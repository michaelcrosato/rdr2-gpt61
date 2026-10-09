import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {LEGACY_SAVE_KEY as LEGACY,CAMPAIGN_SAVE_KEY as CAMPAIGN,MERCY_SAVE_KEY as MERCY,saveSlotFor,readLegacySave,savedSlotCandidates,writeSaveSlot} from '../src/save-slots.js';

// Storage-unit emulation of atomic setItem and a five-MiB UTF-16 quota. The
// bytes below are untouched game-generated fixtures, not invented progress.
const fixture=name=>gunzipSync(fs.readFileSync(new URL(`fixtures/journey-v3-${name}.json.gz`,import.meta.url))).toString('utf8');
const earlier=fixture('rescue-complete'),later=fixture('hunt-complete');
const mercy='{"version":1,"region":"mercy","unitFixture":"other-world-byte-preservation"}\n';
class Storage {
  constructor(initial={},quota=Infinity){this.values=new Map();this.quota=quota;this.writes=[];for(const [key,value]of Object.entries(initial))this.setItem(key,value);this.writes=[];}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  removeItem(key){this.values.delete(key);this.writes.push({key,removed:true});}
  setItem(key,value){
    const replacement=new Map(this.values);replacement.set(key,value);
    const bytes=[...replacement].reduce((sum,[k,v])=>sum+2*(k.length+v.length),0);
    if(bytes>this.quota){const error=new Error('Storage quota exceeded.');error.name='QuotaExceededError';throw error;}
    this.values=replacement;this.writes.push({key,value});
  }
}
const reference=slot=>JSON.stringify({format:'dust-mercy-slot-reference',slot});

