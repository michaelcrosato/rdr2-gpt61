import test from 'node:test';
import assert from 'node:assert/strict';
import {createPowderReferences,createTrainPowderRecord,validatePowderReferences,inspectPowderGroundTrace,constrainPowderWireMotion,validatePowderWireBalance,acceptedPowderStep,inspectPowderContactWindow,validatePowderPendingWork} from '../src/train-powder.js';
import {validatePowderWorkHistory} from '../src/train-powder.js';

test('powder reference contract rejects the reviewed crate/tin role aliases',()=>{
  const refs=createPowderReferences();
  assert.equal(validatePowderReferences(refs),true);
  const tinAsCrate=structuredClone(refs);tinAsCrate.tin=structuredClone(refs.crate);
  const crateAsTin=structuredClone(refs);crateAsTin.crate=structuredClone(refs.tin);
  assert.equal(validatePowderReferences(tinAsCrate),false);
  assert.equal(validatePowderReferences(crateAsTin),false);
});

test('fixed original child references reject duplicate, missing, extra and foreign sources',()=>{
  const mutations=[
    refs=>{refs.charges[1]=structuredClone(refs.charges[0]);},
    refs=>{refs.charges.pop();},
    refs=>{refs.charges.push(structuredClone(refs.charges[0]));},
    refs=>{refs.charges[0].sourceMissionId='snowbound-what-the-line-carries';},
    refs=>{refs.charges[0].objectId='quarry-sealed-charge-5';},
    refs=>{refs.charges[0].quantity=4;},
    refs=>{refs.shadowCharges=structuredClone(refs.charges);},
  ];
  for(const mutate of mutations){const refs=createPowderReferences();mutate(refs);assert.equal(validatePowderReferences(refs),false);}
});

test('future kit references are definitions, not factory possessions or inferred primers',()=>{
  const record=createTrainPowderRecord();
  assert.equal(validatePowderReferences(record.refs),true);
  assert.deepEqual(record.kit,{});
  assert.deepEqual(record.custodyEventRefs,[]);
  assert.deepEqual(record.physicalEvents,[]);
  assert.deepEqual(record.pending,[]);
  assert.equal(Object.hasOwn(record,'primers'),false);
  assert.equal(Object.hasOwn(record,'clock'),false);
  const wrong=structuredClone(record.refs);wrong.fuses[1]=structuredClone(wrong.fuses[0]);
  assert.equal(validatePowderReferences(wrong),false);
});

// Explicit component geometry samples: these test trace arithmetic/constraints,
// not the still-unavailable native train mission or a public earned spool.
const trace=points=>({clear:true,groundPoints:points,length3d:points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y,p.z-points[i].z),0),hit:null});
const spool=()=>({id:'brass-wire-spool',kind:'wire-spool',issuedLength:420,onReel:420,deployedLength:0,cutoffLength:0,lostLength:0});

test('wire constraint measures the full ground route and never writes actor or reel state',()=>{
  const from={x:0,y:0,z:0},to={x:4,y:3,z:1};
  const sample=trace([from,{x:2,y:0,z:0},{x:2,y:3,z:1},to]);
  const reel=spool(),before=structuredClone({from,to,sample,reel});
  const result=constrainPowderWireMotion(reel,from,to,sample);
  assert.equal(result.allowed,true);assert.equal(result.length,4+Math.sqrt(10));
  assert.ok(result.length>Math.hypot(4,3,1));
  assert.deepEqual({from,to,sample,reel},before);
  result.points[0].x=99;assert.equal(from.x,0);
});

