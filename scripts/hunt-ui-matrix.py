#!/usr/bin/env python3
"""Inspect imported, game-generated Hunt Saves on ten browser/viewport profiles.

Public Import menus and ordinary pointer/touch/button controls only. Browser
evaluations read UI, renderer errors and actual menu Saves. This is responsive
presentation and draw cancellation evidence, not a complete touch playthrough.
"""
import argparse
import asyncio
import json
import math
import os
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright

PROFILES=[('webkit','se-portrait',375,667,True),('webkit','se-landscape',667,375,True),('webkit','phone-landscape',756,352,True),('chromium','android',412,915,True),('chromium','foldable',690,829,True),('webkit','tablet',768,1024,True),('chromium','desktop',1440,900,False),('webkit','desktop',1440,900,False),('firefox','desktop',1440,900,False),('chromium','ultrawide',3440,1440,False)]
HUNT='snowbound-a-quiet-table'


async def check(p,args,profile):
    engine,name,w,h,mobile=profile
    browser=await getattr(p,engine).launch()
    page=await browser.new_page(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    prefix=f'{engine}-{name}'
    result={'profile':prefix,'width':w,'height':h,'errors':errors,'cases':[], 'passed':False}

    async def capture(label):
        measurements=await page.evaluate('''()=>{const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return e.hidden||getComputedStyle(e).display==='none'?null:{x:r.x,y:r.y,w:r.width,h:r.height}};return {overflow:document.documentElement.scrollWidth>innerWidth,objective:box('.objective'),joystick:box('#joystick'),cancel:box('[data-story-action="cancel-bow"]'),engineErrors:My3D2dge.current.errors}}''')
        a,b=measurements['objective'],measurements['joystick']
        assert not a or not b or not (a['x']<b['x']+b['w'] and a['x']+a['w']>b['x'] and a['y']<b['y']+b['h'] and a['y']+a['h']>b['y']),measurements
        assert not measurements['overflow'] and not measurements['engineErrors'],measurements
        filename=f'{prefix}-{label}.png'
        await page.screenshot(path=str(args.output/filename))
        result['cases'].append({'label':label,'screenshot':filename,'measurements':measurements})

    async def import_save(filename):
        await page.goto(args.url)
        await page.wait_for_function('globalThis.My3D2dge?.current?._running')
        await page.locator('[data-panel="menu"]').click()
        async with page.expect_file_chooser() as chooser:
            await page.locator('[data-command="import"]').click()
        await (await chooser.value).set_files(str(args.source_dir/filename))
        await page.locator('#welcome').wait_for(state='hidden')
        await page.wait_for_timeout(200)
        assert await page.locator('#mission-name').inner_text()=='A Quiet Table'

    async def raw_save():
        await page.locator('[data-panel="menu"]').click()
        await page.locator('[data-command="save"]').click()
        raw=await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
        await page.locator('[data-command="resume"]').click()
        await page.wait_for_timeout(120)
        assert raw['version']==3 and raw['failure'] is None
        return raw

    async def walk(route):
        for tx,ty in route:
            for _ in range(130):
                before=await page.evaluate('()=>{const g=My3D2dge.current;return {x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by}}')
                dx,dy=tx-before['x'],ty-before['y']
                if math.hypot(dx,dy)<9:break
                horizontal=abs(dx)>abs(dy)
                key=('d' if dx>0 else 'a') if horizontal else ('s' if dy>0 else 'w')
                await page.keyboard.down(key)
                await page.wait_for_timeout(min(450,max(40,abs(dx if horizontal else dy)/85*1000)))
                await page.keyboard.up(key)
                await page.wait_for_timeout(65)
            else:raise AssertionError(f'Actual setup movement cannot reach {tx},{ty}')

    try:
        await import_save('06-accepted-invitation-state.json')
        await capture('prelude')
        await walk([(270,1270),(205,1270),(175,1220)])
        await page.wait_for_function("!document.querySelector('#interact').hidden && document.querySelector('#interaction-label').textContent.includes('Orla')")
        await page.locator('#interact').click()
        assert await page.locator('#conversation').get_attribute('open') is not None
        assert await page.locator('#speaker').inner_text()=='Orla Venn'
        await capture('orla-conversation')
        await page.locator('[data-choice="leave"]').click()
        await import_save('09-equipped-state.json')
        before=await raw_save()
        await capture('equipped')
        if mobile:
            crouch=page.locator('[data-action="crouch"]')
            await crouch.tap();assert await crouch.get_attribute('aria-pressed')=='true'
            await crouch.tap();assert await crouch.get_attribute('aria-pressed')=='false'
            fire=await page.locator('[data-action="shoot"]').bounding_box()
            await page.mouse.move(fire['x']+fire['width']/2,fire['y']+fire['height']/2)
        else:
            await page.mouse.move(w*.52,h*.45)
        await page.mouse.down()
        await page.wait_for_function("document.querySelector('#weapon-status').textContent.startsWith('Draw ')")
        await page.wait_for_timeout(600)
        assert await page.locator('[data-story-action="cancel-bow"]').is_visible()
        await capture('draw-held')
        if mobile:
            # A real touchscreen tap is a separate pointer from the held mouse
            # pointer. This tests the visible cancel control without claiming
            # physical multi-touch or native touch dragging coverage.
            await page.locator('[data-story-action="cancel-bow"]').tap()
        else:
            await page.keyboard.press('x')
        await page.mouse.up()
        await page.wait_for_timeout(250)
        after=await raw_save()
        assert after['weapons']['juno-ash-bow']['ammo']==before['weapons']['juno-ash-bow']['ammo']
        assert after['weapons']['juno-ash-bow']['reserve']==before['weapons']['juno-ash-bow']['reserve']
        assert after['campaign']['missions'][HUNT]['bow']['serial']==before['campaign']['missions'][HUNT]['bow']['serial']
        assert after['campaign']['missions'][HUNT]['bow']['drawing'] is False
        assert after['campaign']['missions'][HUNT]['bow']['canceled']>before['campaign']['missions'][HUNT]['bow']['canceled']
        result['unspentCancelVerified']=True
        await capture('canceled')
        await page.locator('[data-panel="map"]').click()
        assert await page.locator('#panel-title').inner_text()=='Snowbound'
        await capture('map')
        await page.locator('#close-panel').click()
        await page.locator('[data-panel="satchel"]').click()
        assert await page.locator('#panel-body').get_by_text('Juno’s ash bow',exact=False).count()>0
        await capture('satchel')
        await page.locator('#close-panel').click()
        await page.locator('[data-panel="menu"]').click()
        await page.locator('#text-size').select_option('1.4')
        await page.locator('#reduce-motion').check()
        await page.locator('[data-command="save"]').click()
        await page.locator('[data-command="resume"]').click()
        await page.reload()
        await page.locator('#continue-game').click()
        await page.wait_for_timeout(250)
        reloaded=await raw_save()
        assert reloaded['weapons']['juno-ash-bow']==after['weapons']['juno-ash-bow']
        assert reloaded['campaign']['missions'][HUNT]['transactions']==after['campaign']['missions'][HUNT]['transactions']
        await capture('reloaded')
        result['passed']=not errors
    except Exception as e:
        result['failure']=str(e)
        await page.screenshot(path=str(args.output/f'{prefix}-failure.png'))
    finally:
        await browser.close()
    print(json.dumps(result),flush=True)
    return result


async def main(args):
    args.output.mkdir(parents=True,exist_ok=True)
    semaphore=asyncio.Semaphore(3)
    async with async_playwright() as p:
        async def bounded(profile):
            async with semaphore:return await check(p,args,profile)
        results=await asyncio.gather(*(bounded(profile) for profile in PROFILES))
    summary={'passed':all(r['passed'] for r in results),'caveat':'Imports actual game-generated prelude/equipped Saves through public UI. Responsive presentation/reload and mixed pointer/touch cancel controls only; not a complete input playthrough or real iOS hardware proof.','results':results}
    (args.output/'report.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary['passed']


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-hunt-ui'))
    parser.add_argument('--url',default='http://127.0.0.1:4173')
    raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