test('the full uncompressed graph saves once under a five-MiB quota where duplicate raw storage fails',()=>{
  const storage=new Storage({},5*1024*1024);
  storage.setItem(CAMPAIGN,later);
  assert.throws(()=>storage.setItem(LEGACY,later),{name:'QuotaExceededError'});
  assert.equal(writeSaveSlot(storage,CAMPAIGN,later),true);
  assert.equal(storage.getItem(CAMPAIGN),later,'every original byte and checkpoint remains');
  assert.equal(storage.getItem(LEGACY),reference(CAMPAIGN));assert.ok(storage.getItem(LEGACY).length<100);
  assert.equal(readLegacySave(storage),later);assert.deepEqual(savedSlotCandidates(storage,'campaign'),[later]);
});
test('replacing old duplicated saves releases the legacy bytes before the canonical replacement',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier,[LEGACY]:earlier},5*1024*1024);
  assert.throws(()=>storage.setItem(CAMPAIGN,later),{name:'QuotaExceededError'});
  writeSaveSlot(storage,CAMPAIGN,later);
  assert.equal(storage.writes[0].key,LEGACY);assert.equal(storage.writes[0].value,reference(CAMPAIGN));
  assert.equal(storage.getItem(CAMPAIGN),later);assert.equal(readLegacySave(storage),later);
});
test('legacy-only plain saves and both canonical slots return exact old bytes without normalization',()=>{
  const old=new Storage({[LEGACY]:earlier});assert.equal(readLegacySave(old),earlier);assert.deepEqual(savedSlotCandidates(old,'campaign'),[earlier]);
  const mixed=new Storage({[CAMPAIGN]:later,[MERCY]:mercy,[LEGACY]:earlier});
  assert.deepEqual(savedSlotCandidates(mixed,'campaign'),[later,earlier]);assert.deepEqual(savedSlotCandidates(mixed,'mercy'),[mercy,earlier]);
  assert.equal(saveSlotFor('campaign'),CAMPAIGN);assert.equal(saveSlotFor('mercy'),MERCY);assert.throws(()=>saveSlotFor('other'));
});
test('canonical references resolve either whitelisted world and leave the other world untouched',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier,[MERCY]:mercy,[LEGACY]:reference(MERCY)});
  assert.equal(readLegacySave(storage),mercy);writeSaveSlot(storage,CAMPAIGN,later);
  assert.equal(storage.getItem(MERCY),mercy);assert.equal(readLegacySave(storage),later);
  assert.deepEqual(savedSlotCandidates(storage,'mercy'),[mercy,later]);
});
test('a valid other-region old legacy archive preserves that complete world before switching the reference',()=>{
  const storage=new Storage({[LEGACY]:mercy});
  writeSaveSlot(storage,CAMPAIGN,later,{slot:MERCY,serialized:mercy});
  assert.equal(storage.getItem(MERCY),mercy);assert.equal(storage.getItem(CAMPAIGN),later);assert.equal(readLegacySave(storage),later);
  assert.deepEqual(storage.writes.map(entry=>entry.key),[LEGACY,MERCY,CAMPAIGN]);
});
test('failed canonical replacement restores prior plain legacy bytes and the old accessible canonical save',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier,[LEGACY]:earlier},5*1024*1024),before=new Map(storage.values);
  const tooLarge=JSON.stringify({storageUnitPayload:'x'.repeat(3*1024*1024)});
  assert.throws(()=>writeSaveSlot(storage,CAMPAIGN,tooLarge),{name:'QuotaExceededError'});
  assert.deepEqual(storage.values,before);assert.equal(readLegacySave(storage),earlier);
});
test('a failed first reference write leaves all prior save bytes unchanged',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier,[LEGACY]:earlier}),before=new Map(storage.values),setItem=storage.setItem.bind(storage);
  storage.setItem=(key,value)=>{if(key===LEGACY)throw new Error('Reference write unavailable.');setItem(key,value);};
  assert.throws(()=>writeSaveSlot(storage,CAMPAIGN,later),/Reference write unavailable/);
  assert.deepEqual(storage.values,before);assert.equal(readLegacySave(storage),earlier);
});
test('a failed new canonical write removes the temporary reference when there was no prior legacy key',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier},5*1024*1024),before=new Map(storage.values);
  const tooLarge=JSON.stringify({storageUnitPayload:'x'.repeat(3*1024*1024)});
  assert.throws(()=>writeSaveSlot(storage,CAMPAIGN,tooLarge),{name:'QuotaExceededError'});
  assert.deepEqual(storage.values,before);assert.equal(storage.getItem(LEGACY),null);assert.deepEqual(savedSlotCandidates(storage,'campaign'),[earlier]);
});
test('failed replacement restores an existing slot reference and rolls back a new other-region archive',()=>{
  const tooLarge=JSON.stringify({storageUnitPayload:'x'.repeat(3*1024*1024)});
  const referenced=new Storage({[CAMPAIGN]:earlier,[MERCY]:mercy,[LEGACY]:reference(MERCY)},5*1024*1024),before=new Map(referenced.values);
  assert.throws(()=>writeSaveSlot(referenced,CAMPAIGN,tooLarge),{name:'QuotaExceededError'});
  assert.deepEqual(referenced.values,before);assert.equal(readLegacySave(referenced),mercy);
  const oldOnly=new Storage({[LEGACY]:earlier},5*1024*1024),original=new Map(oldOnly.values);
  assert.throws(()=>writeSaveSlot(oldOnly,MERCY,tooLarge,{slot:CAMPAIGN,serialized:earlier}),{name:'QuotaExceededError'});
  assert.deepEqual(oldOnly.values,original);assert.equal(readLegacySave(oldOnly),earlier);
});
test('failed other-world archive replacement restores its old bytes before restoring the legacy save',()=>{
  const storage=new Storage({[CAMPAIGN]:earlier,[MERCY]:'old-invalid-byte-fixture',[LEGACY]:mercy},5*1024*1024),before=new Map(storage.values);
  const tooLarge=JSON.stringify({storageUnitPayload:'x'.repeat(3*1024*1024)});
  assert.throws(()=>writeSaveSlot(storage,CAMPAIGN,tooLarge,{slot:MERCY,serialized:mercy}),{name:'QuotaExceededError'});
  assert.deepEqual(storage.values,before);assert.equal(readLegacySave(storage),mercy);
});
test('invalid, dangling and chained references never read arbitrary storage keys or masquerade as graph bytes',()=>{
  for(const raw of [reference('unrelated.secret'),reference(LEGACY),JSON.stringify({format:'dust-mercy-slot-reference',slot:CAMPAIGN,extra:true})]){
    const storage=new Storage({[LEGACY]:raw,'unrelated.secret':'unrelated unit sentinel'});
    assert.equal(readLegacySave(storage),null);assert.deepEqual(savedSlotCandidates(storage,'campaign'),[]);
  }
  const dangling=new Storage({[LEGACY]:reference(CAMPAIGN)});assert.equal(readLegacySave(dangling),null);
  const chained=new Storage({[LEGACY]:reference(CAMPAIGN),[CAMPAIGN]:reference(MERCY),[MERCY]:mercy});
  assert.equal(readLegacySave(chained),null);assert.deepEqual(savedSlotCandidates(chained,'campaign'),[]);
  assert.throws(()=>writeSaveSlot(chained,'unrelated.secret',later));assert.throws(()=>writeSaveSlot(chained,CAMPAIGN,reference(MERCY)));
});
