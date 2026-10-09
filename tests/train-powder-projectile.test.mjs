import test from 'node:test';import assert from 'node:assert/strict';
import {createFuseComponentFixture} from './helpers/train-powder-fuse-fixture.mjs';
import {createWireComponentFixture} from './helpers/train-powder-wire-fixture.mjs';
import {bindPowderProjectileFixture} from './helpers/train-powder-projectile-fixture.mjs';
import {worldPoint} from '../src/rail-foundation/rigid-frame.js';
import {raycastCoverAt} from '../src/train-terrain.js';
import {createTrainConsist,advanceTrainConsist,trainGeometry} from '../src/train-motion.js';
import {createTrainBlastState} from '../src/train-blast.js';
import {createTrainCombat} from '../src/train-combat.js';
import {createTrainRuntimeSections} from '../src/train-runtime-schema.js';
import * as Journey from '../src/campaign-journey.js';
import * as Powder from '../src/train-powder.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
const P=a=>({x:a.x,y:a.y,z:a.z||0});
function prepared(){const f=createFuseComponentFixture();for(let i=0;i<2;i++)f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[i+1],[i?'juno':'mara'],f.socket(i),f.ctx));return f;}
function harness(f){return bindPowderProjectileFixture({...f,boxFor(charge,w){if(charge.location.type!=='car')return null;const frame=w.geometry.platforms.find(p=>p.id===charge.location.carId).frame;return{frame,center:charge.location.local};}});}
function target(f,index){return P(f.blastProviders.chargePoint(f.s,f.s.campaign.missions[RIVAL_ID].objects[f.refs.charges[index].objectId],f.world()));}

test('real owned round/native flight/finite charge intersection causes one unlit premature blast without fake lighting',()=>{
 const f=prepared();f.retreat();const stores=f.world().geometry.platforms.find(p=>p.id==='morrow-stores-coach');f.walkTo('mara',worldPoint(stores.frame,{x:-20,y:-20,z:26}));f.tick();f.enableCombat();
 const r=f.s.campaign.missions[RIVAL_ID],originalGrade=structuredClone(r.performance),gun=f.s.weapons[f.s.entities.mara.equippedWeaponId],ammo=gun.ammo,h=harness(f),bullet=h.shoot(target(f,2)),result=h.fly(bullet),p=Powder.trainPowderRecord(f.s);
 assert.equal(result.receipt.kind,'charge');assert.equal(result.receipt.chargeRef.objectId,'quarry-sealed-charge-3');assert.equal(result.blasted,true);assert.equal(gun.ammo,ammo-1);
 assert.equal(p.fuses[1].litEventId,null);assert.equal(p.fuses[1].litAt,null);assert.equal(p.fuses[1].dueAt,null);assert.ok(p.fuses[1].blastEventId);assert.equal(p.kit['brass-fuse-b'].state,'spent');
 assert.equal(r.objects['quarry-sealed-charge-3'].powder.spent,true);assert.equal(r.rival.continuation.events.filter(event=>event.kind==='light-fuse').length,0);assert.deepEqual(r.performance,originalGrade);
 assert.equal(f.s.campaign.missions[TRAIN_ID].performance.shots,1);assert.equal(f.s.campaign.missions[TRAIN_ID].train.combat.emissions.length,1);assert.equal(f.history(),true);
 assert.equal(Powder.applyPowderProjectileHit(f.s,f.refs.charges[2],result.receipt,f.ctx),false);assert.equal(r.rival.continuation.events.filter(event=>event.kind==='blast-charge').length,1);
});

test('existing living body wins earlier native projectile intersection and prevents a fictional charge hit',()=>{
 const f=prepared();f.tick();f.enableCombat();const h=harness(f),result=h.fly(h.shoot(target(f,2))),r=f.s.campaign.missions[RIVAL_ID];
 assert.equal(result.receipt.kind,'body');assert.equal(result.receipt.actorId,'juno');assert.equal(result.blasted,false);assert.equal(r.objects['quarry-sealed-charge-3'].powder.spent,false);assert.deepEqual(f.s.campaign.missions[TRAIN_ID].train.blasts.events,[]);
 assert.equal(Powder.applyPowderProjectileHit(f.s,f.refs.charges[2],{...result.receipt,chargeRef:f.refs.charges[2]},f.ctx),false);
});

