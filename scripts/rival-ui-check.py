#!/usr/bin/env python3
"""Bounded public Rival UI checks using untouched game-generated continuations.

Imports via the visible file chooser, then uses ordinary buttons, keyboard and
browser touchscreen taps. Evaluations only read DOM, renderer errors and Saves.
No game-state writes, teleports, synthetic Saves or injected input fixtures.
"""

from campaign_save import observed_save
import argparse
import asyncio
import hashlib
import json
import os
import traceback
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE', 'ubuntu24.04-x64')
from playwright.async_api import async_playwright

RIVAL = 'snowbound-the-names-they-took'
REPO = Path(__file__).resolve().parent.parent
SOURCE_FILES = ['index.html', 'styles.css', 'src/game.js', 'src/campaign-journey.js',
                'src/rival-mission.js', 'src/rival-aftermath.js', 'src/rival-dialogue-validation.js',
                'content/campaign/bellwether-works.js', 'src/bellwether-renderer.js',
                'src/rival-actors.js', 'src/rival-animation.js', 'src/rival-rigs.js']
UI_SOURCE_FILES = ['index.html', 'styles.css', 'src/game.js', 'src/bellwether-renderer.js',
                   'src/rival-actors.js', 'src/rival-animation.js', 'src/rival-rigs.js']
