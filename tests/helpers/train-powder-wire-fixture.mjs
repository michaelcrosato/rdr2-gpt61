import assert from 'node:assert/strict';
import {createPowderFixture} from './train-powder-fixture.mjs';
import * as Powder from '../../src/train-powder.js';
import * as Custody from '../../src/rival-continuation.js';
import {moveActor} from '../../src/campaign-navigation.js';
import {RIVAL_ID,RIVAL_WORLD} from '../../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {TRAIN_TOOL_CASE} from '../../content/campaign/train-equipment.js';
import {createRailPath,createConsist,advanceConsist} from '../../src/rail-foundation/rail-consist.js';
import {TRAIN_CAR_SPECS} from '../../src/train-motion.js';
const P=(x,y,z=0)=>({x,y,z}),point=a=>P(a.x,a.y,a.z||0),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

/** COMPONENT SPATIAL FIXTURE ONLY. Earn actual case/tin/first-primer/kit custody
 * through the camp helper first. Then stage initial Brass body/region positions
 * on an explicit bounded flat test plane. This is NOT earned mission travel,
 * native terrain, native hand IK, cargo-carry presentation, public play or full
 * Journey Save acceptance. No stage/health/stock/outcome field is manufactured.
 * Actual later fixture motion uses shared moveActor and measured ground paths.
 */
