import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import '../my-3d2dge-agent.js';
import * as Journey from '../src/campaign-journey.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {validateTrainRuntime} from '../src/train-runtime-schema.js';
import {blockedAt} from '../src/campaign-navigation.js';
const RESCUE='snowbound-a-voice-under-ice',RIVAL='snowbound-the-names-they-took',HUNT='snowbound-a-quiet-table';
const raw=name=>gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`,import.meta.url))).toString();
const record=s=>s.campaign.missions[TRAIN_ID];
function roundTrip(s,label){const bytes=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(bytes);if(!restored)writeFileSync(`/tmp/dust-mercy-train-clinic-invalid-${label}.json`,bytes);assert.ok(restored,label);return restored;}
function walk(s,target){
  // Read-only planning around the actual shelter/kitchen solids. Every leg
  // executes ordinary movement input; no body, route or goal is assigned.
  const world=Journey.worldForCampaign(s),size=20,cols=Math.ceil(world.width/size),rows=Math.ceil(world.height/size),point=id=>({x:id%cols*size+10,y:Math.floor(id/cols)*size+10}),cell=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size),start=cell(s.player),end=cell(target),queue=[start],previous=new Map([[start,null]]);
  for(let n=0;n<queue.length&&!previous.has(end);n++)for(const offset of [1,-1,cols,-cols]){const id=queue[n]+offset,p=point(id),old=point(queue[n]);if(id<0||id>=cols*rows||Math.abs(p.x-old.x)>size+1||previous.has(id)||blockedAt(world,p.x,p.y,9))continue;previous.set(id,queue[n]);queue.push(id);}
  assert.ok(previous.has(end),'physical camp route exists');const route=[target];for(let id=end;id!==start;id=previous.get(id))route.push(point(id));
  for(const node of route.reverse()){for(let i=0;i<1000&&Math.hypot(s.player.x-node.x,s.player.y-node.y)>3;i++){const length=Math.hypot(s.player.x-node.x,s.player.y-node.y);Journey.stepCampaign(s,.05,{mx:(node.x-s.player.x)/length,my:(node.y-s.player.y)/length});assert.equal(s.failure,null);}assert.ok(Math.hypot(s.player.x-node.x,s.player.y-node.y)<=3);}
}
function interact(s,id){assert.ok(Journey.getCampaignInteractions(s).some(a=>a.id===id),`${id} actually offered`);Journey.interactCampaign(s,id);}
function choose(s,id='train-speech-next'){assert.ok(s.dialog?.choices.some(c=>c.id===id));Journey.chooseCampaign(s,id);}
function exchange(s,id){interact(s,id);for(let i=0;s.dialog&&i<10;i++)choose(s);assert.equal(s.dialog,null);}
function start(name='journey-v4-rival-webkit-current-reloaded'){
  const s=Journey.restoreCampaign(raw(name));assert.ok(s);assert.ok(!Journey.getCampaignInteractions(s).some(a=>a.id.startsWith('train:')),'unfinished operation has no public entry offer');
  assert.equal(Journey.beginCampaignTrainClinic(s),false,'native entry also requires the actual near patient approach');
  walk(s,{x:385,y:1270});assert.equal(Journey.beginCampaignTrainClinic(s),true);
  assert.equal(record(s).mission.stage,0);assert.equal(record(s).train.chronicle.acceptedAt,null);return s;
}

// No stage, position, HP, inventory, clinical or outcome assignment. Genuine
// prior public/native fixture bytes, real owning migration, actual fixed-step
// movement/verbs, native skeleton/swept bottle contact and whole graph codec.
// This is the implemented native clinic prefix; Train remains unavailable and
// its other nineteen scenes/public browser route are not claimed here.
test('actual clinic entry, separate voices, real owned dressing and native bottle handling survive whole graph checkpoints',()=>{
  let s=start();const oldRival=structuredClone(s.campaign.missions[RIVAL].performance),campMedicine=s.camp.medicine,patientHp=s.entities.silas.hp;
  assert.equal(validateTrainRuntime(s),true);s=roundTrip(s,'entry');
  interact(s,'care:silas');assert.equal(s.camp.medicine,campMedicine-1);assert.equal(s.entities.silas.hp,patientHp+8);assert.equal(record(s).train.chronicle.clinicalActions.length,1);assert.equal(record(s).performance.healingUses,0,'patient care is not Mara consuming a health item');s=roundTrip(s,'actual-care');
  for(let i=0;i<200&&record(s).train.prelude.arrivals.abel.arrivedAt===null;i++)Journey.stepCampaign(s,.05);
  assert.ok(record(s).train.prelude.arrivals.abel.arrivedAt!==null);s=roundTrip(s,'real-arrival');
  interact(s,'train:bedside');assert.equal(s.dialog.speaker,'A visitor at the shelter');choose(s,'train-speech-pause');assert.equal(record(s).train.prelude.acknowledged.length,0);s=roundTrip(s,'unheard-pause');
  interact(s,'train:resume-prelude');choose(s);assert.equal(s.dialog.speaker,'Abel Sedge');s=roundTrip(s,'actual-name');while(s.dialog)choose(s);
  for(let i=0;i<240&&record(s).train.prelude.bottleWork.finishedAt===null;i++)Journey.stepCampaign(s,.05);
  const p=record(s).train.prelude;assert.equal(p.bottle.location.type,'ground');assert.ok(p.bottleWork.intervals.length>=11);assert.ok(p.bottleWork.acceptedSeconds>=1.1-1e-7);s=roundTrip(s,'native-setdown');
  exchange(s,'train:silas');walk(s,{x:410,y:1270});exchange(s,'train:family');Journey.stepCampaign(s,.05);
  assert.equal(record(s).mission.stage,1);assert.equal(record(s).mission.completed,false);assert.equal(record(s).train.chronicle.acceptedAt,null);assert.equal(record(s).choices.operation,null);assert.deepEqual(s.campaign.missions[RIVAL].performance,oldRival);
  s=roundTrip(s,'whole-accepted-frame-checkpoint');assert.ok(s.checkpoints[record(s).checkpointId].data.campaign.missions[TRAIN_ID].train.prelude.bottleWork.finishedAt!==null);
  const full=JSON.parse(Journey.serializeCampaign(s));
  for(const mutate of [
    d=>{record(d).train.chronicle.clinicalActions=[];},
    d=>{record(d).train.chronicle.clinicalActions[0].afterHP++;},
    d=>{record(d).train.chronicle.clinicalActions[0].resource.after++;},
    d=>{record(d).train.prelude.bottleWork.intervals[0].handPoint.x++;},
    d=>{record(d).train.prelude.knownNames=[];},
    d=>{record(d).train.chronicle.acceptedAt=d.elapsed;},
    d=>{record(d).mission.stage=2;},
  ]){const bad=structuredClone(full);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,mutate.toString());}
});

test('actual inherited Hunt ration during native clinic keeps original once-only ownership and freezes earned Rival performance',()=>{
  let s=start('save-v4-four-stories-complete-native');assert.equal(s.inventory.quietRation,1);const hp=s.player.hp,hunt=s.campaign.missions[HUNT],rivalScore=structuredClone(s.campaign.missions[RIVAL].performance);
  Journey.useCampaignItem(s,'quietRation');assert.equal(s.inventory.quietRation,0);assert.equal(s.player.hp,Math.min(100,hp+8));assert.equal(hunt.flags.rationUsed,true);assert.deepEqual(hunt.transactions[`${HUNT}:use:quiet-ration`],{amount:1,completed:true});assert.equal(record(s).performance.healingUses,1);assert.equal(record(s).performance.noHealingItems,false);assert.deepEqual(s.campaign.missions[RIVAL].performance,rivalScore);
  Journey.useCampaignItem(s,'quietRation');assert.equal(record(s).performance.healingUses,1);s=roundTrip(s,'actual-owned-Hunt-ration');assert.equal(record(s).performance.healingUses,1);
});

test('actual offered Rescue and Rival camp windows keep their own dialogue choices during the native clinic',()=>{
  let s=start();interact(s,'aftermath:silas');assert.ok(s.dialog.id.startsWith('rescue-'));s=roundTrip(s,'owning-patient-window');choose(s,'leave');assert.equal(s.dialog,null);
  if(!s.entities.silas.coatRepaired&&s.camp.materials>0){
    const materials=s.camp.materials;interact(s,'repair:silas-coat');assert.equal(s.dialog.id,'rescue-repair-request');s=roundTrip(s,'owning-coat-choice');choose(s,'repair-coat');assert.equal(s.dialog,null);assert.equal(s.entities.silas.coatRepaired,true);assert.equal(s.camp.materials,materials-1);s=roundTrip(s,'actual-paid-coat');
  }
  walk(s,{x:820,y:1240});interact(s,'rival:visit');assert.equal(s.dialog.id,'rival-visit');s=roundTrip(s,'owning-held-Levi-window');choose(s,'leave');assert.equal(s.dialog,null);assert.equal(record(s).mission.completed,false);assert.equal(record(s).train.chronicle.acceptedAt,null);roundTrip(s,'owning-window-return');
});

test('genuine old zero-hours care bytes stay exact on restore and recover naturally at the next accepted clinic frame',()=>{
  const provenance=JSON.parse(readFileSync(new URL('./fixtures/rescue-v4-zero-hours-provenance.json',import.meta.url))),bytes=gunzipSync(readFileSync(new URL(`./fixtures/${provenance.fixture}`,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256OfUncompressedOriginalBytes);assert.equal(bytes.length,provenance.uncompressedBytes);
  const original=JSON.parse(bytes);assert.equal(original.version,4);assert.equal(original.entities.silas.injured,true);assert.equal(original.campaign.missions[RESCUE].rescue.silas.healingHours,0);assert.equal(Journey.validateLegacyCampaign(original),true);
  let s=Journey.restoreCampaign(bytes.toString());assert.ok(s);assert.equal(s.entities.silas.injured,true,'restore cannot invent an earlier completed injury transition');
  assert.equal(s.entities.silas.hp,original.entities.silas.hp);assert.deepEqual(s.campaign.missions[RESCUE].transactions,original.campaign.missions[RESCUE].transactions);
  assert.equal(Journey.beginCampaignTrainClinic(s),true);s=roundTrip(s,'legacy-zero-hours-entry');assert.equal(s.entities.silas.injured,true);
  const unchanged=structuredClone({hp:s.entities.silas.hp,scars:s.entities.silas.scars,inventory:s.inventory,camp:s.camp,transactions:s.campaign.missions[RESCUE].transactions});
  Journey.stepCampaign(s,.05);assert.equal(s.entities.silas.injured,false);assert.equal(s.sideQuests.silas.status,'recovering-strength');assert.deepEqual({hp:s.entities.silas.hp,scars:s.entities.silas.scars,inventory:s.inventory,camp:s.camp,transactions:s.campaign.missions[RESCUE].transactions},unchanged,'actual recovery changes no health, scars, possessions or past care');roundTrip(s,'legacy-zero-hours-actual-frame');
});
