import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as Journey from '../src/campaign-journey.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_ID,TRAIN_NEW_CAST,TRAIN_MOVING_CREW,TRAIN_LINE_GUARDS} from '../content/campaign/brass-cutting.js';
import {createRivalContinuation,validateRivalContinuation} from '../src/rival-continuation.js';

const dir=new URL('./fixtures/',import.meta.url),clone=structuredClone;
const fixtures=[
  ['journey-v4-rival-complete.json.gz','journey-v4-provenance.json'],
  ['journey-v4-rival-reloaded.json.gz','journey-v4-provenance.json'],
  ['journey-v4-rival-webkit-current-complete.json.gz','journey-v4-rival-webkit-current-provenance.json'],
  ['journey-v4-rival-webkit-current-reloaded.json.gz','journey-v4-rival-webkit-current-provenance.json'],
  ['save-v4-four-stories-complete-native.json.gz','save-database-native-provenance.json'],
  ['save-v4-four-stories-opening-replay-native.json.gz','save-database-native-provenance.json'],
];
function original(name,manifestName){
  const bytes=gunzipSync(readFileSync(new URL(name,dir))),manifest=JSON.parse(readFileSync(new URL(manifestName,dir)));
  const provenance=(manifest.fixtures||manifest.entries).find(f=>f.fixture===name);assert.ok(provenance,`${name}: genuine fixture provenance`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256OfUncompressedOriginalBytes||provenance.sourceSHA256);
  return JSON.parse(bytes);
}
function checkBody(before,after){
  assert.equal(before.version,4);assert.equal(after.version,5);
  for(const field of ['region','entities','weapons','party','inventory','itemInstances','camp','companions','sideQuests','wanted','honor','stats','elapsed','day','time'])assert.deepEqual(after[field],before[field],`${field}: no invented old fact or new possession`);
  for(const [id,region]of Object.entries(before.regions))assert.deepEqual(after.regions[id],region);
  assert.deepEqual(after.regions['brass-cutting'],{residentIds:[],worldChanges:{},supplies:[],dropped:{}});
  for(const [id,record]of Object.entries(before.campaign.missions)){
    const current=clone(after.campaign.missions[id]);
    if(id===RIVAL_ID){assert.equal(current.rival.continuationVersion,1);assert.deepEqual(current.rival.continuation,createRivalContinuation());delete current.rival.continuationVersion;delete current.rival.continuation;}
    assert.deepEqual(current,record,`${id}: original exchanges, care, scores and custody stay exact`);
  }
  const train=after.campaign.missions[TRAIN_ID];assert.equal(train.mission.completed,false);assert.equal(train.mission.stage,0);assert.deepEqual(train.transactions,{});assert.deepEqual(train.train,{schema:1,powder:null,consist:null});
  for(const actor of [...TRAIN_NEW_CAST,...TRAIN_MOVING_CREW,...TRAIN_LINE_GUARDS])assert.equal(after.entities[actor.id],undefined,'authoring template does not grant arrivals or a train population');
  assert.equal(validateRivalContinuation(after),true);
}
function checkGraph(before,after){
  checkBody(before,after);assert.deepEqual(Object.keys(after.checkpoints||{}),Object.keys(before.checkpoints||{}));assert.deepEqual(Object.keys(after.missionEntries||{}),Object.keys(before.missionEntries||{}));
  for(const [id,checkpoint]of Object.entries(before.checkpoints||{})){const current=after.checkpoints[id];for(const field of ['id','missionId','stage','label'])assert.deepEqual(current[field],checkpoint[field]);checkBody(checkpoint.data,current.data);}
  for(const [id,entry]of Object.entries(before.missionEntries||{}))checkBody(entry,after.missionEntries[id]);
  assert.equal(!!after.replayCanonical,!!before.replayCanonical);if(before.replayCanonical)checkGraph(before.replayCanonical,after.replayCanonical);
}
for(const [name,manifest]of fixtures)test(`v5 preserves every genuine v4 graph in ${name}`,()=>{
  const before=original(name,manifest);assert.equal(Journey.validateLegacyCampaign(before),true,'the owning v4 codec accepts original bytes before migration');
  const state=Journey.restoreCampaign(before);assert.ok(state);const after=JSON.parse(Journey.serializeCampaign(state));checkGraph(before,after);assert.ok(Journey.restoreCampaign(after));
});

test('v5 declarations cannot be omitted, changed or laundered through an earlier graph body',()=>{
  const state=Journey.createCampaignState(),raw=JSON.parse(Journey.serializeCampaign(state));
  for(const mutate of [
    s=>{delete s.campaign.missions[RIVAL_ID].rival.continuationVersion;},
    s=>{delete s.campaign.missions[RIVAL_ID].rival.continuation;},
    s=>{s.campaign.missions[RIVAL_ID].rival.continuationVersion=2;},
    s=>{s.campaign.missions[RIVAL_ID].rival.continuation.events=[{kind:'open-tin'}];},
    s=>{s.campaign.missions[TRAIN_ID].train.powder={kit:{}};},
    s=>{s.entities.mara.support={carId:'morrow-engine'};},
    s=>{s.version=4;},
  ]){const bad=clone(raw);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null);}
});

test('ignored old extension extras never become an earned primer registry during v5 migration',()=>{
  const base=original(...fixtures[0]);
  const targets=[s=>s,s=>Object.values(s.checkpoints).find(cp=>cp.data.campaign.missions[RIVAL_ID].mission.completed)?.data].filter(select=>select(base));
  for(const target of targets)for(const mutate of [
    r=>{r.objects['cap-tin'].primers=[];},r=>{r.objects['cap-tin'].openingEventId='made-up';},
    r=>{r.objects['charge-crate'].issuedCount=4;},r=>{r.objects['quarry-sealed-charge-1'].powder={spent:false};},
    r=>{r.rival.continuationVersion=1;r.rival.continuation=createRivalContinuation();},
  ]){const bad=clone(base);mutate(target(bad).campaign.missions[RIVAL_ID]);assert.equal(Journey.restoreCampaign(bad),null);}
});

test('unknown future companion metadata cannot migrate into an earned train introduction',()=>{
  const before=original(...fixtures[0]);for(const id of ['abel','nell']){const bad=clone(before);bad.companions[id]={trust:0,requests:0};assert.equal(Journey.restoreCampaign(bad),null);}
});
