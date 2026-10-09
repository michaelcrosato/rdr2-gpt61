import test from 'node:test';import assert from 'node:assert/strict';
import {createFuseComponentFixture} from './helpers/train-powder-fuse-fixture.mjs';
import * as Powder from '../src/train-powder.js';
import * as Custody from '../src/rival-continuation.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {privateTrainDoorBreached} from '../src/train-blast.js';
function placed(){const f=createFuseComponentFixture();f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[1],['mara'],f.socket(0),f.ctx));assert.equal(Powder.requestFuseLighting(f.s,f.refs.charges[1].objectId,'mara',f.ctx),null);f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[2],['juno'],f.socket(1),f.ctx));assert.equal(f.history(),true);return f;}
function lit(){const f=placed(),a=Powder.requestFuseLighting(f.s,f.refs.charges[1].objectId,'mara',f.ctx),b=Powder.requestFuseLighting(f.s,f.refs.charges[2].objectId,'juno',f.ctx);assert.ok(a);assert.ok(b);f.complete(a);assert.equal(f.history(),true);return f;}

test('distinct native hinge placements earn two exclusive lights and fixed six-second deadlines',()=>{
 const f=lit(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID];
 assert.notEqual(p.fuses[0].litEventId,p.fuses[1].litEventId);
 for(const fuse of p.fuses){assert.equal(fuse.dueAt,fuse.litAt+6);assert.equal(p.kit[fuse.fuseRef.objectId].state,'burning');assert.equal(Powder.requestFuseLighting(f.s,fuse.chargeRef.objectId,fuse.chargeRef.objectId.endsWith('2')?'mara':'juno',f.ctx),null);}
 assert.equal(r.objects['cap-tin'].primers.filter(unit=>unit.state==='in-tin').length,3);
 const before=JSON.stringify(p),elapsed=f.s.elapsed;
 assert.deepEqual(Powder.advancePowderFuses(f.s,f.ctx,{paused:true}),[]);assert.equal(JSON.stringify(p),before);assert.equal(f.s.elapsed,elapsed);
 for(const mutate of [r=>{r.fuses[0].litAt-=1;r.fuses[0].dueAt-=1;},r=>{r.fuses[0].dueAt-=.1;},r=>{r.fuses[1].litEventId=r.fuses[0].litEventId;}]){
  const bad=structuredClone(p);mutate(bad);assert.equal(Powder.validatePowderWorkHistory(bad,f.s.elapsed,{...Custody.custodyValidationLinks(f.s),fixedContactFor:id=>f.ctx.fixedContact(f.s,id)}),false);
 }
});

test('unsafe actual native exposure damages existing people while exactly two originals breach and conserve stock',()=>{
 const f=lit(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID],ruthHp=f.s.entities.ruth.hp;
 for(let i=0;i<70&&p.fuses.some(fuse=>fuse.blastEventId===null);i++)f.tick();
 assert.ok(p.fuses.every(fuse=>fuse.blastEventId!==null));assert.equal(privateTrainDoorBreached(f.s),true);
 assert.equal(f.s.entities.mara.hp,0,'Unsafe exposed original Mara takes real blast damage');assert.equal(f.s.entities.ruth.hp,ruthHp,'Actual iron/partition shields original Ruth');
 assert.deepEqual(r.objects['charge-crate'].chargeIds,['quarry-sealed-charge-1','quarry-sealed-charge-4']);assert.equal(r.objects['charge-crate'].count,2);assert.deepEqual(r.objects['charge-crate'].consumedChargeIds,['quarry-sealed-charge-2','quarry-sealed-charge-3']);
 assert.equal(r.objects['cap-tin'].primers.filter(unit=>unit.state==='damaged').length,1);assert.equal(r.objects['cap-tin'].primers.filter(unit=>unit.state==='spent').length,2);assert.equal(r.objects['cap-tin'].primers.filter(unit=>unit.state==='in-tin').length,3);
 assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,false);assert.equal(r.objects['quarry-sealed-charge-4'].sealed,true);assert.equal(f.history(),true);
 const events=p.custodyEventRefs.length;assert.deepEqual(Powder.advancePowderFuses(f.s,f.ctx),[]);assert.equal(p.custodyEventRefs.length,events);
});