test('wire rejects a blocked path, forged quantity, detached endpoint and skipped samples',()=>{
  const from={x:0,y:0,z:0},to={x:4,y:0,z:0},valid=trace([from,{x:2,y:0,z:0},to]);
  const mutations=[t=>{t.clear=false;t.hit={id:'rock'};},t=>{t.length3d=.1;},t=>{t.groundPoints[0].x=1;},t=>{t.groundPoints[1].z=NaN;},t=>{t.quantity=4;},t=>{t.hit={id:'wall'};},t=>{t.groundPoints.splice(1,0,{...from});}];
  assert.ok(inspectPowderGroundTrace(valid,from,to));
  for(const mutate of mutations){const bad=structuredClone(valid);mutate(bad);assert.equal(inspectPowderGroundTrace(bad,from,to),null);}
  const far={x:8,y:0,z:0};assert.equal(inspectPowderGroundTrace(trace([from,far]),from,far),null);
  assert.equal(inspectPowderGroundTrace(trace([from,from]),from,from),null);
});

test('wire conservation includes deployed, cutoff and lost length without refunds',()=>{
  const reel=spool();reel.onReel=5;reel.deployedLength=410;reel.cutoffLength=3;reel.lostLength=2;
  assert.equal(validatePowderWireBalance(reel),true);
  const from={x:0,y:0,z:0},to={x:6,y:0,z:0},sample=trace([from,{x:3,y:0,z:0},to]);
  assert.deepEqual(constrainPowderWireMotion(reel,from,to,sample),{allowed:false,reason:'reel-exhausted'});
  for(const change of [r=>{r.onReel+=1;},r=>{r.lostLength=-1;},r=>{r.issuedLength=421;},r=>{r.deployedLength=Infinity;}]){const bad=structuredClone(reel);change(bad);assert.equal(validatePowderWireBalance(bad),false);}
});

test('accepted time rejects duplicate, paused, reversed, skipped and unbounded steps',()=>{
  const record=createTrainPowderRecord();
  assert.deepEqual(acceptedPowderStep(record,10,.1),{start:9.9,finish:10,seconds:.1});
  record.lastAdvancedAt=10;
  assert.ok(acceptedPowderStep(record,10.025,.025));
  for(const [now,dt,options] of [[10,.1,{}],[10.2,.1,{}],[9.9,.1,{}],[10.1,.1,{paused:true}],[11,1,{}],[10,0,{}],[Infinity,.1,{}],[10.1,NaN,{}]])assert.equal(acceptedPowderStep(record,now,dt,options),null);
  assert.equal(record.lastAdvancedAt,10);
});

function contactFixture(){
  const ref=createPowderReferences().tin,expected={start:10,finish:10.1,actorIds:['ruth'],refs:[ref],destinations:[],fixedContacts:[]};
  const window={start:10,finish:10.1,sweptClear:true,actors:[{id:'ruth',root:{x:0,y:0,z:0},hand:{x:0,y:0,z:33},regionId:'snowbound',alive:true,mounted:false,handUsable:true,handFree:true}],sources:[{ref:structuredClone(ref),point:{x:1,y:0,z:33},regionId:'snowbound',actorId:'ruth',maxHandDistance:1}],destinations:[],fixedContacts:[]};
  return{expected,window};
}

test('contact evidence distinguishes actual feet from elevated hands and sockets',()=>{
  const {expected,window}=contactFixture(),before=structuredClone(window);
  const receipt=inspectPowderContactWindow(window,expected);
  assert.equal(receipt.actors[0].point.z,0);assert.equal(receipt.sources[0].point.z,33);
  assert.deepEqual(window,before);receipt.sources[0].point.x=99;assert.equal(window.sources[0].point.x,1);
});

test('contact rejects reviewed tin walk-away, lost hand, layer and swept-obstruction cases',()=>{
  const mutations=[
    w=>{w.sources[0].maxHandDistance=80;}, // Carries charge away from the separate tin.
    w=>{w.actors[0].hand.x=80;},w=>{w.actors[0].handFree=false;},w=>{w.actors[0].handUsable=false;},
    w=>{w.actors[0].mounted=true;},w=>{w.actors[0].alive=false;},w=>{w.sources[0].regionId='brass-cutting';},
    w=>{w.sweptClear=false;},w=>{w.sources[0].actorId='mara';},w=>{w.sources[0].ref.objectId='charge-crate';},
    w=>{w.sources[0].maxHandDistance=NaN;},w=>{w.finish=.2;},w=>{w.sources[0].quantity=6;},
  ];
  for(const mutate of mutations){const {expected,window}=contactFixture();mutate(window);assert.equal(inspectPowderContactWindow(window,expected),null);}
  const {expected,window}=contactFixture();delete window.sweptClear;assert.equal(inspectPowderContactWindow(window,expected),null);
});

