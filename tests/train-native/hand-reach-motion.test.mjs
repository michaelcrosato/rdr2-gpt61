import test from 'node:test';
import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
import {createTrainHuman,prepareTrainPose,rigWorldPoint} from '../../src/train-native/rigs.js';
import {captureNativeGroundLocomotion,applyNativeGroundLocomotion} from '../../src/train-native/locomotion-state.js';
import {buildNativeHandReach as build} from '../../src/train-native/hand-reach-motion.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../../src/train-held-volume.js';
import {makeFrame} from '../../src/rail-foundation/rigid-frame.js';
import * as Camp from '../../content/campaign/train-preparation-camp.js';
const E=My3D2dge,axes=['x','y','z'],copy=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z}),distance=(a,b)=>Math.hypot(...axes.map(k=>a[k]-b[k])),nativeDistance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const actor=(id='ruth',facing=0,crouch=false)=>({id,x:750,y:1245,z:0,hp:100,facing,vx:0,vy:0,holstered:true,crouch,pose:crouch?'crouch':'stand'});
function source(body,clock=7.3){const human=createTrainHuman(E,body),r=human.rig;r.update(0,body);r.t=clock;r.phase=.37;r.spW=r.sq=r.sqV=0;r.poseW={cheer:0,cast:0,guard:0,kneel:0,crouch:body.crouch?1:0,wave:0,hips:0,block:0};r._pose();return{human,motion:captureNativeGroundLocomotion(r)};}
const argsFor=(body,side='R')=>{const {human,motion}=source(body),sh=rigWorldPoint(human.rig,body,'sh'+side);return{motion,side,target:P(sh.x+7,sh.y+8,sh.z+2),elbowHint:[0,0,1],progress:0};};

test('native reach preserves idle exactly, reaches only the final grip and withdraws over the identical finite path',()=>{
 for(const id of ['ruth','mara'])for(const facing of [0,.7])for(const crouch of [false,true])for(const side of ['R','L']){
  const body=actor(id,facing,crouch),args=argsFor(body,side),baseline=source(body).human,before=JSON.stringify({body,args}),forward=[];
  for(let i=0;i<=32;i++){const pose=build(E,body,{...args,progress:i/32});assert.ok(pose);assert.deepEqual(pose.root,P(body.x,body.y,body.z));assert.equal(pose.clock,args.motion.clock);assert.equal(pose.human.rig.t,args.motion.clock);assert.equal(pose.gripContact,i===32);assert.equal(pose.intervalCertified,false);assert.equal(pose.nativeRadius,Math.max(2,baseline.rig.o.limbW)*baseline.rig.o.size);
   const J=pose.human.rig.J;assert.ok(Math.abs(nativeDistance(J['sh'+side],J['elbow'+side])-baseline.rig.o.armUpper)<1e-8);assert.ok(Math.abs(nativeDistance(J['elbow'+side],J['hand'+side])-baseline.rig.o.armLower)<1e-8);
   for(const k of Object.keys(baseline.rig.J).filter(k=>!['elbow'+side,'hand'+side].includes(k)))assert.deepEqual(J[k],baseline.rig.J[k],'feet, other hand and original native torso remain unchanged');
   if(i===0){assert.deepEqual(J,baseline.rig.J);assert.deepEqual(pose.contacts,[]);assert.deepEqual(pose.diagnostics,[]);}else{assert.ok(pose.diagnostics[0].reachable);assert.ok(distance(pose.hand,pose.requestedHand)<1e-8);assert.deepEqual(pose.contacts[0].target,pose.requestedHand);if(i<32)assert.ok(distance(pose.hand,args.target)>1e-5,'partial reach cannot publish the final material grip');}
   forward.push(copy(J));pose.restore();assert.deepEqual(pose.human.rig.J,baseline.rig.J);assert.deepEqual(captureNativeGroundLocomotion(pose.human.rig),args.motion);pose.restore();
  }
  for(let i=32;i>=0;i--){const pose=build(E,body,{...args,progress:i/32});assert.ok(pose);assert.deepEqual(pose.human.rig.J,forward[i],'withdrawal reverses the same actual native keyframe');pose.restore();}
  const full=build(E,body,{...args,progress:1}),independent=createTrainHuman(E,body);applyNativeGroundLocomotion(independent.rig,args.motion);const fit=prepareTrainPose(E,independent,body,null,{contacts:[{side,target:args.target,elbowHint:args.elbowHint}],freeHands:true});try{assert.deepEqual(full.human.rig.J,independent.rig.J);assert.ok(distance(full.hand,args.target)<1e-8);}finally{fit.restore();full.restore();}assert.equal(JSON.stringify({body,args}),before);
 }
});