test('actual current iron obstruction and an actual miss never become charge receipts',()=>{
 const f=prepared();f.tick();f.enableCombat();const h=harness(f),inside=worldPoint(f.car().frame,{x:0,y:0,z:45}),result=h.fly(h.shoot(inside));
 assert.equal(result.receipt.kind,'cover');assert.equal(result.receipt.volumeId,'private-iron-door');assert.equal(result.blasted,false);assert.deepEqual(f.s.campaign.missions[TRAIN_ID].train.blasts.events,[]);
 const g=prepared();g.retreat();const maintenance=g.world().geometry.platforms.find(p=>p.id==='morrow-maintenance-wagon');g.walkTo('mara',worldPoint(maintenance.frame,{x:-45,y:0,z:26}));g.tick();assert.equal(g.s.entities.mara.support.carId,'morrow-maintenance-wagon');g.enableCombat();const miss=harness(g),a=g.s.entities.mara,flight=miss.fly(miss.shoot({x:a.x,y:a.y,z:a.z+200}));
 assert.equal(flight.receipt,null);assert.equal(flight.blasted,false);assert.deepEqual(g.s.campaign.missions[TRAIN_ID].train.blasts.events,[]);
});

test('real gun hit before wire work consumes first original and records destroyed terminal without a fake misfire',()=>{
 const f=createWireComponentFixture(),s=f.s,r=s.campaign.missions[RIVAL_ID];
 f.complete(Powder.requestPowderTransfer(s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'station',targetId:'turnout-service-plate',regionId:'brass-cutting'}},f.ctx));
 for(let i=0;i<90;i++)f.move('mara',2,0);for(let i=0;i<80;i++)f.move('ruth',0,2);f.tick();
 Journey.campaignAction(s,'equip:tern-carbine');Journey.campaignAction(s,'holster');assert.equal(s.entities.mara.equippedWeaponId,'tern-carbine');
 // Empty emission-world initialization only, no mission entry/stage claim.
 s.campaign.activeMissionId=TRAIN_ID;s.campaign.missions[TRAIN_ID].performance=structuredClone(createTrainRuntimeSections(s).performance);s.campaign.missions[TRAIN_ID].train.combat=createTrainCombat();s.campaign.missions[TRAIN_ID].train.blasts=createTrainBlastState();
 let consist=createTrainConsist(),geometry=trainGeometry(consist);s.campaign.missions[TRAIN_ID].train.consist=consist;
 const world=()=>({regionId:'brass-cutting',geometry}),origin={x:100,y:100,z:6},blastProviders={worldFor:world,raycast:(w,a,b,o)=>raycastCoverAt(w.geometry,a,b,o),actorPoint:P,chargePoint:()=>({...origin,regionId:'brass-cutting'}),doorPoint:()=>({present:true,point:worldPoint(geometry.platforms.find(p=>p.id==='morrow-custody-coach').frame,{x:85,y:0,z:45})})};
 const tick=(_controls,dt)=>{const next=advanceTrainConsist(consist,dt,{throttle:0,brake:0});consist=next.state;geometry=next.geometry;s.campaign.missions[TRAIN_ID].train.consist=consist;f.tick(dt);};
 const priorAuthorization=f.ctx.authorizeCustodyOp;f.ctx.authorizeCustodyOp=(_s,op)=>op.kind==='blast-charge'?op.actorIds.length===0&&op.options.chargeId==='quarry-sealed-charge-1'&&op.options.trigger==='projectile':priorAuthorization(_s,op);
 Journey.campaignAction(s,'draw');assert.equal(s.entities.mara.holstered,false);const health=[s.entities.mara.hp,s.entities.ruth.hp],gun=s.weapons['tern-carbine'],ammo=gun.ammo;
 const h=bindPowderProjectileFixture({s,ctx:f.ctx,tick,world,blastProviders,boxFor:charge=>charge.id==='quarry-sealed-charge-1'&&charge.location.type==='station'?{center:origin}:null}),result=h.fly(h.shoot(origin)),p=Powder.trainPowderRecord(s);
 assert.equal(result.receipt.kind,'charge');assert.equal(result.receipt.chargeRef.objectId,'quarry-sealed-charge-1');assert.equal(result.blasted,true);assert.equal(gun.ammo,ammo-1);
 assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,true);assert.equal(r.objects['charge-crate'].count,3);assert.deepEqual(r.objects['charge-crate'].consumedChargeIds,['quarry-sealed-charge-1']);
 assert.deepEqual(p.circuit.path,[]);assert.equal(p.circuit.terminals.charge.state,'destroyed');assert.equal(p.circuit.breakEventId,null);assert.deepEqual(p.circuit.strokes,[]);assert.equal(r.objects['cap-tin'].primers[0].state,'spent');assert.equal(r.objects['cap-tin'].primers.filter(unit=>unit.state==='damaged').length,0);
 assert.deepEqual([s.entities.mara.hp,s.entities.ruth.hp],health);assert.equal(f.history(),true);
});

