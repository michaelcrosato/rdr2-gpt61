import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import {restoreCampaign,serializeCampaign} from '../../src/campaign-journey.js';
import {RIVAL_ID} from '../../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import * as Camp from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_CHARGE_HALF_EXTENTS} from '../../content/campaign/train-equipment.js';
import {createTrainHuman,rigWorldPoint} from '../../src/train-native/rigs.js';
import {capturePreparationBodyBounds} from '../../src/train-preparation-layout.js';
import {localPoint,length,sub} from '../../src/rail-foundation/rigid-frame.js';
import {PREPARATION_CHARGE_ID,PREPARATION_CHARGE_APPROACH,PREPARATION_CHARGE_HELD_CENTER,preparationChargeOperationMode,validatePreparationChargeWork,preparationChargeLiftGeometry,preparationChargeCarryGeometry,preparationCarriedChargeGeometry,inspectPreparationChargeContact,preparePreparationChargePose,preparationChargeWorldGeometry,inspectPreparationChargeLiftWindow,getPreparationChargePose,createPreparationChargeProvider} from '../../src/train-preparation-charge.js';

const axes=['x','y','z'],copy=structuredClone;
const source=()=>{const raw=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),s=restoreCampaign(raw);assert.ok(s);assert.equal(serializeCampaign(s),raw);return s;};
// This detached authoring graph deliberately relocates only a copied Ruth.
// It is never serialized, restored, or used as a performed campaign prefix.
function detached(){const old=source();return{...old,entities:{...old.entities,ruth:{...old.entities.ruth,...PREPARATION_CHARGE_APPROACH,vx:0,vy:0}}};}
const operation=()=>({kind:'move-object',actorIds:['ruth'],refs:[{sourceMissionId:RIVAL_ID,objectId:PREPARATION_CHARGE_ID}],to:{owner:'ruth',location:{type:'carried',targetId:'ruth'}},options:{chargeLiftVersion:1}});
const args=s=>({fromProgress:0,toProgress:1,bodyBounds:capturePreparationBodyBounds(s,{geometryVersion:3}),geometry:preparationChargeWorldGeometry(s)});

test('unchanged earned mask prefix cannot invent four charge inspections, custody or a live extraction pose',()=>{
 const s=source(),before=serializeCampaign(s),op=operation();assert.equal(validatePreparationChargeWork(s,op,s.elapsed),false);assert.equal(preparationCarriedChargeGeometry(s),null);assert.equal(getPreparationChargePose(s),null);
 const provider=createPreparationChargeProvider(My3D2dge,()=>null),base={authorizeCustodyOp:()=>false,prepareCampWork(){}};assert.equal(provider.context(s,base,.05).authorizeCustodyOp(s,op),false);
 assert.equal(serializeCampaign(s),before,'negative read-only ownership checks leave the exact earned Save unchanged');
 const forged=source(),continuation=forged.campaign.missions[RIVAL_ID].rival.continuation;forged.campaign.missions[RIVAL_ID].objects[PREPARATION_CHARGE_ID].location={type:'carried',targetId:'ruth'};continuation.events.push({kind:'move-object',operation:{...operation(),cause:{missionId:TRAIN_ID,eventId:'powder-event-999'}},workReceipt:{startedAt:forged.elapsed-.9,finishedAt:forged.elapsed,acceptedSeconds:.9,actors:[{id:'ruth',point:{x:743,y:1246,z:0}}],sources:[],destinations:[],cause:{missionId:TRAIN_ID,eventId:'powder-event-999'}}});
 assert.equal(preparationCarriedChargeGeometry(forged),null,'a fabricated item field/event with elapsed seconds creates no trusted carried pose');assert.equal(getPreparationChargePose(forged),null);
 continuation.events=[{kind:'move-object'}];assert.equal(preparationCarriedChargeGeometry(forged),null);continuation.events={invented:true};assert.equal(preparationCarriedChargeGeometry(forged),null,'malformed continuation data cannot crash or create a carried pose');
});

