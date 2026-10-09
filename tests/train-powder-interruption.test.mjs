import test from 'node:test';import assert from 'node:assert/strict';
import {createFuseComponentFixture} from './helpers/train-powder-fuse-fixture.mjs';
import {createWireComponentFixture} from './helpers/train-powder-wire-fixture.mjs';
import * as Powder from '../src/train-powder.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
// Reuse the explicitly bounded spatial/hand fixtures and actual earned finite
// resources. Native consist motion and fuse/blast owners perform these causes;
// no production impact binder, complete travel/IK or public-mission claim.
function dueTransfer(){
 const f=createFuseComponentFixture();for(let i=0;i<2;i++)f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[i+1],[i?'juno':'mara'],f.socket(i),f.ctx));f.complete(Powder.requestFuseLighting(f.s,f.refs.charges[1].objectId,'mara',f.ctx));const p=Powder.trainPowderRecord(f.s);
 while(f.s.elapsed<p.fuses[0].dueAt-.25)f.tick({},.05);
 const request=Powder.requestPowderTransfer(f.s,f.refs.charges[1],['mara'],{owner:'mara',location:{type:'carried',targetId:'mara'}},f.ctx);assert.ok(request);return{...f,request};
}
function strainTransfer(){
 const f=createWireComponentFixture();f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'station',targetId:'turnout-service-plate',regionId:'brass-cutting'}},f.ctx));f.complete(Powder.requestWireStart(f.s,'mara',f.ctx));f.complete(Powder.requestTerminalFastening(f.s,'charge','mara',f.ctx));
 const request=Powder.requestPowderTransfer(f.s,f.refs.tin,['ruth'],{owner:'ruth',location:{type:'station',targetId:'turnout-service-plate',regionId:'brass-cutting'}},f.ctx);assert.ok(request);return{...f,request};
}
test('actual six-second fuse cancels a touched pending transfer before its one real blast, rather than waiting on the lock',()=>{
 const f=dueTransfer(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID];for(let i=0;i<8&&!p.fuses[0].blastEventId;i++)f.tick({},.05);
 assert.ok(p.fuses[0].blastEventId);assert.equal(p.pending.length,0);assert.equal(r.rival.continuation.requests[f.request.requestId],undefined);assert.equal(r.objects['quarry-sealed-charge-2'].powder.spent,true);
 const cancelled=p.physicalEvents.find(e=>e.kind==='work-cancelled'&&e.data.workId===f.request.workId),blast=p.physicalEvents.find(e=>e.kind==='charge-blast');assert.ok(cancelled);assert.ok(p.physicalEvents.indexOf(cancelled)<p.physicalEvents.indexOf(blast));assert.equal(r.rival.continuation.events.filter(e=>e.kind==='blast-charge').length,1);assert.equal(f.history(),true);
});
test('failed actual overdue blast restores original pending request/prefix/metadata and physical effects, then retries once',()=>{
 const f=dueTransfer(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID],health=['mara','juno','ruth'].map(id=>f.s.entities[id].hp),canonical=JSON.stringify(r.rival.continuation),due=p.fuses[0].dueAt;
 f.settings.throwPhysical=true;while(f.s.elapsed<due+.001)f.tick({},.05);assert.equal(JSON.stringify(r.rival.continuation),canonical);assert.deepEqual(['mara','juno','ruth'].map(id=>f.s.entities[id].hp),health);assert.equal(p.fuses[0].dueAt,due);assert.equal(p.fuses[0].blastEventId,null);assert.equal(p.pending[0].requestId,f.request.requestId);assert.ok(p.pending[0].acceptedSeconds<.9);assert.equal(f.history(),true);
 const pending=JSON.stringify(p.pending),events=JSON.stringify(p.physicalEvents);assert.deepEqual(Powder.advancePowderFuses(f.s,f.ctx),[]);assert.equal(JSON.stringify(p.pending),pending);assert.equal(JSON.stringify(p.physicalEvents),events);assert.equal(JSON.stringify(r.rival.continuation),canonical);
 f.settings.throwPhysical=false;assert.deepEqual(Powder.advancePowderFuses(f.s,f.ctx),[f.refs.charges[1].objectId]);assert.equal(p.pending.length,0);assert.equal(r.rival.continuation.events.filter(e=>e.kind==='blast-charge').length,1);assert.equal(f.history(),true);
});
test('actual passing native consist interrupts a touched tin transfer and damages the same attached primer once',()=>{
 const f=strainTransfer(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID];assert.equal(f.passTrain(),true);assert.equal(p.pending.length,0);assert.deepEqual(r.objects['cap-tin'].location,{type:'carried',targetId:'ruth'});assert.equal(r.objects['cap-tin'].primers[0].state,'damaged');assert.equal(p.physicalEvents.filter(e=>e.kind==='work-cancelled'&&e.data.workId===f.request.workId).length,1);assert.equal(r.rival.continuation.events.filter(e=>e.kind==='damage-primer').length,1);assert.equal(f.history(),true);
});
test('failed strain commit restores interruption metadata and accepted tin-transfer progress before actual retry',()=>{
 const f=strainTransfer(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions[RIVAL_ID],canonical=JSON.stringify(r.rival.continuation),prior=structuredClone(p.pending[0]);f.settings.throwPhysical=true;assert.equal(f.passTrain(),false);assert.equal(JSON.stringify(r.rival.continuation),canonical);assert.equal(p.pending[0].requestId,prior.requestId);assert.ok(Math.abs(p.pending[0].acceptedSeconds-prior.acceptedSeconds-.1)<1e-7);assert.equal(r.objects['cap-tin'].primers[0].state,'attached');assert.equal(p.circuit.breakEventId,null);assert.equal(f.history(),true);
 f.settings.throwPhysical=false;assert.equal(Powder.applyPowderTerminalStrain(f.s,f.ctx),true);assert.equal(p.pending.length,0);assert.equal(r.objects['cap-tin'].primers[0].state,'damaged');assert.equal(f.history(),true);
});
