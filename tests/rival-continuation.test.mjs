import test from 'node:test';
import assert from 'node:assert/strict';
import {createPowderFixture} from './helpers/train-powder-fixture.mjs';
import * as Custody from '../src/rival-continuation.js';
import * as Powder from '../src/train-powder.js';
import {validateRivalRecord} from '../src/rival-mission.js';
import {validateQuestioning} from '../src/rival-questioning.js';
import {validateHolding} from '../src/rival-aftermath.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {TRAIN_TOOL_CASE} from '../content/campaign/train-equipment.js';

// Genuine W6 history + owning v5 migration, explicitly staged EMPTY powder
// component, real native camp approaches and timed verbs. The fixture's hand
// geometry is limited to z33; these are component/owning-validator checks,
// not a playable Train mission, native IK proof or a full active Train Save.
function opened(){const f=createPowderFixture();f.approach('ruth',RIVAL_WORLD.camp.charges);f.complete(Powder.requestTinOpening(f.s,f.ctx));return f;}
const record=s=>s.campaign.missions[RIVAL_ID],powder=s=>s.campaign.missions[TRAIN_ID].train.powder;

test('earned first opening replays exact original units and preserves historical Rival scores, care and validators',()=>{
  const f=createPowderFixture(),old=structuredClone({performance:record(f.s).performance,questioning:record(f.s).rival.questioning,care:record(f.s).captivity.care,transactions:record(f.s).transactions});
  f.approach('ruth',RIVAL_WORLD.camp.charges);f.complete(Powder.requestTinOpening(f.s,f.ctx));
  assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(validateRivalRecord(f.s),true);assert.equal(validateQuestioning(f.s),true);assert.equal(validateHolding(f.s),true);
  assert.deepEqual({performance:record(f.s).performance,questioning:record(f.s).rival.questioning,care:record(f.s).captivity.care,transactions:record(f.s).transactions},old,'later work cannot rewrite past scores, heard questions, care or old transactions');
  assert.equal(Custody.resolveFixedRef(f.s,{sourceMissionId:RIVAL_ID,objectId:'quarry-primer-1'}),record(f.s).objects['cap-tin'].primers[0],'nested tin remains the one primer authority');
  assert.equal(record(f.s).objects['quarry-primer-1'],undefined);
  const copied=JSON.parse(JSON.stringify(f.s));assert.equal(Custody.validateRivalContinuation(copied),true);assert.equal(validateRivalRecord(copied),true);
});

test('strict replay rejects forged quantities, owners, old facts, inverse links and substituted work receipts',()=>{
  const f=opened(),base=JSON.parse(JSON.stringify(f.s));assert.equal(Custody.validateRivalContinuation(base),true);
  const mutations=[
    s=>{record(s).objects['cap-tin'].primers.pop();},
    s=>{record(s).objects['cap-tin'].primers[0].state='spent';},
    s=>{record(s).objects['cap-tin'].owner='mara';},
    s=>{record(s).objects['quarry-primer-1']=structuredClone(record(s).objects['cap-tin'].primers[0]);},
    s=>{record(s).objects['charge-crate'].issuedCount=5;},
    s=>{record(s).captivity.guardId='inez';},
    s=>{record(s).rival.continuation.baseline.objects['cap-tin'].primers=[];},
    s=>{record(s).rival.continuation.events[0].requestId='unknown-request';},
    s=>{record(s).rival.continuation.events[0].operation.options.count=99;},
    s=>{record(s).rival.continuation.events[0].workReceipt.acceptedSeconds=.01;},
    s=>{record(s).rival.continuation.events[0].workReceipt.sources[0].ref.objectId='charge-crate';},
    s=>{record(s).rival.continuation.events[0].effects[0].after.primers=[];},
    s=>{powder(s).custodyEventRefs=[];},
    s=>{powder(s).custodyEventRefs.push(powder(s).custodyEventRefs[0]);},
    s=>{powder(s).physicalEvents.at(-1).data.intervals[0].finish+=.05;},
    s=>{powder(s).physicalEvents.at(-1).data.requestId='other';},
  ];
  for(const mutate of mutations){const s=structuredClone(base);mutate(s);assert.equal(Custody.validateRivalContinuation(s),false,mutate.toString());assert.equal(validateRivalRecord(s),false);}
});

