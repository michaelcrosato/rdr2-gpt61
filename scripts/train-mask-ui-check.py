"""Actual current wear/remove controls from an unchanged historical earned mask.

This does not prove a fresh Ada issue, public Train entry or full preparation.
"""
import argparse,asyncio,gzip,hashlib,json,os,sys,traceback
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
report={'passed':False,'scope':'Unchanged historical earned PR9 issue; current actual UI wear/remove, crouched fitting, Save/reload/Continue and draw interruption. No fresh issue/public Train/fullgame/real Safari claim.','sourceStart':hashes(),'inputSHA256':sha(raw),'driverSHA256':sha(Path(__file__).read_bytes()),'profiles':[],'errors':[]}
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

    await import_owned();baseline=await save('historical-owned');born=baseline['itemInstances'][MASK];assert born['location']['type']=='carried'
    await action('train:prepare-mask-wear');partial=await observe(lambda s:any(w['kind']=='move-object'and w['acceptedSeconds']>0 for w in train(s)['powder']['pending']),'wear-pending');await continue_pending(partial,'wear-continued');worn=await observe(lambda s:s['itemInstances'][MASK]['location']['type']=='worn','worn');assert worn['itemInstances'][MASK]['issueEventId']==born['issueEventId'];await close();await capture('worn')
    await action('train:prepare-mask-remove');partial=await observe(lambda s:any(w['kind']=='move-object'and w['acceptedSeconds']>0 for w in train(s)['powder']['pending']),'remove-pending');await continue_pending(partial,'remove-continued');await observe(lambda s:s['itemInstances'][MASK]['location']['type']=='carried','removed');await close();await capture('removed')
    # Actual crouch control, not a body-flag fixture or browser state write.
    if touch:await press(page.locator('[data-action="crouch"]'))
    else:await page.keyboard.down('c')
    await page.wait_for_timeout(220);await action('train:prepare-mask-wear');partial=await observe(lambda s:any(w['kind']=='move-object'and w['acceptedSeconds']>0 for w in train(s)['powder']['pending']),'crouched-pending');assert partial['entities']['mara']['crouch'];kept=await continue_pending(partial,'crouched-continued');assert kept['entities']['mara']['crouch'],'Continue must retain the actual saved crouch stance';await page.keyboard.up('c');await observe(lambda s:s['itemInstances'][MASK]['location']['type']=='worn','crouched-worn');await close();await capture('crouched-worn')
    # The next actual stance control releases the restored latch. Keyboard
    # release must also remain meaningful after a menu cleared engine input.
    if touch:await press(page.locator('[data-action="crouch"]'))
    else:await page.keyboard.down('c');await page.wait_for_timeout(100);await save('keyboard-held');await close();await page.keyboard.up('c')
    await page.wait_for_timeout(220);released=await save('stance-released');assert not released['entities']['mara']['crouch'];await close()
    await action('train:prepare-mask-remove');await observe(lambda s:s['itemInstances'][MASK]['location']['type']=='carried','before-interrupt');await action('train:prepare-mask-wear');partial=await observe(lambda s:any(w['kind']=='move-object'and w['acceptedSeconds']>0 for w in train(s)['powder']['pending']),'interrupt-pending');work=train(partial)['powder']['pending'][0];await close()
    if touch:await press(page.locator('[data-story-action="holster"]'))
    else:await page.keyboard.press('q')
    await page.wait_for_timeout(120);interrupted=await save('draw-interrupted');assert interrupted['itemInstances'][MASK]['location']['type']=='carried' and not train(interrupted)['powder']['pending'];assert any(e['kind']=='work-cancelled'and e['data'].get('workId')==work['workId']for e in train(interrupted)['powder']['physicalEvents']);assert interrupted['itemInstances'][MASK]['issueEventId']==born['issueEventId'];await close();await capture('draw-interrupted')
    assert not row['errors'];row['functionalPassed']=True;await browser.close();record()
  report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];report['inputStable']=sha(INPUT.read_bytes())==report['inputSHA256'];report['driverStable']=sha(Path(__file__).read_bytes())==report['driverSHA256'];report['passed']=report['sourceStable']and report['inputStable']and report['driverStable']and all(r.get('functionalPassed')for r in report['profiles']);record();return 0 if report['passed']else 1
 except Exception as e:
  report['errors'].append({'error':str(e),'trace':traceback.format_exc()});report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];record();print(traceback.format_exc(),flush=True);return 1
raise SystemExit(asyncio.run(run()))
