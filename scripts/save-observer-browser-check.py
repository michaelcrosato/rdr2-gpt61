"""Real post-ack read races using normal Import/Save/New controls.

A native readwrite transaction with no writes delays the observer's real readonly
transaction. A temporary API wrapper observes its enqueue only; it fabricates no
data or result. No gameplay state/API calls or assigned journey fields.
"""
from __future__ import annotations

import argparse
import asyncio
import gzip
import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE', 'ubuntu24.04-x64')
from playwright.async_api import async_playwright
from campaign_save import observed_save_bytes, wait_for_save_commit

ROOT = Path(__file__).resolve().parent.parent


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def application_hashes(root: Path) -> dict[str, str]:
    paths = [root / name for name in ['index.html', 'styles.css', 'my-3d2dge-agent.js', 'scripts/campaign_save.py']]
    paths += sorted((root / 'src').rglob('*.js')) + sorted((root / 'content').rglob('*.js'))
    return {str(path.relative_to(root)): sha(path.read_bytes()) for path in paths}


async def hold_database(page):
    await page.evaluate("""async () => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves');r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);});
      const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
      window.observerLockRelease=false;window.observerLockEnded=false;
      await new Promise((resolve,reject)=>{
        let started=false;
        function ping(){const r=store.get('last-slot');r.onsuccess=()=>{if(!started){started=true;resolve();}if(!window.observerLockRelease)ping();};}
        tx.oncomplete=()=>{window.observerLockEnded=true;db.close();};
        tx.onabort=()=>{window.observerLockEnded=true;db.close();reject(tx.error||new Error('Test lock aborted'));};
        ping();
      });
    }""")


async def watch_read_enqueue(page):
    await page.evaluate("""() => {
      window.observerOriginalTransaction=IDBDatabase.prototype.transaction;
      window.observerReadEnqueues=0;
      IDBDatabase.prototype.transaction=function(names,mode,...args){
        const tx=window.observerOriginalTransaction.call(this,names,mode,...args);
        if(mode==='readonly'&&(names==='snapshots'||Array.isArray(names)&&names.includes('snapshots')))window.observerReadEnqueues++;
        return tx;
      };
    }""")


async def restore_read_watch(page):
    await page.evaluate("""() => {IDBDatabase.prototype.transaction=window.observerOriginalTransaction;}""")


async def release_database(page):
    await page.evaluate('window.observerLockRelease=true')
    await page.wait_for_function('window.observerLockEnded')
    # A real readonly barrier follows both the observer and queued application
    # Save. It acknowledges no gameplay state and changes no stored value.
    await page.evaluate("""async () => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves');r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);});
      try{await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readonly');t.objectStore('snapshots').get('last-slot');t.oncomplete=resolve;t.onabort=()=>reject(t.error);});}finally{db.close();}
    }""")


async def direct_stored_campaign(page):
    return await page.evaluate("""async () => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves');r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);});
      try{return await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readonly'),r=t.objectStore('snapshots').get('dust-mercy.campaign.v1');let raw;r.onsuccess=()=>{raw=r.result;};t.oncomplete=()=>resolve(raw);t.onabort=()=>reject(t.error);});}finally{db.close();}
    }""")


async def must_refuse(task, expected_message):
    try:
        await asyncio.wait_for(task, 15)
    except ValueError as error:
        assert expected_message in str(error), str(error)
        return str(error)
    raise AssertionError('Observer returned journey bytes after its acknowledged request changed')