test('pending actual work has exclusive references, exact source revisions and earns no early registry',()=>{
  const f=createPowderFixture();f.approach('ruth',RIVAL_WORLD.camp.charges);
  const work=Powder.requestTinOpening(f.s,f.ctx);assert.ok(work);f.tick(.25);
  assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(record(f.s).objects['cap-tin'].primers,undefined);
  assert.equal(Powder.requestTinOpening(f.s,f.ctx),null,'same actor/tin cannot start another simultaneous opening');
  const request=Custody.inspectCustodyRequest(f.s,work.requestId);request.sourceBindings[0].value.owner='mara';assert.equal(Custody.inspectCustodyRequest(f.s,work.requestId).sourceBindings[0].value.owner,'ruth','inspection returns a detached view');
  const bad=JSON.parse(JSON.stringify(f.s));record(bad).rival.continuation.requests[work.requestId].sourceBindings[0].value.owner='mara';assert.equal(Custody.validateRivalContinuation(bad),false);
  assert.equal(Powder.cancelPowderWork(f.s,work.workId),true);assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(record(f.s).objects['cap-tin'].primers,undefined);
});

test('direct custody API refuses missing physical providers and lost hands before beginning',()=>{
  for(const missing of ['worldFor','pointForLocation','canContain','handUsable','handFree','powderContactWindow','custodySnapshot','authorizeCustodyOp']){
    const f=createPowderFixture();f.approach('ruth',RIVAL_WORLD.camp.charges);const ctx={...f.ctx};delete ctx[missing];
    const op={kind:'open-tin',actorIds:['ruth'],refs:[{sourceMissionId:RIVAL_ID,objectId:'cap-tin'}],to:null,options:{},cause:{missionId:TRAIN_ID,eventId:'powder-event-1'}};
    assert.equal(Custody.beginCustodyRequest(f.s,op,ctx),null,missing);assert.equal(record(f.s).rival.continuation.initializedAt,null);assert.equal(record(f.s).objects['cap-tin'].primers,undefined);
  }
});

test('direct begin inspects an actual false contact window instead of accepting provider presence',()=>{
  const f=createPowderFixture();f.approach('ruth',RIVAL_WORLD.camp.charges);
  const original=f.ctx.powderContactWindow;
  const op={kind:'open-tin',actorIds:['ruth'],refs:[{sourceMissionId:RIVAL_ID,objectId:'cap-tin'}],to:null,options:{},cause:{missionId:TRAIN_ID,eventId:'powder-event-1'}};
  for(const mutate of [window=>{window.sweptClear=false;},window=>{window.actors[0].handFree=false;},window=>{window.sources[0].maxHandDistance=80;}]){
    f.ctx.powderContactWindow=(...args)=>{const window=original(...args);mutate(window);return window;};
    assert.equal(Custody.beginCustodyRequest(f.s,op,f.ctx),null);assert.equal(record(f.s).rival.continuation.initializedAt,null);
  }
});

test('variable accepted native step fractions preserve continuous timed work through floating point subtraction',()=>{
  const f=createPowderFixture();f.approach('ruth',RIVAL_WORLD.camp.charges);assert.ok(Powder.requestTinOpening(f.s,f.ctx));
  const fractions=[1/60,1/30,.05,.075,.1,.025];
  for(let i=0;i<120&&powder(f.s).pending.length;i++)f.tick(fractions[i%fractions.length]);
  assert.equal(powder(f.s).pending.length,0);assert.equal(record(f.s).objects['cap-tin'].primers.length,6);assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(f.history(),true);
});

test('an erroneous physical owner append rolls back the exact earlier custody reference list and new material',()=>{
  const f=opened(),beforeRefs=[...powder(f.s).custodyEventRefs],beforeEvents=structuredClone(record(f.s).rival.continuation.events);
  f.approach('mara',TRAIN_TOOL_CASE);f.approach('ruth',TRAIN_TOOL_CASE);
  f.ctx.prepareCustodyPhysicalEffects=()=>({apply(){powder(f.s).custodyEventRefs.push('erroneous-second-writer');},rollback(){}});
  f.complete(Powder.requestKitOpening(f.s,f.ctx),{success:false});
  assert.deepEqual(powder(f.s).kit,{});assert.deepEqual(powder(f.s).custodyEventRefs,beforeRefs);assert.deepEqual(record(f.s).rival.continuation.events,beforeEvents);
  assert.equal(powder(f.s).physicalEvents.at(-1).kind,'work-cancelled');assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(f.history(),true);
});
