import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from '../helpers/train-preparation-route.mjs';
import {interactNative,chooseNative} from '../helpers/train-clinic-route.mjs';
import {TRAIN_STORE_MARA} from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {TRAIN_MASK_ID,TRAIN_MASK_APPROACHES,TRAIN_MASK_SHAPE} from '../../content/campaign/train-gear-data.js';
import {preparationMaskOperationMode,validatePreparationMaskWork,preparationMaskGeometry,preparationMaskHalfExtents,getPreparationMaskPose,getPreparationWornMaskPose} from '../../src/train-preparation-mask.js';
import {createTrainCampWorkProvider} from '../../src/train-camp-work.js';
import {preparationPlayerApproach} from '../../src/train-preparation-work.js';

const E=globalThis.My3D2dge;
const operation=worn=>({kind:'move-object',actorIds:['mara'],refs:[{sourceMissionId:TRAIN_ID,objectId:TRAIN_MASK_ID}],options:{},to:{owner:'mara',location:worn?{type:'worn',targetId:'mara',slot:'face'}:{type:'carried',targetId:'mara'}}});
function wait(s,predicate,seconds){for(let i=0;!predicate()&&i<seconds/.05;i++)Journey.stepCampaign(s,.05);assert.ok(predicate());}
function ownedMask(){const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});interactNative(s,'train:prepare-call');moveNative(s,TRAIN_STORE_MARA);interactNative(s,'train:prepare-talk:store');while(s.dialog)chooseNative(s,'train-prepare-next');moveNative(s,{x:390,y:1180});const t=TRAIN_MASK_APPROACHES.mara;for(let i=0;i<80&&Math.hypot(s.player.x-t.x,s.player.y-t.y)>.3;i++){const d=Math.hypot(s.player.x-t.x,s.player.y-t.y);Journey.stepCampaign(s,Math.min(.005,d/105),{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});}interactNative(s,'train:prepare-mask-issue');Journey.stepCampaign(s,.05);const guide=preparationPlayerApproach(s);assert.ok(guide,'the actual request supplies its versioned reachable player approach');moveNative(s,guide.point);wait(s,()=>!!s.itemInstances[TRAIN_MASK_ID],20);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)));return s;}

test('native clothing policy needs the same actually issued carried windwrap and refuses wrong actor/slot/source or an already mismatched transition',()=>{
 const s=ownedMask(),before=Journey.serializeCampaign(s),op=operation(true);assert.equal(preparationMaskOperationMode(op),'wear');assert.equal(validatePreparationMaskWork(s,op,s.elapsed),true);assert.equal(validatePreparationMaskWork(s,operation(false),s.elapsed),false);
 for(const mutate of [x=>x.actorIds.push('ada'),x=>x.to.owner='ada',x=>x.to.location.slot='head',x=>x.refs[0].objectId='invented-cloth',x=>x.options.free=true]){const bad=structuredClone(op);mutate(bad);assert.equal(validatePreparationMaskWork(s,bad,s.elapsed),false);}
 assert.equal(validatePreparationMaskWork(s,op,trainRecord(s).train.preparation.startedAt),false,'a later issue cannot be worn before it actually exists');assert.equal(Journey.serializeCampaign(s),before);
});

test('folding conserves the finite original volume throughout both directions',()=>{
 const v=h=>8*h.x*h.y*h.z,expected=v(TRAIN_MASK_SHAPE.folded);assert.ok(Math.abs(expected-v(TRAIN_MASK_SHAPE.worn))<1e-12);
 for(const fitVersion of[1,2])for(let i=0;i<=256;i++){const h=preparationMaskHalfExtents(i/256,fitVersion);assert.ok(Math.abs(v(h)-expected)<1e-12);assert.ok(h.x>=3&&h.x<=6&&h.y>=.05-1e-12&&h.y<=2&&h.z>=.2&&h.z<=4);}
 assert.throws(()=>preparationMaskHalfExtents(.5,3));
 for(const p of [-1,2,NaN,Infinity])assert.throws(()=>preparationMaskHalfExtents(p));
});