test('actual supported retreat through open vestibule reaches safe distance before both fuse blasts',()=>{
 const f=lit(),before={mara:f.s.entities.mara.hp,juno:f.s.entities.juno.hp,ruth:f.s.entities.ruth.hp},p=Powder.trainPowderRecord(f.s);
 f.retreat();assert.deepEqual({mara:f.s.entities.mara.hp,juno:f.s.entities.juno.hp,ruth:f.s.entities.ruth.hp},before);
 assert.ok(f.s.elapsed<p.fuses[0].dueAt,'Native retreat finishes within actual remaining fuse time');
 for(let i=0;i<70&&p.fuses.some(fuse=>fuse.blastEventId===null);i++)f.tick();
 assert.ok(p.fuses.every(fuse=>fuse.blastEventId!==null));assert.equal(privateTrainDoorBreached(f.s),true);
 assert.deepEqual({mara:f.s.entities.mara.hp,juno:f.s.entities.juno.hp,ruth:f.s.entities.ruth.hp},before);assert.equal(f.history(),true);
});

test('burning-fuse JSON component boundary retains original due times, bodies and single resource use',()=>{
 const f=lit(),deadlines=Powder.trainPowderRecord(f.s).fuses.map(fuse=>({litAt:fuse.litAt,dueAt:fuse.dueAt,litEventId:fuse.litEventId}));for(let i=0;i<5;i++)f.tick();
 const raw=JSON.stringify(f.s),resumed=createFuseComponentFixture({componentGraph:JSON.parse(raw)}),p=Powder.trainPowderRecord(resumed.s);
 // Component/actual-car JSON boundary only; no full Journey/UI Save claim.
 assert.deepEqual(p.fuses.map(fuse=>({litAt:fuse.litAt,dueAt:fuse.dueAt,litEventId:fuse.litEventId})),deadlines);assert.equal(resumed.history(),true);
 assert.deepEqual(['mara','juno','ruth'].map(id=>resumed.s.entities[id].support),['mara','juno','ruth'].map(id=>f.s.entities[id].support));
 resumed.retreat();for(let i=0;i<70&&p.fuses.some(fuse=>fuse.blastEventId===null);i++)resumed.tick();
 assert.ok(p.fuses.every(fuse=>fuse.blastEventId!==null));assert.equal(resumed.s.entities.mara.hp,51);assert.equal(resumed.s.entities.juno.hp,100);assert.equal(resumed.history(),true);
 assert.equal(resumed.s.campaign.missions[RIVAL_ID].rival.continuation.events.filter(event=>event.kind==='light-fuse').length,2);
});

test('post-blast component exception atomically restores damage, door, stock and overdue burning clocks',()=>{
 const f=lit(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID],health=['mara','juno','ruth'].map(id=>f.s.entities[id].hp),originalDue=p.fuses.map(fuse=>fuse.dueAt),events=r.rival.continuation.events.length;
 f.settings.throwPhysical=true;while(f.s.elapsed<p.fuses[0].dueAt+.01)f.tick();
 assert.deepEqual(['mara','juno','ruth'].map(id=>f.s.entities[id].hp),health);assert.equal(privateTrainDoorBreached(f.s),false);assert.deepEqual(f.s.campaign.missions[TRAIN_ID].train.blasts.events,[]);
 assert.equal(r.rival.continuation.events.length,events);assert.deepEqual(p.fuses.map(fuse=>fuse.dueAt),originalDue);assert.ok(p.fuses.every(fuse=>fuse.blastEventId===null&&p.kit[fuse.fuseRef.objectId].state==='burning'));
 assert.equal(r.objects['quarry-sealed-charge-2'].powder.spent,false);assert.equal(r.objects['cap-tin'].primers.filter(primer=>primer.state==='spent').length,0);assert.equal(f.history(),true);
 f.settings.throwPhysical=false;f.tick();assert.ok(p.fuses.every(fuse=>fuse.blastEventId!==null));assert.equal(r.rival.continuation.events.filter(event=>event.kind==='blast-charge').length,2);assert.equal(f.history(),true);
});
