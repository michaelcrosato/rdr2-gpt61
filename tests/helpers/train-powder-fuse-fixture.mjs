import assert from 'node:assert/strict';
import {createRecoveredWireComponentFixture} from './train-powder-wire-fixture.mjs';
import * as Powder from '../../src/train-powder.js';
import * as Custody from '../../src/rival-continuation.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../../content/campaign/bellwether-works.js';
import {createTrainConsist,advanceTrainConsist,trainGeometry,stepTrainBody,validateTrainSupport} from '../../src/train-motion.js';
import {worldPoint,localPoint,dot} from '../../src/rail-foundation/rigid-frame.js';
import {worldContact} from '../../src/rail-foundation/moving-support.js';
import {raycastCoverAt} from '../../src/train-terrain.js';
import {createTrainBlastOwner,createTrainBlastState} from '../../src/train-blast.js';
import * as Journey from '../../src/campaign-journey.js';
import {createTrainCombat} from '../../src/train-combat.js';
import {createTrainRuntimeSections} from '../../src/train-runtime-schema.js';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

/** Scoped integrated resource + native-car-cover fixture. Camp opening and the
 * first misfire/recovery are actually performed through the component APIs.
 * Initial Juno position, and later initial door-party/support placement, are
 * EXPLICIT SPATIAL FIXTURES, not earned travel/reunion or train availability.
 * Actor HP/stock/stage/outcomes are never assigned. Standing hand+33 remains a
 * limited contact provider; real NativeRig wrist/bundle/terrain are separate.
 */