test('pending work derives duration and accepted time rather than trusting editable timers',()=>{
  const work={workId:'powder-event-1',requestId:'test-custody-request-1',kind:'attach-primer',startedAt:10,acceptedSeconds:.4,intervals:[{start:10,finish:10.2},{start:10.2,finish:10.4}]};
  assert.equal(validatePowderPendingWork(work,10.4),true);
  const mutations=[w=>{w.kind='invented-free-stock';},w=>{w.duration=.1;},w=>{w.acceptedSeconds=.8;},w=>{w.intervals[1].start=10.3;},w=>{w.intervals[1].start=10;},w=>{w.intervals[1].finish=11;},w=>{w.startedAt=11;},w=>{w.intervals[0].finish=10;},w=>{w.intervals[0].count=999;},w=>{w.workId='powder-event-0';},w=>{w.kind='blast-charge';}];
  for(const mutate of mutations){const bad=structuredClone(work);mutate(bad);assert.equal(validatePowderPendingWork(bad,10.4),false);}
  assert.equal(validatePowderPendingWork(work,10.3),false);
});

test('work history rejects invented events, opening count/source fields and orphaned requests',()=>{
  const empty=createTrainPowderRecord();assert.equal(validatePowderWorkHistory(empty,0),true);
  const mutations=[r=>{r.physicalEvents.push({id:'powder-event-1',kind:'tin-first-opening',at:0,data:{count:999}});},r=>{r.primers=Array(6).fill({});},r=>{r.refs.tin.objectId='charge-crate';},r=>{r.kit['invented-spool']={};},r=>{r.lastAdvancedAt=1;},r=>{r.workSerial=1;},r=>{r.custodyEventRefs=['invented-event'];},r=>{r.pending.push({kind:'invented-op'});}];
  for(const mutate of mutations){const bad=structuredClone(empty);mutate(bad);assert.equal(validatePowderWorkHistory(bad,0),false);}
});

test('empty component rejects manufactured circuit, future fuse clocks and partial kit grants',()=>{
  const empty=createTrainPowderRecord(),mutations=[
    r=>{r.circuit.terminals.charge.state='fastened';},r=>{r.circuit.terminals.detonator={state:'open',eventId:'invented-disconnect'};},
    r=>{r.circuit.path=[{x:1,y:1,z:0}];},r=>{r.circuit.actorId='mara';},r=>{r.circuit.anchorRef=structuredClone(r.refs.charges[1]);},
    r=>{r.circuit.lastTest={eventId:'free-lamp',at:0,closed:true,current:1};},r=>{r.circuit.strokes=['free-stroke'];},
    r=>{r.circuit.recovery.safeAfter=0;},r=>{r.circuit.cutEventId='free-cut';},r=>{r.circuit.breakEventId='timer-break';},
    r=>{r.fuses[0].litAt=0;},r=>{r.fuses[0].dueAt=6;},r=>{r.fuses[1].fuseRef=structuredClone(r.fuses[0].fuseRef);},
    r=>{r.fuses[0].blastEventId='free-blast';},r=>{r.fuses[0].fuseRemaining=6;},
    r=>{r.kit['brass-wire-spool']=spool();},r=>{r.circuit.clock=0;},
  ];
  for(const mutate of mutations){const bad=structuredClone(empty);mutate(bad);assert.equal(validatePowderWorkHistory(bad,0),false);}
});