test('actual owned projectile interrupts Ruth’s pending physical fastening before its one native charge blast',()=>{
 const f=createWireComponentFixture(),s=f.s,r=s.campaign.missions[RIVAL_ID];
 f.complete(Powder.requestPowderTransfer(s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'station',targetId:'turnout-service-plate',regionId:'brass-cutting'}},f.ctx));
 f.complete(Powder.requestWireStart(s,'mara',f.ctx));for(let i=0;i<18;i++)f.move('ruth',1,0,.05);
 const fastening=Powder.requestTerminalFastening(s,'charge','ruth',f.ctx);assert.ok(fastening);
 Journey.campaignAction(s,'equip:tern-carbine');Journey.campaignAction(s,'draw');assert.equal(s.entities.mara.holstered,false);
 // Same explicit initial emission/car-world fixture as the prior first-child
 // shot. No stage, health, ammunition, completion or impact is assigned.
 s.campaign.activeMissionId=TRAIN_ID;s.campaign.missions[TRAIN_ID].performance=structuredClone(createTrainRuntimeSections(s).performance);s.campaign.missions[TRAIN_ID].train.combat=createTrainCombat();s.campaign.missions[TRAIN_ID].train.blasts=createTrainBlastState();
 let consist=createTrainConsist(),geometry=trainGeometry(consist);s.campaign.missions[TRAIN_ID].train.consist=consist;
 const world=()=>({regionId:'brass-cutting',geometry}),origin={x:100,y:100,z:6},blastProviders={worldFor:world,raycast:(w,a,b,o)=>raycastCoverAt(w.geometry,a,b,o),actorPoint:P,chargePoint:()=>({...origin,regionId:'brass-cutting'}),doorPoint:()=>({present:true,point:worldPoint(geometry.platforms.find(p=>p.id==='morrow-custody-coach').frame,{x:85,y:0,z:45})})};
 const tick=(_controls,dt)=>{const next=advanceTrainConsist(consist,dt,{throttle:0,brake:0});consist=next.state;geometry=next.geometry;s.campaign.missions[TRAIN_ID].train.consist=consist;f.tick(dt);};
 const prior=f.ctx.authorizeCustodyOp;f.ctx.authorizeCustodyOp=(_s,op)=>op.kind==='blast-charge'?op.actorIds.length===0&&op.options.chargeId==='quarry-sealed-charge-1'&&op.options.trigger==='projectile':prior(_s,op);
 const ammo=s.weapons['tern-carbine'].ammo,h=bindPowderProjectileFixture({s,ctx:f.ctx,tick,world,blastProviders,boxFor:charge=>charge.id==='quarry-sealed-charge-1'&&charge.location.type==='station'?{center:origin}:null}),result=h.fly(h.shoot(origin)),p=Powder.trainPowderRecord(s);
 assert.equal(result.receipt.kind,'charge');assert.equal(result.blasted,true);assert.equal(s.weapons['tern-carbine'].ammo,ammo-1);assert.equal(p.pending.length,0);
 const cancelled=p.physicalEvents.find(e=>e.kind==='work-cancelled'&&e.data.workId===fastening.workId),blast=p.physicalEvents.find(e=>e.kind==='charge-blast');assert.ok(cancelled);assert.ok(p.physicalEvents.indexOf(cancelled)<p.physicalEvents.indexOf(blast));assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,true);assert.equal(r.rival.continuation.events.filter(e=>e.kind==='blast-charge').length,1);assert.equal(f.history(),true);
});