test('interior hand motion obeys a smooth speed bound and the elbow does not snap from the actual idle bend',()=>{
 const body=actor(),args=argsFor(body),idle=build(E,body,args);assert.ok(idle);const tiny=build(E,body,{...args,progress:1e-6});assert.ok(tiny);assert.ok(distance(tiny.hand,idle.hand)<1e-8);assert.ok(distance(tiny.joints[1],idle.joints[1])<1e-7,'no instantaneous switch to the final elbow pole');
 let previous=idle;for(let i=1;i<=128;i++){const pose=build(E,body,{...args,progress:i/128});assert.ok(pose);assert.ok(distance(pose.hand,previous.hand)<=pose.handSpeedPerProgressBound/128+1e-8);const expected=P(...axes.map(k=>pose.idleHand[k]+(args.target[k]-pose.idleHand[k])*pose.weight));assert.ok(distance(pose.hand,expected)<1e-8);previous.restore();previous=pose;}previous.restore();tiny.restore();
 const end=build(E,body,{...args,progress:1}),almost=build(E,body,{...args,progress:1-1e-6});assert.ok(distance(end.hand,almost.hand)<1e-8);assert.ok(distance(end.joints[1],almost.joints[1])<1e-7);end.restore();almost.restore();
});

test('the supplied native record is re-posed without update, changing a world clock or writing body/profile inputs',()=>{
 const body=actor('ruth',.4,true),args=argsFor(body),before=JSON.stringify({body,args}),style=JSON.stringify(E.style),update=E.Humanoid.prototype.update;let calls=0;E.Humanoid.prototype.update=function(){calls++;throw Error('Reach must not advance the native clock');};
 try{const pose=build(E,body,{...args,progress:.43});assert.ok(pose);assert.equal(pose.clock,args.motion.clock);assert.equal(pose.human.rig.phase,args.motion.phase);assert.deepEqual(pose.human.rig.mv,args.motion.movement);pose.restore();assert.deepEqual(captureNativeGroundLocomotion(pose.human.rig),args.motion);}finally{E.Humanoid.prototype.update=update;}
 assert.equal(calls,0);assert.equal(JSON.stringify({body,args}),before);assert.equal(JSON.stringify(E.style),style);
});

test('valid instantaneous inspection endpoints do not grant a clear crate-crossing reach or any physical work credit',()=>{
 const body=actor(),{motion}=source(body),args={motion,target:P(747,1264,46.2),elbowHint:[0,0,1],progress:.5},rail=Camp.TRAIN_CRATE_SOLIDS.find(o=>o.id==='charge-crate-front-rail'),box=createHeldBox({id:rail.id,frame:makeFrame(P(rail.x+rail.w/2,rail.y+rail.h/2,rail.z+rail.height/2),P(1,0,0)),halfExtents:P(rail.w/2,rail.h/2,rail.height/2)}),set=compileHeldBoxSet([{box,ownerId:'original-crate'}],{id:'actual-front-rail'}),mid=build(E,body,args),end=build(E,body,{...args,progress:1});assert.ok(mid&&end);assert.ok(mid.parts.some(p=>heldBoxContacts(p,set).some(h=>h.interiorOverlap)),'the finite actual arm path genuinely meets the original front rail');assert.equal(mid.gripContact,false);assert.equal(mid.intervalCertified,false);assert.notDeepEqual(mid.contacts[0].target,args.target);assert.equal(end.gripContact,true);assert.ok(distance(end.hand,args.target)<1e-8);mid.restore();end.restore();
});

test('malformed source records, occupied hands, reach clamps, short/antipodal paths and native pole fallbacks refuse',()=>{
 const body=actor(),args=argsFor(body),before=JSON.stringify({body,args});for(const change of [v=>v.extra=true,v=>delete v.motion,v=>v.motion.profile.armUpper+=.01,v=>v.motion.clock=NaN,v=>v.motion.extra=true,v=>v.motion.speedWeight=.01,v=>v.motion.squash=.001,v=>v.motion.squashVelocity=.001,v=>v.motion.poseWeights.crouch=.5,v=>v.target.x=Infinity,v=>v.target.extra=true,v=>v.elbowHint=[0,0,0],v=>v.elbowHint=[0,NaN,1],v=>v.side='both',v=>v.progress=-.01,v=>v.progress=1.01]){const value=copy(args);change(value);assert.equal(build(E,body,value),null);}
 for(const facts of [{vx:.001},{z:NaN},{facing:.1},{toolHeld:'another-tool'},{hp:0},{mounted:true},{reloadTimer:NaN},{handInjury:{side:'right',recovered:false},injured:true}])assert.equal(build(E,{...body,...facts},args),null);
 const idle=source(body).human,sh=rigWorldPoint(idle.rig,body,'shR'),hand=rigWorldPoint(idle.rig,body,'handR'),reach=(args.motion.profile.armUpper+args.motion.profile.armLower-.01)*args.motion.profile.size;for(const target of [P(sh.x+reach+1e-7,sh.y,sh.z),P(2*sh.x-hand.x,2*sh.y-hand.y,2*sh.z-hand.z),P(sh.x+.001,sh.y,sh.z)])assert.equal(build(E,body,{...args,target,progress:.5}),null);
 assert.equal(build(E,body,{...args,target:P(sh.x+6,sh.y,sh.z),elbowHint:[1,0,0],progress:1}),null,'native degenerate-pole fallback is not a reach pose');assert.equal(JSON.stringify({body,args}),before);
});
