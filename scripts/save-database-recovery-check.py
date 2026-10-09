"""Real frontend recovery previews and delayed native-transaction acknowledgments.
Storage setup uses exact unchanged game bytes and never assigns gameplay fields.
"""
import argparse,asyncio,gzip,hashlib,json,os
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
from campaign_save import wait_for_save_commit,observed_save_bytes
ROOT=Path(__file__).resolve().parent.parent
async def db_raw(page):
 return await page.evaluate("""async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readonly'),r=t.objectStore('snapshots').get('dust-mercy.campaign.v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}""")
async def hold(page):
 await page.evaluate("""async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}),t=db.transaction('snapshots','readwrite'),s=t.objectStore('snapshots');window.storageRelease=false;window.storageHoldEnded=false;function ping(){const r=s.get('last-slot');r.onsuccess=()=>{if(!window.storageRelease)ping()}}ping();t.oncomplete=()=>{window.storageHoldEnded=true;db.close()};}""")
async def release(page):
 await page.evaluate('window.storageRelease=true');await page.wait_for_function('window.storageHoldEnded');await page.evaluate("""async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('dust-mercy.saves');r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const t=db.transaction('snapshots','readonly');t.objectStore('snapshots').get('last-slot');t.oncomplete=resolve});db.close()}""")
async def main(args):
 args.output.mkdir(parents=True,exist_ok=True);
 if args.source is None:
  args.source=args.output/'unchanged-native-source.json';args.source.write_bytes(gzip.decompress((ROOT/'tests/fixtures/save-v4-four-stories-opening-replay-native.json.gz').read_bytes()))
 (args.output/'report.json').write_text('{"passed":false,"status":"Started"}\n');rows=[]
 primary=args.source.read_text();recovery=gzip.decompress((ROOT/'tests/fixtures/journey-v3-rescue-complete.json.gz').read_bytes()).decode()
 async with async_playwright() as p:
  for engine in args.engines.split(','):
   browser=await getattr(p,engine).launch(headless=not args.headful);context=await browser.new_context(viewport={'width':375,'height':667} if engine=='webkit' else {'width':1280,'height':900},has_touch=engine=='webkit',is_mobile=engine=='webkit');page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/__recovery_setup',lambda route:route.fulfill(body='<!doctype html><title>Recovery fixture setup</title>',content_type='text/html'))
   await page.goto(args.url+'/__recovery_setup');await page.evaluate("""async ([primary,recovery])=>{localStorage.setItem('dust-mercy.campaign.v1',recovery);localStorage.setItem('dust-mercy.journey.v1',recovery);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite'),s=t.objectStore('snapshots');s.put(primary,'dust-mercy.campaign.v1');s.put('dust-mercy.campaign.v1','last-slot');t.oncomplete=resolve;t.onabort=()=>reject(t.error)});db.close()}""",[primary,recovery])
   await page.goto(args.url);await page.locator('#continue-game').click();await page.locator('[data-panel="menu"]').click();assert await db_raw(page)==primary
   await page.locator('[data-command="panel"][data-id="recoveries"]').click();await page.locator('[data-command="recover-load"][data-id="dust-mercy.campaign.v1"]').click();await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='preview'");assert await db_raw(page)==primary
   await page.locator('[data-command="panel"][data-id="recoveries"]').click()
   async with page.expect_download() as exporting:await page.locator('[data-command="recover-export"][data-id="dust-mercy.campaign.v1"]').click()
   file=args.output/f'{engine}-original-recovery-export.json';await (await exporting.value).save_as(str(file));assert file.read_bytes()==recovery.encode()
   if engine=='chromium':
    cdp=await context.new_cdp_session(page);await cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':False})
   await page.evaluate("()=>{window.previewEventCounts={blur:0,visibility:0};addEventListener('blur',()=>previewEventCounts.blur++);document.addEventListener('visibilitychange',()=>previewEventCounts.visibility++)}");other=await context.new_page();await other.goto(args.url+'/__recovery_setup');
   if engine=='chromium':
    other_cdp=await context.new_cdp_session(other);await other_cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':False})
   await other.bring_to_front();hidden=await page.evaluate('document.visibilityState');await page.bring_to_front();await other.close();events=await page.evaluate('window.previewEventCounts');assert await db_raw(page)==primary,'actual focus/tab/export events cannot adopt a preview'
   await page.reload();await page.locator('#continue-game').click();assert await db_raw(page)==primary;await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="panel"][data-id="recoveries"]').click();await page.locator('[data-command="recover-load"][data-id="dust-mercy.campaign.v1"]').click()
   # A native write transaction holds the real DB lock while the application's
   # manual save snapshot is captured. It writes no game values itself.
   await hold(page);await page.locator('[data-command="save"]').click();await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='saving'")
   await page.locator('[data-command="story"][data-id="replay:snowbound-the-last-warm-light"]').click();await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='preview'");await release(page)
   assert await page.locator('#save-status').get_attribute('data-save-state')=='preview';assert 'Journey saved' not in await page.locator('#save-status').inner_text()
   pre_transition=json.loads(await db_raw(page));assert pre_transition['replayCanonical'] is None,'older request commits its captured correct world, not the newer displayed replay'
   await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await wait_for_save_commit(page);adopted=json.loads(await observed_save_bytes(page));assert adopted['replayCanonical'] is not None
   await page.locator('[data-command="panel"][data-id="recoveries"]').click();assert await page.locator('[data-command="recover-export"]').count()>=1,'prior exact DB authority remains recoverable after explicit adoption';await page.screenshot(path=str(args.output/f'{engine}-recovery-menu.png'))
   await page.locator('#close-panel').click();await page.locator('[data-panel="menu"]').click();await hold(page);await page.locator('[data-command="save"]').click();await page.locator('[data-command="new"]').click();await page.locator('[data-command="confirm-new"]').click();await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='unsaved'");await release(page)
   assert await page.locator('#save-status').get_attribute('data-save-state')=='unsaved';assert 'Journey saved' not in await page.locator('#save-status').inner_text();assert not errors,errors
   rows.append({'engine':engine,'passed':True,'exactRecoveryExportSHA256':hashlib.sha256(file.read_bytes()).hexdigest(),'previewDidNotAdoptOnExportFocusReload':True,'observedBackgroundVisibility':hidden,'actualPreviewEvents':events,'olderManualCompletionDidNotAcknowledgeNewReplay':True,'explicitSaveAdoptedAndKeptPriorAuthorityRecoverable':True,'olderCompletionDidNotAcknowledgeNewWorld':True,'pageErrors':errors});await browser.close();print(engine,flush=True)
 report={'passed':all(r['passed'] for r in rows),'kind':'real-frontend-recovery-preview-and-delayed-transaction-races','sourceSHA256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'recoverySHA256':hashlib.sha256(recovery.encode()).hexdigest(),'results':rows,'provenance':'Exact unchanged native earned primary and original public-byte legacy source are installed as storage fixtures. Subsequent review/export/manualSave/replay/new-world actions use normal visible UI. Native transaction locks deliberately delay persistence; no gameplay state/API assignments.','limitations':['Native primary source carries its explicit initial camp proximity fixture limits.','These storage/UI checks are not a fresh public gameplay route or real iOS hardware.']};(args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');return report['passed']
parser=argparse.ArgumentParser();parser.add_argument('--headful',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4196');parser.add_argument('--engines',default='chromium,webkit,firefox');parser.add_argument('--source',type=Path,default=None);parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-indexeddb-recovery-ui'))
raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
