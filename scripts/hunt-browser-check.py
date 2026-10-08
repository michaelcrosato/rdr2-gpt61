#!/usr/bin/env python3
"""Check the hunt prelude with normal controls after a public rescue Save import.

Evaluations only observe camera, UI, renderer errors and ordinary menu Saves.
The imported artifact must come from an actual game run. No simulation writes,
teleports or injected mission progress. This is a prelude continuation check,
not evidence of a complete connected campaign or a complete hunt playthrough.
"""
import argparse
import asyncio
import copy
import json
import math
import os
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE', 'ubuntu24.04-x64')
from playwright.async_api import async_playwright

HUNT = 'snowbound-a-quiet-table'
RESCUE = 'snowbound-a-voice-under-ice'
OPENING = 'snowbound-the-last-warm-light'


async def check(p, engine, args):
    out = args.output / engine
    out.mkdir(parents=True, exist_ok=True)
    browser = await getattr(p, engine).launch()
    page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors, events = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda e: errors.append(e.text) if e.type == 'error' else None)
    result = {'browser': engine, 'passed': False, 'errors': errors, 'events': events,
        'sourceSave': str(args.source_save.resolve()), 'sourceVersion': json.loads(args.source_save.read_text())['version'],
        'caveat': 'Public import of an actual completed rescue Save, then ordinary keyboard/mouse controls. Prelude only; no full hunt or fresh connected journey claim.'}

    async def observe():
        return await page.evaluate('''()=>{const g=My3D2dge.current;return {
            x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by,z:g.cam.tz,
            mission:document.querySelector('#mission-name').textContent,
            stage:document.querySelector('#mission-count').textContent,
            objective:document.querySelector('#objective-text').textContent,
            interaction:document.querySelector('#interact').hidden?null:document.querySelector('#interaction-label').textContent,
            dialog:document.querySelector('#conversation').open,
            speaker:document.querySelector('#speaker').textContent,
            engineErrors:g.errors}}''')

    async def key(key, ms=65):
        await page.keyboard.down(key)
        await page.wait_for_timeout(ms)
        await page.keyboard.up(key)
        await page.wait_for_timeout(65)

    async def walk(route):
        for tx, ty in route:
            stuck = 0
            for _ in range(130):
                before = await observe()
                assert not before['dialog'], before
                dx, dy = tx-before['x'], ty-before['y']
                if math.hypot(dx, dy) < 9:
                    break
                horizontal = abs(dx)>abs(dy)
                k = ('d' if dx>0 else 'a') if horizontal else ('s' if dy>0 else 'w')
                await key(k, min(500, max(40, abs(dx if horizontal else dy)/85*1000)))
                after = await observe()
                stuck = stuck+1 if math.hypot(after['x']-before['x'], after['y']-before['y'])<.5 else 0
                assert stuck < 5, f'Actual movement blocked toward {tx},{ty}: {after}'
            else:
                raise AssertionError(f'Actual movement failed to reach {tx},{ty}: {await observe()}')

    async def interact(text):
        await page.wait_for_function("text=>!document.querySelector('#interact').hidden && document.querySelector('#interaction-label').textContent.toLowerCase().includes(text)", arg=text.lower(), timeout=25000)
        await key('e')
        await page.wait_for_timeout(100)

    async def choose(identifier='leave'):
        await page.locator(f'[data-choice="{identifier}"]').click()
        await page.wait_for_timeout(100)

    async def record(label):
        event = {'label': label, **await observe(), 'screenshot': f'{label}.png'}
        await page.screenshot(path=str(out / event['screenshot']))
        events.append(event)
        print(json.dumps({'browser': engine, **event}), flush=True)

    async def save(label):
        assert not (await observe())['dialog']
        await page.locator('[data-panel="menu"]').click()
        await page.locator('[data-command="save"]').click()
        raw = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
        (out/f'{label}.json').write_text(json.dumps(raw, indent=2)+'\n')
        await page.locator('[data-command="resume"]').click()
        assert raw['version']==3 and raw['failure'] is None
        return raw

    try:
        await page.goto(args.url)
        await page.wait_for_function('globalThis.My3D2dge?.current?._running')
        await page.locator('[data-panel="menu"]').click()
        async with page.expect_file_chooser() as chooser:
            await page.locator('[data-command="import"]').click()
        await (await chooser.value).set_files(str(args.source_save.resolve()))
        await page.locator('#welcome').wait_for(state='hidden')
        await page.wait_for_timeout(200)
        baseline = await save('00-imported-rescue-state')
        assert baseline['campaign']['missions'][RESCUE]['mission']['completed']
        assert baseline['campaign']['missions'][HUNT]['status']=='unstarted'
        assert 'juno-ash-bow' not in baseline['weapons']
        opening = copy.deepcopy(baseline['campaign']['missions'][OPENING])
        await record('00-imported-rescue')
        # The kitchen has a physical east doorway. Enter it from the clear
        # corridor between the kitchen and the original medical shelter.
        await walk([(270,1220),(270,1270),(205,1270),(175,1250)])
        await interact('Orla')
        assert (await observe())['speaker']=='Orla Venn'
        await record('01-orla')
        await choose('ask-pantry')
        text = await page.locator('#dialogue-text').inner_text()
        for value, label in [(baseline['camp']['food'],'food portions'),(baseline['camp']['medicine'],'medicine'),(baseline['camp']['materials'],'repair materials')]:
            assert f'{value} {label}' in text, text
        await record('02-pantry')
        await choose()
        await walk([(205,1270),(270,1270),(270,1170),(380,1170),(380,1230),(355,1250)])
        await interact('Moss')
        assert (await observe())['speaker']=='Moss Laird'
        await record('03-moss')
        await choose()
        await walk([(390,1250)])
        await interact('Vera')
        assert (await observe())['speaker']=='Vera Holl'
        await record('04-vera')
        await choose()
        await walk([(380,1230),(380,1170),(270,1170)])
        await interact('Juno')
        assert (await observe())['speaker']=='Juno Mercier'
        await record('05-juno')
        await choose('accept-hunt')
        accepted = await save('06-accepted-invitation-state')
        assert accepted['campaign']['activeMissionId']==HUNT
        assert accepted['campaign']['missions'][HUNT]['mission']['stage']==0
        assert 'juno-ash-bow' not in accepted['weapons']
        assert accepted['inventory'].get('quietRation',0)==0
        await page.reload()
        await page.locator('#continue-game').click()
        await page.wait_for_timeout(200)
        assert (await observe())['mission']=='A Quiet Table'
        await record('06-reloaded-prelude')
        await walk([(270,1270),(205,1298)])
        await interact('flour map')
        await page.wait_for_function("document.querySelector('#mission-count').textContent==='02 / 11'")
        confirmed = await save('07-map-confirmed-state')
        assert confirmed['inventory']['quietRation']==1
        assert confirmed['camp']['pantry']['kitchenStarterFuel']==1
        await record('07-map-confirmed')
        await walk([(205,1270),(270,1270),(270,1170)])
        location = await save('08-rack-approach-state')
        horse = location['entities'][location['party']['mountId']]
        await walk([(horse['x']-25,horse['y'])])
        await page.wait_for_function("!document.querySelector('#interact').hidden && document.querySelector('#interaction-label').textContent.includes('Inspect Juno')", timeout=25000)
        gifted = await save('08-uninspected-bow-state')
        assert gifted['campaign']['missions'][HUNT]['flags']['bowInspected'] is False
        assert gifted['campaign']['missions'][HUNT]['flags']['bowEquipped'] is False
        await page.locator('[data-panel="satchel"]').click()
        bow_button = page.locator('[data-command="equipment"][data-id="equip:juno-ash-bow"]')
        assert await bow_button.is_disabled(), 'Satchel must preserve the physical rack inspection'
        assert await bow_button.inner_text() == 'Inspect at rack'
        assert await page.locator('#panel-body').get_by_text('Inspect the bow beside Copper before equipping it.', exact=False).count() == 1
        await page.screenshot(path=str(out/'08-uninspected-satchel.png'))
        await page.locator('#close-panel').click()
        await page.reload()
        await page.locator('#continue-game').click()
        await page.wait_for_timeout(200)
        await interact('Inspect Juno')
        await record('08-bow-inspected')
        await choose()
        await page.locator('[data-panel="satchel"]').click()
        bow_button = page.locator('[data-command="equipment"][data-id="equip:juno-ash-bow"]')
        assert await bow_button.is_enabled(), 'Inspected nearby bow should be equippable through the satchel'
        await bow_button.click()
        await page.locator('#close-panel').click()
        equipped = await save('09-equipped-state')
        hunt = equipped['campaign']['missions'][HUNT]
        bow = equipped['weapons']['juno-ash-bow']
        assert bow['ammo']+bow['reserve']==22 and bow['owner']=='mara'
        assert equipped['entities']['mara']['equippedWeaponId']==bow['id']
        assert equipped['campaign']['missions'][OPENING]==opening
        for k in ['food','medicine','materials','upgrades']:
            assert equipped['camp'][k]==baseline['camp'][k]
        elapsed = equipped['elapsed']-baseline['elapsed']
        earlier = baseline['campaign']['missions'][RESCUE]['rescue']['silas']['healingHours']
        later = equipped['campaign']['missions'][RESCUE]['rescue']['silas']['healingHours']
        assert abs(later-max(0,earlier-elapsed/80))<1e-6
        result['clinicalHoursAdvanced']=earlier-later
        await record('09-equipped')
        await page.locator('[data-panel="satchel"]').click()
        assert await page.locator('#panel-body').get_by_text('Juno’s ash bow',exact=False).count()>0
        await page.screenshot(path=str(out/'10-satchel.png'))
        await page.locator('#close-panel').click()
        await page.reload()
        await page.locator('#continue-game').click()
        await page.wait_for_timeout(200)
        reloaded = await save('11-reloaded-state')
        assert reloaded['weapons']['juno-ash-bow']==equipped['weapons']['juno-ash-bow']
        assert reloaded['campaign']['missions'][HUNT]['transactions']==hunt['transactions']
        await record('11-reloaded')
        result['passed']=not errors and all(not event['engineErrors'] for event in events)
    except Exception as e:
        result['failure']=str(e)
        await page.screenshot(path=str(out/'failure.png'))
        print(json.dumps({'browser':engine,'failure':str(e)}),flush=True)
    finally:
        (out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
        await browser.close()
    return result


async def main(args):
    args.output.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        results=await asyncio.gather(*(check(p,engine,args) for engine in args.engines.split(',')))
    summary={'passed':all(r['passed'] for r in results),'results':results}
    (args.output/'report.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary['passed']


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-save',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-hunt-prelude'))
    parser.add_argument('--url',default='http://127.0.0.1:4173')
    parser.add_argument('--engines',default='chromium,firefox,webkit')
    raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
