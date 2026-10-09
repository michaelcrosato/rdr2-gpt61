import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {restoreCampaign,serializeCampaign} from '../src/campaign-journey.js';
import {TRAIN_ID,TRAIN_STAGES} from '../content/campaign/brass-cutting.js';
const dir=new URL('fixtures/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('save-database-native-provenance.json',dir),'utf8'));
function priorGraphOnly(original,current){
  assert.equal(original.version,4);assert.equal(current.version,5);
  const result=structuredClone(current),rival=result.campaign.missions['snowbound-the-names-they-took'];
  assert.equal(rival.rival.continuationVersion,1);assert.deepEqual(rival.rival.continuation,{schema:1,initializedAt:null,baseline:null,requestSerial:0,requests:{},events:[]});delete rival.rival.continuationVersion;delete rival.rival.continuation;
  const ready=original.campaign.missions['snowbound-a-quiet-table'].mission.completed&&original.campaign.missions['snowbound-the-names-they-took'].mission.completed;
  assert.deepEqual(result.campaign.missions[TRAIN_ID],{status:ready?'unstarted':'locked',sourceRequirementId:'campaign-who-the-hell-is-leviticus-cornwall',retryCount:0,checkpointId:null,mission:{id:TRAIN_ID,name:'What the Line Carries',stage:0,stageCount:20,completed:false,rewardPaid:false,objective:TRAIN_STAGES[0]},flags:{},timers:{},performance:{},choices:{},transactions:{},train:{schema:1,powder:null,consist:null}});
  delete result.campaign.missions[TRAIN_ID];assert.deepEqual(result.regions['brass-cutting'],{residentIds:[],worldChanges:{},supplies:[],dropped:{}});delete result.regions['brass-cutting'];result.version=4;
  assert.deepEqual(Object.keys(result.checkpoints||{}),Object.keys(original.checkpoints||{}));for(const [id,cp]of Object.entries(original.checkpoints||{}))result.checkpoints[id].data=priorGraphOnly(cp.data,result.checkpoints[id].data);
  assert.deepEqual(Object.keys(result.missionEntries||{}),Object.keys(original.missionEntries||{}));for(const [id,entry]of Object.entries(original.missionEntries||{}))result.missionEntries[id]=priorGraphOnly(entry,result.missionEntries[id]);
  assert.equal(!!result.replayCanonical,!!original.replayCanonical);if(original.replayCanonical)result.replayCanonical=priorGraphOnly(original.replayCanonical,result.replayCanonical);
  return result;
}
for(const item of manifest.fixtures)test(`unchanged earned native ${item.fixture} retains all four stories and exceeds a five-MiB UTF-16 single-slot budget`,()=>{
  const bytes=gunzipSync(fs.readFileSync(new URL(item.fixture,dir)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256OfUncompressedOriginalBytes);
  assert.equal(bytes.length,item.bytes);const raw=bytes.toString('utf8');assert.equal(raw.length,item.codeUnits);assert.ok(raw.length*2>5*1024*1024,'large size comes from actual gameplay/history, not padding');
  const original=JSON.parse(raw),restored=restoreCampaign(original);assert.ok(restored,'the current owning codec accepts the entire original graph');
  const world=original.replayCanonical||original;assert.equal(Object.keys(world.campaign.missions).length,4);assert.ok(Object.values(world.campaign.missions).every(record=>record.mission.completed));
  const again=priorGraphOnly(original,JSON.parse(serializeCampaign(restored)));for(const key of ['version','campaign','entities','weapons','regions','party','itemInstances','camp','inventory','checkpoints','missionEntries','replayCanonical'])assert.deepEqual(again[key],original[key],`${key} survives without truncation or invented outcomes`);
});