async def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    source = args.source_save or args.app_root / 'tests/fixtures/journey-v3-rescue-complete.json.gz'
    source_original = source.read_bytes()
    source_raw = gzip.decompress(source_original) if source.suffix == '.gz' else source_original
    imported = args.output / 'unchanged-original-source.json'
    imported.write_bytes(source_raw)
    initial_hashes = application_hashes(args.app_root)
    own_paths = [Path(__file__), Path(__file__).with_name('campaign_save.py')]
    own_hashes = {str(path): sha(path.read_bytes()) for path in own_paths}
    report = {
        'passed': False, 'status': 'Started; terminal errors retain a failed receipt',
        'kind': 'normal-ui-post-ack-save-observer-read-races', 'url': args.url,
        'source': str(source), 'sourceSHA256': sha(source_original),
        'uncompressedOriginalSHA256': sha(source_raw), 'sourceHashesAtStart': initial_hashes,
        'observerAndHarnessHashesAtStart': own_hashes, 'results': [],
        'provenance': 'Unchanged genuine public-control Rescue-complete fixture, normal file Import/Save/New controls. A native no-write transaction lock and enqueue-only API wrapper isolate the post-ack read interval; no gameplay state assignments or fabricated Saves.',
        'limitations': ['This is storage-observer concurrency proof, not a fresh gameplay route.', 'WebKit profiles approximate Safari engine; no real iOS hardware.'],
    }

    def write_report():
        (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')

    write_report()
    async with async_playwright() as p:
        for engine in args.engines.split(','):
            browser = await getattr(p, engine).launch()
            page = await browser.new_page(viewport={'width': 375, 'height': 667} if engine == 'webkit' else {'width': 1280, 'height': 900}, has_touch=engine == 'webkit', is_mobile=engine == 'webkit')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                await page.goto(args.url)
                await page.locator('[data-panel="menu"]').click()
                async with page.expect_file_chooser() as selecting:
                    await page.locator('[data-command="import"]').click()
                await (await selecting.value).set_files(str(imported))
                await page.locator('#welcome').wait_for(state='hidden')
                await page.locator('[data-panel="menu"]').click()
                await page.locator('[data-command="save"]').click()
                wanted = await page.locator('#save-status').get_attribute('data-save-request')
                assert await wait_for_save_commit(page, expected_commit=wanted) == wanted
                before = await observed_save_bytes(page, expected_commit=wanted)

                await hold_database(page)
                await watch_read_enqueue(page)
                observer = asyncio.create_task(observed_save_bytes(page, expected_commit=wanted))
                await page.wait_for_function('window.observerReadEnqueues>0')
                assert await page.locator('#save-status').get_attribute('data-save-request') == wanted
                await restore_read_watch(page)
                await page.locator('[data-command="save"]').click()
                next_request = await page.locator('#save-status').get_attribute('data-save-request')
                assert next_request != wanted
                await page.screenshot(path=str(args.output / f'{engine}-post-ack-superseding-save.png'))
                await release_database(page)
                supersession = await must_refuse(observer, 'while its bytes were read')
                assert await wait_for_save_commit(page, expected_commit=next_request) == next_request
                latest = await observed_save_bytes(page, expected_commit=next_request)
                assert latest == before, 'both paused manual Saves capture the same exact graph'
                old_binding = await must_refuse(asyncio.create_task(observed_save_bytes(page, expected_commit=wanted)), 'superseded')

                await hold_database(page)
                await watch_read_enqueue(page)
                # The default API still binds its own acknowledged request.
                observer = asyncio.create_task(observed_save_bytes(page))
                await page.wait_for_function('window.observerReadEnqueues>0')
                await restore_read_watch(page)
                await page.locator('[data-command="new"]').click()
                await page.locator('[data-command="confirm-new"]').click()
                await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='unsaved'&&!document.querySelector('#save-status').dataset.saveRequest")
                await release_database(page)
                epoch = await must_refuse(observer, 'while its bytes were read')
                assert await direct_stored_campaign(page) == latest, 'reviewed old authority remains exact; the new displayed journey was never saved'
                assert 'Journey saved' not in await page.locator('#save-status').inner_text()
                await page.screenshot(path=str(args.output / f'{engine}-post-ack-new-journey-unsaved.png'))
                assert not errors, errors
                report['results'].append({'engine': engine, 'passed': True, 'capturedRequest': wanted, 'supersedingRequest': next_request, 'postAckSupersessionRefused': supersession, 'outerExpectedCommitRefusedNewerAcknowledgement': old_binding, 'defaultApiPostAckEpochRefused': epoch, 'priorBytesRetainedExact': True, 'pausedSameGraphSHA256': sha(latest.encode()), 'pageErrors': errors})
                write_report()
                print(engine, flush=True)
            except Exception as error:
                report['failure'] = f'{engine}: {error}'
                write_report()
                raise
            finally:
                await browser.close()
    report['sourceHashesAtEnd'] = application_hashes(args.app_root)
    report['observerAndHarnessHashesAtEnd'] = {str(path): sha(path.read_bytes()) for path in own_paths}
    report['sourcesStable'] = report['sourceHashesAtEnd'] == initial_hashes
    report['observerAndHarnessStable'] = report['observerAndHarnessHashesAtEnd'] == own_hashes
    report['originalSourceUnchanged'] = sha(source.read_bytes()) == report['sourceSHA256']
    report['passed'] = len(report['results']) == len(args.engines.split(',')) and all(report[key] for key in ['sourcesStable', 'observerAndHarnessStable', 'originalSourceUnchanged'])
    report['status'] = 'Terminal'
    write_report()
    return report['passed']


parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173')
parser.add_argument('--app-root', type=Path, default=ROOT)
parser.add_argument('--source-save', type=Path)
parser.add_argument('--engines', default='chromium,webkit,firefox')
parser.add_argument('--output', type=Path, default=Path('/tmp/dust-mercy-save-observer-read-races'))
if __name__ == '__main__':
    raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
