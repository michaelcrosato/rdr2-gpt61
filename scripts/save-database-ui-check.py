"""Normal frontend controls verify async Save/Continue/Export for unchanged
native earned histories; storage failure setup is separately labelled.
"""
import argparse,asyncio,gzip,hashlib,json,os,sys
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
from campaign_save import observed_save_bytes,wait_for_save_commit
ROOT=Path(__file__).resolve().parent.parent
PROFILES=[('webkit-phone320','webkit',320,568,True),('webkit-tablet','webkit',768,1024,True),('chromium-ultrawide','chromium',2560,1080,False),('webkit-phone','webkit',375,667,True),('chromium-desktop','chromium',1440,900,False),('firefox-desktop','firefox',1440,900,False)]
async def main(args):
 args.output.mkdir(parents=True,exist_ok=True);
 if args.source is None:
  args.source=args.output/'unchanged-native-source.json';args.source.write_bytes(gzip.decompress((ROOT/'tests/fixtures/save-v4-four-stories-opening-replay-native.json.gz').read_bytes()))
 (args.output/'report.json').write_text(json.dumps({'passed':False,'status':'Started; terminal errors preserve this receipt'})+'\n');rows=[]
 async with async_playwright() as p:
  for name,engine,width,height,touch in PROFILES:
   browser=await getattr(p,engine).launch();page=await browser.new_page(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   await page.goto(args.url);await page.locator('[data-panel="menu"]').click()
   async with page.expect_file_chooser() as choosing:await page.locator('[data-command="import"]').click()
   await (await choosing.value).set_files(str(args.source));await page.locator('#welcome').wait_for(state='hidden');await wait_for_save_commit(page)
   await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();commit=await wait_for_save_commit(page);raw=await observed_save_bytes(page);stored=json.loads(raw)
   # The readonly observer still uses the known DB locator when the optional
   # databases() enumeration method is unavailable; it never creates a DB.
   await page.evaluate("()=>{window.savedDatabaseEnumeration=indexedDB.databases;Object.defineProperty(indexedDB,'databases',{value:undefined,configurable:true})}")
   assert await observed_save_bytes(page)==raw
   await page.evaluate("()=>{Object.defineProperty(indexedDB,'databases',{value:window.savedDatabaseEnumeration,configurable:true})}")
   assert stored['replayCanonical'] and all(r['mission']['completed'] for r in stored['replayCanonical']['campaign']['missions'].values())
   async with page.expect_download() as exporting:await page.locator('[data-command="export"]').click()
   export=args.output/f'{name}-ordinary-large-export.json';await (await exporting.value).save_as(str(export));assert export.read_bytes()==raw.encode(),'paused current in-memory Export equals actual committed raw graph'
   await page.screenshot(path=str(args.output/f'{name}-large-save.png'))
   slots=await page.evaluate("()=>Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return {key,length:localStorage.getItem(key).length}})")
   assert not any(row['length']>1000 for row in slots),'localStorage holds no full second graph'
   await page.reload();await page.locator('#continue-game').click();await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await wait_for_save_commit(page);continued=json.loads(await observed_save_bytes(page));assert continued['replayCanonical']==stored['replayCanonical'],'the whole permanent four-story world survives Continue'
   await page.locator('[data-command="resume"]').click();await page.locator('.wordmark').click();await page.locator('#mercy-game').click();await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await wait_for_save_commit(page);mercy=json.loads(await observed_save_bytes(page));assert mercy.get('campaignId')!='dust-and-mercy' and mercy['mission']['id']=='the-last-water'
   await page.reload();await page.locator('#continue-game').click();await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await wait_for_save_commit(page);back=json.loads(await observed_save_bytes(page));assert back['replayCanonical']==stored['replayCanonical']
   await page.goto(args.url+'?mode=mercy');await page.locator('#continue-game').click();await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await wait_for_save_commit(page);again=json.loads(await observed_save_bytes(page));assert again['mission']==mercy['mission'] and again['inventory']==mercy['inventory']
   # A native readonly transaction setup failure must not silently return a
   # different readable legacy graph as this committed Save.
   stale=gzip.decompress((ROOT/'tests/fixtures/journey-v3-rescue-complete.json.gz').read_bytes()).decode()
   await page.evaluate("""raw=>{localStorage.setItem('dust-mercy.journey.v1',raw);window.savedReadTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){return window.savedReadTransaction.call(this,mode==='readonly'?'deliberately-missing-store':names,mode,...args)}}""",stale)
   rejected=False
   try:await observed_save_bytes(page)
   except Exception:rejected=True
   await page.evaluate("()=>{IDBDatabase.prototype.transaction=window.savedReadTransaction}")
   assert rejected,'a failed authoritative DB read must never fall back to stale legacy data'
   assert not errors,errors;rows.append({'profile':name,'passed':True,'commit':commit,'largeBytes':len(raw.encode()),'exportSHA256':hashlib.sha256(raw.encode()).hexdigest(),'localSlotLengths':slots,'normalImportSaveContinueExport':True,'bothWorldsPreserved':True,'readonlyObserverWithoutDatabasesAPI':True,'readonlyFailureRejectsStaleLegacyFallback':True,'errors':errors});await browser.close();print(name,flush=True)
  # Negative storage environment: a real newer IndexedDB schema rejects this
  # application's open, while an untouched old legacy save remains readable.
  browser=await p.webkit.launch();page=await browser.new_page(viewport={'width':375,'height':667},has_touch=True,is_mobile=True)
  await page.route('**/__failure_setup',lambda route:route.fulfill(body='<!doctype html><title>Storage failure fixture</title>',content_type='text/html'))
  await page.goto(args.url+'/__failure_setup');legacy=gzip.decompress((ROOT/'tests/fixtures/journey-v3-rescue-complete.json.gz').read_bytes()).decode()
  await page.evaluate("""async raw=>{localStorage.setItem('dust-mercy.journey.v1',raw);await new Promise((resolve,reject)=>{const r=indexedDB.open('dust-mercy.saves',2);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onerror=()=>reject(r.error);r.onsuccess=()=>{r.result.close();resolve()}})}""",legacy)
  await page.goto(args.url);await page.locator('#continue-game').click();await page.locator('[data-panel="menu"]').click();await page.locator('[data-command="save"]').click();await page.wait_for_function("document.querySelector('#save-status').dataset.saveState==='failed'")
  refused=False
  try:await observed_save_bytes(page)
  except ValueError:refused=True
  assert refused,'failed current Save cannot be replaced with stale readable legacy bytes';assert await page.evaluate("localStorage.getItem('dust-mercy.journey.v1')")==legacy
  await page.screenshot(path=str(args.output/'webkit-real-open-failure.png'));rows.append({'profile':'webkit-real-open-failure','passed':True,'actualFailure':'VersionError','currentSaveReaderRefused':True,'legacyBytesExact':True});await browser.close()
 report={'passed':all(row['passed'] for row in rows),'kind':'normal-frontend-large-native-save-and-real-storage-failure','source':str(args.source),'sourceSHA256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'provenance':'Unchanged native earned four-story replay with explicit initial camp proximity fixture limits. UI actions are normal file Import, menus, Save, Export and Continue; no game API/state writes. Negative environment creates a real future database schema and installs unchanged legacy bytes; no fabricated gameplay fields.','results':rows,'limitations':['This imported native route is not a fresh public four-story gameplay proof.','WebKit phone approximates Safari engine, not real iOS.','Pagehide save remains best-effort; assertions await actual manual commit.']};(args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');return report['passed']
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4196');parser.add_argument('--source',type=Path,default=None);parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-indexeddb-public-ui'))
raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
