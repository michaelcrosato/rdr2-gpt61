import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,clinicCompleteNative,moveNative,trainRecord,interactNative,chooseNative,originalBytes} from './helpers/train-clinic-route.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import * as Briefing from '../src/train-briefing.js';
import {TRAIN_BRIEFING_APPROACHES,TRAIN_BRIEFING_PAPER_CONTACTS,TRAIN_BRIEFING_TABLE,TRAIN_BRIEFING_HANDOFF_APPROACH,TRAIN_BRIEFING_CASH_APPROACH} from '../content/campaign/train-camp.js';
const RIVAL='snowbound-the-names-they-took';
const ctx={worldFor:Journey.worldForCampaign,notice(s,text){s.notices.push({text,time:6});},talk(s,id,speaker,text,choices){s.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};}};
const traces=process.env.DUST_MERCY_TRAIN_BRIEFING_ARTIFACTS||`${tmpdir()}/dust-mercy-train-briefing-tests-${Date.now()}-${process.pid}`;mkdirSync(traces,{recursive:true});
function waitNative(s,predicate,seconds,label){for(let i=0;!predicate()&&i<seconds/.05;i++){Journey.stepCampaign(s,.05);assert.equal(s.failure,null,label);}if(!predicate())writeFileSync(`${traces}/stalled-${label}.json`,Journey.serializeCampaign(s));assert.ok(predicate(),label);}
function whole(s,label){const raw=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(raw);if(!restored)writeFileSync(`${traces}/invalid-${label}.json`,raw);assert.ok(restored,label);return restored;}
function say(s,id){interactNative(s,id);for(let i=0;s.dialog&&s.dialog.id!=='train-briefing-decision'&&i<30;i++)chooseNative(s,'train-brief-next');}

test('genuine native clinic phase one retains no invented briefing until the actual stove-room call',()=>{
  const s=clinicCompleteNative(),before=JSON.parse(Journey.serializeCampaign(s));
  assert.equal(trainRecord(s).train.briefingVersion,undefined);const old=Journey.restoreCampaign(Journey.serializeCampaign(s));assert.ok(old);assert.equal(trainRecord(old).train.briefing,undefined,'restore cannot manufacture a called table or heard employer');
  moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);const bastian=structuredClone(s.entities.bastian),paper=structuredClone(s.campaign.missions[RIVAL].objects),weapons=structuredClone(s.weapons);
  assert.ok(Briefing.getTrainBriefingInteractions(s).some(a=>a.id==='train:brief-call'));
  assert.equal(Briefing.interactTrainBriefing(s,'train:brief-call',ctx),true);
  const b=trainRecord(s).train.briefing;assert.equal(trainRecord(s).train.briefingVersion,1);assert.equal(b.setup.finishedAt,null);assert.deepEqual(b.heard,[]);assert.deepEqual(b.completed,[]);assert.equal(b.acceptedAt,null);
  assert.deepEqual(s.entities.bastian,bastian,'the current keeper is neither moved to the table nor given another job');assert.deepEqual(s.campaign.missions[RIVAL].objects,paper);assert.deepEqual(s.weapons,weapons,'calling the briefing grants and refills nothing');
  assert.equal(Briefing.validateTrainBriefing(s),true);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)),'actual empty declared setup survives every owning graph');
  assert.equal(before.campaign.missions[RIVAL].mission.completed,true);
});

test('declared first briefing rejects missing records, free setup, false heard lines and premature acceptance',()=>{
  const s=clinicCompleteNative();moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);assert.equal(Briefing.interactTrainBriefing(s,'train:brief-call',ctx),true);const raw=JSON.parse(Journey.serializeCampaign(s));
  for(const mutate of [
    d=>{delete trainRecord(d).train.briefing;},d=>{delete trainRecord(d).train.briefingVersion;},d=>{trainRecord(d).train.briefingVersion=2;},
    d=>{trainRecord(d).train.briefing.setup.finishedAt=d.elapsed;trainRecord(d).train.briefing.setup.acceptedSeconds=1.1;},
    d=>{trainRecord(d).train.briefing.heard=[{kind:'employer',speakerId:'della',text:'Invented completed speech.'}];},
    d=>{const r=trainRecord(d);r.train.briefing.acceptedAt=d.elapsed;r.train.chronicle.acceptedAt=d.elapsed;r.choices.operation='accepted';r.mission.stage=2;},
  ]){const bad=structuredClone(raw);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,mutate.toString());}
});