def source_hashes():
    return {name: hashlib.sha256((REPO/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
PROFILES = [
    ('chromium', 'phone-320', 320, 568, True),
    ('webkit', 'phone-320', 320, 568, True),
    ('webkit', 'phone-375', 375, 667, True),
    ('chromium', 'android', 412, 915, True),
    ('webkit', 'landscape-667', 667, 375, True),
    ('chromium', 'landscape-756', 756, 352, True),
    ('chromium', 'foldable', 690, 829, True),
    ('webkit', 'tablet', 768, 1024, True),
    ('chromium', 'tablet-landscape', 1024, 768, True),
    ('chromium', 'desktop', 1440, 900, False),
    ('webkit', 'desktop', 1440, 900, False),
    ('firefox', 'desktop', 1440, 900, False),
    ('chromium', 'ultrawide', 3440, 1440, False),
]
MEASURE = '''() => {
  const selectors={objective:'.objective',joystick:'#joystick',touchActions:'.touch-actions',
    toolbar:'#campaign-controls',interaction:'#interact',reload:'#reload',topbar:'.topbar',
    close:'#close-panel',panel:'#panel',conversation:'#conversation'};
  const box=e=>{if(!e||!e.getClientRects().length||getComputedStyle(e).visibility==='hidden')return null;
    if(e.matches('dialog')&&!e.open)return null;const r=e.getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const boxes=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,box(document.querySelector(selector))]));
  const overlap=(a,b)=>a&&b&&a.x<b.x+b.w-1&&a.x+a.w>b.x+1&&a.y<b.y+b.h-1&&a.y+a.h>b.y+1;
  const pairs=[['objective','joystick'],['objective','touchActions'],['objective','toolbar'],['toolbar','joystick'],
    ['toolbar','touchActions'],['toolbar','topbar'],['interaction','joystick'],['interaction','touchActions']];
  const overlaps=pairs.filter(([a,b])=>overlap(boxes[a],boxes[b]));
  const offenders=[...document.querySelectorAll('body *')].filter(e=>{const r=box(e);
    return r&&(r.x< -1||r.x+r.w>innerWidth+1)&&!e.matches('canvas,svg,path,line,polyline,polygon,circle,text,defs,pattern,rect');})
    .slice(0,12).map(e=>({tag:e.tagName,id:e.id,class:e.className?.baseVal||e.className}));
  const panelBody=document.querySelector('#panel-body');
  const close=document.querySelector('#close-panel'),cb=box(close);
  const closeHit=cb&&boxes.panel?document.elementFromPoint(cb.x+cb.w/2,cb.y+cb.h/2):null;
  return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
    panelOverflow:!!boxes.panel&&panelBody.scrollWidth>panelBody.clientWidth+1,offenders,boxes,overlaps,
    panelCloseReachable:!boxes.panel||cb&&cb.x>=0&&cb.y>=0&&cb.x+cb.w<=innerWidth&&cb.y+cb.h<=innerHeight&&(closeHit===close||close.contains(closeHit)),
    engineErrors:My3D2dge.current.errors,
    mission:document.querySelector('#mission-name').textContent,
    count:document.querySelector('#mission-count').textContent};
}'''


async def check(playwright, args, profile):
    engine, name, width, height, mobile = profile
    prefix = f'{engine}-{name}'
    result = {'profile': prefix, 'width': width, 'height': height, 'touchEmulation': mobile,
              'cases': [], 'errors': [], 'sources': [], 'failures': [], 'passed': False,
              'sourceHashesAtStart': source_hashes()}
    browser = await getattr(playwright, engine).launch()
    page = await browser.new_page(viewport={'width': width, 'height': height},
                                  has_touch=mobile, is_mobile=mobile)
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    page.on('console', lambda message: result['errors'].append(message.text) if message.type == 'error' else None)
    page.set_default_timeout(10000)

    async def press(locator):
        await (locator.tap() if mobile else locator.click())

    async def capture(label):
        await page.wait_for_function('''() => document.querySelector('#panel').open ||
            document.querySelector('#conversation').open || !document.querySelector('#campaign-controls').hidden''')
        measures = await page.evaluate(MEASURE)
        filename = f'{prefix}-{label}.png'
        await page.screenshot(path=str(args.output/filename))
        result['cases'].append({'label': label, 'screenshot': filename, 'measurements': measures})
        if measures['overflow'] or measures['panelOverflow'] or measures['engineErrors'] or measures['overlaps'] or not measures['panelCloseReachable']:
            result['failures'].append({'case': label, 'reason': 'Overflow, overlap, unreachable close or engine error', 'measurements': measures})

    async def import_save(path):
        original = path.read_bytes()
        source = json.loads(original)
        assert source['version'] == 4 and source['failure'] is None, 'A genuine nonfailed v4 public Save is required'
        assert source['campaign']['activeMissionId'] == RIVAL
        await page.goto(args.url)
        await page.wait_for_function('globalThis.My3D2dge?.current?._running')
        await press(page.locator('[data-panel="menu"]'))
        async with page.expect_file_chooser() as chooser:
            await press(page.locator('[data-command="import"]'))
        await (await chooser.value).set_files(str(path))
        await page.locator('#welcome').wait_for(state='hidden')
        await page.wait_for_timeout(180)
        assert await page.locator('#mission-name').inner_text() == 'The Names They Took'
        assert path.read_bytes() == original, 'Source Save bytes were never rewritten'
        result['sources'].append({'path': str(path.resolve()), 'sha256': hashlib.sha256(original).hexdigest(),
                                  'version': 4, 'stage': source['campaign']['missions'][RIVAL]['mission']['stage']})
        return source

    async def saved():
        await press(page.locator('[data-panel="menu"]'))
        await press(page.locator('[data-command="save"]'))
        raw = await observed_save(page)
        await press(page.locator('[data-command="resume"]'))
        await page.locator('#campaign-controls').wait_for(state='visible')
        await page.wait_for_timeout(40)
        assert raw['version'] == 4 and raw['failure'] is None
        return raw

    async def nearby(identifier=None):
        await press(page.locator('[data-story-action="nearby-actions"]'))
        assert await page.locator('#panel-title').inner_text() == 'Within reach'
        options = await page.locator('[data-command="nearby"]').evaluate_all('(es)=>es.map(e=>({id:e.dataset.id,label:e.textContent,disabled:e.disabled}))')
        assert options, 'The menu exposes genuine offered actions'
        if identifier:
            await press(page.locator(f'[data-command="nearby"][data-id="{identifier}"]'))
            await page.wait_for_timeout(130)
        return options

    try:
        if args.paint_only:
            await import_save(args.source_dir/args.equipment_file)
            await press(page.locator('[data-panel="menu"]'))
            await page.locator('#text-size').scroll_into_view_if_needed()
            await page.locator('#text-size').select_option('1.4')
            await page.locator('#mute-audio').check()
            await page.locator('#reduce-motion').check()
            await page.locator('#text-size').scroll_into_view_if_needed()
            if not mobile:
                await page.locator('#panel-body').hover()
                await page.mouse.wheel(0, 180)
                await page.wait_for_timeout(120)
            result['headingPaint'] = await page.locator('.panel-heading').evaluate('(e)=>({background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow,position:getComputedStyle(e).position})')
            result['headingPaint']['dialogScrollTop'] = await page.locator('#panel').evaluate('(e)=>e.scrollTop')
            result['headingPaint']['title'] = await page.locator('#panel-title').evaluate('''e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,display:s.display,visibility:s.visibility,color:s.color,fontSize:s.fontSize,box:{x:r.x,y:r.y,w:r.width,h:r.height}}}''')
            await capture('preferences-heading-paint')
            await press(page.locator('#close-panel'))
            result['passed'] = not result['errors'] and not result['failures']
            return result
        await import_save(args.source_dir/args.accepted_file)
        await capture('accepted')
        await nearby()
        await capture('accepted-nearby')
        await press(page.locator('#close-panel'))
        await import_save(args.source_dir/args.equipment_file)
        await capture('equipped')
        before = await saved()
        await nearby()
        await capture('equipment-nearby')
        await press(page.locator('#close-panel'))
        await press(page.locator('[data-panel="satchel"]'))
        assert await page.locator('[data-command="equipment"][data-id="equip:tern-carbine"]').count() == 1
        assert await page.locator('[data-command="equipment"][data-id="equip:working-lariat"]').count() == 1
        await capture('weapon-tool-selectors')
        await press(page.locator('[data-command="equipment"][data-id="equip:working-lariat"]'))
        assert await page.locator('[data-command="equipment"][data-id="equip:working-lariat"]').inner_text() == 'Equipped'
        await press(page.locator('#close-panel'))
        selected_tool = await saved()
        assert selected_tool['entities']['mara']['equippedWeaponId'] == 'working-lariat'
        assert selected_tool['weapons']['working-lariat']['capacity'] == 0
        result['lariatSelectorVerified'] = True
        await capture('lariat-selected')
        await press(page.locator('[data-panel="satchel"]'))
        await press(page.locator('[data-command="equipment"][data-id="equip:tern-carbine"]'))
        await press(page.locator('#close-panel'))
        await press(page.locator('#reload'))
        after_reload = await saved()
        assert after_reload['weapons']['tern-carbine']['ammo'] == before['weapons']['tern-carbine']['ammo']
        assert after_reload['weapons']['tern-carbine']['reserve'] == before['weapons']['tern-carbine']['reserve']
        result['reloadCoverage'] = 'Visible full-chamber reload no-op conserves rounds; partial reload cycle is not covered.'
        await nearby('rival:postpone')
        assert await page.locator('#speaker').inner_text() == 'Tomas Reed'
        await capture('postpone-dialog-standard')
        await press(page.locator('[data-choice="leave"]'))
        await press(page.locator('[data-panel="menu"]'))
        await page.locator('#text-size').scroll_into_view_if_needed()
        await page.locator('#text-size').select_option('1.4')
        await page.locator('#mute-audio').check()
        await page.locator('#reduce-motion').check()
        await page.locator('#text-size').scroll_into_view_if_needed()
        await capture('preferences')
        await press(page.locator('[data-command="resume"]'))
        await nearby('rival:postpone')
        await capture('postpone-dialog-extra-large')
        await press(page.locator('[data-choice="leave"]'))
        before_reload = await saved()
        await page.reload()
        await press(page.locator('#continue-game'))
        await page.wait_for_timeout(180)
        after = await saved()
        for key in ['inventory', 'weapons']:
            assert after[key] == before_reload[key], key
        assert after['campaign']['missions'][RIVAL]['transactions'] == before_reload['campaign']['missions'][RIVAL]['transactions']
        assert after['campaign']['missions'][RIVAL]['mission']['stage'] == 1
        await press(page.locator('[data-panel="menu"]'))
        assert await page.locator('#text-size').input_value() == '1.4'
        assert await page.locator('#mute-audio').is_checked()
        assert await page.locator('#reduce-motion').is_checked()
        await press(page.locator('[data-command="resume"]'))
        result['preferencesAndEquipmentReload'] = True
        await capture('reloaded-preferences')
        scope_path = args.source_dir/args.scope_file
        if scope_path.exists():
            await import_save(scope_path)
            await nearby('sightglass:raise')
            baseline = await saved()
            assert baseline['campaign']['missions'][RIVAL]['scope']['raised'] is True
            await capture('scope-before')
            await press(page.locator('[data-story-action="scope:zoom-in"]'))
            zoomed = await saved()
            assert zoomed['campaign']['missions'][RIVAL]['scope']['zoom'] > baseline['campaign']['missions'][RIVAL]['scope']['zoom']
            await capture('scope-zoom')
            await press(page.locator('[data-story-action="scope:zoom-out"]'))
            await page.keyboard.down('d')
            await page.wait_for_timeout(650)
            await page.keyboard.up('d')
            panned = await saved()
            a, b = baseline['campaign']['missions'][RIVAL]['scope'], panned['campaign']['missions'][RIVAL]['scope']
            assert b['camera']['x'] > a['camera']['x']+20
            for axis in ['x', 'y', 'z']:
                assert abs(panned['entities']['mara'][axis]-baseline['entities']['mara'][axis]) < .1, 'Scope panning leaves Mara at the viewpoint'
            result['scopeCoverage'] = {'covered': True, 'mode': 'Visible zoom buttons and ordinary keyboard pan on every viewport; no native touch dragging/controller claim.'}
            await capture('scope-panned')
        else:
            result['scopeCoverage'] = {'covered': False, 'reason': 'No genuine game-generated phase-three continuation was supplied.'}
        result['passed'] = not result['errors'] and not result['failures']
    except Exception as error:
        result['failures'].append({'reason': str(error) or type(error).__name__, 'traceback': traceback.format_exc()})
        await page.screenshot(path=str(args.output/f'{prefix}-failure.png'))
    finally:
        result['sourceHashesAtEnd'] = source_hashes()
        result['sourcesStable'] = result['sourceHashesAtStart'] == result['sourceHashesAtEnd']
        result['uiSourcesStable'] = all(result['sourceHashesAtStart'][name] == result['sourceHashesAtEnd'][name] for name in UI_SOURCE_FILES)
        result['backendFilesChangedDuringProfile'] = [name for name in SOURCE_FILES if name not in UI_SOURCE_FILES and result['sourceHashesAtStart'][name] != result['sourceHashesAtEnd'][name]]
        if not result['uiSourcesStable']:
            result['failures'].append({'reason': 'UI source files changed during this exploratory profile; rerun against the settled UI implementation.'})
            result['passed'] = False
        await browser.close()
    print(json.dumps(result), flush=True)
    return result


async def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    selected = PROFILES if not args.profile else [p for p in PROFILES if f'{p[0]}-{p[1]}' in args.profile]
    assert selected, 'At least one known profile is required'
    semaphore = asyncio.Semaphore(args.parallel)
    async with async_playwright() as playwright:
        async def bounded(profile):
            async with semaphore:
                return await check(playwright, args, profile)
        results = await asyncio.gather(*(bounded(profile) for profile in selected))
    report = {'passed': all(r['passed'] for r in results), 'results': results, 'mode': 'paint-only' if args.paint_only else 'bounded-flow',
              'scope': 'Bounded public UI/import/equipment/dialogue/preferences/viewport/engine checks. Continuations come from public playthrough Saves, including exploratory runs; this does not prove a complete phone mission or full journey.',
              'limitations': ['WebKit phone profiles approximate Safari’s engine; real iOS Safari is unavailable.',
                              'Browser touchscreen taps are emulated, with keyboard scope pan; no physical controller/native multi-touch hardware proof.',
                              'Reload checks a full-chamber no-op; partial reload belongs to separate combat verification.',
                              'UI source stability gates this bounded receipt. Backend hashes and any edits during each profile are retained separately; this is not whole-runtime verification.'],
              'pngInspection': 'Pending agent visual inspection; this script does not claim that screenshots have been inspected.'}
    (args.output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    return report['passed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--accepted-file', default='01-accepted-state.json')
    parser.add_argument('--equipment-file', default='02-gate-party-00.json')
    parser.add_argument('--scope-file', default='04-viewpoint-position.json')
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', type=Path, default=Path('/tmp/dust-mercy-rival-ui'))
    parser.add_argument('--profile', action='append')
    parser.add_argument('--parallel', type=int, default=2)
    parser.add_argument('--paint-only', action='store_true', help='Only verify the latest opaque sticky preferences heading and close control.')
    raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
