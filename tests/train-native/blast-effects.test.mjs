/** Limited train-cover component fixtures, not valid Journeys or earned fuse
 * histories. Real car/gangway frames and the real instantaneous ray query are
 * exercised; complete terrain/provider and custody-bridge acceptance is later.
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../../content/campaign/bellwether-works.js';
import {worldPoint,localPoint,dot} from '../../src/rail-foundation/rigid-frame.js';
import {worldContact} from '../../src/rail-foundation/moving-support.js';
import {createTrainConsist,trainGeometry,validateTrainSupport} from '../../src/train-motion.js';
import {raycastCoverAt} from '../../src/train-terrain.js';
import {createTrainBlastState,createTrainBlastOwner,privateTrainDoorBreached} from '../../src/train-blast.js';
const ref=(id,sourceMissionId=RIVAL_ID)=>({sourceMissionId,objectId:id}),copy=v=>structuredClone(v);
function fixture(){
  const consist=createTrainConsist(),geometry=trainGeometry(consist),car=geometry.platforms.find(p=>p.id==='morrow-custody-coach'),gangway=geometry.platforms.find(p=>p.id==='morrow-gangway-6');
  function person(id,platform,surfaceId,local,hp){return{id,category:id==='mara'?'player':'npc',kind:'person',regionId:'brass-cutting',hp,...worldPoint(platform.frame,local),r:9,footRadius:9,height:53,onGround:true,support:{carId:platform.id,surfaceId,local,relativeVelocity:{x:0,y:0,z:0}}};}
  const reference=worldPoint(car.frame,{x:97,y:-17,z:26}),n=gangway.frame.z;
  const root={...reference,z:(dot(n,gangway.frame.origin)-n.x*reference.x-n.y*reference.y)/n.z};
  const mara=person('mara',gangway,'gangway-deck',localPoint(gangway.frame,root),51),worker=person('etta',car,'private-floor',{x:-36,y:0,z:26},100);
  assert.ok(validateTrainSupport(mara,consist));assert.ok(validateTrainSupport(worker,consist));
  const charges=[2,3].map((number,index)=>{const contactId=index?'private-hinge-b':'private-hinge-a',contact=car.contacts.find(c=>c.id===contactId);return{id:`quarry-sealed-charge-${number}`,kind:'sealed-charge',sealed:false,owner:'mara',location:{type:'car',carId:car.id,contactId,local:copy(contact.local),regionId:'brass-cutting'},powder:{spent:false,primerId:`quarry-primer-${index+1}`,fuseRef:ref(index?'brass-fuse-b':'brass-fuse-a',TRAIN_ID)}};});
  const primers=Array.from({length:6},(_,i)=>({id:`quarry-primer-${i+1}`,kind:'game-primer',state:i<2?'attached':'in-tin'}));
  const physicalEvents=charges.map((charge,i)=>({id:`powder-event-${i+1}`,kind:'charge-blast',at:20,data:{chargeRef:ref(charge.id),trigger:'fuse',projectileReceipt:null,custodyEventId:null}}));
  const powder={kit:Object.fromEntries(['brass-fuse-a','brass-fuse-b'].map(id=>[id,{id,kind:'game-fuse',owner:null,location:{type:'consumed'}}])),physicalEvents,fuses:charges.map((c,i)=>({chargeRef:ref(c.id),fuseRef:c.powder.fuseRef,litEventId:`light-${i+1}`,litAt:14,dueAt:20,blastEventId:null}))};
  const s={version:5,elapsed:20,entities:{mara,etta:worker},campaign:{activeMissionId:TRAIN_ID,missions:{[TRAIN_ID]:{train:{consist,powder,blasts:createTrainBlastState()}},[RIVAL_ID]:{rival:{continuation:{events:[{id:'tin-open',kind:'open-tin'}]}},objects:{...Object.fromEntries(charges.map(c=>[c.id,c])),'cap-tin':{id:'cap-tin',kind:'cap-tin',openingEventId:'tin-open',primers}}}}}};
  const world={regionId:'brass-cutting',geometry};
  const providers={worldFor:()=>world,raycast:(w,a,b,options)=>raycastCoverAt(w.geometry,a,b,options),actorPoint:(actor,w)=>{assert.ok(validateTrainSupport(actor,consist));return{x:actor.x,y:actor.y,z:actor.z};},
    chargePoint:(state,charge,w)=>{const p=w.geometry.platforms.find(p=>p.id===charge.location.carId),contact=p.contacts.find(c=>c.id===charge.location.contactId);assert.deepEqual(charge.location.local,contact.local);return{...worldContact(p,contact.id),regionId:w.regionId};},
    doorPoint:(state,w,origin)=>{const p=w.geometry.platforms.find(p=>p.id===car.id),cover=p.cover.find(c=>c.id==='private-iron-door'),local=localPoint(p.frame,origin);return{present:true,point:worldPoint(p.frame,Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(cover.bounds.min[k],Math.min(cover.bounds.max[k],local[k]))])))};}};
  const owner=createTrainBlastOwner(providers),args=index=>({chargeRef:ref(charges[index].id),trigger:'fuse',cause:{missionId:TRAIN_ID,eventId:physicalEvents[index].id}}),receipt=index=>({...owner.blastGeometry(s,args(index)),custodyEventId:`canonical-blast-${index+1}`});
  return{s,owner,providers,args,receipt,charges};
}
test('real current iron/partition shielding protects worker while an exposed gangway actor takes actual damage',()=>{
  const {s,owner,receipt,charges}=fixture(),before=JSON.stringify(s),resources=JSON.stringify(charges);
  const effect=owner.prepareBlastEffects(s,receipt(0));assert.equal(JSON.stringify(s),before,'preparation is read-only');
  effect.apply();assert.equal(s.entities.etta.hp,100);assert.equal(s.entities.mara.hp,0);assert.equal(s.entities.mara.dead,true);
  assert.equal(s.campaign.missions[TRAIN_ID].train.blasts.events[0].doorHit,true);assert.equal(privateTrainDoorBreached(s),false);
  assert.equal(JSON.stringify(charges),resources,'physical owner never consumes or clones resources');
  effect.rollback();assert.equal(JSON.stringify(s),before,'rollback restores HP/dead absence and physical history exactly');
});
test('two distinct conserved charge events are required for physical breach and repeated child refuses',()=>{
  const {s,owner,receipt}=fixture();owner.prepareBlastEffects(s,receipt(0)).apply();
  assert.throws(()=>owner.prepareBlastEffects(s,{...receipt(0),custodyEventId:'invented-second-use'}),/repeated/);
  owner.prepareBlastEffects(s,receipt(1)).apply();assert.equal(privateTrainDoorBreached(s),true);assert.equal(s.campaign.missions[TRAIN_ID].train.blasts.events.length,2);
});
test('stale clock/body and forged origin refuse before damage; provider absence never means clear',()=>{
  const {s,owner,receipt,providers,args}=fixture(),valid=receipt(0),beforeHp=s.entities.mara.hp;
  assert.throws(()=>owner.prepareBlastEffects(s,{...valid,origin:{...valid.origin,x:valid.origin.x+1}}),/changed/);
  const timed=owner.prepareBlastEffects(s,valid);s.elapsed+=.1;assert.throws(()=>timed.apply(),/stale/);assert.equal(s.entities.mara.hp,beforeHp);s.elapsed=20;
  const moved=owner.prepareBlastEffects(s,valid);s.entities.mara.x+=1;assert.throws(()=>moved.apply(),/stale/);assert.equal(s.entities.mara.hp,beforeHp);
  assert.throws(()=>createTrainBlastOwner({}),/required/);
  assert.equal(createTrainBlastOwner({...providers,worldFor:()=>null}).blastGeometry(s,args(0)),null);
});
test('physical write failure restores affected actor and event history before propagating',()=>{
  const {s,owner,receipt}=fixture(),before=JSON.stringify(s),events=s.campaign.missions[TRAIN_ID].train.blasts.events;
  const effect=owner.prepareBlastEffects(s,receipt(0));events.push=()=>{throw new Error('deliberate physical event fault');};
  assert.throws(()=>effect.apply(),/deliberate/);delete events.push;assert.equal(JSON.stringify(s),before);
});
test('fuse duration comes from its finite authored instance and an explicitly absent door grants no shielding',()=>{
  const {s,owner,providers,args}=fixture(),powder=s.campaign.missions[TRAIN_ID].train.powder;
  powder.fuses[0].dueAt=15;assert.equal(owner.blastGeometry(s,args(0)),null,'edited shorter deadline is not earned timing');powder.fuses[0].dueAt=20;
  const noDoor=createTrainBlastOwner({...providers,doorPoint:()=>({present:false})}),receipt={...noDoor.blastGeometry(s,args(0)),custodyEventId:'canonical-absent-door'};
  noDoor.prepareBlastEffects(s,receipt).apply();assert.equal(s.campaign.missions[TRAIN_ID].train.blasts.events[0].doorHit,false);assert.equal(s.entities.mara.hp,0);
});
