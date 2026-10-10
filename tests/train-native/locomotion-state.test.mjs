import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import {createTrainHuman,physicalProjection,rigWorldPoint} from '../../src/train-native/rigs.js';
import {createTrainCampWorkProvider} from '../../src/train-camp-work.js';
import * as Journey from '../../src/campaign-journey.js';
import {captureNativeGroundLocomotion as capture,applyNativeGroundLocomotion as apply,validateNativeGroundLocomotion as valid} from '../../src/train-native/locomotion-state.js';
const E=globalThis.My3D2dge,body={id:'inez',x:500,y:1200,z:0,facing:0,vx:0,vy:0,hp:100};
const human=()=>{const h=createTrainHuman(E,body);h.rig.update(0,body);return h;};
const joints=h=>physicalProjection(E,()=>Object.fromEntries(Object.keys(h.rig.J).map(k=>[k,rigWorldPoint(h.rig,body,k)])));

test('native sideways gait, braking and crouch blend survive JSON records with identical joints and subsequent native steps',()=>{
 // Native component execution, not performed campaign movement or a whole Save.
 const source=human();source.rig.t=40;
 const inputs=[...Array.from({length:7},()=>({vx:65,vy:0})),...Array.from({length:7},()=>({vx:0,vy:65})),...Array.from({length:5},()=>({vx:0,vy:0,pose:'crouch'})),...Array.from({length:5},()=>({vx:-40,vy:0,pose:null}))];
 let retainedSideways=false,intermediateCrouch=false;
 for(const input of inputs){
  source.rig.update(.05,{...body,...input});const record=capture(source.rig),raw=JSON.stringify(record),decoded=JSON.parse(raw),restored=human();
  assert.equal(valid(decoded,restored.rig),true);const root=[restored.rig.x,restored.rig.y,restored.rig.z];let updates=0;const update=restored.rig.update;restored.rig.update=function(...args){updates++;return update.apply(this,args);};
  apply(restored.rig,decoded);assert.equal(updates,0);assert.deepEqual([restored.rig.x,restored.rig.y,restored.rig.z],root);assert.deepEqual(restored.rig.J,source.rig.J);assert.deepEqual(joints(restored),joints(source));assert.equal(JSON.stringify(capture(restored.rig)),raw);
  retainedSideways ||= input.vy===0&&record.movement[1]>.1;intermediateCrouch ||= record.poseWeights.crouch>0&&record.poseWeights.crouch<1;
  source.rig.update(.025,{...body,...input});restored.rig.update(.025,{...body,...input});assert.deepEqual(capture(restored.rig),capture(source.rig));assert.deepEqual(restored.rig.J,source.rig.J);
 }
 assert.ok(retainedSideways,'stopping does not fabricate a forward-only movement history');assert.ok(intermediateCrouch,'the actual finite posture blend is retained');
});

test('malformed records and mismatched native dimensions reject before changing the receiver',()=>{
 const source=human(),record=capture(source.rig),cases=[v=>v.extra=true,v=>v.speedWeight=1.251,v=>v.phase=NaN,v=>v.movement=[1,1],v=>v.poseWeights.wave=.1,v=>v.profile.stride+=.01,v=>v.profile.weapon='gun',v=>delete v.profile.legLower,v=>v.squash=.31,v=>v.clock=Number.MAX_VALUE];
 for(const mutate of cases){const bad=structuredClone(record);mutate(bad);const receiver=human(),before=JSON.stringify({motion:capture(receiver.rig),joints:receiver.rig.J});assert.equal(valid(bad,receiver.rig),false);assert.throws(()=>apply(receiver.rig,bad));assert.equal(JSON.stringify({motion:capture(receiver.rig),joints:receiver.rig.J}),before);}
 assert.ok(Object.isFrozen(record)&&Object.isFrozen(record.profile)&&Object.isFrozen(record.movement)&&Object.isFrozen(record.poseWeights));
});

test('advanced native motions cannot be relabeled as ordinary grounded history',()=>{
 for(const change of [r=>r.airW=.2,r=>r.downW=.1,r=>r.armW=.2,r=>r.pointW=.1,r=>r.poseW.guard=.1,r=>r.o.cape={len:6},r=>{r._from={R:[0,0,0]};r._windK=.5;},r=>r.sqV=Infinity,r=>r.J.handR[0]+=.1,r=>r._cheat=.1,r=>r.o.size=Number.MAX_VALUE]){const h=human();change(h.rig);assert.throws(()=>capture(h.rig));}
 const h=human();delete h.rig.poseW;const record=capture(h.rig),fresh=human();apply(fresh.rig,JSON.parse(JSON.stringify(record)));assert.equal(fresh.rig.poseW,undefined,'constructor absence stays absent rather than inventing pose weights');assert.deepEqual(fresh.rig.J,h.rig.J);
});

test('genuine camp movement retains native braking history that current stopped velocity cannot reconstruct',()=>{
 const raw=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);
 const provider=createTrainCampWorkProvider(E,Journey.worldForCampaign),original=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].objects),start={x:s.player.x,y:s.player.y};provider.prepareNativeActor(s,'mara');
 for(let i=0;i<6;i++){Journey.stepCampaign(s,.05,{mx:1,my:0});provider.prepareNativeActor(s,'mara');}
 assert.ok(s.player.x>start.x);Journey.stepCampaign(s,.05,{});const entry=provider.prepareNativeActor(s,'mara'),before=Journey.serializeCampaign(s),record=capture(entry.human.rig);
 assert.equal(Math.hypot(s.player.vx,s.player.vy),0);assert.ok(record.speedWeight>0,'the native gait actually decays after the body stops');
 const fresh=createTrainHuman(E,s.player);fresh.rig.update(0,s.player);assert.equal(fresh.rig.spW,0,'velocity-only reconstruction loses the genuine braking history');apply(fresh.rig,JSON.parse(JSON.stringify(record)));assert.deepEqual(fresh.rig.J,entry.human.rig.J);
 assert.equal(Journey.serializeCampaign(s),before,'motion observation and detached reconstruction change no campaign facts');assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].objects,original);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(before)),before);
});