test('earned mask sockets reach through actual native hands without changing body or bone lengths; proposed heading fixtures stay explicit',()=>{
 const s=ownedMask(),before=Journey.serializeCampaign(s),provider=createTrainCampWorkProvider(E,Journey.worldForCampaign),entry=provider.prepareNativeActor(s,'mara'),positions=[];
 for(const fitVersion of[1,2])for(const mode of ['wear','remove'])for(let i=0;i<=20;i++){
  const g=preparationMaskGeometry(E,entry,mode,i/20,{fitVersion}),pose=provider.prepareNativeActor(s,'mara',g.hand,{elbowHint:[0,0,1]});assert.ok(pose.reachable&&pose.usable);assert.ok(Math.hypot(pose.joints[2].x-g.hand.x,pose.joints[2].y-g.hand.y,pose.joints[2].z-g.hand.z)<1e-6);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);assert.ok(Math.abs(dist(pose.joints[0],pose.joints[1])-pose.human.rig.o.armUpper*pose.human.rig.o.size)<1e-6);assert.ok(Math.abs(dist(pose.joints[1],pose.joints[2])-pose.human.rig.o.armLower*pose.human.rig.o.size)<1e-6);positions.push(g.center);
  const {x,y,z}=g.axes;assert.ok(Math.abs((x.y*y.z-x.z*y.y)*z.x+(x.z*y.x-x.x*y.z)*z.y+(x.x*y.y-x.y*y.x)*z.z-1)<1e-12,'right-handed material frame');
 }
 assert.equal(Journey.serializeCampaign(s),before);assert.ok(positions.some(p=>p.z>positions[0].z+1),'the cloth actually moves upward from its pocket to the native face');
 // Explicit geometry-only heading fixtures; no performed wear/whole-Save claim.
 for(let i=0;i<16;i++){const body={...s.player,facing:i*Math.PI/8},fixture={elapsed:s.elapsed,entities:{mara:body}},native=createTrainCampWorkProvider(E,()=>({id:'explicit-empty-geometry-fixture',obstacles:[]})),e=native.prepareNativeActor(fixture,'mara'),g=preparationMaskGeometry(E,e,'wear',1);assert.ok(native.prepareNativeActor(fixture,'mara',g.hand,{elbowHint:[0,0,1]}).reachable);}
});

test('actual native wear and removal commit the same garment once and continue from in-progress whole Saves',()=>{
 let s=ownedMask();const born=structuredClone(s.itemInstances[TRAIN_MASK_ID]),playerBefore={x:s.player.x,y:s.player.y,z:s.player.z||0,facing:s.player.facing,crouch:s.player.crouch};
 for(const[id,worn]of [['train:prepare-mask-wear',true],['train:prepare-mask-remove',false]]){
  interactNative(s,id);wait(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='move-object'&&w.acceptedSeconds>0),10);assert.ok(getPreparationMaskPose(s)?.reachable);
  const before=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(before);assert.ok(restored,'entire actual in-progress clothing graph restores');assert.equal(Journey.serializeCampaign(restored),before);s=restored;
  wait(s,()=>trainRecord(s).train.preparation.work===null,10);assert.equal(s.itemInstances[TRAIN_MASK_ID].location.type,worn?'worn':'carried');assert.equal(s.itemInstances[TRAIN_MASK_ID].issueEventId,born.issueEventId);assert.equal(s.itemInstances[TRAIN_MASK_ID].issuedAt,born.issuedAt);
  Journey.getCampaignInteractions(s);assert.equal(!!getPreparationWornMaskPose(s),worn);assert.equal(getPreparationMaskPose(s),null);
  const whole=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(whole));
 }
 assert.deepEqual({x:s.player.x,y:s.player.y,z:s.player.z||0,facing:s.player.facing,crouch:s.player.crouch},playerBefore,'personal clothing does not move or turn Mara');
 assert.equal(s.campaign.missions['snowbound-the-names-they-took'].rival.continuation.events.filter(e=>e.kind==='issue-mask').length,1);
 assert.deepEqual({...s.itemInstances[TRAIN_MASK_ID],location:born.location},born);
});

test('drawing during native fitting interrupts it without committing a worn copy',()=>{
 const s=ownedMask(),before=structuredClone(s.itemInstances[TRAIN_MASK_ID]);interactNative(s,'train:prepare-mask-wear');wait(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='move-object'&&w.acceptedSeconds>0),10);assert.ok(getPreparationMaskPose(s));Journey.campaignAction(s,'draw');assert.equal(getPreparationMaskPose(s),null);Journey.stepCampaign(s,.05);assert.deepEqual(s.itemInstances[TRAIN_MASK_ID],before);assert.equal(trainRecord(s).train.powder.pending.length,0);assert.ok(trainRecord(s).train.powder.physicalEvents.some(e=>e.kind==='work-cancelled'));assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)));
});

test('an actually crouched fitting of the unchanged PR9 earned garment keeps native cloth/head geometry on whole Save reload',()=>{
 // Historical earned issue, explicitly separate from the current issue-route
 // tests above. No garment, body, work interval or stage is constructed here.
 const rawSource=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString();let s=Journey.restoreCampaign(rawSource);assert.ok(s);assert.equal(Journey.serializeCampaign(s),rawSource);
 Journey.campaignAction(s,'crouch');for(let i=0;i<6;i++)Journey.stepCampaign(s,.05);assert.equal(s.player.crouch,true);interactNative(s,'train:prepare-mask-wear');wait(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='move-object'&&w.acceptedSeconds>0),10);
 const before=structuredClone(getPreparationMaskPose(s).geometry),raw=Journey.serializeCampaign(s);s=Journey.restoreCampaign(raw);assert.ok(s);Journey.getCampaignInteractions(s);const after=getPreparationMaskPose(s);assert.ok(after);for(const k of ['center','face','pocket','hand'])for(const axis of ['x','y','z'])assert.ok(Math.abs(before[k][axis]-after.geometry[k][axis])<1e-8,`${k}.${axis} remains native and unchanged across reload`);
 wait(s,()=>trainRecord(s).train.preparation.work===null,10);assert.equal(s.itemInstances[TRAIN_MASK_ID].location.type,'worn');assert.equal(s.player.crouch,true);
});
