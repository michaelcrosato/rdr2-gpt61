#!/usr/bin/env python3
"""Inspect genuine field, cargo, processing and completed Hunt Saves publicly.

Imports untouched game-generated files through the visible Import menu. Uses
ordinary controls, with read-only UI/camera/menu-Save observations. This is
responsive presentation evidence, not a complete mobile/input playthrough.
"""

from campaign_save import observed_save
import argparse
import asyncio
import json
import math
import os
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE', 'ubuntu24.04-x64')
from playwright.async_api import async_playwright

PROFILES = [('webkit','se-portrait',375,667,True),('webkit','se-landscape',667,375,True),
            ('webkit','phone-landscape',756,352,True),('chromium','android',412,915,True),
            ('chromium','foldable',690,829,True),('webkit','tablet',768,1024,True),
            ('chromium','desktop',1440,900,False),('webkit','desktop',1440,900,False),
            ('firefox','desktop',1440,900,False),('chromium','ultrawide',3440,1440,False)]

HUNT = 'snowbound-a-quiet-table'


async def check(playwright, args, profile):
    engine, name, width, height, mobile = profile
    browser = await getattr(playwright, engine).launch()
    page = await browser.new_page(viewport={'width': width, 'height': height},
                                  has_touch=mobile, is_mobile=mobile)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    prefix = f'{engine}-{name}'
    result = {'profile': prefix, 'width': width, 'height': height,
              'errors': errors, 'cases': [], 'passed': False}

    async def capture(label):
        measurements = await page.evaluate('''() => {
          const box = selector => { const e = document.querySelector(selector), r = e.getBoundingClientRect();
            return e.hidden || getComputedStyle(e).display === 'none' ? null : {x:r.x,y:r.y,w:r.width,h:r.height}; };
          return {overflow:document.documentElement.scrollWidth > innerWidth,
            objective:box('.objective'),joystick:box('#joystick'),engineErrors:My3D2dge.current.errors,
            mission:document.querySelector('#mission-name').textContent,
            stage:document.querySelector('#mission-count').textContent};
        }''')
        a, b = measurements['objective'], measurements['joystick']
        assert not a or not b or not (a['x'] < b['x']+b['w'] and a['x']+a['w'] > b['x']
            and a['y'] < b['y']+b['h'] and a['y']+a['h'] > b['y']), measurements
        assert not measurements['overflow'] and not measurements['engineErrors'], measurements
        filename = f'{prefix}-{label}.png'
        await page.screenshot(path=str(args.output/filename))
        result['cases'].append({'label': label, 'screenshot': filename, 'measurements': measurements})

    async def import_save(label):
        filename = args.source_dir/f'{label}-state.json'
        expected = json.loads(filename.read_text())
        await page.goto(args.url)
        await page.wait_for_function('globalThis.My3D2dge?.current?._running')
        await page.locator('[data-panel="menu"]').click()
        async with page.expect_file_chooser() as chooser:
            await page.locator('[data-command="import"]').click()
        await (await chooser.value).set_files(str(filename))
        await page.locator('#welcome').wait_for(state='hidden')
        await page.wait_for_timeout(180)
        assert await page.locator('#mission-name').inner_text() == 'A Quiet Table'
        result.setdefault('sources', []).append(str(filename.resolve()))
        return expected

    async def save():
        await page.locator('[data-panel="menu"]').click()
        await page.locator('[data-command="save"]').click()
        raw = await observed_save(page)
        await page.locator('[data-command="resume"]').click()
        await page.wait_for_timeout(120)
        assert raw['version'] == 3 and raw['failure'] is None
        return raw

    async def walk(route):
        for tx, ty in route:
            for _ in range(130):
                position = await page.evaluate('''() => {const g=My3D2dge.current;
                    return {x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by};}''')
                dx, dy = tx-position['x'], ty-position['y']
                if math.hypot(dx, dy) < 9:
                    break
                horizontal = abs(dx) > abs(dy)
                key = ('d' if dx > 0 else 'a') if horizontal else ('s' if dy > 0 else 'w')
                await page.keyboard.down(key)
                await page.wait_for_timeout(min(450, max(40, abs(dx if horizontal else dy)/85*1000)))
                await page.keyboard.up(key)
                await page.wait_for_timeout(65)
            else:
                raise AssertionError(f'Actual setup movement cannot reach {tx},{ty}')

    async def interact(text):
        await page.wait_for_function('''text => !document.querySelector('#interact').hidden &&
            document.querySelector('#interaction-label').textContent.includes(text)''', arg=text)
        await page.locator('#interact').click()
        await page.wait_for_timeout(120)

    try:
        await import_save('04-bank')
        await capture('bank')
        await interact('Read signs')
        observed = await save()
        assert observed['campaign']['missions'][HUNT]['tracks']['overlay'] is True
        await capture('signs')
        await page.locator('[data-panel="map"]').click()
        assert await page.locator('#panel-title').inner_text() == 'Willow Run'
        assert await page.locator('.willow-map').count() == 1
        await capture('willow-map')
        await page.locator('#close-panel').click()
        await import_save('07-loaded')
        observed = await save()
        bodies = [observed['entities'][identifier] for identifier in ['willow-creek-doe', 'willow-cedar-buck']]
        assert {body['attachment']['targetId'] for body in bodies} == {'copper', 'bracken'}
        assert all(body['dead'] and body['attachment']['type'] == 'large-load' for body in bodies)
        await capture('two-loads')
        await import_save('08-bear')
        await capture('gorge')
        await import_save('10-benches')
        await capture('two-benches')
        await walk([(175, 1220)])
        await interact('field skinning knife')
        await walk([(160, 1245)])
        await interact('Skin your deer')
        await page.wait_for_timeout(1600)
        await capture('skinning')
        await import_save('11-processed')
        observed = await save()
        assert observed['camp']['pantry']['rawVenison'] == 12
        assert len([item for item in observed['itemInstances'].values() if item['kind'] == 'deer-hide']) == 2
        await page.locator('[data-panel="satchel"]').click()
        assert await page.locator('#panel-body').get_by_text('Quality 3 / 3', exact=False).count() == 2
        await capture('hides-and-tools')
        await page.locator('#close-panel').click()
        await import_save('12-complete')
        before = await save()
        assert before['campaign']['missions'][HUNT]['status'] == 'completed'
        await capture('shared-table')
        await page.locator('[data-panel="journal"]').click()
        assert await page.locator('[data-command="story"][data-id="replay:snowbound-a-quiet-table"]').count() == 1
        await capture('completed-journal')
        await page.locator('#close-panel').click()
        await page.locator('[data-panel="menu"]').click()
        await page.locator('#text-size').select_option('1.4')
        await page.locator('#reduce-motion').check()
        await page.locator('[data-command="save"]').click()
        await page.locator('[data-command="resume"]').click()
        await page.reload()
        await page.locator('#continue-game').click()
        await page.wait_for_timeout(250)
        after = await save()
        for key in ['weapons', 'inventory', 'camp', 'itemInstances', 'checkpoints', 'missionEntries']:
            assert after[key] == before[key], key
        assert after['campaign']['missions'][HUNT]['transactions'] == before['campaign']['missions'][HUNT]['transactions']
        await capture('completed-reload-large-text')
        result['durableReloadVerified'] = True
        result['passed'] = not errors
    except Exception as error:
        result['failure'] = str(error) or type(error).__name__
        await page.screenshot(path=str(args.output/f'{prefix}-failure.png'))
    finally:
        await browser.close()
    print(json.dumps(result), flush=True)
    return result


async def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(2)
    async with async_playwright() as playwright:
        async def bounded(profile):
            async with semaphore:
                return await check(playwright, args, profile)
        profiles = PROFILES if not args.profile else [p for p in PROFILES if f'{p[0]}-{p[1]}' == args.profile]
        results = await asyncio.gather(*(bounded(profile) for profile in profiles))
    summary = {'passed': all(r['passed'] for r in results), 'results': results,
               'caveat': 'Public import of genuine game-generated Saves; ordinary controls for focused processing/panels/preferences. Setup movement uses keys on all profiles. This is responsive presentation, not a full touch/controller playthrough or real Safari hardware.'}
    (args.output/'report.json').write_text(json.dumps(summary, indent=2)+'\n')
    return summary['passed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('/tmp/dust-mercy-hunt-field-ui'))
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--profile')
    raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
