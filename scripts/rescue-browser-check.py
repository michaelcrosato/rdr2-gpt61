"""Verify imported, game-generated rescue Saves on ten actual UI profiles.

Uses public menus and browser file choosers. Evaluations read layout, displayed
state, engine errors and ordinary manual Saves; none writes runtime state. This
checks presentation/reload, separately from the full normal-control playthrough.
WebKit phone profiles approximate Safari's engine, not real iOS hardware.
"""
import argparse,asyncio,json,os
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser(description='Check northern UI and whole-campaign reloads through visible Import save menus.')
parser.add_argument('--source-dir',type=Path,required=True,help='Ordinary rescue-playthrough output containing the ash-trail and secured-rest-pad Saves')
parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-rescue-browser'))
parser.add_argument('--url',default='http://127.0.0.1:4173')
parser.add_argument('--completed-save',type=Path,help='Optional actual completed rescue Save; otherwise use source-dir/10-complete-state.json when present')
args=parser.parse_args()
OUT=args.output;OUT.mkdir(parents=True,exist_ok=True)
SOURCE=args.source_dir
PROFILES=[('webkit','se-portrait',375,667,True),('webkit','se-landscape',667,375,True),('webkit','phone-landscape',756,352,True),('chromium','android',412,915,True),('chromium','foldable',690,829,True),('webkit','tablet',768,1024,True),('chromium','desktop',1440,900,False),('webkit','desktop',1440,900,False),('firefox','desktop',1440,900,False),('chromium','ultrawide',3440,1440,False)]
SAVES=['03-ash-trail-state.json','06-rest-pad-state.json']
async def check(p,brow,name,w,h,mobile):
 browser=await getattr(p,brow).launch(); page=await browser.new_page(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
 result={'profile':f'{brow}-{name}','width':w,'height':h,'errors':errors,'cases':[]}
 try:
  for f in SAVES:
   await page.goto(args.url);await page.wait_for_function('globalThis.My3D2dge?.current?._running')
   await page.locator('[data-panel="menu"]').click()
   async with page.expect_file_chooser() as c: await page.locator('[data-command="import"]').click()
   await (await c.value).set_files(str(SOURCE/f));await page.locator('#welcome').wait_for(state='hidden');await page.wait_for_timeout(200)
   assert await page.locator('#mission-name').inner_text()=='A Voice Under Ice'
   assert await page.locator('body').get_attribute('data-region')=='north-cutting'
   if mobile:
    crouch=page.locator('[data-action="crouch"]');assert await crouch.is_visible();await crouch.tap();assert await crouch.get_attribute('aria-pressed')=='true';await crouch.tap();assert await crouch.get_attribute('aria-pressed')=='false'
   measurements=await page.evaluate('''()=>{const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return getComputedStyle(e).display==='none'?null:{x:r.x,y:r.y,w:r.width,h:r.height}};return {objective:box('.objective'),joystick:box('#joystick'),actions:box('.touch-actions'),controls:box('.campaign-controls'),overflow:document.documentElement.scrollWidth>innerWidth,engineErrors:My3D2dge.current.errors}}''')
   a=measurements['objective'];b=measurements['joystick'];assert not b or not (a['x']<b['x']+b['w'] and a['x']+a['w']>b['x'] and a['y']<b['y']+b['h'] and a['y']+a['h']>b['y']), ('Objective overlaps movement control', measurements)
   title=f.removesuffix('-state.json'); shot=f'{brow}-{name}-{title}.png';await page.screenshot(path=str(OUT/shot))
   result['cases'].append({'save':f,'screenshot':shot,'objective':await page.locator('#objective-text').inner_text(),'measurements':measurements})
  await page.locator('[data-panel="map"]').click();assert await page.locator('#panel-title').inner_text()=='North Cutting';await page.screenshot(path=str(OUT/f'{brow}-{name}-map.png'));await page.locator('#close-panel').click()
  await page.locator('[data-panel="satchel"]').click();assert await page.locator('#panel-body').get_by_text('Rescue rope and sling',exact=False).count()>0;await page.screenshot(path=str(OUT/f'{brow}-{name}-satchel.png'));await page.locator('#close-panel').click()
  await page.locator('[data-panel="menu"]').click();await page.locator('#text-size').select_option('1.4');await page.locator('#reduce-motion').check();await page.locator('[data-command="save"]').click();raw=await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))');assert raw['version']==2 and raw['region']=='north-cutting';await page.locator('[data-command="resume"]').click()
  await page.reload();await page.locator('#continue-game').click();await page.wait_for_timeout(100);assert await page.locator('#mission-name').inner_text()=='A Voice Under Ice';assert await page.locator('body').get_attribute('data-region')=='north-cutting';await page.screenshot(path=str(OUT/f'{brow}-{name}-reloaded.png'))
  completed=args.completed_save or SOURCE/'10-complete-state.json'
  if completed.exists():
   await page.locator('[data-panel="menu"]').click()
   async with page.expect_file_chooser() as c:await page.locator('[data-command="import"]').click()
   await (await c.value).set_files(str(completed));await page.wait_for_timeout(100)
   assert await page.locator('#mission-count').inner_text()=='COMPLETE';assert await page.locator('body').get_attribute('data-region')=='snowbound'
   await page.screenshot(path=str(OUT/f'{brow}-{name}-completed-camp.png'))
   await page.locator('[data-panel="journal"]').click();drawing=page.locator('.journal-illustration');assert await drawing.count()==1;await page.locator('[data-command="notebook"]').click();await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/f'{brow}-{name}-notebook.png'));assert 'three arches, two horses, one sling' in await drawing.inner_text()
   await page.locator('#close-panel').click()
   result['completedNotebook']=True
  assert not errors and all(not c['measurements']['overflow'] and not c['measurements']['engineErrors'] for c in result['cases'])
  result['passed']=True
 except Exception as e: result['passed']=False;result['failure']=str(e);await page.screenshot(path=str(OUT/f'{brow}-{name}-failure.png'))
 finally: await browser.close()
 print(json.dumps(result),flush=True);return result
async def main():
 async with async_playwright() as p:
  results=await asyncio.gather(*(check(p,*row) for row in PROFILES))
 (OUT/'report.json').write_text(json.dumps({'passed':all(r['passed'] for r in results),'caveat':'Game-generated Saves imported through visible product UI. Responsive presentation/reload check, not a full normal-control playthrough.','profiles':results},indent=2)+'\n')
asyncio.run(main())
raise SystemExit(0 if json.loads((OUT/'report.json').read_text())['passed'] else 1)
