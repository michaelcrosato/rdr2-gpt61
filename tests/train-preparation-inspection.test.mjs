import test from 'node:test';
import assert from 'node:assert/strict';
import {createPowderFixture} from './helpers/train-powder-fixture.mjs';
import * as Powder from '../src/train-powder.js';
import * as Custody from '../src/rival-continuation.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_TOOL_CASE} from '../content/campaign/train-equipment.js';

// Actual untouched earned prior-story bytes, native camp approaches and finite
// bridge operations; explicit z33/dispatch component fixture only. These do
// not prove Root's new Native inspection poses, full Journey Save or availability.
const original=id=>({sourceMissionId:RIVAL_ID,objectId:id}),tool=id=>({sourceMissionId:TRAIN_ID,objectId:id});
function fixture(options){const f=createPowderFixture(options);f.ctx.authorizePreparationInspection=(_s,op)=>op.actorIds.join(',')==='mara,ruth';return f;}
function atStore(f){const p=RIVAL_WORLD.camp.charges;f.approach('mara',{x:p.x-10,y:p.y});f.approach('ruth',{x:p.x+10,y:p.y});}
function atCase(f){f.approach('mara',{x:TRAIN_TOOL_CASE.x-10,y:TRAIN_TOOL_CASE.y});f.approach('ruth',{x:TRAIN_TOOL_CASE.x+10,y:TRAIN_TOOL_CASE.y});}
const inspect=(f,topic,ref)=>Powder.requestPreparationInspection(f.s,{topic,ref,actorIds:['mara','ruth']},f.ctx);
const record=f=>Powder.trainPowderRecord(f.s);
function valid(f,r=record(f),links=Custody.custodyValidationLinks(f.s)){return Powder.validatePowderWorkHistory(r,f.s.elapsed,{...links,fixedContactFor:id=>f.ctx.fixedContact(f.s,id)});}

test('each actual original child earns its own timed observation without changing any original object, old flag, score or stock',()=>{
 const f=fixture();atStore(f);const objects=JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects),score=JSON.stringify(f.s.campaign.missions[RIVAL_ID].performance);
 for(let n=1;n<=4;n++){const request=inspect(f,'child-seal',original(`quarry-sealed-charge-${n}`));assert.equal(request.requiredSeconds,.6);f.complete(request);}
 const rows=Powder.preparationInspectionEvidence(f.s);assert.equal(rows.length,4);assert.deepEqual(rows.map(row=>row.ref.objectId),Array.from({length:4},(_,i)=>`quarry-sealed-charge-${i+1}`));assert.ok(rows.every(row=>row.measurement.sealed&&row.measurement.primerId===null&&!row.measurement.spent));
 assert.equal(JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects),objects);assert.equal(JSON.stringify(f.s.campaign.missions[RIVAL_ID].performance),score);assert.deepEqual(record(f).kit,{});assert.equal(f.s.campaign.missions[RIVAL_ID].rival.continuation.events.length,0);assert.equal(valid(f),true);assert.equal(f.history(),true);
 rows[0].measurement.sealed=false;assert.equal(Powder.preparationInspectionEvidence(f.s)[0].measurement.sealed,true,'evidence is a detached historical value');assert.deepEqual(Powder.preparationInspectionEvidence(f.s,{at:rows[0].finishedAt-.01}),[]);
});

test('tin observation refuses undisclosed primers, then counts the same actual six revealed units without a second issue',()=>{
 const f=fixture();atStore(f);assert.equal(inspect(f,'primer-tin',original('cap-tin')),null);f.complete(Powder.requestTinOpening(f.s,f.ctx));const before=JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects);f.complete(inspect(f,'primer-tin',original('cap-tin')));
 const row=Powder.preparationInspectionEvidence(f.s)[0];assert.equal(row.measurement.usableIds.length,6);assert.deepEqual(row.measurement.absentIds,[]);assert.deepEqual(row.measurement.unserviceableIds,[]);assert.equal(JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects),before);assert.equal(Powder.requestTinOpening(f.s,f.ctx),null);assert.equal(valid(f),true);
});

test('wire/tool observation refuses unissued definitions and measures the actual one issued conserved kit',()=>{
 const f=fixture();atCase(f);assert.equal(inspect(f,'wire-and-tools',tool('brass-wire-spool')),null);f.complete(Powder.requestKitOpening(f.s,f.ctx));const kit=JSON.stringify(record(f).kit);f.complete(inspect(f,'wire-and-tools',tool('brass-wire-spool')));const row=Powder.preparationInspectionEvidence(f.s)[0];assert.deepEqual(row.measurement.spool,{issuedLength:420,onReel:420,deployedLength:0,cutoffLength:0,lostLength:0});assert.equal(row.measurement.kit.length,6);assert.equal(row.measurement.fuses.length,2);assert.equal(JSON.stringify(record(f).kit),kit);assert.equal(valid(f),true);
});

