import test from 'node:test';import assert from 'node:assert/strict';
import {createWireComponentFixture,createRecoveredWireComponentFixture} from './helpers/train-powder-wire-fixture.mjs';
import * as Powder from '../src/train-powder.js';
import * as Custody from '../src/rival-continuation.js';
const station=id=>({owner:'ruth',location:{type:'station',targetId:id,regionId:'brass-cutting'}});
function startedWire(){
 const f=createWireComponentFixture();
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],station('turnout-service-plate'),f.ctx));
 f.complete(Powder.requestWireStart(f.s,'mara',f.ctx));f.complete(Powder.requestTerminalFastening(f.s,'charge','mara',f.ctx));
 assert.equal(f.history(),true);return f;
}
function completeWire(){
 const f=startedWire();
 for(let i=0;i<30;i++)assert.equal(f.move('mara',2,0,.1,{lay:true}).paid,true);
 for(let i=0;i<30;i++)f.move('ruth',2,0);
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.detonator,['ruth'],station('ridge-detonator'),f.ctx));
 f.complete(Powder.requestTerminalFastening(f.s,'detonator','mara',f.ctx));
 assert.equal(f.history(),true);return f;
}

test('accepted actual fixture movement pays out one continuous measured path, no endpoint or standing grant',()=>{
 const f=startedWire(),p=Powder.trainPowderRecord(f.s),spool=p.kit[f.refs.spool.objectId];
 assert.equal(spool.deployedLength,0);assert.deepEqual(p.circuit.path,[f.contacts['turnout-service-plate']]);
 const first=f.move('mara',2,0,.1,{lay:true});assert.equal(first.paid,true);assert.equal(spool.onReel,418);assert.equal(spool.deployedLength,2);
 const count=p.custodyEventRefs.length;assert.equal(Powder.applyAcceptedPowderMotion(f.s,first.motion,f.ctx),false);assert.equal(p.custodyEventRefs.length,count);
 const idle=f.move('mara',0,0,.1,{lay:true});assert.equal(idle.paid,false);assert.equal(spool.deployedLength,2);assert.equal(f.history(),true);
});

test('blocked/misreported wire preconstraint refuses without moving or refunding the reel',()=>{
 const f=startedWire(),p=Powder.trainPowderRecord(f.s),spool=p.kit[f.refs.spool.objectId],from=f.contacts['turnout-service-plate'],to={x:104,y:100,z:0};
 const trace={clear:true,groundPoints:[from,{x:102,y:100,z:0},to],length3d:4,hit:null};
 assert.equal(Powder.constrainPowderWireMotion(spool,from,to,trace).allowed,true);
 const before=structuredClone({actor:f.s.entities.mara,spool});
 assert.equal(Powder.constrainPowderWireMotion(spool,from,to,{...trace,clear:false,hit:{id:'rock'}}).allowed,false);
 assert.equal(Powder.constrainPowderWireMotion(spool,from,to,{...trace,length3d:1}).allowed,false);
 assert.deepEqual({actor:f.s.entities.mara,spool},before);
});

test('actual native passing motion releases damaged collar, current fails and same charge/cap recover safely',()=>{
 const f=completeWire(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions['snowbound-the-names-they-took'];
 f.complete(Powder.requestCircuitTest(f.s,'mara',f.ctx));assert.equal(p.circuit.lastTest.current,1);
 assert.equal(Powder.applyPowderTerminalStrain(f.s,{...f.ctx,terminalStrain:()=>({at:f.s.elapsed,trainId:'morrow-freight-consist',carId:'morrow-engine',terminalId:'turnout-split-collar',passingSpeed:0,groundDistance:0,strain:999})}),false);
 assert.equal(f.passTrain(),true);assert.equal(p.circuit.terminals.charge.state,'released');assert.equal(r.objects['cap-tin'].primers[0].state,'damaged');
 const afterBreak=p.custodyEventRefs.length;assert.equal(f.passTrain(),false);assert.equal(p.custodyEventRefs.length,afterBreak);
 f.complete(Powder.requestDetonatorStroke(f.s,f.ctx));assert.equal(p.circuit.lastTest.current,0);assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,false);
 f.complete(Powder.requestCircuitDisconnect(f.s,f.ctx));assert.equal(Powder.requestPrimerRemoval(f.s,'quarry-sealed-charge-1','quarry-primer-1',f.ctx),null);
 for(let i=0;i<30;i++)f.move('ruth',-2,0);while(f.s.elapsed<p.circuit.recovery.safeAfter+.01)f.tick();
 f.complete(Powder.requestPrimerRemoval(f.s,'quarry-sealed-charge-1','quarry-primer-1',f.ctx));
 const cap=r.objects['cap-tin'].primers[0];assert.equal(cap.id,'quarry-primer-1');assert.equal(cap.state,'damaged');assert.equal(cap.chargeId,null);assert.equal(cap.lastChargeId,'quarry-sealed-charge-1');assert.equal(cap.location.compartment,'unserviceable');
 assert.equal(Powder.requestPrimerAttachment(f.s,'quarry-sealed-charge-1','quarry-primer-1','ruth','wired',f.ctx),null);
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
 assert.equal(r.objects['quarry-sealed-charge-1'].powder.primerId,null);assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,false);assert.ok(p.circuit.recovery.recoveredChargeEventId);assert.equal(r.objects['cap-tin'].primers.length,6);assert.equal(f.history(),true);
});

