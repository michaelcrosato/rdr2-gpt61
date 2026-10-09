import assert from 'node:assert/strict';
import {Journey,clinicCompleteNative,moveNative,trainRecord,interactNative,chooseNative} from './train-clinic-route.mjs';
import {TRAIN_BRIEFING_APPROACHES,TRAIN_BRIEFING_CASH_APPROACH,TRAIN_BRIEFING_PAPER_CONTACTS,TRAIN_BRIEFING_HANDOFF_APPROACH} from '../../content/campaign/train-camp.js';
export {Journey,moveNative,trainRecord};
const RIVAL='snowbound-the-names-they-took';
const cached=new Map();
function wait(s,predicate,seconds,label){for(let i=0;!predicate()&&i<seconds/.05;i++)Journey.stepCampaign(s,.05);assert.ok(predicate(),label);}
function hear(s,id){interactNative(s,id);for(let i=0;s.dialog&&s.dialog.id!=='train-briefing-decision'&&i<30;i++)chooseNative(s,'train-brief-next');}
/** Entire existing clinic/briefing earned from unchanged native prior Save.
 * No body/health/stock/stage/outcome is assigned; no new preparation succeeds
 * through this helper. Cached bytes are ordinary owning serialization only.
 */
export function acceptedBriefingNative(name='journey-v4-rival-webkit-current-reloaded'){
  if(cached.has(name)){const s=Journey.restoreCampaign(cached.get(name));assert.ok(s);return s;}
  const s=clinicCompleteNative(name);moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);Journey.campaignAction(s,'holster');interactNative(s,'train:brief-call');
  wait(s,()=>trainRecord(s).train.briefing.setup.finishedAt!==null,45,'native table setup');
  if(s.campaign.missions[RIVAL].objects['route-diagram'].owner==='mara'){
    moveNative(s,{x:650,y:TRAIN_BRIEFING_HANDOFF_APPROACH.y});moveNative(s,TRAIN_BRIEFING_HANDOFF_APPROACH);const t=s.entities.tomas,d=Math.hypot(t.x-s.player.x,t.y-s.player.y);Journey.stepCampaign(s,.01,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});interactNative(s,'train:brief-return-papers');wait(s,()=>s.campaign.missions[RIVAL].objects['route-diagram'].owner==='tomas',10,'native original paper return');moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);
  }
  for(const id of ['route-diagram','seizure-list']){interactNative(s,`train:brief-layout:${id}`);wait(s,()=>s.campaign.missions[RIVAL].objects[id].location.targetId===TRAIN_BRIEFING_PAPER_CONTACTS[id].id,20,'native individual original layout');}
  wait(s,()=>Journey.getCampaignInteractions(s).some(a=>a.id==='train:brief-invitation'),15,'native table speakers');hear(s,'train:brief-invitation');hear(s,'train:brief-employer');
  moveNative(s,TRAIN_BRIEFING_CASH_APPROACH);interactNative(s,'train:brief-cash');wait(s,()=>s.dialog?.id==='train-briefing-cash',35,'native cash speakers');for(let i=0;s.dialog&&i<30;i++)chooseNative(s,'train-brief-next');
  moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);hear(s,'train:brief-readiness');chooseNative(s,'train-brief-accept');assert.equal(trainRecord(s).mission.stage,2);assert.equal(trainRecord(s).train.preparation,undefined);
  const bytes=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(bytes));cached.set(name,bytes);return s;
}
