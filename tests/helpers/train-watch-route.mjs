import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from './train-preparation-route.mjs';
import {interactNative,chooseNative} from './train-clinic-route.mjs';
import {TRAIN_STORE_MARA} from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_WATCH_DISCUSSION_APPROACH} from '../../content/campaign/train-watch-data.js';
import {preparationPlayerApproach} from '../../src/train-preparation-work.js';
import {preparationWatchPrefix} from '../../src/train-preparation-watch.js';
export {Journey,trainRecord};
const prep=s=>trainRecord(s).train.preparation;
export function waitWatchNative(s,predicate,seconds,label){for(let i=0;!predicate()&&i<seconds/.05;i++)Journey.stepCampaign(s,.05);assert.ok(predicate(),`${label}: ${JSON.stringify({work:prep(s)?.work,exchange:prep(s)?.exchange,actors:Object.fromEntries(['mara','bastian','inez','hob'].map(id=>[id,{x:s.entities[id].x,y:s.entities[id].y,facing:s.entities[id].facing}]))})}`);}
export function wholeWatchNative(s){const raw=Journey.serializeCampaign(s),copy=Journey.restoreCampaign(raw);assert.ok(copy,'earned entire graph restores');assert.equal(Journey.serializeCampaign(copy),raw);return copy;}
/** Real native clinic/briefing and preparation call/hearing; no player, helper,
 * guard, stock, health, stage, elapsed or outcome assignments. Full Train entry
 * remains unavailable. This helper claims only the earned holding prefix. */
export function watchDiscussionNative(){
 const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});interactNative(s,'train:prepare-call');moveNative(s,TRAIN_STORE_MARA);interactNative(s,'train:prepare-talk:store');waitWatchNative(s,()=>s.dialog?.id==='train-prepare-store',30,'store speakers arrive');while(s.dialog)chooseNative(s,'train-prepare-next');
 moveNative(s,{x:775,y:1205});interactNative(s,'train:prepare-talk:holding');moveNative(s,TRAIN_WATCH_DISCUSSION_APPROACH);waitWatchNative(s,()=>s.dialog?.id==='train-prepare-holding',50,'Inez and Hob reach the actual holding exchange');while(s.dialog)chooseNative(s,'train-prepare-next');assert.equal(s.campaign.missions['snowbound-the-names-they-took'].captivity.guardId,'bastian');return s;
}
export function beginWatchReliefNative(s,to){interactNative(s,`train:prepare-watch:${to}`);Journey.stepCampaign(s,.05);const approach=preparationPlayerApproach(s);assert.ok(approach,'a safe holding approach was selected from the current guard feet');moveNative(s,approach.point);waitWatchNative(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='guard-handover'&&w.acceptedSeconds>0),35,'native relief contact begins');return s;}
export function hobWatchNative(){let s=watchDiscussionNative();for(const to of ['inez','hob']){beginWatchReliefNative(s,to);s=wholeWatchNative(s);waitWatchNative(s,()=>prep(s).work===null,10,`actual ${to} relief commits`);s=wholeWatchNative(s);}assert.ok(preparationWatchPrefix(s));return s;}
