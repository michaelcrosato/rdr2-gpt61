import test from 'node:test';
import assert from 'node:assert/strict';
import {createPowderFixture as fixture} from './helpers/train-powder-fixture.mjs';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_TOOL_CASE} from '../content/campaign/train-equipment.js';
import * as Custody from '../src/rival-continuation.js';
import * as Powder from '../src/train-powder.js';

test('real native approach and accepted opening issue six kit objects once, never in factory',()=>{
  const f=fixture(),p=Powder.trainPowderRecord(f.s),health={mara:f.s.entities.mara.hp,ruth:f.s.entities.ruth.hp};
  assert.deepEqual(p.kit,{});assert.equal(Powder.requestKitOpening(f.s,f.ctx),null);
  f.approach('mara',TRAIN_TOOL_CASE);f.approach('ruth',TRAIN_TOOL_CASE);
  const request=Powder.requestKitOpening(f.s,f.ctx);assert.ok(request);f.tick(.25);assert.deepEqual(p.kit,{});
  f.complete(request);assert.equal(Object.keys(p.kit).length,6);assert.equal(p.kit['brass-wire-spool'].onReel,420);
  assert.equal(p.custodyEventRefs.length,1);assert.equal(Powder.requestKitOpening(f.s,f.ctx),null);assert.equal(f.history(),true);
  assert.deepEqual({mara:f.s.entities.mara.hp,ruth:f.s.entities.ruth.hp},health);
});

test('actual tin opening reveals exact six nested primers and repeated inspection cannot mint more',()=>{
  const f=fixture(),tin=f.s.campaign.missions[RIVAL_ID].objects['cap-tin'];assert.equal(tin.primers,undefined);
  f.approach('ruth',RIVAL_WORLD.camp.charges);f.complete(Powder.requestTinOpening(f.s,f.ctx));
  assert.deepEqual(tin.primers.map(p=>p.id),Array.from({length:6},(_,i)=>`quarry-primer-${i+1}`));
  assert.ok(tin.primers.every(p=>p.state==='in-tin'&&p.location.compartment==='usable'));
  assert.equal(Powder.requestTinOpening(f.s,f.ctx),null);assert.equal(f.history(),true);
});

test('blocked/lost-hand/interrupted opening preserves actual unopened tin and count',()=>{
  for(const mode of ['blocked','lostHand','interrupted']){
    const f=fixture(),tin=f.s.campaign.missions[RIVAL_ID].objects['cap-tin'];f.approach('ruth',RIVAL_WORLD.camp.charges);
    const request=Powder.requestTinOpening(f.s,f.ctx);assert.ok(request);f.tick(.25);
    if(mode==='interrupted')assert.equal(Powder.cancelPowderWork(f.s,request.workId),true);else{f.settings[mode]=true;f.tick(.1);}
    assert.equal(tin.primers,undefined);assert.equal(tin.openingEventId,undefined);assert.equal(Powder.trainPowderRecord(f.s).custodyEventRefs.length,0);assert.equal(f.history(),true);
  }
});

test('deliberate physical result exception rolls back item issue, canonical event and component result',()=>{
  const f=fixture();f.approach('mara',TRAIN_TOOL_CASE);f.approach('ruth',TRAIN_TOOL_CASE);
  const c=f.s.campaign.missions[RIVAL_ID].rival.continuation,p=Powder.trainPowderRecord(f.s);
  f.settings.throwPhysical=true;f.complete(Powder.requestKitOpening(f.s,f.ctx),{success:false});
  assert.deepEqual(p.kit,{});assert.deepEqual(p.custodyEventRefs,[]);assert.deepEqual(c.events,[]);
  assert.equal(p.physicalEvents.at(-1).kind,'work-cancelled');assert.equal(f.history(),true);
});

