"""Real IndexedDB unit/integration probes. Storage fixtures use unchanged game
bytes; these direct API cases are not public gameplay or hardware evidence.
"""
import argparse,asyncio,gzip,hashlib,json,os
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-x64')
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
HTML=r'''<!doctype html><meta charset="utf-8"><button id="run">Run storage checks</button><pre id="result"></pre><script type="module">
import * as D from '/src/save-database.js';import * as L from '/src/save-slots.js';import * as Sim from '/src/frontier.js';
const ok=(value,label)=>{if(!value)throw new Error(label)},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),codec={restore:raw=>Sim.restore(raw),modeOf:s=>Sim.isCampaign(s)?'campaign':'mercy'};
const digest=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function nativeOpen(version){return new Promise((resolve,reject)=>{const r=indexedDB.open(D.SAVE_DATABASE_NAME,version);r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result)});}
async function run(){
 const old=await(await fetch('/__source/old')).text(),latest=await(await fetch('/__source/latest')).text(),full=await(await fetch('/__source/full')).text(),replay=await(await fetch('/__source/replay')).text(),mercy=Sim.serialize(Sim.createState('mercy'));
 for(const [name,raw]of[['old',old],['full',full],['replay',replay],['mercy',mercy]])ok(Sim.restore(raw),'owning codec validates '+name);
 const tests=[];localStorage.setItem(L.CAMPAIGN_SAVE_KEY,old);localStorage.setItem(L.MERCY_SAVE_KEY,mercy);localStorage.setItem(L.LEGACY_SAVE_KEY,latest);
 let repo=D.createSaveRepository({...codec,legacyStorage:localStorage});ok(await repo.ready,'real backend is ready');let values=await repo.loadCandidates('campaign');ok(values[0]===latest,'latest original legacy bytes override a stale same-world canonical archive');ok((await repo.loadCandidates('mercy'))[0]===mercy,'migration keeps other world');ok(localStorage.getItem(L.CAMPAIGN_SAVE_KEY)===old&&localStorage.getItem(L.MERCY_SAVE_KEY)===null,'only identical migrated duplicates are removed; distinct valid canonical copy remains recoverable');tests.push('exact original-byte two-world migration with latest legacy authority');
 let localQuota=null;try{localStorage.setItem('large-unit-quota-probe',full)}catch(e){localQuota=e.name}finally{localStorage.removeItem('large-unit-quota-probe')}
 await repo.save(L.CAMPAIGN_SAVE_KEY,full);ok((await repo.loadCandidates('campaign'))[0]===full,'actual full four-story raw bytes commit');ok((await repo.loadCandidates('mercy'))[0]===mercy,'large commit preserves other world');tests.push('large valid complete histories beyond five-MiB UTF-16');
 localStorage.setItem(L.CAMPAIGN_SAVE_KEY,latest);localStorage.setItem(L.LEGACY_SAVE_KEY,latest);await repo.close();repo=D.createSaveRepository({...codec,legacyStorage:localStorage});ok(await repo.ready,'reopen with distinct genuine legacy bytes');ok((await repo.loadCandidates('campaign'))[0]===full,'existing valid DB authority wins without guessing recency');ok(localStorage.getItem(L.CAMPAIGN_SAVE_KEY)===latest&&localStorage.getItem(L.LEGACY_SAVE_KEY)===latest,'different genuine legacy bytes are never deleted');ok(repo.recoveries().some(copy=>copy.raw===latest),'different legacy state has an explicit recovery path');
 await repo.save(L.CAMPAIGN_SAVE_KEY,latest,{preservePrevious:true});ok((await repo.loadCandidates('campaign'))[0]===latest,'explicit adoption changes canonical authority');ok(repo.recoveries().some(copy=>copy.raw===full),'the prior genuine DB world remains exactly recoverable');tests.push('distinct valid DB and legacy states survive review and explicit adoption');
 const jobs=[repo.save(L.CAMPAIGN_SAVE_KEY,old),repo.save(L.CAMPAIGN_SAVE_KEY,full),repo.save(L.CAMPAIGN_SAVE_KEY,replay)];await Promise.all(jobs);ok((await repo.loadCandidates('campaign'))[0]===replay,'FIFO requested snapshots cannot finish out of order');tests.push('ordered exact snapshot queue');
 await repo.save(L.MERCY_SAVE_KEY,mercy);await repo.close();repo=D.createSaveRepository({...codec,legacyStorage:localStorage});ok(await repo.ready,'reopen backend');ok((await repo.loadCandidates('campaign'))[0]===replay&&(await repo.loadCandidates('mercy'))[0]===mercy,'both worlds and replay survive fresh connection');tests.push('fresh connection preserves both-world authority');await repo.close();
 const db=await D.openSaveDatabase(),baseline=await D.readDatabaseSlots(db);
 const failed=D.beginDatabaseSave(db,L.CAMPAIGN_SAVE_KEY,full,{archive:{slot:L.MERCY_SAVE_KEY,serialized:mercy}});
 // This genuine native duplicate-key request fails asynchronously after the
 // replacement requests were queued; IndexedDB must roll them all back.
 failed.transaction.objectStore(D.SAVE_DATABASE_STORE).add('constraint-failure-fixture',L.CAMPAIGN_SAVE_KEY);
 let failure=null;try{await failed.done}catch(e){failure=e.name}ok(failure==='ConstraintError','real duplicate-key transaction fails');ok(same([...await D.readDatabaseSlots(db)],[...baseline]),'aborted target/archive/last-slot retain exact prior bytes');tests.push('real asynchronous request error rolls back complete transaction');
 const aborted=D.beginDatabaseSave(db,L.CAMPAIGN_SAVE_KEY,old);aborted.transaction.abort();let abortName=null;try{await aborted.done}catch(e){abortName=e.name}ok(abortName==='AbortError','explicit native transaction abort');ok(same([...await D.readDatabaseSlots(db)],[...baseline]),'explicit abort restores all prior bytes');tests.push('explicit native abort preserves authority');
 const originalPut=IDBObjectStore.prototype.put;let enqueueCount=0,enqueueFailure;
 try{
  IDBObjectStore.prototype.put=function(value,key){enqueueCount++;return originalPut.call(this,enqueueCount===2?(()=>{}):value,key)};
  enqueueFailure=D.beginDatabaseSave(db,L.CAMPAIGN_SAVE_KEY,full);
 }finally{IDBObjectStore.prototype.put=originalPut;}
 let enqueueName=null;try{await enqueueFailure.done}catch(e){enqueueName=e.name}
 ok(enqueueName==='DataCloneError','real synchronous second native put enqueue failure is retained');ok(same([...await D.readDatabaseSlots(db)],[...baseline]),'setup failure aborts the earlier queued replacement and metadata');tests.push('second-write synchronous native enqueue failure explicitly aborts');
 const archiveDb=await D.openSaveDatabase({open:(name,version)=>indexedDB.open(name+'.archive-fault',version)});await D.beginDatabaseSave(archiveDb,L.CAMPAIGN_SAVE_KEY,old).done;const archiveBaseline=await D.readDatabaseSlots(archiveDb);
 let archiveFailure=null;try{IDBObjectStore.prototype.put=function(value,key){return originalPut.call(this,key===L.MERCY_SAVE_KEY?(()=>{}):value,key)};try{await D.beginDatabaseSave(archiveDb,L.CAMPAIGN_SAVE_KEY,full,{archive:{slot:L.MERCY_SAVE_KEY,serialized:mercy}}).done}catch(e){archiveFailure=e.name}}finally{IDBObjectStore.prototype.put=originalPut;}
 ok(archiveFailure==='DataCloneError','real asynchronous archive callback enqueue fails');ok(same([...await D.readDatabaseSlots(archiveDb)],[...archiveBaseline]),'archive callback failure rolls back target and metadata too');archiveDb.close();tests.push('archive callback enqueue failure explicitly aborts without page error');
 sessionStorage.clear();sessionStorage.setItem(L.CAMPAIGN_SAVE_KEY,old);sessionStorage.setItem(L.MERCY_SAVE_KEY,mercy);sessionStorage.setItem(L.LEGACY_SAVE_KEY,old);let migrationFailure;
 try{IDBObjectStore.prototype.put=function(value,key){return originalPut.call(this,key===L.MERCY_SAVE_KEY?(()=>{}):value,key)};const broken=D.createSaveRepository({...codec,factory:{open:(name,version)=>indexedDB.open(name+'.migration-fault',version)},legacyStorage:sessionStorage});ok(await broken.ready===false,'actual migration callback native enqueue failure is reported');migrationFailure=broken.error?.name;await broken.close()}finally{IDBObjectStore.prototype.put=originalPut;}
 ok(migrationFailure==='DataCloneError','native migration failure cause retained');ok(sessionStorage.getItem(L.CAMPAIGN_SAVE_KEY)===old&&sessionStorage.getItem(L.MERCY_SAVE_KEY)===mercy&&sessionStorage.getItem(L.LEGACY_SAVE_KEY)===old,'failed migration retains every exact old byte');const migrationDb=await D.openSaveDatabase({open:(name,version)=>indexedDB.open(name+'.migration-fault',version)});ok((await D.readDatabaseSlots(migrationDb)).size===0,'failed migration leaves no partial authority');migrationDb.close();tests.push('migration callback failure preserves both-world legacy bytes');
 const timed=D.createSaveRepository({...codec,legacyStorage:null});await timed.ready;const start=performance.now();for(let i=0;i<3;i++)timed.candidates('campaign');const candidateMs=(performance.now()-start)/3;await timed.close();db.close();
 let closed=null;try{D.beginDatabaseSave(db,L.CAMPAIGN_SAVE_KEY,old)}catch(e){closed=e.name}ok(closed==='InvalidStateError','closed native connection rejects save');const reopened=await D.openSaveDatabase();ok(same([...await D.readDatabaseSlots(reopened)],[...baseline]),'closed-connection failure leaves committed data intact');reopened.close();tests.push('actual closed connection failure preserves prior data');
 localStorage.setItem(L.CAMPAIGN_SAVE_KEY,old);localStorage.setItem(L.LEGACY_SAVE_KEY,old);const future=await nativeOpen(2);future.close();const unavailable=D.createSaveRepository({...codec,legacyStorage:localStorage});ok(await unavailable.ready===false,'real future schema causes unsupported open error');ok(unavailable.error?.name==='VersionError','the actual native open error is retained');ok((await unavailable.loadCandidates('campaign'))[0]===old,'validated old bytes remain readable on open failure');let saveFailed=false;try{await unavailable.save(L.CAMPAIGN_SAVE_KEY,full)}catch{saveFailed=true}ok(saveFailed,'failed backend never claims a memory-only save');ok(localStorage.getItem(L.LEGACY_SAVE_KEY)===old,'failed open leaves legacy bytes unchanged');tests.push('real unsupported DB version fails truthfully with intact legacy fallback');
 return {passed:true,tests,localQuota,candidateMs,fullBytes:new Blob([full]).size,fullCodeUnits:full.length,fullSHA256:await digest(full),replaySHA256:await digest(replay),scope:'Direct real-browser storage API fixtures, not public full-game proof'};
}
window.probe={run};document.querySelector('#run').onclick=async()=>{try{window.storageResult=await run()}catch(e){window.storageResult={passed:false,error:e.message,stack:e.stack}}document.querySelector('#result').textContent=JSON.stringify(window.storageResult)};
</script>'''
async def main(args):
 args.output.mkdir(parents=True,exist_ok=True)
 sources={'latest':gzip.decompress((ROOT/'tests/fixtures/journey-v3-hunt-invitation.json.gz').read_bytes()),'old':gzip.decompress((ROOT/'tests/fixtures/journey-v3-rescue-complete.json.gz').read_bytes()),'full':gzip.decompress((ROOT/'tests/fixtures/save-v4-four-stories-complete-native.json.gz').read_bytes()),'replay':gzip.decompress((ROOT/'tests/fixtures/save-v4-four-stories-opening-replay-native.json.gz').read_bytes())}
 results=[]
 async with async_playwright() as p:
  for engine in args.engines.split(','):
   browser=await getattr(p,engine).launch();page=await browser.new_page(viewport={'width':1280,'height':800});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/__storage_probe',lambda route:route.fulfill(body=HTML,content_type='text/html'))
   async def source_route(route):await route.fulfill(body=sources[route.request.url.rsplit('/',1)[1]],content_type='application/json')
   await page.route('**/__source/*',source_route)
   await page.goto(args.url.rstrip('/')+'/__storage_probe');await page.wait_for_function('!!window.probe');await page.locator('#run').click();await page.wait_for_function('!!window.storageResult',timeout=60000);result=await page.evaluate('window.storageResult');result.update({'engine':engine,'pageErrors':errors});results.append(result);await page.screenshot(path=str(args.output/f'{engine}.png'));await browser.close();print(json.dumps(result),flush=True)
 report={'passed':all(r['passed'] and not r['pageErrors'] for r in results),'kind':'real-indexeddb-storage-unit-integration','results':results,'sourceSHA256':{name:hashlib.sha256(data).hexdigest() for name,data in sources.items()},'limitations':['Direct storage API fixtures use unchanged native/provenanced game graphs. They do not demonstrate a public gameplay route.','WebKit approximates Safari’s engine, not real iOS hardware.']};(args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n');return report['passed']
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4196');parser.add_argument('--engines',default='chromium,firefox,webkit');parser.add_argument('--native-dir',type=Path,default=Path('/tmp/dust-mercy-indexeddb-native-fixtures'));parser.add_argument('--output',type=Path,default=Path('/tmp/dust-mercy-indexeddb-storage-browser'))
raise SystemExit(0 if asyncio.run(main(parser.parse_args())) else 1)
