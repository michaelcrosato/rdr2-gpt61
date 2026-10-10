import {followPreparationGuideNative} from '../helpers/train-preparation-route.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
import {createTrainHuman,prepareTrainPose,rigWorldPoint} from '../../src/train-native/rigs.js';
import {createTrainCampWorkProvider,getTrainCampWorkPose} from '../../src/train-camp-work.js';
import {TRAIN_CHILD_CONTACTS,TRAIN_STORE_MARA} from '../../content/campaign/train-preparation-camp.js';
import * as Camp from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_CHARGE_HALF_EXTENTS} from '../../content/campaign/train-equipment.js';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from '../helpers/train-preparation-route.mjs';
import {interactNative,chooseNative} from '../helpers/train-clinic-route.mjs';
const E=globalThis.My3D2dge,dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// Native geometry fixture at actual authoring metadata, not a performed game
// job or a substitute for owning tray/body collision and whole-route proof.
function fixture(){const slot=TRAIN_CHILD_CONTACTS['quarry-sealed-charge-1'],body={id:'ruth',...slot.approach,hp:100,holstered:true,regionId:'snowbound'},human=createTrainHuman(E,body);human.rig.update(.05,body);return{body,human,target:slot.grip};}
test('authored local up pole reaches the same child contact while retaining native upper/lower arm lengths and world root',()=>{
 const {body,human,target}=fixture(),before=JSON.stringify(body),joints=structuredClone(human.rig.J),elbows=[];
 for(const hint of [null,[0,0,1]]){const pose=prepareTrainPose(E,human,body,null,{contacts:[{side:'R',kind:'child-label',target,elbowHint:hint}]});try{assert.ok(pose.diagnostics[0].reachable&&pose.diagnostics[0].error<1e-5);assert.ok(Math.abs(dist(human.rig.J.shR,human.rig.J.elbowR)-human.rig.o.armUpper)<1e-6);assert.ok(Math.abs(dist(human.rig.J.elbowR,human.rig.J.handR)-human.rig.o.armLower)<1e-6);elbows.push(rigWorldPoint(human.rig,pose.root,'elbowR'));assert.deepEqual(pose.root,{x:body.x,y:body.y,z:body.z});}finally{pose.restore();}}
 assert.ok(elbows[1].z>elbows[0].z,'the actual bend pole changes the elbow rather than stretching or moving the actor');assert.deepEqual(human.rig.J,joints);assert.equal(JSON.stringify(body),before);
});
test('same-clock native contact cache binds/copies the hint and changes elbow without updating the physics rig twice',()=>{
 const {body,target}=fixture(),s={elapsed:1,entities:{ruth:body}},provider=createTrainCampWorkProvider(E,()=>({id:'explicit-empty-geometry-fixture',obstacles:[]})),hint=[0,0,1],entry=provider.prepareNativeActor(s,'ruth',target,{elbowHint:hint}),up=structuredClone(entry.joints[1]);assert.deepEqual(entry.contactHint,hint);hint[2]=-1;assert.deepEqual(entry.contactHint,[0,0,1]);const old=entry.human.rig.update;entry.human.rig.update=()=>{throw Error('Hint-only endpoint re-probe must not advance the rig again');};
 try{const changed=provider.prepareNativeActor(s,'ruth',target,{elbowHint:[0,0,-1]});assert.equal(changed,entry);assert.ok(changed.reachable);assert.ok(changed.joints[1].z<up.z);assert.deepEqual(changed.contactHint,[0,0,-1]);}finally{entry.human.rig.update=old;}
});
test('nonfinite or malformed hint refuses before joint mutation; the default contact remains reachable',()=>{
 const {body,human,target}=fixture(),joints=structuredClone(human.rig.J);for(const elbowHint of [[0,NaN,1],[0,1],{x:0,y:0,z:1}])assert.throws(()=>prepareTrainPose(E,human,body,null,{contacts:[{side:'R',target,elbowHint}]}),/finite local/);assert.deepEqual(human.rig.J,joints);const pose=prepareTrainPose(E,human,body,null,{contacts:[{side:'R',target}]});assert.ok(pose.diagnostics[0].reachable);pose.restore();
});
test('same-clock route velocity changes invalidate the exposed native pose before a current velocity re-probe',()=>{
 const {body,target}=fixture(),s={elapsed:1,entities:{ruth:body}},provider=createTrainCampWorkProvider(E,()=>({id:'explicit-empty-geometry-fixture',obstacles:[]}));body.vx=65;body.vy=0;const entry=provider.prepareNativeActor(s,'ruth',target,{elbowHint:[0,0,1]});assert.equal(getTrainCampWorkPose(s,'ruth'),entry);body.vx=0;assert.equal(getTrainCampWorkPose(s,'ruth'),null,'a walking pose cannot remain current after the route actually stops');let updates=0;const update=entry.human.rig.update;entry.human.rig.update=function(dt,actual){updates++;assert.equal(dt,0);assert.equal(actual.vx,0);return update.call(this,dt,actual);};try{assert.equal(provider.prepareNativeActor(s,'ruth',target,{elbowHint:[0,0,1]}),entry);assert.equal(updates,1);assert.equal(getTrainCampWorkPose(s,'ruth'),entry);}finally{entry.human.rig.update=update;}
});
test('independent rigs from the same genuine Save and accepted clock ignore random constructors and prior cache gaps',()=>{
 const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});interactNative(s,'train:prepare-call');moveNative(s,TRAIN_STORE_MARA);interactNative(s,'train:prepare-talk:store');for(let i=0;!s.dialog&&i<500;i++)Journey.stepCampaign(s,.05);while(s.dialog)chooseNative(s,'train-prepare-next');for(let i=0;!trainRecord(s).train.preparation.campSetup.sites['quarry-charge-worktop']&&i<500;i++)Journey.stepCampaign(s,.05);interactNative(s,'train:prepare-inspect:quarry-sealed-charge-1');followPreparationGuideNative(s);for(let i=0;!trainRecord(s).train.powder.pending.some(w=>w.acceptedSeconds>0)&&i<500;i++)Journey.stepCampaign(s,.05);assert.ok(trainRecord(s).train.powder.pending.some(w=>w.acceptedSeconds>0));
 const provider=createTrainCampWorkProvider(E,Journey.worldForCampaign),body=s.entities.ruth,target={x:body.x+4,y:body.y+4,z:(body.z||0)+33},random=Math.random;assert.equal(Math.hypot(body.vx,body.vy),0,'actual route has stopped before physical work');
 try{Math.random=()=>.01;provider.prepareNativeActor(s,'ruth',target,{elbowHint:[0,0,1]});}finally{Math.random=random;}
 // Real accepted frames leave this independent contact observer unused. Its
 // private cache clock must still agree with a fresh full-graph restoration.
 for(let i=0;i<5;i++)Journey.stepCampaign(s,.05);
 const before=Journey.serializeCampaign(s),existing=provider.prepareNativeActor(s,'ruth',target,{elbowHint:[0,0,1]}),restored=Journey.restoreCampaign(before);assert.ok(restored);let fresh;
 try{Math.random=()=>.99;fresh=createTrainCampWorkProvider(E,Journey.worldForCampaign).prepareNativeActor(restored,'ruth',target,{elbowHint:[0,0,1]});}finally{Math.random=random;}
 assert.ok(existing.reachable&&fresh.reachable);for(let i=0;i<3;i++)assert.ok(Math.hypot(...['x','y','z'].map(k=>existing.joints[i][k]-fresh.joints[i][k]))<1e-9,'saved clock and body determine the physical joint');assert.ok(Math.abs(existing.human.rig.t-fresh.human.rig.t)<1e-9);assert.equal(Journey.serializeCampaign(s),before);assert.equal(Journey.serializeCampaign(restored),before);
});
test('authored tin pose has reach and swept capsule clearance throughout a complete native idle cycle',()=>{
 // Dense authoring geometry probe, not a manufactured completed game action.
 // Real whole-Save tin work is exercised separately through the owning route.
 const body={id:'ruth',...Camp.TRAIN_TIN_APPROACH,hp:100,holstered:true},h=createTrainHuman(E,body),obstacles=[...Camp.TRAIN_CRATE_SOLIDS,...Object.values(Camp.TRAIN_CHILD_CONTACTS).map(slot=>({x:slot.center.x-TRAIN_CHARGE_HALF_EXTENTS.x,y:slot.center.y-TRAIN_CHARGE_HALF_EXTENTS.y,z:slot.center.z-TRAIN_CHARGE_HALF_EXTENTS.z,w:TRAIN_CHARGE_HALF_EXTENTS.x*2,h:TRAIN_CHARGE_HALF_EXTENTS.y*2,height:TRAIN_CHARGE_HALF_EXTENTS.z*2})),Camp.TRAIN_PREPARATION_SOLIDS.find(s=>s.id==='quarry-charge-worktop'),{x:Camp.TRAIN_TIN_CENTER.x-Camp.TRAIN_TIN_SHAPE.x,y:Camp.TRAIN_TIN_CENTER.y-Camp.TRAIN_TIN_SHAPE.y,z:Camp.TRAIN_TIN_CENTER.z-Camp.TRAIN_TIN_SHAPE.z,w:Camp.TRAIN_TIN_SHAPE.x*2,h:Camp.TRAIN_TIN_SHAPE.y*2,height:Camp.TRAIN_TIN_SHAPE.z*2}];
 const intersects=(a,b,o,r)=>{let lo=0,hi=1;for(const[k,min,max]of[['x',o.x-r,o.x+o.w+r],['y',o.y-r,o.y+o.h+r],['z',o.z-r,o.z+o.height+r]]){const d=b[k]-a[k];if(Math.abs(d)<1e-10){if(a[k]<min||a[k]>max)return false;continue;}let x=(min-a[k])/d,y=(max-a[k])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}return true;};
 let prior=null;for(let i=0;i<=256;i++){h.rig.t=i/256*(Math.PI*2/1.15);h.rig.update(0,body);const pose=prepareTrainPose(E,h,body,null,{contacts:[{side:'R',target:Camp.TRAIN_TIN_HAND,elbowHint:[0,0,1]}]});try{assert.ok(pose.diagnostics[0].reachable&&pose.diagnostics[0].error<1e-5,'every idle phase retains actual reach');const current=['shR','elbowR','handR'].map(j=>rigWorldPoint(h.rig,pose.root,j)),travel=prior?Math.max(...current.map((p,n)=>Math.hypot(...['x','y','z'].map(k=>p[k]-prior[n][k])))):0,radius=2.5+travel/2;for(const t of[0,.5,1]){const joints=current.map((p,n)=>Object.fromEntries(['x','y','z'].map(k=>[k,prior?prior[n][k]+(p[k]-prior[n][k])*t:p[k]])));for(const o of obstacles)for(const[a,b]of[[0,1],[1,2]])assert.equal(intersects(joints[a],joints[b],o,radius),false,'native arm stays clear of unchanged tray/children/tin');}prior=current;}finally{pose.restore();}}
});
