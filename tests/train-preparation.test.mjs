import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from './helpers/train-preparation-route.mjs';
import * as Preparation from '../src/train-preparation.js';
import * as Custody from '../src/rival-continuation.js';
import * as Powder from '../src/train-powder.js';
import {createPowderFixture} from './helpers/train-powder-fixture.mjs';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_STORE_MARA} from '../content/campaign/train-preparation-camp.js';
import {TRAIN_BRIEFING_CASH_APPROACH} from '../content/campaign/train-camp.js';
const ctx={notice(){},talk(s,id,speaker,text,choices){s.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};}};
function whole(s){const bytes=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(bytes);assert.ok(restored,'entire actually earned graph restores');return restored;}
function begin(){const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});assert.ok(Preparation.getTrainPreparationInteractions(s).some(a=>a.id==='train:prepare-call'));assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-call',ctx),true);return s;}

test('native accepted clinic/briefing remains exact without an inferred preparation declaration',()=>{
  const s=acceptedBriefingNative(),before=structuredClone(trainRecord(s)),objects=structuredClone(s.campaign.missions[RIVAL_ID].objects);const restored=whole(s);
  assert.deepEqual(trainRecord(restored),before);assert.equal(trainRecord(restored).train.preparationVersion,undefined);assert.deepEqual(restored.campaign.missions[RIVAL_ID].objects,objects);assert.equal(Preparation.validateTrainPreparation(restored),true);
});

test('actual nearby native preparation call grants no material, clock, heard lesson, keeper or departure',()=>{
  const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});const before={elapsed:s.elapsed,objects:structuredClone(s.campaign.missions[RIVAL_ID].objects),weapons:structuredClone(s.weapons),inventory:structuredClone(s.inventory),entities:structuredClone(s.entities),score:structuredClone(s.campaign.missions[RIVAL_ID].performance)};
  assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-call',ctx),true);const p=trainRecord(s).train.preparation;
  assert.equal(trainRecord(s).train.preparationVersion,1);assert.deepEqual(p.heard,[]);assert.equal(p.stableDuty,null);assert.equal(p.maskChoice,null);assert.equal(p.departure,null);assert.equal(p.completedAt,null);
  assert.equal(s.elapsed,before.elapsed);assert.deepEqual(s.entities,before.entities);assert.deepEqual(s.weapons,before.weapons);assert.deepEqual(s.inventory,before.inventory);assert.deepEqual(s.campaign.missions[RIVAL_ID].objects,before.objects);assert.deepEqual(s.campaign.missions[RIVAL_ID].performance,before.score);assert.equal(s.campaign.missions[RIVAL_ID].captivity.guardId,'bastian');whole(s);
  assert.equal(Preparation.trainPreparationReadiness(s).ready,false,'missing native, inspection and material work cannot become readiness');
});

test('actual store exchange pauses/restores without unheard completion and rejects declaration/hearing/native-proof forgeries',()=>{
  let s=begin();moveNative(s,TRAIN_STORE_MARA);assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-talk:store',ctx),true);assert.equal(Preparation.chooseTrainPreparation(s,'train-prepare-next',ctx),true);assert.equal(trainRecord(s).train.preparation.heard.length,1);assert.equal(Preparation.chooseTrainPreparation(s,'train-prepare-pause',ctx),true);s=whole(s);assert.equal(trainRecord(s).train.preparation.completed.length,0);
  assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-resume',ctx),true);while(s.dialog)assert.equal(Preparation.chooseTrainPreparation(s,'train-prepare-next',ctx),true);s=whole(s);assert.deepEqual(trainRecord(s).train.preparation.completed.map(e=>e.kind),['store']);
  const raw=JSON.parse(Journey.serializeCampaign(s));for(const mutate of [
    d=>{delete trainRecord(d).train.preparationVersion;},d=>{delete trainRecord(d).train.preparation;},d=>{trainRecord(d).train.preparationVersion=2;},
    d=>{trainRecord(d).train.preparation.heard[0].text='A fabricated count.';},d=>{const h=trainRecord(d).train.preparation.heard;[h[0],h[1]]=[h[1],h[0]];},
    d=>{trainRecord(d).train.preparation.heard[0].actorPosition.x+=200;},d=>{trainRecord(d).train.preparation.stableDuty={accepted:true};},
    d=>{trainRecord(d).train.preparation.maskChoice={owned:true};},d=>{trainRecord(d).train.preparation.departure={complete:true};},
    d=>{trainRecord(d).mission.stage=3;trainRecord(d).train.preparation.completedAt=d.elapsed;},
  ]){const bad=structuredClone(raw);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,mutate.toString());}
});