export function createFuseComponentFixture({componentGraph=null}={}){
 const f=componentGraph?{s:structuredClone(componentGraph),refs:Powder.createPowderReferences(),ctx:{fixedContact(_s,id){return id==='turnout-service-plate'?{x:100,y:100,z:0}:id==='ridge-detonator'?{x:160,y:100,z:0}:null;},validateCustodyCause:Powder.validatePowderCustodyCause}}:createRecoveredWireComponentFixture(),s=f.s,refs=f.refs;
 if(!componentGraph){
 Journey.campaignAction(s,'equip:tern-carbine');Journey.campaignAction(s,'holster');assert.equal(s.entities.mara.equippedWeaponId,'tern-carbine');
 // A separately staged initial helper at the existing plane, no arrival credit.
 Object.assign(s.entities.juno,{x:100,y:100,z:0,regionId:'brass-cutting'});
 for(const [number,actor,primer,fuse]of [[2,'mara','quarry-primer-2',refs.fuses[0]],[3,'juno','quarry-primer-3',refs.fuses[1]]]){
  const charge=refs.charges[number-1];f.complete(Powder.requestPowderTransfer(s,charge,['ruth',actor],{owner:actor,location:{type:'carried',targetId:actor}},f.ctx));
  f.complete(Powder.requestChargeUnseal(s,charge.objectId,actor,f.ctx));f.complete(Powder.requestPrimerAttachment(s,charge.objectId,primer,actor,'fused',f.ctx));
  f.complete(Powder.requestPowderTransfer(s,fuse,['ruth',actor],{owner:actor,location:{type:'carried',targetId:actor}},f.ctx));f.complete(Powder.requestFuseAttachment(s,charge.objectId,actor,f.ctx));
 }
 assert.equal(f.history(),true);
 }
 let consist=componentGraph?s.campaign.missions[TRAIN_ID].train.consist:createTrainConsist();
 for(let i=0;i<200&&consist.speed>0;i++)consist=advanceTrainConsist(consist,.1,{throttle:0,brake:1}).state;
 assert.equal(consist.speed,0,'Actual native braking must finish before static fixture work');
 let geometry=trainGeometry(consist);
 const car=()=>geometry.platforms.find(p=>p.id==='morrow-custody-coach'),gangway=()=>geometry.platforms.find(p=>p.id==='morrow-gangway-6');
 function placeInitial(actor,platform,surfaceId,local){Object.assign(actor,worldPoint(platform.frame,local),{regionId:'brass-cutting',r:9,footRadius:9,height:53,onGround:true,vx:0,vy:0,vz:0,support:{carId:platform.id,surfaceId,local,relativeVelocity:{x:0,y:0,z:0}}});assert.ok(validateTrainSupport(actor,consist));}
 if(!componentGraph){for(const [id,y]of [['mara',-17],['juno',17]]){
  const reference=worldPoint(car().frame,{x:97,y,z:26}),n=gangway().frame.z,root={...reference,z:(dot(n,gangway().frame.origin)-n.x*reference.x-n.y*reference.y)/n.z};
  placeInitial(s.entities[id],gangway(),'gangway-deck',localPoint(gangway().frame,root));
 }
 placeInitial(s.entities.ruth,car(),'private-floor',{x:-36,y:0,z:26});
 // Staged active component world only; TRAIN_PLAYABLE remains false and this is
 // not asserted as a valid full Journey or a mission controller progression.
 s.campaign.activeMissionId=TRAIN_ID;s.campaign.missions[TRAIN_ID].train.consist=consist;s.campaign.missions[TRAIN_ID].train.blasts=createTrainBlastState();
 }
 const hand=a=>({...point(a),z:(a.z||0)+33}),settings={blocked:false,lostHand:false,capacity:true,throwPhysical:false};
 function locationPoint(location){
  if(location.type==='carried')return hand(s.entities[location.targetId]);
  if(location.type==='crate')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
  if(location.type==='tin')return locationPoint(s.campaign.missions[RIVAL_ID].objects['cap-tin'].location);
  if(location.type==='charge')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
  if(location.type==='car'){const p=geometry.platforms.find(p=>p.id===location.carId),contact=p.contacts.find(c=>c.id===location.contactId);assert.deepEqual(location.local,contact.local);return worldContact(p,contact.id);}
  throw new Error('Not part of this car-contact fixture');
 }
 const world=()=>({regionId:'brass-cutting',geometry}),refPoint=ref=>locationPoint(Custody.resolveFixedRef(s,ref).location);
 const blastProviders={worldFor:world,raycast:(w,a,b,o)=>raycastCoverAt(w.geometry,a,b,o),actorPoint:a=>{assert.ok(validateTrainSupport(a,consist));return point(a);},
  chargePoint:(_s,charge)=>({...locationPoint(charge.location),regionId:'brass-cutting'}),doorPoint:(_s,w,origin)=>{const p=car(),box=p.cover.find(c=>c.id==='private-iron-door'),local=localPoint(p.frame,origin);return{present:true,point:worldPoint(p.frame,Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(box.bounds.min[k],Math.min(box.bounds.max[k],local[k]))])))};}};
 const blast=createTrainBlastOwner(blastProviders);
 const ctx={...f.ctx,...blast,worldFor:world,pointForLocation:(_s,location)=>locationPoint(location),handUsable:()=>!settings.lostHand,handFree:(_s,id)=>s.entities[typeof id==='string'?id:id.id]?.holstered!==false,canContain:()=>settings.capacity,
  authorizeCustodyOp(_s,op){return ['move-object','light-fuse','blast-charge'].includes(op.kind)&&op.actorIds.every(id=>s.entities[id]?.hp>0&&!s.entities[id].mounted);},
  custodySnapshot(_s,{actorIds,refs,destinations}){return{actors:actorIds.map(id=>({id,point:point(s.entities[id])})),sources:refs.map(ref=>({ref,point:refPoint(ref)})),destinations:destinations.map(location=>({location,point:locationPoint(location)}))};},
  powderContactWindow(_s,op,{start,finish}){const actors=op.actorIds.map(id=>({id,root:point(s.entities[id]),hand:hand(s.entities[id]),regionId:'brass-cutting',alive:s.entities[id].hp>0,mounted:!!s.entities[id].mounted,handUsable:!settings.lostHand,handFree:s.entities[id].holstered!==false}));const endpoint=(p,extra)=>{const actor=actors.reduce((best,a)=>!best||distance(a.hand,p)<distance(best.hand,p)?a:best,null);return{...extra,point:p,regionId:'brass-cutting',actorId:actor?.id,maxHandDistance:actor?distance(actor.hand,p):Infinity};};return{start,finish,sweptClear:!settings.blocked,actors,sources:op.refs.map(ref=>endpoint(refPoint(ref),{ref})),destinations:op.to?[endpoint(locationPoint(op.to.location),{location:op.to.location})]:[],fixedContacts:[]};},
  prepareCustodyPhysicalEffects(){return{apply(){if(settings.throwPhysical)throw new Error('Deliberate post-blast component failure');},rollback(){}};},
 };
 function tick(controls={},dt=.1){
  const next=advanceTrainConsist(consist,dt,{throttle:0,brake:1});consist=next.state;geometry=next.geometry;s.campaign.missions[TRAIN_ID].train.consist=consist;
  for(const id of ['mara','juno','ruth']){stepTrainBody(s.entities[id],geometry,{relativeVelocity:controls[id]||{x:0,y:0,z:0},inputSpace:'world',groundAt:()=>0});assert.ok(s.entities[id].support,`Fixture actor ${id} lost actual car support`);assert.ok(validateTrainSupport(s.entities[id],consist));}
  s.elapsed+=dt;const work=Powder.stepPowderWork(s,dt,ctx),blasted=Powder.advancePowderFuses(s,ctx);return{work,blasted};
 }
 function complete(request){assert.ok(request);for(let i=0;i<30&&Powder.trainPowderRecord(s).pending.length;i++)tick();const event=Powder.trainPowderRecord(s).physicalEvents.find(e=>e.data?.workId===request.workId);assert.equal(event?.kind,'work-completed');}
 function socket(index){const contact=car().contacts.find(c=>c.id===`private-hinge-${index?'b':'a'}`);return{owner:index?'juno':'mara',location:{type:'car',carId:car().id,contactId:contact.id,local:structuredClone(contact.local),regionId:'brass-cutting'}};}
 function history(){return Custody.validateRivalContinuation(s)&&Powder.validatePowderWorkHistory(Powder.trainPowderRecord(s),s.elapsed,{...Custody.custodyValidationLinks(s),fixedContactFor:id=>f.ctx.fixedContact(s,id)});}
 function walkTo(id,target){for(let i=0;i<60;i++){const a=s.entities[id],dx=target.x-a.x,dy=target.y-a.y,n=Math.hypot(dx,dy);if(n<.2)return;const speed=Math.min(105,n/.1);tick({[id]:{x:dx/n*speed,y:dy/n*speed,z:0}});assert.ok(Math.hypot(s.entities.mara.x-s.entities.juno.x,s.entities.mara.y-s.entities.juno.y)>=18-1e-7,'Physical retreat keeps separate bodies');}throw new Error('Native supported retreat failed to reach its waypoint');}
 function retreat(){
  // Actual control-driven plate/opening/coach route, never position assignment.
  walkTo('juno',worldPoint(car().frame,{x:97,y:18.5,z:26}));
  const vestibule=()=>geometry.platforms.find(p=>p.id==='morrow-vestibule-coach');
  const stores=()=>geometry.platforms.find(p=>p.id==='morrow-stores-coach');
  walkTo('mara',worldPoint(car().frame,{x:97,y:0,z:26}));
  walkTo('mara',worldPoint(vestibule().frame,{x:-45,y:0,z:26}));
  walkTo('mara',worldPoint(vestibule().frame,{x:-45,y:2,z:26}));
  walkTo('mara',worldPoint(stores().frame,{x:-20,y:2,z:26}));
  walkTo('juno',worldPoint(car().frame,{x:97,y:0,z:26}));
  walkTo('juno',worldPoint(vestibule().frame,{x:-45,y:0,z:26}));
  walkTo('juno',worldPoint(vestibule().frame,{x:-45,y:2,z:26}));
  walkTo('juno',worldPoint(stores().frame,{x:-44,y:2,z:26}));
 }
 function enableCombat(){
  assert.equal(s.campaign.missions[TRAIN_ID].train.combat,undefined,'Only an empty emission component is initialized');
  s.campaign.missions[TRAIN_ID].train.combat=createTrainCombat();
  s.campaign.missions[TRAIN_ID].performance=structuredClone(createTrainRuntimeSections(s).performance);
  const before=JSON.stringify(s.weapons);Journey.campaignAction(s,'draw');assert.equal(s.entities.mara.holstered,false);assert.equal(JSON.stringify(s.weapons),before,'Actual draw does not change stock');
 }
 return{s,refs,ctx,settings,tick,complete,socket,history,car,gangway,world,retreat,walkTo,enableCombat,blastProviders};
}