test('first-child operation rejects different artifacts, actors, destinations, versions and extra authority fields',()=>{
 const op=operation();assert.equal(preparationChargeOperationMode(op),'take');assert.equal(preparationChargeOperationMode({...op,cause:{missionId:TRAIN_ID,eventId:'powder-event-1'}}),'take');
 const bad=[v=>v.extra=true,v=>delete v.options,v=>v.options.extra=true,v=>v.options.chargeLiftVersion=2,v=>v.actorIds=['mara'],v=>v.actorIds.push('ruth'),v=>v.refs[0].objectId='quarry-sealed-charge-2',v=>v.refs[0].extra=true,v=>v.refs.push(copy(v.refs[0])),v=>v.to.owner='mara',v=>v.to.location={type:'saddle',targetId:'plover'},v=>v.cause={missionId:TRAIN_ID,eventId:'invented'},v=>v.cause={missionId:TRAIN_ID,eventId:'powder-event-1',extra:true}];
 for(const change of bad){const value=copy(op);change(value);assert.equal(preparationChargeOperationMode(value),null);}
});

test('detached rigid lift conserves the same finite child and joins continuously to a body-relative carried pose',()=>{
 const s=detached(),before=JSON.stringify(s),start=preparationChargeLiftGeometry(0),end=preparationChargeLiftGeometry(1);assert.deepEqual(start.center,Camp.TRAIN_CHILD_CONTACTS[PREPARATION_CHARGE_ID].center);assert.deepEqual(end.center,PREPARATION_CHARGE_HELD_CENTER);
 for(let i=0;i<=100;i++){const g=preparationChargeLiftGeometry(i/100);assert.deepEqual(g.halfExtents,TRAIN_CHARGE_HALF_EXTENTS);assert.equal(8*g.halfExtents.x*g.halfExtents.y*g.halfExtents.z,288);assert.equal(g.itemRef.objectId,PREPARATION_CHARGE_ID);const finger=localPoint(g.frame,g.rightFinger);assert.ok(Math.abs(finger.z-6)<1e-8&&Math.abs(finger.x)<1e-8&&Math.abs(finger.y)<=3+1e-8,'original right fingertip stays on the same actual bundle surface');if(g.handoff){const left=localPoint(g.frame,g.leftFinger);assert.ok(axes.every(k=>Math.abs(left[k])<=g.halfExtents[k]+1e-8));}}
 for(const p of [.12,.4,.6,.78,.9]){const a=preparationChargeLiftGeometry(p-1e-9),b=preparationChargeLiftGeometry(p+1e-9);assert.ok(length(sub(a.center,b.center))<1e-6);assert.ok(length(sub(a.right,b.right))<1e-6);}
 const carried=preparationChargeCarryGeometry(s.entities.ruth);for(const k of ['center','frame','right','left','rightFinger','leftFinger'])assert.deepEqual(carried[k],end[k],'custody commit changes no physical socket or item corner');
 const moved={...s.entities.ruth,x:s.entities.ruth.x+31,y:s.entities.ruth.y-17,z:4,facing:s.entities.ruth.facing+.7},turned=preparationChargeCarryGeometry(moved),a=localPoint({origin:{x:s.entities.ruth.x,y:s.entities.ruth.y,z:0},x:{x:Math.cos(s.entities.ruth.facing),y:Math.sin(s.entities.ruth.facing),z:0},y:{x:-Math.sin(s.entities.ruth.facing),y:Math.cos(s.entities.ruth.facing),z:0},z:{x:0,y:0,z:1}},carried.center),b=localPoint({origin:{x:moved.x,y:moved.y,z:moved.z},x:{x:Math.cos(moved.facing),y:Math.sin(moved.facing),z:0},y:{x:-Math.sin(moved.facing),y:Math.cos(moved.facing),z:0},z:{x:0,y:0,z:1}},turned.center);assert.ok(length(sub(a,b))<1e-8,'later native root/yaw carries the original bundle rigidly');assert.equal(JSON.stringify(s),before);
 for(const p of [NaN,-.01,1.01])assert.throws(()=>preparationChargeLiftGeometry(p));assert.throws(()=>preparationChargeCarryGeometry({...moved,z:NaN}));
});

