"""Visible preparation controls from unchanged, genuinely earned native Saves.

This checks a bounded development prefix, not public Train entry or a complete
mission. Movement/source state are never assigned through the browser.
"""
import argparse, asyncio, hashlib, json, os, sys, traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from campaign_save import observed_save_bytes, wait_for_save_commit
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-dir',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--url',default='http://127.0.0.1:4173/')
args=parser.parse_args();INPUT=args.source_dir.resolve();OUT=args.output.resolve()
if OUT.is_relative_to(ROOT):parser.error('Keep artifacts outside the repository')
if OUT.exists() and any(OUT.iterdir()):parser.error('Preserve previous evidence; output must be new or empty')
OUT.mkdir(parents=True,exist_ok=True)
TRAIN='snowbound-what-the-line-carries';RIVAL='snowbound-the-names-they-took'
sha=lambda b:hashlib.sha256(b).hexdigest()
paths=['index.html','styles.css','my-3d2dge-agent.js','scripts/campaign_save.py']+[str(p.relative_to(ROOT))for folder in ['src','content']for p in sorted((ROOT/folder).rglob('*.js'))]
hashes=lambda:{p:sha((ROOT/p).read_bytes())for p in paths}
input_hashes=lambda:{p.name:sha(p.read_bytes())for p in sorted(INPUT.glob('*.json'))}
provenance=json.loads((INPUT/'provenance.json').read_text())
assert provenance['sourceStable'] and provenance['sourceStart']==provenance['sourceEnd'] and provenance['completeEvidenceSet']
for file,digest in provenance['sourceEnd'].items():assert sha((ROOT/file).read_bytes())==digest,('Native source/input changed before browser verification',file)
assert sha((ROOT/provenance['originalInput']).read_bytes())==provenance['originalInputSHA256']
native_captures={c['label']:c for c in provenance['captures']}
for label in ['01-store-ready','04-tin-mid-work','06-mending-ready']:assert sha((INPUT/f'{label}.json').read_bytes())==native_captures[label]['sha256'],('Native input receipt mismatch',label)
report={'passed':False,'scope':'Visible Import of unchanged native-earned phase-two Saves; actual Nearby actions, inspection/tin/mask work, strict manual Save/reload/Continue. Three viewport/engine profiles with actual tap/click controls. No injected runtime state, public Train entry, finished scene three/full mission, real Safari/hardware or full touch movement claim.','url':args.url,'driverSHA256':sha(Path(__file__).read_bytes()),'sourceStart':hashes(),'inputs':input_hashes(),'profiles':[],'errors':[]}
(OUT/'driver.py').write_bytes(Path(__file__).read_bytes());(OUT/'reader.py').write_bytes((ROOT/'scripts/campaign_save.py').read_bytes())
def record():(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
def train(s):return s['campaign']['missions'][TRAIN]['train']
OBS="""()=>({overflow:document.documentElement.scrollWidth>innerWidth,panelOverflow:document.querySelector('#panel').open&&document.querySelector('#panel').scrollWidth>document.querySelector('#panel').clientWidth+1,dialogOverflow:document.querySelector('#conversation').open&&document.querySelector('#conversation').scrollWidth>document.querySelector('#conversation').clientWidth+1,engineErrors:My3D2dge.current.errors,view:{id:My3D2dge.current.view.id,scale:My3D2dge.current.view.scale},stage:document.querySelector('#mission-count').textContent,nearbyVisible:!document.querySelector('[data-story-action="nearby-actions"]').hidden,interaction:document.querySelector('#interaction-label').textContent})"""

async def run():
 record()
 try:
  async with async_playwright() as pw:
   for name,engine,width,height,touch in [('webkit320','webkit',320,568,True),('webkit768','webkit',768,1024,True),('chromium1440','chromium',1440,1000,False)]:
    browser=await getattr(pw,engine).launch();page=await browser.new_page(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch)
    row={'name':name,'captures':[],'saves':[],'errors':[]};report['profiles'].append(row)
    page.on('pageerror',lambda e:row['errors'].append(str(e)));page.on('console',lambda e:row['errors'].append(e.text)if e.type=='error'else None)
    async def press(locator):await(locator.tap()if touch else locator.click())
    async def close():
     if await page.locator('#panel').evaluate('(e)=>e.open'):await press(page.locator('#close-panel'))
    async def menu():await close();await press(page.locator('[data-panel="menu"]'))
    async def capture(label):
     observed=await page.evaluate(OBS);assert not any(observed[k]for k in ['overflow','panelOverflow','dialogOverflow','engineErrors']),observed
     before=await page.evaluate('()=>My3D2dge.current.inspectTrainCampPresentation?.()');file=f'{name}-{label}.png';await page.screenshot(path=str(OUT/file));after=await page.evaluate('()=>My3D2dge.current.inspectTrainCampPresentation?.()')
     assert not (before or {}).get('errors') and not (after or {}).get('errors')
     active_before=[a['id']for a in (before or {}).get('actors',[])if a.get('work')=='preparation'];active_after=[a['id']for a in (after or {}).get('actors',[])if a.get('work')=='preparation']
     row['captures'].append({'label':label,'file':file,'observed':observed,'renderBefore':before,'renderAfter':after,'activePreparationActorsAtBothObservations':sorted(set(active_before)&set(active_after))});record();print(name,label,flush=True)
    async def save(label):
     await menu();await press(page.locator('[data-command="save"]'));commit=await page.locator('#save-status').get_attribute('data-save-request');assert commit
     await wait_for_save_commit(page,expected_commit=commit);raw=await observed_save_bytes(page,expected_commit=commit);s=json.loads(raw)
     assert s['failure'] is None and s['campaign']['activeMissionId']==TRAIN and s['campaign']['missions'][TRAIN]['mission']['stage']==2
     file=f'{name}-{label}.json';(OUT/file).write_text(raw);row['saves'].append({'label':label,'file':file,'sha256':sha(raw.encode()),'request':commit,'commit':await page.locator('#save-status').get_attribute('data-save-commit')});record();return s
    async def import_save(file):
     await page.goto(args.url);await page.wait_for_function('globalThis.My3D2dge?.current?._running');await menu();await page.locator('#text-size').select_option('1.4');await page.locator('#reduce-motion').check()
     async with page.expect_file_chooser()as fc:await press(page.locator('[data-command="import"]'))
     await(await fc.value).set_files(str(INPUT/file));await page.locator('#welcome').wait_for(state='hidden',timeout=30000);await page.wait_for_timeout(80)
     assert await page.locator('#mission-name').inner_text()=='What the Line Carries'
    async def action(id):
     await close();await press(page.locator('[data-story-action="nearby-actions"]'));await press(page.locator(f'[data-command="nearby"][data-id="{id}"]'))
    async def observe(predicate,label,missed=None):
     for i in range(30):
      s=await save(f'{label}-{i}')
      if predicate(s):return s
      if missed and missed(s):
       row.setdefault('timingMisses',[]).append({'label':label,'lastSave':row['saves'][-1]['file'],'reason':'Work lawfully completed before its pending window could be sampled.'});record();return None
      await close();await page.wait_for_timeout(200)
     raise AssertionError(f'{label} did not complete through accepted gameplay')
    async def continued_work(before,label):
     old=train(before)['powder']['pending'];assert len(old)==1;old=old[0]
     await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden');await page.wait_for_timeout(80)
     after=await save(label);p=train(after)['powder'];assert not any(e['kind']=='work-cancelled'and e['data'].get('workId')==old['workId']for e in p['physicalEvents'])
     pending=[w for w in p['pending']if w['workId']==old['workId']];done=[e for e in p['physicalEvents']if e['kind']in ['work-completed','preparation-inspection-completed']and e['data']['workId']==old['workId']]
     assert len(pending)+len(done)==1
     kept=pending[0]if pending else done[0]['data'];intervals=kept['intervals'];assert intervals[:len(old['intervals'])]==old['intervals']
     assert kept['acceptedSeconds']>old['acceptedSeconds'] and len(intervals)>len(old['intervals'])
     assert intervals[len(old['intervals'])]['start']==old['intervals'][-1]['finish']
     row.setdefault('continuedWork',[]).append({'workId':old['workId'],'kind':old['kind'],'retainedIntervalPrefix':True,'newContiguousAcceptedTime':kept['acceptedSeconds']-old['acceptedSeconds'],'mode':'same pending work advanced'if pending else'exact saved work completed'});return after

    for attempt in range(3):
     await import_save('01-store-ready.json');await capture(f'store-ready-{attempt}');await press(page.locator('[data-story-action="nearby-actions"]'));await capture(f'store-actions-{attempt}');await press(page.locator('[data-command="nearby"][data-id="train:prepare-inspect:quarry-sealed-charge-1"]'))
     first=await observe(lambda s:any(w['kind']=='inspect-child-seal'and w['acceptedSeconds']>0 for w in train(s)['powder']['pending']),f'first-inspection-active-{attempt}',missed=lambda s:any(e['kind']=='preparation-inspection-completed'for e in train(s)['powder']['physicalEvents']))
     if first:break
    else:raise AssertionError('The pending inspection window was missed in three UI attempts; successful completions are preserved as timing diagnostics.')
    kept=await continued_work(first,'inspection-continued');row['inspectionManualContinuationMode']='pending'if train(kept)['powder']['pending']else'completed';await close();await capture('inspection-after-continue')
    await observe(lambda s:any(e['kind']=='preparation-inspection-completed'for e in train(s)['powder']['physicalEvents']),'inspection-complete')

    for attempt in range(3):
     await import_save('04-tin-mid-work.json');tin=await save(f'tin-imported-{attempt}')
     if train(tin)['powder']['pending']:break
     expected=json.loads((INPUT/'04-tin-mid-work.json').read_text());work=train(expected)['powder']['pending'][0]
     assert any(e['kind']=='work-completed'and e['data']['workId']==work['workId']for e in train(tin)['powder']['physicalEvents'])
     row.setdefault('timingMisses',[]).append({'label':f'tin-imported-{attempt}','lastSave':row['saves'][-1]['file'],'reason':'Imported tin work lawfully completed before its pending window was sampled.'});record()
    else:raise AssertionError('The pending tin window was missed in three unchanged-input attempts; successful completions are preserved.')
    await continued_work(tin,'tin-continued')
    counted=await observe(lambda s:len(s['campaign']['missions'][RIVAL]['objects']['cap-tin'].get('primers',[]))==6,'tin-open');assert len([e for e in counted['campaign']['missions'][RIVAL]['rival']['continuation']['events']if e['kind']=='open-tin'])==1
    await close();await capture('tin-open')

    await import_save('06-mending-ready.json');await capture('mending-ready');await action('train:prepare-mask-issue')
    owned=await observe(lambda s:'mara-windwrap'in s['itemInstances'],'mask-issued');assert len([e for e in owned['campaign']['missions'][RIVAL]['rival']['continuation']['events']if e['kind']=='issue-mask'])==1
    await action('train:prepare-mask-bring');owned=await save('mask-bring');assert train(owned)['preparation']['maskChoice']['choice']=='bring';issue=owned['itemInstances']['mara-windwrap']['issueEventId']
    await page.reload();await press(page.locator('#continue-game'));await page.locator('#welcome').wait_for(state='hidden');kept=await save('mask-bring-continued');assert kept['itemInstances']['mara-windwrap']['issueEventId']==issue and train(kept)['preparation']['maskChoice']['choice']=='bring'
    await close();await capture('mask-owned');assert not row['errors'];row['functionalPassed']=True;await browser.close();record()
  report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];report['inputsStable']=report['inputs']==input_hashes();report['driverStable']=report['driverSHA256']==sha(Path(__file__).read_bytes());report['passed']=report['sourceStable']and report['inputsStable']and report['driverStable']and all(p.get('functionalPassed')for p in report['profiles']);record();return 0 if report['passed']else 1
 except Exception as e:
  report['errors'].append({'error':str(e),'trace':traceback.format_exc()});report['sourceEnd']=hashes();report['sourceStable']=report['sourceStart']==report['sourceEnd'];record();print(traceback.format_exc(),flush=True);return 1

raise SystemExit(asyncio.run(run()))