test('two real terminals and low current test precede timed cut/clamp and finite reel return',()=>{
 const f=completeWire(),p=Powder.trainPowderRecord(f.s),spool=p.kit[f.refs.spool.objectId];
 assert.deepEqual(Powder.inspectPowderCircuit(f.s,f.ctx),{closed:true,current:1,reason:'continuous'});
 f.complete(Powder.requestCircuitTest(f.s,'mara',f.ctx));assert.equal(p.circuit.lastTest.current,1);
 assert.equal(spool.deployedLength,60);assert.equal(spool.onReel,360);
 f.complete(Powder.requestWireCutClamp(f.s,'mara',station('ridge-detonator'),f.ctx));
 assert.equal(spool.deploymentClosed,true);assert.equal(p.circuit.actorId,null);assert.equal(spool.onReel+spool.deployedLength+spool.cutoffLength+spool.lostLength,420);
 f.complete(Powder.requestPowderTransfer(f.s,f.refs.spool,['mara','ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},f.ctx));
 assert.equal(spool.owner,'ruth');assert.equal(spool.onReel,360);assert.equal(p.circuit.path.length,31);assert.equal(f.history(),true);
});

test('strict wire history rejects an endpoint teleport, quantity refund and invented test/terminal',()=>{
 const f=completeWire(),p=Powder.trainPowderRecord(f.s),c=f.s.campaign.missions['snowbound-the-names-they-took'].rival.continuation;
 const validate=r=>Powder.validatePowderWorkHistory(r,f.s.elapsed,{...Custody.custodyValidationLinks(f.s),fixedContactFor:id=>f.ctx.fixedContact(f.s,id)});
 assert.equal(validate(p),true);
 const mutations=[r=>{r.circuit.path=[r.circuit.path[0],r.circuit.path.at(-1)];},r=>{r.kit['brass-wire-spool'].onReel=420;},r=>{r.circuit.terminals.charge.eventId='invented';},r=>{r.circuit.lastTest={eventId:'invented',at:f.s.elapsed,closed:true,current:1};},r=>{r.physicalEvents.find(e=>e.kind==='wire-motion').data.motion.trace.length3d=1;}];
 for(const mutate of mutations){const bad=structuredClone(p);mutate(bad);assert.equal(validate(bad),false);}
 assert.ok(c.events.some(e=>e.kind==='wire-pay-out'));
});

test('safe postpone disconnects, waits and returns same undamaged unit without inventing a misfire',()=>{
 const f=completeWire(),p=Powder.trainPowderRecord(f.s),r=f.s.campaign.missions['snowbound-the-names-they-took'];
 assert.equal(Powder.requestWireCutClamp(f.s,'mara',station('ridge-detonator'),f.ctx),null,'Normal wiring requires actual continuity test before cut/return');
 f.complete(Powder.requestCircuitDisconnect(f.s,f.ctx));assert.equal(Powder.requestWireCutClamp(f.s,'mara',station('ridge-detonator'),f.ctx),null);
 while(f.s.elapsed<p.circuit.recovery.safeAfter+.01)f.tick();f.complete(Powder.requestWireCutClamp(f.s,'mara',station('ridge-detonator'),f.ctx));
 for(let i=0;i<30;i++)f.move('ruth',-2,0);f.complete(Powder.requestPrimerRemoval(f.s,'quarry-sealed-charge-1','quarry-primer-1',f.ctx));
 assert.equal(r.objects['cap-tin'].primers[0].state,'in-tin');assert.equal(r.objects['cap-tin'].primers[0].location.compartment,'usable');assert.equal(r.objects['quarry-sealed-charge-1'].powder.spent,false);
 assert.equal(p.circuit.breakEventId,null);assert.deepEqual(p.circuit.strokes,[]);assert.equal(p.kit['brass-wire-spool'].onReel,360);assert.equal(p.kit['brass-wire-spool'].deployedLength,60);assert.equal(f.history(),true);
});

test('strict replay cannot erase performed break, failed stroke, measurement or recovery',()=>{
 const f=createRecoveredWireComponentFixture(),p=Powder.trainPowderRecord(f.s),links={...Custody.custodyValidationLinks(f.s),fixedContactFor:id=>f.ctx.fixedContact(f.s,id)};
 assert.equal(Powder.validatePowderWorkHistory(p,f.s.elapsed,links),true);
 const mutations=[r=>{r.circuit.breakEventId=null;r.circuit.terminals.charge={state:'fastened',eventId:r.physicalEvents.find(e=>e.kind==='circuit-work-started'&&e.data.operation.kind==='fasten-terminal').id};},r=>{r.circuit.strokes=[];},r=>{r.circuit.lastTest=null;},r=>{r.circuit.lastTest.current=1;r.circuit.lastTest.closed=true;},r=>{r.circuit.recovery.removedPrimerEventId=null;},r=>{r.circuit.recovery.safeAfter-=1;},r=>{r.physicalEvents.find(e=>e.kind==='circuit-work-completed'&&e.data.measurement?.current===1).data.measurement={closed:false,current:0};}];
 for(const mutate of mutations){const bad=structuredClone(p);mutate(bad);assert.equal(Powder.validatePowderWorkHistory(bad,f.s.elapsed,links),false);}
});

test('same-actor/ref pending work cannot duplicate or coexist with a proven wire movement task',()=>{
 const f=createWireComponentFixture();f.complete(Powder.requestPowderTransfer(f.s,f.refs.charges[0],['ruth'],station('turnout-service-plate'),f.ctx));
 const request=Powder.requestWireStart(f.s,'mara',f.ctx);assert.ok(request);assert.equal(Powder.requestWireStart(f.s,'mara',f.ctx),null);
 const negative=structuredClone(Powder.trainPowderRecord(f.s)),start=structuredClone(negative.physicalEvents.at(-1)),work=structuredClone(negative.pending[0]);
 start.id=`powder-event-${negative.physicalEvents.length+1}`;work.workId=start.id;work.requestId=`physical:${start.id}`;negative.physicalEvents.push(start);negative.pending.push(work);negative.workSerial++;
 assert.equal(Powder.validatePowderWorkHistory(negative,f.s.elapsed,{...Custody.custodyValidationLinks(f.s),fixedContactFor:id=>f.ctx.fixedContact(f.s,id)}),false);
 f.complete(request);f.complete(Powder.requestTerminalFastening(f.s,'charge','mara',f.ctx));for(let i=0;i<30;i++)f.move('mara',2,0,.1,{lay:true});for(let i=0;i<30;i++)f.move('ruth',2,0);f.complete(Powder.requestPowderTransfer(f.s,f.refs.detonator,['ruth'],station('ridge-detonator'),f.ctx));
 const fastening=Powder.requestTerminalFastening(f.s,'detonator','mara',f.ctx);assert.ok(fastening);f.tick();assert.equal(f.move('mara',-2,0,.1,{lay:true}).paid,true);
 const p=Powder.trainPowderRecord(f.s);assert.equal(p.pending.length,0);assert.equal(p.circuit.terminals.detonator.state,'open');assert.equal(p.kit['brass-wire-spool'].deployedLength,62);assert.ok(p.physicalEvents.some(event=>event.kind==='work-cancelled'&&event.data.workId===fastening.workId));assert.equal(f.history(),true);
});

test('a fastened endpoint requires actual cut/clamp before the carrier can take reel away',()=>{
 const f=completeWire(),p=Powder.trainPowderRecord(f.s),from={x:f.s.entities.mara.x,y:f.s.entities.mara.y,z:0},to={...from,x:from.x+2},trace={clear:true,groundPoints:[from,to],length3d:2,hit:null},before=JSON.stringify(p);
 assert.deepEqual(Powder.constrainPowderActorMotion(f.s,'mara',from,to,trace),{allowed:false,reason:'cut-clamp-required'});assert.equal(JSON.stringify(p),before);
});
