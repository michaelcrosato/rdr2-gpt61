/** Async exact-byte save authority. Game graphs are neither truncated nor
 * re-encoded here; only the owning codec decides whether a graph is valid.
 */
import {LEGACY_SAVE_KEY,CAMPAIGN_SAVE_KEY,MERCY_SAVE_KEY,readLegacySave,saveSlotFor} from './save-slots.js';
export const SAVE_DATABASE_NAME='dust-mercy.saves';
export const SAVE_DATABASE_VERSION=1;
export const SAVE_DATABASE_STORE='snapshots';
export const SAVE_DATABASE_LAST_SLOT='last-slot';
const RECOVERY_PREFIX='recovery:';
const slots=[CAMPAIGN_SAVE_KEY,MERCY_SAVE_KEY],allowed=new Set(slots);
export function openSaveDatabase(factory=globalThis.indexedDB,{timeoutMs=5000}={}){
  return new Promise((resolve,reject)=>{
    if(!factory){reject(new Error('Device save storage is unavailable.'));return;}
    let request;try{request=factory.open(SAVE_DATABASE_NAME,SAVE_DATABASE_VERSION);}catch(error){reject(error);return;}
    let failed=false;
    const timer=setTimeout(()=>{failed=true;reject(new Error('Device save storage did not become ready.'));},timeoutMs);
    request.onupgradeneeded=()=>{try{if(!request.result.objectStoreNames.contains(SAVE_DATABASE_STORE))request.result.createObjectStore(SAVE_DATABASE_STORE);}catch(error){failed=true;clearTimeout(timer);try{request.transaction.abort();}catch{}reject(error);}};
    request.onerror=()=>{failed=true;clearTimeout(timer);reject(request.error||new Error('Device save storage could not open.'));};
    request.onblocked=()=>{failed=true;clearTimeout(timer);reject(new Error('Another page is holding an older save-storage connection.'));};
    request.onsuccess=()=>{clearTimeout(timer);if(failed){request.result.close();return;}const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  });
}
function transaction(db,mode){
  // Strict is a durability hint, not a guarantee against device failure.
  try{return db.transaction(SAVE_DATABASE_STORE,mode,{durability:'strict'});}catch(error){if(error.name!=='TypeError')throw error;return db.transaction(SAVE_DATABASE_STORE,mode);}
}
function completion(tx){return new Promise((resolve,reject)=>{tx.addEventListener('complete',()=>resolve(true),{once:true});tx.addEventListener('abort',()=>reject(tx.error||new DOMException('Device save transaction was aborted.','AbortError')),{once:true});});}
function managedTransaction(db,mode,enqueue){
  const tx=transaction(db,mode);let failure=null;
  const done=completion(tx).catch(error=>{throw failure||error;});
  const abort=error=>{failure ||= error;try{tx.abort();}catch{}};
  const guard=callback=>event=>{try{callback(event);}catch(error){abort(error);}};
  try{enqueue(tx.objectStore(SAVE_DATABASE_STORE),guard);}catch(error){abort(error);}
  return {transaction:tx,done};
}
export function readDatabaseSlots(db){
  const result=new Map(),read=managedTransaction(db,'readonly',(store,guard)=>{
    const request=store.openCursor();request.onsuccess=guard(()=>{const cursor=request.result;if(!cursor)return;if(allowed.has(cursor.key)||cursor.key===SAVE_DATABASE_LAST_SLOT||typeof cursor.key==='string'&&cursor.key.startsWith(RECOVERY_PREFIX))result.set(cursor.key,cursor.value);cursor.continue();});
  });return read.done.then(()=>result);
}
export function beginDatabaseSave(db,slot,serialized,{archive=null,preservePrevious=false}={}){
  if(!allowed.has(slot)||typeof serialized!=='string')throw new TypeError('Invalid save slot or bytes.');
  if(archive&&(!allowed.has(archive.slot)||archive.slot===slot||typeof archive.serialized!=='string'))throw new TypeError('Invalid other-world archive.');
  let archived=false,recovery=null;
  const write=managedTransaction(db,'readwrite',(store,guard)=>{
    if(preservePrevious){const previous=store.get(slot);previous.onsuccess=guard(()=>{
      const raw=previous.result;if(typeof raw!=='string'||raw===serialized)return;
      const scan=store.openCursor();scan.onsuccess=guard(()=>{const cursor=scan.result;if(cursor){if(typeof cursor.key==='string'&&cursor.key.startsWith(RECOVERY_PREFIX)&&cursor.value===raw)return;cursor.continue();}else{const key=RECOVERY_PREFIX+slot+':'+crypto.randomUUID();store.put(raw,key);recovery={key,raw};}});
    });}
    if(archive){const request=store.get(archive.slot);request.onsuccess=guard(()=>{if(request.result===undefined){store.put(archive.serialized,archive.slot);archived=true;}});}
    store.put(serialized,slot);store.put(slot,SAVE_DATABASE_LAST_SLOT);
  });return {transaction:write.transaction,done:write.done.then(()=>({archived,recovery}))};
}
function legacyBytes(storage){
  const result=new Map();if(!storage)return result;
  for(const slot of slots){try{const raw=storage.getItem(slot);if(typeof raw==='string')result.set(slot,raw);}catch{}}
  try{const raw=readLegacySave(storage);if(typeof raw==='string')result.set(LEGACY_SAVE_KEY,raw);}catch{}
  return result;
}
export function createSaveRepository({factory=globalThis.indexedDB,legacyStorage,restore,modeOf}={}){
  if(typeof restore!=='function'||typeof modeOf!=='function')throw new TypeError('The owning save codec is required.');
  if(legacyStorage===undefined){try{legacyStorage=globalThis.localStorage;}catch{legacyStorage=null;}}
  let db=null,cache=new Map(),tail=Promise.resolve(),ready=false,problem=null;
  // Retain at most four exact strings and scalar classifications. Decoded
  // mutable game states never enter this cache; actual loading still restores.
  const classifications=new Map();
  function candidateMode(raw){
    if(typeof raw!=='string')return null;
    if(classifications.has(raw)){const mode=classifications.get(raw);classifications.delete(raw);classifications.set(raw,mode);return mode;}
    let mode=null;try{const state=restore(raw),value=state&&modeOf(state);if(value==='campaign'||value==='mercy')mode=value;}catch{}
    if(classifications.size>=4)classifications.delete(classifications.keys().next().value);classifications.set(raw,mode);return mode;
  }
  function valid(raw,slot){const mode=candidateMode(raw);return mode!==null&&saveSlotFor(mode)===slot;}
  function cleanup(){
    if(!legacyStorage)return;
    try{
      const old=readLegacySave(legacyStorage),oldMode=candidateMode(old),identical=oldMode&&cache.get(saveSlotFor(oldMode))===old;
      const last=cache.get(SAVE_DATABASE_LAST_SLOT);
      // Different valid bytes are a distinct recovery candidate, not evidence
      // of an older/staler copy. Only exact migrated duplicates are removed.
      if((old===null||!oldMode||identical)&&allowed.has(last))legacyStorage.setItem(LEGACY_SAVE_KEY,JSON.stringify({format:'dust-mercy-database-reference',database:SAVE_DATABASE_NAME,slot:last}));
      for(const slot of slots){const previous=legacyStorage.getItem(slot);if(previous!==null&&cache.get(slot)===previous)legacyStorage.removeItem(slot);}
    }catch{ /* IndexedDB has committed; a locator is optional and not authority. */ }
  }
  const initialized=(async()=>{
    try{
      db=await openSaveDatabase(factory);cache=await readDatabaseSlots(db);
      const originals=legacyBytes(legacyStorage),migration=new Map();let legacyLast=null;
      for(const [key,raw]of originals){const mode=candidateMode(raw);if(!mode)continue;const slot=saveSlotFor(mode);if(key!==LEGACY_SAVE_KEY&&key!==slot)continue;if(!cache.has(slot)&&(!migration.has(slot)||key===LEGACY_SAVE_KEY))migration.set(slot,raw);if(key===LEGACY_SAVE_KEY)legacyLast=slot;}
      if(migration.size){
        // Re-check within the transaction so another page's valid committed
        // world always wins over a stale legacy copy.
        const write=managedTransaction(db,'readwrite',(store,guard)=>{
          for(const [slot,raw]of migration){const request=store.get(slot);request.onsuccess=guard(()=>{if(request.result===undefined)store.put(raw,slot);});}
          if(!allowed.has(cache.get(SAVE_DATABASE_LAST_SLOT))){const request=store.get(SAVE_DATABASE_LAST_SLOT);request.onsuccess=guard(()=>{if(!allowed.has(request.result))store.put(legacyLast||migration.keys().next().value,SAVE_DATABASE_LAST_SLOT);});}
        });await write.done;cache=await readDatabaseSlots(db);
      }
      ready=true;cleanup();return true;
    }catch(error){problem=error;ready=true;return false;}
  })();
  function fallback(mode){const originals=legacyBytes(legacyStorage),out=[];for(const key of [saveSlotFor(mode),LEGACY_SAVE_KEY]){const raw=originals.get(key),kind=candidateMode(raw);if(kind&&(key===LEGACY_SAVE_KEY||saveSlotFor(kind)===key)&&!out.includes(raw))out.push(raw);}return out;}
  return {
    ready:initialized,
    get settled(){return ready;},get error(){return problem;},
    candidateMode,
    recoveries(){
      const out=[],seen=new Set();
      for(const [key,raw]of [...cache,...legacyBytes(legacyStorage)]){
        if(key===SAVE_DATABASE_LAST_SLOT||allowed.has(key)&&cache.get(key)===raw||typeof raw!=='string')continue;
        const mode=candidateMode(raw);if(!mode)continue;const slot=saveSlotFor(mode);if(cache.get(slot)===raw||seen.has(raw))continue;
        seen.add(raw);out.push({key,slot,raw});
      }return out;
    },
    candidates(mode){
      const out=[];for(const key of [saveSlotFor(mode),cache.get(SAVE_DATABASE_LAST_SLOT)]){const raw=cache.get(key);if(allowed.has(key)&&valid(raw,key)&&!out.includes(raw))out.push(raw);}
      if(!db||problem||!valid(cache.get(saveSlotFor(mode)),saveSlotFor(mode)))for(const raw of fallback(mode))if(!out.includes(raw))out.push(raw);
      return out;
    },
    async loadCandidates(mode){await initialized;await tail;if(db&&!problem)cache=await readDatabaseSlots(db);return this.candidates(mode);},
    save(slot,serialized,{preservePrevious=false}={}){
      // The caller captures the exact graph before enqueueing; later state
      // changes and later completions cannot replace an earlier snapshot.
      if(!valid(serialized,slot))return Promise.reject(new Error('The current journey is not a valid owned save.'));
      const operation=tail.then(async()=>{
        await initialized;if(!db||problem)throw problem||new Error('Device save storage is unavailable.');
        const prior=legacyBytes(legacyStorage),old=prior.get(LEGACY_SAVE_KEY);let archive=null;
        if(old){const mode=candidateMode(old),other=mode&&saveSlotFor(mode);if(other&&other!==slot&&!valid(cache.get(other),other))archive={slot:other,serialized:old};}
        const write=beginDatabaseSave(db,slot,serialized,{archive,preservePrevious}),result=await write.done;
        // Confirmation reads cannot turn an already committed write into a
        // false failure. The transaction itself supplies the exact new bytes.
        cache.set(slot,serialized);cache.set(SAVE_DATABASE_LAST_SLOT,slot);if(result.archived)cache.set(archive.slot,archive.serialized);
        if(result.recovery)cache.set(result.recovery.key,result.recovery.raw);
        cleanup();return true;
      });
      tail=operation.catch(()=>{});return operation;
    },
    async close(){await tail;db?.close();db=null;},
  };
}