test('detached full-radius original two-hand IK and continuous complete-world lift certify without stock, feet or time credit',()=>{
 const s=detached(),before=JSON.stringify(s),a=args(s);for(let i=0;i<=36;i++){const g=preparationChargeLiftGeometry(i/36),hit=inspectPreparationChargeContact(s.entities.ruth,i/36);assert.ok(hit);assert.equal(hit.radius,3.22,'actual Ruth limb thickness is retained');for(const e of hit.entries)assert.ok(length(sub(e.joints[2],e.side==='R'?g.right:g.left))<1e-5);}
 for(let i=0;i<18;i++){const result=inspectPreparationChargeLiftWindow(s,{...a,fromProgress:i/18,toProgress:(i+1)/18});assert.ok(result,'entire native physical interval '+i);assert.equal(result.limbRadius,3.22);}
 const whole=inspectPreparationChargeLiftWindow(s,a);assert.ok(whole?.handoff&&whole.intervals>18,'curved hand motion and every phase boundary receive a continuous enclosure');assert.equal(JSON.stringify(s),before);assert.equal(s.campaign.missions[RIVAL_ID].objects[PREPARATION_CHARGE_ID].location.type,'crate','component geometry awards no custody');
});

test('whole original crate, other children, tin, world and every foreign body remain mandatory for a clear lift',()=>{
 const s=detached(),a=args(s);assert.ok(inspectPreparationChargeLiftWindow(s,a));
 for(const id of [...Camp.TRAIN_CRATE_SOLIDS.map(o=>o.id),'quarry-sealed-charge-2','quarry-sealed-charge-3','quarry-sealed-charge-4','cap-tin','quarry-charge-worktop'])assert.equal(inspectPreparationChargeLiftWindow(s,{...a,geometry:a.geometry.filter(o=>o.id!==id)}),null,'missing actual fixed solid '+id+' cannot authorize a lift');
 for(const mutate of [v=>v.geometry.push({id:'invented',x:1,y:1,z:0,w:1,h:1,height:1}),v=>v.bodyBounds=v.bodyBounds.filter(r=>r.id!=='mara'),v=>v.bodyBounds.find(r=>r.id==='mara').volumes[0].max.x-=1,v=>v.extra=true,v=>v.fromProgress=-.1,v=>v.toProgress=NaN]){const value=copy(a);mutate(value);assert.equal(inspectPreparationChargeLiftWindow(s,value),null);}
 const foreign={...s,entities:{...s.entities,mara:{...s.entities.mara,x:747,y:1268,z:0,vx:0,vy:0}}};assert.equal(inspectPreparationChargeLiftWindow(foreign,args(foreign)),null,'a real registered foreign body in the crate-to-hand path blocks the whole lift');
 const inside={...s,entities:{...s.entities,ruth:{...s.entities.ruth,x:750,y:1268}}};assert.equal(inspectPreparationChargeLiftWindow(inside,args(inside)),null,'actual owning body inside the worktop cannot claim clear hand work');
});

test('both actual hands must be free and usable, and the borrowed Human restores its complete private rig state',()=>{
 const s=detached();for(const facts of [{handInjury:{side:'right',recovered:false},injured:true},{handInjury:{side:'left',recovered:false},injured:true},{toolHeld:'another-tool'},{holstered:false},{crouch:true},{mounted:true},{hp:0,dead:true},{z:NaN}])assert.equal(inspectPreparationChargeContact({...s.entities.ruth,...facts},.5),null);
 const h=createTrainHuman(My3D2dge,s.entities.ruth),rig=h.rig;rig.update(.05,{...s.entities.ruth,vx:40,vy:20,crouch:true});rig.t=93;rig.phase=1.2;const fields=['J','t','phase','spW','poseW','facing','spin','sq','mv','downW'],before=copy(Object.fromEntries(fields.map(k=>[k,rig[k]]))),pose=preparePreparationChargePose(My3D2dge,h,s.entities.ruth,preparationChargeLiftGeometry(.5));assert.equal(rig.spW,0);assert.ok(pose.diagnostics.every(d=>d.reachable));assert.ok(length(sub(rigWorldPoint(rig,pose.root,'handR'),preparationChargeLiftGeometry(.5).right))<1e-5);pose.restore();assert.deepEqual(Object.fromEntries(fields.map(k=>[k,rig[k]])),before);
});