test('actual walking away, lost hand, obstructed sweep and missing authorization earn no completed inspection',()=>{
 for(const cause of ['walk','hand','blocked','authorization']){
  const f=fixture();atStore(f);const before=JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects),request=inspect(f,'child-seal',original('quarry-sealed-charge-1'));assert.ok(request);f.tick(.1);
  if(cause==='walk')f.approach('ruth',{x:RIVAL_WORLD.camp.charges.x+65,y:RIVAL_WORLD.camp.charges.y});
  else{if(cause==='hand')f.settings.lostHand=true;if(cause==='blocked')f.settings.blocked=true;if(cause==='authorization')delete f.ctx.authorizePreparationInspection;f.tick(.1);}
  assert.equal(record(f).pending.length,0,cause);assert.deepEqual(Powder.preparationInspectionEvidence(f.s),[]);assert.equal(JSON.stringify(f.s.campaign.missions[RIVAL_ID].objects),before);assert.equal(valid(f),true);
 }
});

test('pending observations lock both actors and the actual contained child ancestor across every work family',()=>{
 const f=fixture();atStore(f);const request=inspect(f,'child-seal',original('quarry-sealed-charge-1'));assert.ok(request);assert.equal(inspect(f,'child-seal',original('quarry-sealed-charge-2')),null);assert.equal(Powder.requestPowderTransfer(f.s,original('charge-crate'),['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx),null);
 const bad=structuredClone(record(f)),start=structuredClone(bad.physicalEvents.at(-1)),work=structuredClone(bad.pending[0]);start.id=`powder-event-${bad.physicalEvents.length+1}`;work.workId=start.id;work.requestId=`inspection:${start.id}`;bad.physicalEvents.push(start);bad.pending.push(work);bad.workSerial++;assert.equal(valid(f,bad),false,'coherent duplicated start cannot share actors/refs');
 assert.equal(valid(f),true);
});

test('a JSON component continuation retains exactly the accepted prefix; pause and redraw cannot add time',()=>{
 const f=fixture();atStore(f);const request=inspect(f,'child-seal',original('quarry-sealed-charge-1'));f.tick(.1);f.tick(.1);const old=structuredClone(record(f).pending[0]);assert.equal(Powder.stepPowderWork(f.s,.1,f.ctx,{paused:true}).advanced,false);assert.equal(Powder.stepPowderWork(f.s,.1,f.ctx).advanced,false);assert.equal(record(f).pending[0].acceptedSeconds,old.acceptedSeconds);
 const resumed=fixture({componentGraph:JSON.parse(JSON.stringify(f.s))});assert.equal(valid(resumed),true);resumed.tick(.1);assert.deepEqual(record(resumed).pending[0].intervals.slice(0,old.intervals.length),old.intervals);assert.ok(Math.abs(record(resumed).pending[0].acceptedSeconds-old.acceptedSeconds-.1)<1e-7);resumed.complete(request);assert.equal(valid(resumed),true);
});

test('newborn inspection receives no interval that elapsed before its request',()=>{
 const f=fixture();atStore(f);f.s.elapsed+=.1;const request=inspect(f,'child-seal',original('quarry-sealed-charge-1'));assert.ok(request);assert.equal(Powder.stepPowderWork(f.s,.1,f.ctx).advanced,true);assert.equal(record(f).pending[0].acceptedSeconds,0);f.tick(.1);assert.equal(record(f).pending[0].intervals[0].start,record(f).pending[0].startedAt);f.complete(request);assert.equal(valid(f),true);
});

test('strict inspection history rejects forged measurement, source alias/revision, elapsed credit and absent owning links',()=>{
 const f=fixture();atCase(f);f.complete(Powder.requestKitOpening(f.s,f.ctx));f.complete(inspect(f,'wire-and-tools',tool('brass-wire-spool')));assert.equal(valid(f),true);
 for(const mutate of [r=>r.physicalEvents.at(-1).data.measurement.spool.onReel=999,r=>r.physicalEvents.at(-1).data.sourceRevision=999,r=>r.physicalEvents.find(e=>e.kind==='preparation-inspection-started').data.sourceBindings[0].value.owner=null,r=>r.physicalEvents.find(e=>e.kind==='preparation-inspection-started').data.operation.options.ref=original('charge-crate'),r=>r.physicalEvents.at(-1).data.intervals[0].start-=.1]){const bad=structuredClone(record(f));mutate(bad);assert.equal(valid(f,bad),false,mutate.toString());}
 const links=Custody.custodyValidationLinks(f.s);delete links.sourceForRevision;assert.equal(valid(f,record(f),links),false);assert.equal(inspect(f,'child-seal',original('cap-tin')),null);assert.equal(Powder.requestPreparationInspection(f.s,{topic:'wire-and-tools',ref:tool('brass-wire-spool'),actorIds:['ruth','mara'],seconds:.01},f.ctx),null);
});