export function createWireComponentFixture(){
  const f=createPowderFixture(),refs=Powder.createPowderReferences();
  f.approach('mara',TRAIN_TOOL_CASE);f.approach('ruth',TRAIN_TOOL_CASE);f.complete(Powder.requestKitOpening(f.s,f.ctx));
  for(const reference of [refs.spool,refs.lead,refs.detonator,refs.pliers,...refs.fuses]){
    const owner=reference.objectId===refs.spool.objectId?'mara':'ruth';
    f.complete(Powder.requestPowderTransfer(f.s,reference,['mara','ruth'],{owner,location:{type:'carried',targetId:owner}},f.ctx));
  }
  f.approach('ruth',RIVAL_WORLD.camp.charges);f.complete(Powder.requestTinOpening(f.s,f.ctx));
  f.complete(Powder.requestPowderTransfer(f.s,refs.charges[0],['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
  f.complete(Powder.requestChargeUnseal(f.s,refs.charges[0].objectId,'ruth',f.ctx));
  f.complete(Powder.requestPrimerAttachment(f.s,refs.charges[0].objectId,'quarry-primer-1','ruth','wired',f.ctx));
  f.complete(Powder.requestPowderTransfer(f.s,refs.tin,['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
  f.complete(Powder.requestPowderTransfer(f.s,refs.crate,['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
  assert.equal(f.history(),true);
  const s=f.s,health={mara:s.entities.mara.hp,ruth:s.entities.ruth.hp};
  // Initial spatial fixture boundary, deliberately not a travel/arrival claim.
  for(const id of ['mara','ruth'])Object.assign(s.entities[id],{...P(100,100),regionId:'brass-cutting'});
  s.region='brass-cutting';
  const world={id:'powder-explicit-flat-fixture',width:400,height:400,obstacles:[]},settings={blocked:false,lostHand:false,capacity:true,throwPhysical:false,lastMotion:null};
  const contacts={'turnout-service-plate':P(100,100),'ridge-detonator':P(160,100)};
  // Explicit low-grip hand fixture. Native pose/contact/bundle proofs are gates.
  const hand=a=>({...point(a),z:(a.z||0)+12});
  function locationPoint(location){
    if(location.type==='carried')return hand(s.entities[location.targetId]);
    if(location.type==='station'&&contacts[location.targetId])return contacts[location.targetId];
    if(location.type==='tin')return locationPoint(s.campaign.missions[RIVAL_ID].objects['cap-tin'].location);
    if(location.type==='charge')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
    if(location.type==='crate')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
    throw new Error('Outside this explicitly limited component plane');
  }
  const refPoint=ref=>locationPoint(Custody.resolveFixedRef(s,ref).location);
  const fixedContact=(_s,id)=>structuredClone(contacts[id]);
  const ctx={
    fixedContact,worldFor:()=>world,pointForLocation:(_s,location)=>locationPoint(location),handUsable:()=>!settings.lostHand,handFree:(_s,id)=>s.entities[typeof id==='string'?id:id.id]?.holstered!==false,canContain:()=>settings.capacity,
    objectGroundPoint(_s,ref){const o=Custody.resolveFixedRef(s,ref);if(o.location.type==='carried')return point(s.entities[o.location.targetId]);return locationPoint(o.location);},
    authorizeCustodyOp(_s,op){return ['move-object','wire-pay-out','cut-clamp','damage-primer','remove-primer','unseal-charge','attach-primer','attach-fuse'].includes(op.kind)&&op.actorIds.every(id=>s.entities[id]?.hp>0&&!s.entities[id].mounted);},
    authorizePowderPhysicalOp(_s,op){return ['begin-wire','fasten-terminal','disconnect-terminal','test-circuit','stroke-detonator'].includes(op.kind)&&op.actorIds.every(id=>s.entities[id]?.hp>0&&!s.entities[id].mounted&&s.entities[id].holstered!==false);},
    custodySnapshot(_s,{actorIds,refs,destinations}){return{actors:actorIds.map(id=>({id,point:point(s.entities[id])})),sources:refs.map(ref=>({ref,point:refPoint(ref)})),destinations:destinations.map(location=>({location,point:locationPoint(location)}))};},
    powderContactWindow(_s,op,{start,finish}){
      const actors=op.actorIds.map(id=>({id,root:point(s.entities[id]),hand:hand(s.entities[id]),regionId:'brass-cutting',alive:s.entities[id].hp>0,mounted:!!s.entities[id].mounted,handUsable:!settings.lostHand,handFree:s.entities[id].holstered!==false}));
      const endpoint=(p,extra)=>{const actor=actors.reduce((best,a)=>!best||dist(a.hand,p)<dist(best.hand,p)?a:best,null);return{...extra,point:p,regionId:'brass-cutting',actorId:actor?.id,maxHandDistance:actor?dist(actor.hand,p):Infinity};};
      return{start,finish,sweptClear:!settings.blocked,actors,sources:op.refs.map(ref=>endpoint(refPoint(ref),{ref})),destinations:op.to?[endpoint(locationPoint(op.to.location),{location:op.to.location})]:[],fixedContacts:Powder.powderFixedContactRoles(op).map(role=>{const p=fixedContact(s,role.id),a=actors.find(a=>a.id===role.actorId);return{...role,point:p,maxHandDistance:dist(a.hand,p)};})};
    },
    validateCustodyCause:Powder.validatePowderCustodyCause,
    prepareCustodyPhysicalEffects(){return{apply(){if(settings.throwPhysical)throw new Error('Deliberate physical apply failure');},rollback(){}};},
    validateAcceptedMotion(_s,motion){return JSON.stringify(motion)===JSON.stringify(settings.lastMotion)&&motion.finishedAt===s.elapsed&&dist(point(s.entities[motion.actorId]),motion.to)<1e-7;},
    wireCutGeometry(){return{cutoffPoints:[P(160,100)],lostPoints:[P(160,100)]};},
  };
  // Real native articulated motion on a clearly labelled straight test rail,
  // not the authored Brass terrain/arrival route. A strain receipt derives
  // from current engine position/speed and actual accepted nonzero travel.
  const rail=createRailPath({id:'explicit-powder-strain-fixture',segments:[{id:'fixture-line',kind:'line',from:P(-1000,100),to:P(2000,100),maxSpeed:200}]});
  let consist=createConsist(rail,TRAIN_CAR_SPECS,{id:'morrow-freight-consist',cursor:1100,speed:85}),lastRailStep=null;
  function strain(){
    if(!lastRailStep||lastRailStep.at!==s.elapsed||lastRailStep.travel<=0)return null;
    const engine=consist.cars[0],distance=dist(engine.frame.origin,contacts['turnout-service-plate']);
    return{at:s.elapsed,trainId:consist.id,carId:engine.id,terminalId:'turnout-split-collar',passingSpeed:consist.speed,groundDistance:distance,strain:consist.speed/80*Math.exp(-distance/180)};
  }
  ctx.terminalStrain=strain;ctx.validateTerminalStrain=(_s,receipt)=>JSON.stringify(receipt)===JSON.stringify(strain());
  const tick=(dt=.1)=>{for(const id of ['mara','ruth','juno'])if(s.entities[id]?.regionId==='brass-cutting')Object.assign(s.entities[id],{vx:0,vy:0,vz:0});s.elapsed+=dt;return Powder.stepPowderWork(s,dt,ctx);};
  function complete(request,{success=true}={}){assert.ok(request);for(let i=0;i<30&&Powder.trainPowderRecord(s).pending.length;i++)tick();const event=Powder.trainPowderRecord(s).physicalEvents.find(e=>e.data?.workId===request.workId);assert.ok(event);assert.ok(success?['work-completed','circuit-work-completed'].includes(event.kind):event.kind==='work-cancelled');}
  function move(id,dx,dy,dt=.1,{lay=false}={}){
    const actor=s.entities[id],from=point(actor),startedAt=s.elapsed;moveActor(world,actor,dx,dy,9);const to=point(actor);Object.assign(actor,{vx:(to.x-from.x)/dt,vy:(to.y-from.y)/dt,vz:0});s.elapsed+=dt;
    const n=Math.max(1,Math.ceil(dist(from,to)/4)),groundPoints=Array.from({length:n+1},(_,i)=>P(from.x+(to.x-from.x)*i/n,from.y+(to.y-from.y)*i/n,0));
    const motion={actorId:id,from,to,startedAt,finishedAt:s.elapsed,trace:{clear:!settings.blocked,groundPoints,length3d:dist(from,to),hit:settings.blocked?{id:'fixture-rock'}:null}};
    settings.lastMotion=structuredClone(motion);const paid=lay?Powder.applyAcceptedPowderMotion(s,motion,ctx):null;Powder.stepPowderWork(s,dt,ctx);return{motion,paid};
  }
  function history(){return Custody.validateRivalContinuation(s)&&Powder.validatePowderWorkHistory(Powder.trainPowderRecord(s),s.elapsed,{...Custody.custodyValidationLinks(s),fixedContactFor:id=>fixedContact(s,id)});}
  function passTrain(dt=.1){const next=advanceConsist(rail,TRAIN_CAR_SPECS,consist,dt,{throttle:0,brake:0});consist=next.state;s.elapsed+=dt;lastRailStep={at:s.elapsed,travel:next.physics.travel};Powder.stepPowderWork(s,dt,ctx);return Powder.applyPowderTerminalStrain(s,ctx);}
  assert.deepEqual({mara:s.entities.mara.hp,ruth:s.entities.ruth.hp},health);
  return{s,ctx,settings,refs,contacts,tick,complete,move,history,passTrain};
}

export function createRecoveredWireComponentFixture(){
 const f=createWireComponentFixture(),station=id=>({owner:'ruth',location:{type:'station',targetId:id,regionId:'brass-cutting'}});
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],station('turnout-service-plate'),f.ctx));
 f.complete(Powder.requestWireStart(f.s,'mara',f.ctx));f.complete(Powder.requestTerminalFastening(f.s,'charge','mara',f.ctx));
 for(let i=0;i<30;i++)assert.equal(f.move('mara',2,0,.1,{lay:true}).paid,true);
 for(let i=0;i<30;i++)f.move('ruth',2,0);
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.detonator,['ruth'],station('ridge-detonator'),f.ctx));
 f.complete(Powder.requestTerminalFastening(f.s,'detonator','mara',f.ctx));f.complete(Powder.requestCircuitTest(f.s,'mara',f.ctx));
 f.complete(Powder.requestWireCutClamp(f.s,'mara',station('ridge-detonator'),f.ctx));
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.spool,['mara','ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
 assert.equal(f.passTrain(),true);f.complete(Powder.requestDetonatorStroke(f.s,f.ctx));f.complete(Powder.requestCircuitDisconnect(f.s,f.ctx));
 for(let i=0;i<30;i++)f.move('ruth',-2,0);while(f.s.elapsed<Powder.trainPowderRecord(f.s).circuit.recovery.safeAfter+.01)f.tick();
 f.complete(Powder.requestPrimerRemoval(f.s,'quarry-sealed-charge-1','quarry-primer-1',f.ctx));
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'crate',targetId:'charge-crate'}},f.ctx));
 for(let i=0;i<30;i++)f.move('mara',-2,0);
 assert.equal(f.history(),true);return f;
}
