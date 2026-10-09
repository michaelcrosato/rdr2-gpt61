import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,clinicCompleteNative,moveNative,interactNative,trainRecord} from '../helpers/train-clinic-route.mjs';
import {TRAIN_BRIEFING_APPROACHES,TRAIN_BRIEFING_HANDOFF_APPROACH} from '../../content/campaign/train-camp.js';
import {createTrainCampWorkProvider,getTrainCampWorkPose} from '../../src/train-camp-work.js';

test('native paper endpoint probes recheck current hands within the same world clock',()=>{
  const s=clinicCompleteNative('train-briefing-borrowed-prerequisites-v4-native');
  moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);Journey.campaignAction(s,'holster');interactNative(s,'train:brief-call');
  for(let i=0;i<500&&trainRecord(s).train.briefing.setup.finishedAt===null;i++)Journey.stepCampaign(s,.05);
  assert.notEqual(trainRecord(s).train.briefing.setup.finishedAt,null);
  moveNative(s,{x:650,y:TRAIN_BRIEFING_HANDOFF_APPROACH.y});moveNative(s,TRAIN_BRIEFING_HANDOFF_APPROACH);
  const t=s.entities.tomas,d=Math.hypot(t.x-s.player.x,t.y-s.player.y);Journey.stepCampaign(s,.01,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});
  const provider=createTrainCampWorkProvider(My3D2dge,Journey.worldForCampaign),op={kind:'return-papers',actorIds:['mara','tomas'],refs:['route-diagram','seizure-list'].map(objectId=>({sourceMissionId:'snowbound-the-names-they-took',objectId})),to:null,options:{}},span={start:s.elapsed,finish:s.elapsed},before=Journey.serializeCampaign(s);
  assert.equal(provider.powderContactWindow(s,op,span).sweptClear,true);
  assert.equal(provider.powderContactWindow(s,op,span).sweptClear,true);
  assert.equal(Journey.serializeCampaign(s),before,'contact observation changes no campaign facts');
  assert.ok(getTrainCampWorkPose(s,'tomas'));
  Journey.campaignAction(s,'equip:mara-revolver');Journey.campaignAction(s,'holster');Journey.reloadCampaign(s);
  assert.ok(s.player.reloadTimer>0,'the actual owned partial revolver starts its real reload');
  assert.equal(provider.handFree(s,'mara'),false,'reloading cannot share the paperwork hand');
  assert.equal(getTrainCampWorkPose(s,'mara'),null);
  // Explicit negative hand-state fixture, after the actual positive approach.
  s.entities.tomas.holstered=false;
  assert.equal(getTrainCampWorkPose(s,'tomas'),null,'drawing refuses the stale free-hand pose before any fresh provider probe');
  const blocked=provider.powderContactWindow(s,op,span);
  assert.equal(blocked.actors.find(a=>a.id==='tomas').handFree,false);
  assert.equal(blocked.sweptClear,false,'an earlier probe cannot mask newly occupied hands');
});
