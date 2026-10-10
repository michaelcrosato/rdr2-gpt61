"""Actual Copper call, bounded recovery, mount and ride controls from an earned Save.

This proves only the performed current horse/mask flow, not full preparation or public Train entry.
"""
import argparse,asyncio,gzip,hashlib,json,os,sys,traceback,subprocess
from collections import deque
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from campaign_save import observed_save_bytes,wait_for_save_commit
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4197/')
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--only',choices=['webkit320','webkit768','chromium1440'])
args=parser.parse_args();OUT=args.output.resolve()
if OUT.is_relative_to(ROOT) or OUT.exists():parser.error('Use a new artifact directory outside the repository')
OUT.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
fixture=ROOT/'tests/fixtures/train-preparation-pr9-mask-owned-bring.json.gz';provenance=json.loads((ROOT/'tests/fixtures/train-preparation-pr9-mask-owned-bring.json.provenance.json').read_text())
compressed=fixture.read_bytes();raw=gzip.decompress(compressed);assert sha(compressed)==provenance['gzipSHA256'] and sha(raw)==provenance['originalRawSHA256']
INPUT=OUT/'unchanged-historical-owned-mask.json';INPUT.write_bytes(raw)
paths=['index.html','styles.css','my-3d2dge-agent.js','scripts/campaign_save.py']+[str(p.relative_to(ROOT))for folder in ['src','content']for p in sorted((ROOT/folder).rglob('*.js'))]
hashes=lambda:{p:sha((ROOT/p).read_bytes())for p in paths}
TRAIN='snowbound-what-the-line-carries';MASK='mara-windwrap'
report={'passed':False,'scope':'Unchanged historical earned PR9 issue; actual UI wear, ordinary foot movement, Call, complete Copper initial-contact recovery, Save/Continue, offered mount, riding and dismount. No body assignments, fresh issue, public Train entry, fullgame or real Safari claim.','sourceStart':hashes(),'inputSHA256':sha(raw),'driverSHA256':sha(Path(__file__).read_bytes()),'profiles':[],'errors':[]}
(OUT/'driver.py').write_bytes(Path(__file__).read_bytes())
def record():(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def train(s):return s['campaign']['missions'][TRAIN]['train']
async def run():
 record()
 try:
  async with async_playwright()as pw:
   for name,engine,width,height,touch in [('webkit320','webkit',320,568,True),('webkit768','webkit',768,1024,True),('chromium1440','chromium',1440,1000,False)]:
    if args.only and name!=args.only:continue
    browser=await getattr(pw,engine).launch();page=await browser.new_page(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch);row={'name':name,'saves':[],'captures':[],'errors':[]};report['profiles'].append(row)
    page.on('pageerror',lambda e:row['errors'].append(str(e)));page.on('console',lambda e:row['errors'].append(e.text)if e.type=='error'else None)
    async def press(loc):await(loc.tap()if touch else loc.click())
    async def close():
     if await page.locator('#panel').evaluate('(e)=>e.open'):
      if touch:await press(page.locator('#close-panel'))
      else:await page.keyboard.press('Escape');await page.wait_for_function('!document.querySelector("#panel").open')
    async def menu():
     await close()
     if touch:await press(page.locator('[data-panel="menu"]'))
     else:await page.keyboard.press('Escape');await page.wait_for_function('document.querySelector("#panel").open')
    async def save(label):
     await menu();await press(page.locator('[data-command="save"]'));commit=await page.locator('#save-status').get_attribute('data-save-request');assert commit;await wait_for_save_commit(page,expected_commit=commit);text=await observed_save_bytes(page,expected_commit=commit);s=json.loads(text);assert s['failure']is None and s['campaign']['activeMissionId']==TRAIN;file=f'{name}-{label}.json';(OUT/file).write_text(text);row['saves'].append({'file':file,'sha256':sha(text.encode()),'commit':commit});record();return s
    async def capture(label):
     obs=await page.evaluate("()=>({overflow:document.documentElement.scrollWidth>innerWidth,errors:My3D2dge.current.errors,render:My3D2dge.current.inspectTrainCampPresentation?.()})");assert not obs['overflow']and not obs['errors']and not (obs['render']or{}).get('errors'),obs;file=f'{name}-{label}.png';await page.screenshot(path=str(OUT/file));row['captures'].append({'file':file,'observed':obs});record();print(name,label,flush=True)
    async def import_owned():
     await page.goto(args.url);await page.wait_for_function('globalThis.My3D2dge?.current?._running');await menu();await page.locator('#text-size').select_option('1.4');await page.locator('#reduce-motion').check()
     async with page.expect_file_chooser()as fc:await press(page.locator('[data-command="import"]'))
     await(await fc.value).set_files(str(INPUT));await page.locator('#welcome').wait_for(state='hidden',timeout=30000);await page.wait_for_timeout(100)
    async def action(id):await close();await press(page.locator('[data-story-action="nearby-actions"]'));await press(page.locator(f'[data-command="nearby"][data-id="{id}"]'))
    async def observe(predicate,label):
     for i in range(25):
      s=await save(f'{label}-{i}')
      if predicate(s):return s
      await close();await page.wait_for_timeout(140)
     raise AssertionError(label+' was not observed in accepted gameplay')
    async def continue_pending(before,label):
     old=train(before)['powder']['pending'];assert len(old)==1;old=old[0];await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden');await page.wait_for_timeout(100);after=await save(label);p=train(after)['powder'];assert not any(e['kind']=='work-cancelled'and e['data'].get('workId')==old['workId']for e in p['physicalEvents']);pending=[w for w in p['pending']if w['workId']==old['workId']];done=[e['data']for e in p['physicalEvents']if e['kind']=='work-completed'and e['data']['workId']==old['workId']];assert len(pending)+len(done)==1;kept=(pending or done)[0];assert kept['intervals'][:len(old['intervals'])]==old['intervals']and kept['acceptedSeconds']>old['acceptedSeconds'];return after

    # The planner only reads a saved graph and static world. Every movement
    # below is real keyboard or joystick input into the normal game loop.
    async def position():
     for _ in range(30):
      p=await page.evaluate("()=>My3D2dge.current.inspectTrainCampPresentation?.()?.actors.find(a=>a.id==='mara')?.world")
      if p:return p
      await page.wait_for_timeout(25)
     raise AssertionError('Current drawn Mara world position was not available')
    async def pulse(axis,sign,ms):
     if touch:
      b=await page.locator('#joystick').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(25*sign if axis=='x'else 0),y+(25*sign if axis=='y'else 0));await page.wait_for_timeout(ms);await page.mouse.up()
     else:
      key=('d'if sign>0 else'a')if axis=='x'else('s'if sign>0 else'w')
      await page.keyboard.down(key);await page.wait_for_timeout(ms);await page.keyboard.up(key)
    async def move_to(goal):
     await close();stalls=0
     for _ in range(160):
      before=await position();dx=goal['x']-before['x'];dy=goal['y']-before['y']
      if max(abs(dx),abs(dy))<2.6:return
      axis='x'if abs(dx)>abs(dy)else'y';value=dx if axis=='x'else dy;speed=105*(.625 if touch else 1)
      await pulse(axis,1 if value>0 else-1,min(180,max(25,abs(value)/speed*850)))
      after=await position();stalls=stalls+1 if abs(after['x']-before['x'])+abs(after['y']-before['y'])<.1 else 0
      assert stalls<8,{'blockedOrdinaryMovement':True,'goal':goal,'actual':after}
     raise AssertionError('Ordinary movement did not reach '+str(goal))
    def planned_route(saved,goal):
     state=OUT/(name+'-route-input.json');state.write_text(json.dumps(saved,separators=(',',':')))
     code="import './my-3d2dge-agent.js';import {readFileSync} from 'node:fs';import {worldForCampaign,restoreCampaign} from './src/campaign-journey.js';const s=restoreCampaign(readFileSync(process.argv[1],'utf8'));if(!s)throw Error('Observed Save refused');console.log(JSON.stringify(worldForCampaign(s)));"
     result=subprocess.run(['node','--input-type=module','-e',code,str(state)],cwd=ROOT,capture_output=True,text=True,check=True);world=json.loads(result.stdout);obstacles=world['obstacles'];size=20;cols=(world['width']+19)//20;rows=(world['height']+19)//20
     def blocked(p):return p['x']<9 or p['y']<9 or p['x']>world['width']-9 or p['y']>world['height']-9 or any(o['x']-9+1e-7<p['x']<o['x']+o['w']+9-1e-7 and o['y']-9+1e-7<p['y']<o['y']+o['h']+9-1e-7 for o in obstacles)
     def at(c):return{'x':c[0]*size+10,'y':c[1]*size+10}
     def cell(p):return(int(p['x']//size),int(p['y']//size))
     def nearest(p):
      c=cell(p);options=[(c[0]+x,c[1]+y)for x in range(-3,4)for y in range(-3,4)];options=[q for q in options if 0<=q[0]<cols and 0<=q[1]<rows and not blocked(at(q))];return min(options,key=lambda q:(at(q)['x']-p['x'])**2+(at(q)['y']-p['y'])**2)
     begin=nearest(saved['entities']['mara']);end=nearest(goal);todo=deque([begin]);prev={begin:None}
     while todo and end not in prev:
      c=todo.popleft()
      for x,y in[(1,0),(-1,0),(0,1),(0,-1)]:
       q=(c[0]+x,c[1]+y)
       if 0<=q[0]<cols and 0<=q[1]<rows and q not in prev and not blocked(at(q)):prev[q]=c;todo.append(q)
     assert end in prev,'Read-only world planner found no foot route'
     points=[];q=end
     while q is not None:points.append(at(q));q=prev[q]
     points.reverse();points.append(goal);compact=[]
     for p in points:
      if len(compact)>1 and (compact[-2]['x']==compact[-1]['x']==p['x'] or compact[-2]['y']==compact[-1]['y']==p['y']):compact[-1]=p
      else:compact.append(p)
     return compact
    await import_owned();baseline=await save('historical-owned');born=baseline['itemInstances'][MASK]
    await action('train:prepare-mask-wear');await observe(lambda s:s['itemInstances'][MASK]['location']['type']=='worn','worn');await close();await capture('worn')
    saved=await save('before-walk');route=planned_route(saved,{'x':600,'y':1330});row['ordinaryFootRoute']=route
    for waypoint in route:await move_to(waypoint)
    before=await save('before-call');assert before['entities']['copper']['y']==baseline['entities']['copper']['y'];await close()
    if touch:await press(page.locator('[data-action="whistle"]'))
    else:await page.keyboard.press('h')
    await page.wait_for_timeout(50);pending=await save('recovery-pending');episode=train(pending)['preparation'].get('copperRecovery');assert episode and episode['status']=='recovering'and episode['steps'],'Observer needs a real nonempty pending recovery prefix'
    prefix=episode['steps'];initial=episode['initial'];await close();await capture('recovery-pending');await menu();await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden')
    continued=await save('recovery-continued');current=train(continued)['preparation']['copperRecovery'];assert current['initial']==initial and current['steps'][:len(prefix)]==prefix;await close()
    cleared=await observe(lambda s:train(s)['preparation']['copperRecovery']['status']=='clear','recovery-clear');assert train(cleared)['preparation']['copperRecovery']['initial']==initial
    await observe(lambda s:abs(s['entities']['copper'].get('vx',0))+abs(s['entities']['copper'].get('vy',0))<.01,'horse-stopped');near=await save('before-mount-walk');h=near['entities']['copper']
    for waypoint in planned_route(near,{'x':h['x']+28,'y':h['y']}):await move_to(waypoint)
    await action('train:mount-copper');mounted=await save('mounted');assert mounted['entities']['mara']['mounted'];assert mounted['entities']['mara']['mountId']=='copper';assert mounted['itemInstances'][MASK]['issueEventId']==born['issueEventId'];await close();await capture('mounted')
    # Keep one real input held across render frames. Short down/up pulses can
    # both land between slow frames and do not prove accepted riding time.
    start=await position()
    if touch:
     b=await page.locator('#joystick').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+25)
    else:await page.keyboard.down('s')
    try:
     for _ in range(180):
      await page.wait_for_timeout(100);actual=await position()
      if abs(actual['x']-start['x'])+abs(actual['y']-start['y'])>35:break
     else:raise AssertionError('Held ordinary riding input did not earn translation')
    finally:
     if touch:await page.mouse.up()
     else:await page.keyboard.up('s')
    await page.wait_for_timeout(100)
    ridden=await save('ridden');a=mounted['entities']['copper'];b=ridden['entities']['copper'];assert abs(a['x']-b['x'])+abs(a['y']-b['y'])>5,'Mounted input must actually translate the shared horse/rider'
    assert all(ridden['entities']['mara'][k]==b[k]for k in ['x','y','z']);await close();await capture('ridden')
    await menu();await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden');restored=await save('ridden-continued');assert restored['entities']['mara']['mounted'];assert all(restored['entities']['mara'][k]==ridden['entities']['mara'][k]for k in ['x','y','z']);await close();await capture('ridden-continued')
    await close();await page.wait_for_timeout(100);await action('train:dismount-copper');unmounted=await save('dismounted');assert not unmounted['entities']['mara']['mounted'];assert unmounted['itemInstances'][MASK]['issueEventId']==born['issueEventId'];await close();await capture('dismounted')
    assert not row['errors'];row['functionalPassed']=True;await browser.close();record()
  report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];report['inputStable']=sha(INPUT.read_bytes())==report['inputSHA256'];report['driverStable']=sha(Path(__file__).read_bytes())==report['driverSHA256'];report['passed']=report['sourceStable']and report['inputStable']and report['driverStable']and all(r.get('functionalPassed')for r in report['profiles']);record();return 0 if report['passed']else 1
 except Exception as e:
  report['errors'].append({'error':str(e),'trace':traceback.format_exc()});report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];record();print(traceback.format_exc(),flush=True);return 1
raise SystemExit(asyncio.run(run()))
