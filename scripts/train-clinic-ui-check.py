"""Observe the bounded clinic UI from separately earned native first-scene Saves.

No public mission-entry or full-train claim is made. The input directory must
contain the unchanged native Saves plus their acquisition provenance.
"""
import argparse,asyncio,json,hashlib,sys,os,traceback,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from campaign_save import observed_save_bytes,wait_for_save_commit
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir',type=Path,required=True,help='Genuine native clinic input directory with its provenance.json')
parser.add_argument('--output',type=Path,required=True,help='Artifact directory outside the repository')
parser.add_argument('--url',default='http://127.0.0.1:4173/',help='Running local application URL')
args=parser.parse_args()
R=Path(__file__).resolve().parents[1];IN=args.source_dir.resolve();OUT=args.output.resolve()
if OUT.is_relative_to(R):parser.error('--output must be outside the repository')
for filename in ['01-real-abel-first-dialogue.json','02-real-clinic-complete.json','provenance.json']:
 if not (IN/filename).is_file():parser.error(f'Missing genuine input or provenance: {filename}')
if OUT.exists() and any(OUT.iterdir()):parser.error('--output must be new or empty to preserve prior evidence')
OUT.mkdir(parents=True,exist_ok=True)
T='snowbound-what-the-line-carries';files=['index.html','styles.css','my-3d2dge-agent.js','scripts/campaign_save.py']+[str(p.relative_to(R)) for d in ['src','content'] for p in sorted((R/d).rglob('*.js'))]
sha=lambda b:hashlib.sha256(b).hexdigest();hashes=lambda:{f:sha((R/f).read_bytes())for f in files}
report={'passed':False,'scope':'Visible Import of genuine native first-scene Saves; public choices, keyboard movement, manual Save/Continue only. Not public mission entry, full20scene, acceptedplan, touch gameplay, hardware or realSafari proof.','driverSHA256':sha(Path(__file__).read_bytes()),'readerSHA256':sha((R/'scripts/campaign_save.py').read_bytes()),'sourceStart':hashes(),'inputs':{p.name:sha(p.read_bytes())for p in IN.glob('*.json')},'profiles':[],'errors':[]}
(OUT/'ui-driver.py').write_bytes(Path(__file__).read_bytes());(OUT/'reader.py').write_bytes((R/'scripts/campaign_save.py').read_bytes())
def write(): (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
OBS='''()=>{const g=My3D2dge.current,d=document.querySelector('#conversation'),p=document.querySelector('#panel');return{x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by,dialog:d.open,speaker:document.querySelector('#speaker').textContent,text:document.querySelector('#dialogue-text').textContent,choices:[...document.querySelectorAll('[data-choice]')].map(e=>e.dataset.choice),overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:d.open&&d.scrollWidth>d.clientWidth+1,panelOverflow:p.open&&p.scrollWidth>p.clientWidth+1,engineErrors:g.errors,portrait:document.querySelector('.dialogue-portrait').innerHTML,stage:document.querySelector('#mission-count').textContent}}'''
async def run():
 write()
 try:
  async with async_playwright() as pw:
   for name,engine,w,h,touch in [('webkit320','webkit',320,568,True),('webkit768','webkit',768,1024,True),('chromium1440','chromium',1440,1000,False)]:
    b=await getattr(pw,engine).launch();page=await b.new_page(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
    row={'name':name,'captures':[],'saves':[],'errors':errors};report['profiles'].append(row)
    async def press(loc): await (loc.tap()if touch else loc.click())
    async def capture(label):
     obs=await page.evaluate(OBS);assert not obs['overflow']and not obs['dialogOverflow']and not obs['panelOverflow']and not obs['engineErrors'],obs
     fn=f'{name}-{label}.png';await page.screenshot(path=str(OUT/fn));row['captures'].append({'label':label,'file':fn,'observed':obs});write();print(name,label,flush=True)
    async def imp(filename):
     await page.goto(args.url);await page.wait_for_function('globalThis.My3D2dge?.current?._running');await press(page.locator('[data-panel="menu"]'));await page.locator('#text-size').select_option('1.4');await page.locator('#reduce-motion').check()
     async with page.expect_file_chooser()as fc: await press(page.locator('[data-command="import"]'))
     await(await fc.value).set_files(str(IN/filename));await page.locator('#welcome').wait_for(state='hidden',timeout=30000);await page.wait_for_timeout(150);assert await page.locator('#mission-name').inner_text()=='What the Line Carries'
    async def save(label):
     await press(page.locator('[data-panel="menu"]'));await press(page.locator('[data-command="save"]'));wanted=await page.locator('#save-status').get_attribute('data-save-request');assert wanted is not None
     await wait_for_save_commit(page,expected_commit=wanted);assert await page.locator('#save-status').inner_text()=='Journey saved on this device.'
     raw=await observed_save_bytes(page,expected_commit=wanted);(OUT/f'{name}-{label}.json').write_text(raw);s=json.loads(raw);r=s['campaign']['missions'][T];assert r['train']['chronicle']['acceptedAt']is None and not r['mission']['completed'];row['saves'].append({'label':label,'sha256':sha(raw.encode()),'request':wanted,'commit':await page.locator('#save-status').get_attribute('data-save-commit'),'backend':await page.locator('#save-status').get_attribute('data-save-backend'),'stage':r['mission']['stage']});write();return s
    await imp('01-real-abel-first-dialogue.json');await capture('abel-first');await press(page.locator('[data-choice="train-speech-next"]'));await capture('abel-known');await press(page.locator('[data-choice="train-speech-pause"]'));before=await save('paused');await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden');after=await save('reloaded');assert before['campaign']['missions'][T]['train']['prelude']['exchange']==after['campaign']['missions'][T]['train']['prelude']['exchange'];row['pausedContinuePreserved']=True
    await press(page.locator('[data-command="resume"]'));await page.wait_for_function("!document.querySelector('#interact').hidden&&document.querySelector('#interaction-label').textContent.includes('Resume')");await press(page.locator('#interact'))
    for _ in range(8):
     if not await page.locator('#conversation').evaluate('(e)=>e.open'):break
     await press(page.locator('[data-choice="train-speech-next"]'))
    await page.wait_for_timeout(150);await capture('bottle-action');await page.wait_for_timeout(1900)
    for attempt in range(8):
     done=await save(f'bottle-observed-{attempt}');
     if done['campaign']['missions'][T]['train']['prelude']['bottle']['location']['type']=='ground':break
     await press(page.locator('[data-command="resume"]'));await page.wait_for_timeout(700)
    else:raise AssertionError('Actual bottle contact never completed after bounded accepted-world waits')
    await press(page.locator('[data-command="resume"]'));await capture('bottle-ground')
    await imp('02-real-clinic-complete.json')
    for tx,ty in [(390,1180),(650,1180),(650,1340)]:
     for _ in range(45):
      o=await page.evaluate(OBS);dx,dy=tx-o['x'],ty-o['y'];
      if math.hypot(dx,dy)<3:break
      dirs=await page.evaluate('''()=>[[['w'],0,-1],[['a'],-1,0],[['s'],0,1],[['d'],1,0],[['w','a'],-1,-1],[['w','d'],1,-1],[['s','a'],-1,1],[['s','d'],1,1]].map(([keys,x,y])=>({keys,v:My3D2dge.current.view.screenDirToGround(x,y)}))''');best=max(dirs,key=lambda q:dx*q['v'][0]+dy*q['v'][1]);duration=min(250,max(45,math.hypot(dx,dy)/105*1000));
      for key in best['keys']:await page.keyboard.down(key)
      await page.wait_for_timeout(duration)
      for key in best['keys']:await page.keyboard.up(key)
      await page.wait_for_timeout(40)
     else:raise AssertionError(f'Public clinic approach blocked: {tx},{ty}, {await page.evaluate(OBS)}')
    await capture('nell-rivet-world');await page.wait_for_function("!document.querySelector('#interact').hidden&&document.querySelector('#interaction-label').textContent.includes('Greet')");await press(page.locator('#interact'));await press(page.locator('[data-choice="train-speech-next"]'));await press(page.locator('[data-choice="train-speech-next"]'));await capture('nell-exchange')
    await press(page.locator('[data-choice="train-speech-pause"]'));await save('nell-paused');assert not errors,errors;row['functionalPassed']=True;await b.close();write()
  report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];report['inputsStable']=report['inputs']=={p.name:sha(p.read_bytes())for p in IN.glob('*.json')};report['passed']=report['sourceStable']and report['inputsStable']and all(p.get('functionalPassed')for p in report['profiles']);write();return 0 if report['passed']else 1
 except Exception as e:
  report['errors'].append({'error':str(e),'trace':traceback.format_exc()});report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];write();print(traceback.format_exc(),flush=True);return 1
raise SystemExit(asyncio.run(run()))
