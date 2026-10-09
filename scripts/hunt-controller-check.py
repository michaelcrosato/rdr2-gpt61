#!/usr/bin/env python3
"""Check actual bow input edges with an isolated standard-Gamepad input fixture.

The visible Import menu/file chooser loads an untouched, game-generated equipped
Hunt Save. After setup, only the normal Gamepad axes/buttons path is used. No
simulation state writes, private verbs, actor placement or keyboard fallback.
This checks cursor, hold/cancel/pause/release, not a complete controller hunt.
"""

from campaign_save import observed_save
import argparse
import asyncio
import json
import os
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
HUNT='snowbound-a-quiet-table'


async def run(args):
    args.output.mkdir(parents=True,exist_ok=True)
    errors=[]
    result={'passed':False,'browser':args.engine,'errors':errors,'sourceSave':str(args.source_save.resolve()),'setup':'Public menu/file chooser imports an untouched, game-generated equipped Hunt Save. Setup mouse clicks excluded from gameplay evidence.','caveat':'Focused emulated standard-Gamepad bow control check only. No physical controller or complete controller hunt claim.','events':[]}
    async with async_playwright() as p:
        browser=await getattr(p,args.engine).launch()
        page=await browser.new_page(viewport={'width':1440,'height':1000})
        await page.add_init_script('''window.huntControlPad={index:0,id:'Bow input test fixture',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[huntControlPad]});''')
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)

        async def button(index,held,ms=120):
            await page.evaluate('([i,h])=>huntControlPad.buttons[i]={pressed:h,value:h?1:0}',[index,held])
            await page.wait_for_timeout(ms)

        async def press(index):
            await button(index,True)
            await button(index,False)

        async def axes(x,y,ms=250):
            await page.evaluate('([x,y])=>{huntControlPad.axes[2]=x;huntControlPad.axes[3]=y}',[x,y])
            await page.wait_for_timeout(ms)
            await page.evaluate('()=>{huntControlPad.axes[2]=0;huntControlPad.axes[3]=0}')
            await page.wait_for_timeout(100)

        async def select(selector):
            for _ in range(35):
                if await page.evaluate('selector=>document.activeElement?.matches(selector)',selector):
                    await press(0);return
                await press(13)
            raise AssertionError(f'D-pad/A cannot reach {selector}')

        async def save(label):
            await press(8)
            await select('[data-command="save"]')
            raw=await observed_save(page)
            (args.output/f'{label}.json').write_text(json.dumps(raw,indent=2)+'\n')
            await press(8)
            assert raw['version']==3 and raw['failure'] is None
            return raw

        async def capture(label):
            await page.screenshot(path=str(args.output/f'{label}.png'))
            observed=await page.evaluate('()=>({status:document.querySelector("#weapon-status").textContent,engineErrors:My3D2dge.current.errors})')
            result['events'].append({'label':label,**observed,'screenshot':f'{label}.png'})
            assert not observed['engineErrors']

        try:
            await page.goto(args.url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await page.locator('[data-panel="menu"]').click()
            async with page.expect_file_chooser() as chooser:
                await page.locator('[data-command="import"]').click()
            await (await chooser.value).set_files(str(args.source_save.resolve()))
            await page.locator('#welcome').wait_for(state='hidden')
            await page.wait_for_timeout(200)
            baseline=await save('00-baseline')
            assert baseline['entities']['mara']['equippedWeaponId']=='juno-ash-bow'
            # Move into clear ground through actual left-stick walking before
            # the intentional miss. The imported camp's protected people stay
            # behind Mara; no actor is relocated by the test fixture.
            await page.evaluate('()=>huntControlPad.axes[1]=-1')
            await page.wait_for_timeout(1200)
            await page.evaluate('()=>huntControlPad.axes[1]=0')
            await axes(1,-1,450)
            await capture('01-manual-cursor')
            await button(7,True,650)
            assert (await page.locator('#weapon-status').inner_text()).startswith('Draw ')
            await capture('02-rt-held')
            await press(2)
            await button(7,False)
            canceled=await save('03-x-canceled')
            assert canceled['weapons']['juno-ash-bow']==baseline['weapons']['juno-ash-bow']
            assert canceled['campaign']['missions'][HUNT]['bow']['serial']==0
            assert canceled['campaign']['missions'][HUNT]['bow']['canceled']>=1
            # Pause while RT stays held, then resume while it is still held.
            # Neither the pause nor a later release may loose that canceled draw.
            await button(7,True,550)
            await press(8)
            await capture('04-paused-held-trigger')
            await press(8)
            await page.wait_for_timeout(300)
            assert not (await page.locator('#weapon-status').inner_text()).startswith('Draw ')
            await button(7,False)
            paused=await save('05-resumed-unspent')
            assert paused['weapons']['juno-ash-bow']==baseline['weapons']['juno-ash-bow']
            assert paused['campaign']['missions'][HUNT]['bow']['serial']==0
            # A fresh RT press and release now causes one actual flight. The
            # ordinary right-stick cursor is retained when its axes return to0.
            await axes(1,-1,350)
            await button(7,True,1500)
            await capture('06-fresh-draw')
            await button(7,False,1000)
            shot=await save('07-one-release')
            bow=shot['campaign']['missions'][HUNT]['bow']
            assert bow['serial']==1 and len(bow['arrows'])==1
            assert shot['weapons']['juno-ash-bow']['ammo']+shot['weapons']['juno-ash-bow']['reserve']==21
            assert bow['arrows'][0]['targetId'] is None
            assert shot['campaign']['missions'][HUNT]['performance']['arrowMisses']==1
            await capture('07-one-release')
            result['verified']=['manual right-stick cursor','RT draw','X cancel with no spent arrow','pause/resume while RT remains held','one fresh release creates exactly one actual miss']
            result['passed']=not errors
        except Exception as e:
            result['failure']=repr(e)
            await page.screenshot(path=str(args.output/'failure.png'))
        finally:
            (args.output/'report.json').write_text(json.dumps(result,indent=2)+'\n')
            await browser.close()
    print(json.dumps(result),flush=True)
    return result['passed']


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-save',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-hunt-controller'))
    parser.add_argument('--engine',choices=['chromium','webkit','firefox'],default='chromium')
    parser.add_argument('--url',default='http://127.0.0.1:4173')
    raise SystemExit(0 if asyncio.run(run(parser.parse_args())) else 1)