test('ordinary requested holding exchange waits for real distant speakers and restores without unheard answers',()=>{
  let s=begin();moveNative(s,TRAIN_STORE_MARA);assert.ok(Journey.getCampaignInteractions(s).some(a=>a.id==='train:prepare-talk:store'));Journey.interactCampaign(s,'train:prepare-talk:store');while(s.dialog)Journey.chooseCampaign(s,'train-prepare-next');moveNative(s,TRAIN_BRIEFING_CASH_APPROACH);
  const before=structuredClone(s.entities.inez),heard=structuredClone(trainRecord(s).train.preparation.heard),keeper={x:s.entities.bastian.x,y:s.entities.bastian.y,guardId:s.campaign.missions[RIVAL_ID].captivity.guardId};
  assert.ok(Math.hypot(before.x-RIVAL_WORLD.camp.holding.x,before.y-RIVAL_WORLD.camp.holding.y)>100);assert.ok(Journey.getCampaignInteractions(s).some(a=>a.id==='train:prepare-talk:holding'));Journey.interactCampaign(s,'train:prepare-talk:holding');assert.equal(s.dialog,null);assert.equal(trainRecord(s).train.preparation.exchange.awaitingSpeakers,true);
  Journey.stepCampaign(s,.05);s=whole(s);Journey.stepCampaign(s,.05);assert.equal(s.dialog,null);assert.deepEqual(trainRecord(s).train.preparation.heard,heard);assert.ok(Math.hypot(s.entities.inez.x-before.x,s.entities.inez.y-before.y)<20,'short real steps cannot teleport a distant speaker');assert.deepEqual({x:s.entities.bastian.x,y:s.entities.bastian.y,guardId:s.campaign.missions[RIVAL_ID].captivity.guardId},keeper);whole(s);
});

test('historical source revision resolves actual accepted custody prefixes and never exposes a mutable stock alias',()=>{
  // Explicit scoped Powder component staging and z33 fixture hands; this is
  // NOT native cargo/IK/mission/whole-Save proof. Its actual tin opening and
  // accepted owner commit are the same tested canonical API, without stock edits.
  const f=createPowderFixture(),tinRef={sourceMissionId:RIVAL_ID,objectId:'cap-tin'},before=structuredClone(f.s.campaign.missions[RIVAL_ID].objects['cap-tin']);
  f.approach('ruth',RIVAL_WORLD.camp.charges);const start=f.s.elapsed;assert.deepEqual(Custody.sourceForRevision(f.s,tinRef,0,start),before);f.complete(Powder.requestTinOpening(f.s,f.ctx));
  const event=f.s.campaign.missions[RIVAL_ID].rival.continuation.events[0],at=event.at;f.tick(.1);
  assert.deepEqual(Custody.sourceForRevision(f.s,tinRef,0,start),before);assert.equal(Custody.sourceForRevision(f.s,tinRef,1,start),null);assert.equal(Custody.sourceForRevision(f.s,tinRef,0,at+.01),null,'a strictly older prefix is stale after the actual event');
  const opened=Custody.sourceForRevision(f.s,tinRef,1,at);assert.equal(opened.primers.length,6);opened.primers.length=0;assert.equal(Custody.sourceForRevision(f.s,tinRef,1,at).primers.length,6);assert.equal(Custody.sourceForRevision(f.s,tinRef,2,at),null);assert.equal(Custody.sourceForRevision(f.s,{sourceMissionId:RIVAL_ID,objectId:'invented-cap'},1,at),null);assert.equal(f.history(),true);
});

test('direct custody begin respects a real Powder inspection actor and contained-ancestor lock',()=>{
  // Same explicit component/fixture-hand limits as the revision test above.
  // Both the inspection and later transfer use their actual accepted runner.
  const f=createPowderFixture(),station=RIVAL_WORLD.camp.charges;
  f.ctx.authorizePreparationInspection=(_s,op)=>op.actorIds.join(',')==='mara,ruth';f.approach('mara',{x:station.x-10,y:station.y});f.approach('ruth',{x:station.x+10,y:station.y});
  const ref={sourceMissionId:RIVAL_ID,objectId:'quarry-sealed-charge-1'},crate={sourceMissionId:RIVAL_ID,objectId:'charge-crate'},request=Powder.requestPreparationInspection(f.s,{topic:'child-seal',ref,actorIds:['mara','ruth']},f.ctx);assert.ok(request);
  const p=Powder.trainPowderRecord(f.s),op={kind:'move-object',actorIds:['ruth'],refs:[crate],to:{owner:'ruth',location:{type:'carried',targetId:'ruth'}},options:{},cause:{missionId:'snowbound-what-the-line-carries',eventId:`powder-event-${p.physicalEvents.length+1}`}};
  assert.equal(Custody.beginCustodyRequest(f.s,op,f.ctx),null);assert.deepEqual(f.s.campaign.missions[RIVAL_ID].rival.continuation.requests,{});assert.equal(f.s.campaign.missions[RIVAL_ID].objects['charge-crate'].location.type,'station');
  assert.equal(Powder.cancelPowderWork(f.s,request.workId),true);f.complete(Powder.requestPowderTransfer(f.s,crate,['ruth'],op.to,f.ctx));assert.equal(f.s.campaign.missions[RIVAL_ID].objects['charge-crate'].location.type,'carried');assert.equal(f.history(),true);
});