for(const [name,borrowed]of [['journey-v4-rival-webkit-current-reloaded',false],['train-briefing-borrowed-prerequisites-v4-native',true]])test(`actual ${borrowed?'borrowed Mara originals':'Tomas originals'} complete physical briefing through normal verbs and whole graph restores`,()=>{
  if(borrowed){const provenance=JSON.parse(readFileSync(new URL('./fixtures/train-briefing-borrowed-prerequisites-provenance.json',import.meta.url)));assert.equal(createHash('sha256').update(originalBytes(name)).digest('hex'),provenance.sha256OfUncompressedOriginalBytes);const original=JSON.parse(originalBytes(name));assert.equal(original.campaign.missions[RIVAL].aftermath.holding.visit2.borrowed,true);assert.equal(original.campaign.missions['snowbound-a-quiet-table'].mission.completed,true);}
  let s=clinicCompleteNative(name);const oldScore=structuredClone(s.campaign.missions[RIVAL].performance),oldInventory=structuredClone(s.inventory),oldWeapons=structuredClone(s.weapons),oldTransactions=structuredClone(s.campaign.missions[RIVAL].transactions);
  moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);Journey.campaignAction(s,'holster');interactNative(s,'train:brief-call');
  assert.equal(Journey.worldForCampaign(s).obstacles.some(o=>o.id===TRAIN_BRIEFING_TABLE.id),false,'an unfinished setup is not an earlier-room obstacle');
  waitNative(s,()=>trainRecord(s).train.briefing.setup.acceptedSeconds>=.2,40,`setup-contact-${borrowed}`);
  // An actual nearby owned Rescue conversation pauses the table work. No
  // clock, stage, health, body, resource, hearing or outcome is assigned.
  moveNative(s,{x:590,y:1125});const partialSetup=trainRecord(s).train.briefing.setup.acceptedSeconds;assert.ok(partialSetup<1.1);
  interactNative(s,'aftermath:tomas');const pausedElapsed=s.elapsed;for(let i=0;i<10;i++)Journey.stepCampaign(s,.05);assert.equal(s.elapsed,pausedElapsed);assert.equal(trainRecord(s).train.briefing.setup.acceptedSeconds,partialSetup);
  s=whole(s,`paused-setup-${borrowed}`);chooseNative(s,'leave');moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);
  waitNative(s,()=>trainRecord(s).train.briefing.setup.finishedAt!==null,15,`finished-setup-${borrowed}`);assert.equal(Journey.worldForCampaign(s).obstacles.some(o=>o.id===TRAIN_BRIEFING_TABLE.id),true);s=whole(s,`real-table-${borrowed}`);
  if(borrowed){assert.equal(s.campaign.missions[RIVAL].objects['route-diagram'].owner,'mara');moveNative(s,{x:650,y:TRAIN_BRIEFING_HANDOFF_APPROACH.y});moveNative(s,TRAIN_BRIEFING_HANDOFF_APPROACH);const t=s.entities.tomas,d=Math.hypot(t.x-s.player.x,t.y-s.player.y);Journey.stepCampaign(s,.01,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});interactNative(s,'train:brief-return-papers');waitNative(s,()=>s.campaign.missions[RIVAL].objects['route-diagram'].owner==='tomas',8,'actual-borrow-return');s=whole(s,'actual-borrow-return');assert.equal(s.campaign.missions[RIVAL].aftermath.holding.visit2.borrowed,true,'the actual return does not erase the earlier loan/testimony');moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);}
  for(const id of ['route-diagram','seizure-list']){
    interactNative(s,`train:brief-layout:${id}`);
    if(id==='route-diagram'){
      waitNative(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='move-object'&&w.acceptedSeconds>=.2),15,`pending-paper-${borrowed}`);
      const work=trainRecord(s).train.powder.pending.find(w=>w.kind==='move-object'),age=work.acceptedSeconds,intervals=structuredClone(work.intervals),requestId=work.requestId;
      s=whole(s,`mid-paper-${borrowed}`);const kept=trainRecord(s).train.powder.pending.find(w=>w.requestId===requestId);assert.ok(kept);assert.equal(kept.acceptedSeconds,age);assert.deepEqual(kept.intervals,intervals);
      Journey.stepCampaign(s,.05);const resumed=trainRecord(s).train.powder.pending.find(w=>w.requestId===requestId);assert.ok(resumed);assert.ok(Math.abs(resumed.acceptedSeconds-age-.05)<1e-7,'restore neither cancels nor awards an extra interval');
    }
    waitNative(s,()=>s.campaign.missions[RIVAL].objects[id].location.targetId===TRAIN_BRIEFING_PAPER_CONTACTS[id].id,15,`placed-${id}-${borrowed}`);assert.equal(s.campaign.missions[RIVAL].objects[id].owner,'tomas');s=whole(s,`placed-${id}-${borrowed}`);
  }
  waitNative(s,()=>Journey.getCampaignInteractions(s).some(a=>a.id==='train:brief-invitation'),10,`table-speakers-${borrowed}`);interactNative(s,'train:brief-invitation');chooseNative(s,'train-brief-next');chooseNative(s,'train-brief-pause');const heard=trainRecord(s).train.briefing.heard.length,setupAge=trainRecord(s).train.briefing.setup.acceptedSeconds;s=whole(s,`paused-invitation-${borrowed}`);Journey.stepCampaign(s,.05);assert.equal(s.dialog,null);assert.equal(trainRecord(s).train.briefing.heard.length,heard);assert.equal(trainRecord(s).train.briefing.setup.acceptedSeconds,setupAge);say(s,'train:brief-resume');
  say(s,'train:brief-employer');say(s,'train:brief-why-later');say(s,'train:brief-workers');say(s,'train:brief-review');say(s,'train:brief-decline');assert.equal(trainRecord(s).mission.stage,1);assert.equal(trainRecord(s).train.chronicle.acceptedAt,null);s=whole(s,`actual-decline-${borrowed}`);
  moveNative(s,TRAIN_BRIEFING_CASH_APPROACH);const keeper={x:s.entities.bastian.x,y:s.entities.bastian.y,z:s.entities.bastian.z,guardId:s.campaign.missions[RIVAL].captivity.guardId};interactNative(s,'train:brief-cash');assert.equal(trainRecord(s).train.briefing.exchange.awaitingSpeakers,true);interactNative(s,'rival:visit');const waitingClock=s.elapsed;Journey.stepCampaign(s,.05);assert.equal(s.elapsed,waitingClock);s=whole(s,`foreign-window-during-cash-arrival-${borrowed}`);chooseNative(s,'leave');waitNative(s,()=>s.dialog?.id==='train-briefing-cash',30,`cash-speakers-${borrowed}`);chooseNative(s,'train-brief-next');chooseNative(s,'train-brief-pause');s=whole(s,`paused-cash-${borrowed}`);Journey.stepCampaign(s,.05);assert.equal(s.dialog,null,'explicit cash pause allows leaving rather than reopening automatically');say(s,'train:brief-resume');assert.deepEqual({x:s.entities.bastian.x,y:s.entities.bastian.y,z:s.entities.bastian.z,guardId:s.campaign.missions[RIVAL].captivity.guardId},keeper,'Bastian remains the actual holding keeper throughout this exchange');
  moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);say(s,'train:brief-readiness');assert.equal(s.dialog.id,'train-briefing-decision');s=whole(s,`explicit-decision-${borrowed}`);chooseNative(s,'train-brief-wait');assert.equal(trainRecord(s).train.chronicle.acceptedAt,null);say(s,'train:brief-readiness');chooseNative(s,'train-brief-accept');assert.equal(trainRecord(s).mission.stage,2);assert.equal(trainRecord(s).mission.completed,false);assert.equal(trainRecord(s).choices.operation,'accepted');assert.equal(trainRecord(s).train.chronicle.acceptedAt,s.elapsed);
  assert.deepEqual(s.inventory,oldInventory);assert.deepEqual(s.weapons,oldWeapons);assert.deepEqual(s.campaign.missions[RIVAL].performance,oldScore);assert.deepEqual(s.campaign.missions[RIVAL].transactions,oldTransactions);assert.deepEqual(trainRecord(s).train.powder.kit,{},'acceptance is not equipment issuance');assert.equal(s.campaign.missions[RIVAL].objects['cap-tin'].primers,undefined);
  s=whole(s,`actual-accepted-briefing-${borrowed}`);assert.equal(Briefing.validateTrainBriefing(s),true);assert.equal(Briefing.briefingPaperEvidence(s).length,borrowed?3:2);
  if(process.env.DUST_MERCY_TRAIN_BRIEFING_ARTIFACTS)writeFileSync(`${traces}/accepted-${borrowed?'borrowed':'tomas'}-originals.json`,Journey.serializeCampaign(s));
  const accepted=JSON.parse(Journey.serializeCampaign(s));
  for(const mutate of [
    d=>{trainRecord(d).train.briefing.heard=trainRecord(d).train.briefing.heard.filter(e=>e.kind!=='employer');},
    d=>{const h=trainRecord(d).train.briefing.heard;[h[0],h[1]]=[h[1],h[0]];},
    d=>{d.campaign.missions[RIVAL].objects['route-diagram'].owner='mara';},
    d=>{trainRecord(d).train.briefing.heard.find(e=>e.kind==='readiness').paperEventIds=[];},
    d=>{trainRecord(d).train.briefing.decisions=trainRecord(d).train.briefing.decisions.filter(e=>e.id!=='accept');},
    d=>{trainRecord(d).train.chronicle.acceptedAt-=.1;},
    d=>{trainRecord(d).train.chronicle.stageEvents[1].cause='clinic-complete';},
    d=>{trainRecord(d).train.briefing.heard.find(e=>e.kind==='cash'&&e.speakerId==='bastian').actorPosition={x:625,y:1090,z:0};},
  ]){const forged=structuredClone(accepted);mutate(forged);assert.equal(Journey.restoreCampaign(forged),null,mutate.toString());}
});