function preparedFirstCharge(){
  const f=fixture(),refs=Powder.createPowderReferences();
  f.approach('ruth',RIVAL_WORLD.camp.charges);f.complete(Powder.requestTinOpening(f.s,f.ctx));
  f.complete(Powder.requestPowderTransfer(f.s,refs.charges[0],['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
  f.complete(Powder.requestChargeUnseal(f.s,refs.charges[0].objectId,'ruth',f.ctx));
  assert.equal(f.history(),true);return{...f,refs};
}

test('same carried first child loses priming when Ruth actually walks away from separate tin',()=>{
  const f=preparedFirstCharge(),r=f.s.campaign.missions[RIVAL_ID],request=Powder.requestPrimerAttachment(f.s,f.refs.charges[0].objectId,'quarry-primer-1','ruth','wired',f.ctx);
  assert.ok(request);f.tick(.25);f.approach('ruth',{x:RIVAL_WORLD.camp.charges.x+80,y:RIVAL_WORLD.camp.charges.y,z:0});
  assert.equal(Powder.trainPowderRecord(f.s).pending.length,0);assert.equal(r.objects['quarry-sealed-charge-1'].powder.primerId,null);
  assert.equal(r.objects['cap-tin'].primers[0].state,'in-tin');assert.equal(r.objects['charge-crate'].count,3);
  assert.equal(r.objects['quarry-sealed-charge-1'].location.targetId,'ruth');assert.equal(f.history(),true);
  f.approach('ruth',RIVAL_WORLD.camp.charges);
  f.complete(Powder.requestPrimerAttachment(f.s,f.refs.charges[0].objectId,'quarry-primer-1','ruth','wired',f.ctx));
  assert.equal(r.objects['cap-tin'].primers[0].state,'attached');assert.equal(r.objects['cap-tin'].primers[0].chargeId,'quarry-sealed-charge-1');
  assert.equal(r.objects['quarry-sealed-charge-1'].powder.primerId,'quarry-primer-1');assert.equal(f.history(),true);
});

test('strict earned stock/history rejects forged opening count, identities, event, timer and custody',()=>{
  const f=preparedFirstCharge();
  f.complete(Powder.requestPrimerAttachment(f.s,f.refs.charges[0].objectId,'quarry-primer-1','ruth','wired',f.ctx));
  assert.equal(Custody.validateRivalContinuation(f.s),true);
  const mutations=[
    s=>{s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers.push(structuredClone(s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers[0]));},
    s=>{s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers[0].id='quarry-primer-7';},
    s=>{s.campaign.missions[RIVAL_ID].objects['cap-tin'].openingEventId='invented-opening';},
    s=>{s.campaign.missions[RIVAL_ID].objects['charge-crate'].count=4;},
    s=>{s.campaign.missions[RIVAL_ID].objects['quarry-sealed-charge-1'].owner='mara';},
    s=>{s.campaign.missions[RIVAL_ID].rival.continuation.events[0].workReceipt.acceptedSeconds=.1;},
    s=>{s.campaign.missions[RIVAL_ID].rival.continuation.events[0].operation.options.count=999;},
  ];
  for(const mutate of mutations){const negative=structuredClone(f.s);mutate(negative);assert.equal(Custody.validateRivalContinuation(negative),false);}
});

test('component JSON boundary preserves accepted priming progress without issuing or consuming twice',()=>{
  const f=preparedFirstCharge(),before=f.s.campaign.missions[RIVAL_ID].objects['quarry-sealed-charge-1'];
  const request=Powder.requestPrimerAttachment(f.s,f.refs.charges[0].objectId,'quarry-primer-1','ruth','wired',f.ctx);assert.ok(request);f.tick(.25);
  assert.equal(before.powder.primerId,null);assert.equal(Powder.trainPowderRecord(f.s).pending[0].acceptedSeconds,.25);
  // This is a JSON component boundary, NOT the still-unavailable train's full
  // Journey restore/normal-menu Save acceptance. No stage/outcome is assigned.
  const resumed=fixture({componentGraph:JSON.parse(JSON.stringify(f.s))});
  assert.equal(resumed.history(),true);resumed.complete(request);
  const r=resumed.s.campaign.missions[RIVAL_ID];
  assert.equal(r.objects['quarry-sealed-charge-1'].powder.primerId,'quarry-primer-1');assert.equal(r.objects['cap-tin'].primers.filter(p=>p.state==='attached').length,1);
  assert.equal(r.objects['cap-tin'].primers.length,6);assert.equal(r.objects['charge-crate'].count,3);assert.equal(resumed.history(),true);
  assert.equal(r.rival.continuation.events.filter(e=>e.kind==='attach-primer').length,1);
});

test('destination capacity and final native hand refusal prevent lawful-source transfer or opening',()=>{
  const f=fixture(),refs=Powder.createPowderReferences();f.approach('ruth',RIVAL_WORLD.camp.charges);
  const denyCapacity={...f.ctx,canContain:()=>false};
  assert.equal(Powder.requestPowderTransfer(f.s,refs.tin,['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},denyCapacity),null);
  assert.equal(f.s.campaign.missions[RIVAL_ID].objects['cap-tin'].location.type,'station');
  const request=Powder.requestTinOpening(f.s,f.ctx);assert.ok(request);for(let i=0;i<10;i++)f.tick();
  // The contact-window fixture stays positive; this isolates the bridge's
  // independent owning-hand gate at final commit rather than its caller.
  f.ctx.handUsable=()=>false;f.tick();
  assert.equal(f.s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers,undefined);assert.equal(Powder.trainPowderRecord(f.s).physicalEvents.at(-1).kind,'work-cancelled');assert.equal(f.history(),true);
});

test('negative copied stale source binding cannot issue stock after accepted opening progress',()=>{
  const f=fixture();f.approach('ruth',RIVAL_WORLD.camp.charges);const request=Powder.requestTinOpening(f.s,f.ctx);assert.ok(request);f.tick(.25);
  const negative=JSON.parse(JSON.stringify(f.s));negative.campaign.missions[RIVAL_ID].objects['cap-tin'].owner='mara';
  const resumed=fixture({componentGraph:negative});resumed.complete(request,{success:false});
  const r=resumed.s.campaign.missions[RIVAL_ID];assert.equal(r.objects['cap-tin'].primers,undefined);assert.equal(r.rival.continuation.events.length,0);assert.equal(Custody.validateRivalContinuation(resumed.s),false,'The deliberately forged source is not repaired/promoted');
});

test('work born at current accepted boundary receives no earlier interval, cancellation or stock',()=>{
  const f=fixture();f.approach('ruth',RIVAL_WORLD.camp.charges);const p=Powder.trainPowderRecord(f.s),old=f.s.elapsed;
  // Explicit accepted-clock controller fixture: the native world owner has
  // advanced, then requests an offered job before dispatching powder work.
  f.s.elapsed+=.1;const request=Powder.requestTinOpening(f.s,f.ctx);assert.ok(request);const born=f.s.elapsed;
  const current=Powder.stepPowderWork(f.s,.1,f.ctx);assert.equal(current.advanced,true);assert.deepEqual(current.completed,[]);assert.deepEqual(current.cancelled,[]);assert.equal(p.lastAdvancedAt,born);assert.equal(p.pending[0].startedAt,born);assert.equal(p.pending[0].acceptedSeconds,0);assert.deepEqual(p.pending[0].intervals,[]);assert.equal(f.s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers,undefined);
  f.tick();assert.ok(Math.abs(p.pending[0].acceptedSeconds-.1)<1e-7);assert.equal(p.pending[0].intervals[0].start,born);assert.ok(p.pending[0].intervals[0].start>old);f.complete(request);assert.equal(f.history(),true);assert.equal(f.s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers.length,6);
});
