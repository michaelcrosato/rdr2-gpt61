/** Actual authored train/free-body regressions. Not a played boarding route. */
import test from 'node:test';import assert from 'node:assert/strict';import '../../my-3d2dge-agent.js';
import {TRAIN_TRACK,TRAIN_CARS,TRAIN_MOTION_PROPOSAL} from '../../content/campaign/brass-cutting.js';
import {createRailPath,compileCarSpecs,createConsist,advanceConsist} from '../../src/rail-foundation/rail-consist.js';
import {createAcceptedStepContext} from '../../src/rail-foundation/accepted-step-context.js';
import {stepRailBody,validateBodySupport,sweepMovingCover} from '../../src/rail-foundation/moving-support.js';
import {worldPoint,localPoint,worldVector,makeFrame} from '../../src/rail-foundation/rigid-frame.js';
const E=My3D2dge,P=(x=0,y=0,z=0)=>({x,y,z}),dt=1/120,path=createRailPath(TRAIN_TRACK),specs=compileCarSpecs(TRAIN_CARS);
function setup(cursor=2000,moving=false,local=P(-8,0,94),extra={}){const state=createConsist(path,specs,{cursor,speed:moving?85:0,brakePressure:moving?0:1}),car=state.cars.find(c=>c.id==='morrow-tool-wagon'),body=new E.Body({...worldPoint(car.frame,local),r:9,height:53,onGround:false,vx:moving?car.frame.x.x*85:0,vy:moving?car.frame.x.y*85:0,vz:-50,...extra});return{state,body};}
function run(seed,moving=false,extraPlatform=null,steps=36){let {state,body}=seed;const contacts=[];for(let n=0;n<steps;n++){const motion=advanceConsist(path,specs,state,dt,{brake:moving?0:1},TRAIN_MOTION_PROPOSAL),platforms=extraPlatform?[...motion.platforms,extraPlatform(motion.platforms.find(p=>p.id==='morrow-tool-wagon'))]:motion.platforms,context=createAcceptedStepContext(platforms,dt),result=stepRailBody(body,context,dt,{relativeVelocity:P(),groundAt:()=>-100000});if(result.contact)contacts.push(result.contact);if(body.support)assert.ok(validateBodySupport(body,context));state=motion.state;}return{state,body,contacts};}
test('full native body earns stable exact84 roof support on actual graded/curved stopped and moving cars',()=>{for(const cursor of[2000,2400,3600,4800])for(const moving of[false,true]){const {state,body}=run(setup(cursor,moving),moving);assert.equal(body.support?.carId,'morrow-tool-wagon',`${cursor}/${moving}`);assert.equal(body.support.surfaceId,'tool-roof');assert.equal(body.onGround,true);const local=localPoint(state.cars.find(c=>c.id===body.support.carId).frame,body);assert.ok(Math.abs(local.z-84)<1e-6,'feet meet authored roof, no permanent toe-hover');assert.ok(Math.abs(body.support.local.z-84)<1e-7);}});
test('samecar sidewall from below still blocks and cannot become roof support',()=>{const result=run(setup(2000,false,P(-8,-50,60),{vy:150,vz:0}),false,null,20);assert.ok(result.body.support==null);assert.ok(result.contacts.some(c=>c.volumeId==='tool-left-wall'));});
test('roof underside remains solid during an upward jump',()=>{const result=run(setup(2000,false,P(-8,0,20),{vz:220}),false,null,18);assert.ok(result.contacts.some(c=>c.volumeId==='tool-roof'));assert.notEqual(result.body.support?.surfaceId,'tool-roof');const local=localPoint(result.state.cars.find(c=>c.id==='morrow-tool-wagon').frame,result.body);assert.ok(local.z<40,'head contact cannot lift feet through roof');});
test('earlier otherplatform cover never defers to a later train roof landing',()=>{const obstacle=p=>({id:'real-overhead-blocker',previousFrame:p.previousFrame,frame:p.frame,surfaces:[],cover:[{id:'block',bounds:{min:P(-40,-20,88),max:P(40,20,92)},bodySolid:true,projectileSolid:true}]});const result=run(setup(),false,obstacle);assert.ok(result.body.support==null);assert.ok(result.contacts.some(c=>c.carId==='real-overhead-blocker'));});
test('samecar cover with a different topheight remains blocking',()=>{const seed=setup();let {state,body}=seed,seen=false;for(let n=0;n<36;n++){const motion=advanceConsist(path,specs,state,dt,{brake:1},TRAIN_MOTION_PROPOSAL),platforms=motion.platforms.map(p=>p.id==='morrow-tool-wagon'?{...p,cover:[...p.cover,{id:'raised-real-obstruction',bounds:{min:P(-40,-20,88),max:P(40,20,92)},bodySolid:true,projectileSolid:true}]}:p),r=stepRailBody(body,createAcceptedStepContext(platforms,dt),dt,{groundAt:()=>-100000});seen||=r.contact?.volumeId==='raised-real-obstruction';state=motion.state;}assert.ok(body.support==null);assert.equal(seen,true);});

test('actual roof toe contact cannot award support before the centre-foot plane crosses',()=>{
 const motion=advanceConsist(path,specs,createConsist(path,specs,{cursor:2000,speed:0,brakePressure:1}),dt,{brake:1},TRAIN_MOTION_PROPOSAL),car=motion.platforms.find(p=>p.id==='morrow-tool-wagon');
 const body=new E.Body({...worldPoint(car.frame,P(-8,0,84.0625)),r:9,height:53,gravity:0,onGround:false,vz:-1});
 const raw=sweepMovingCover(P(body.x,body.y,body.z+53/2),P(body.x,body.y,body.z+53/2-dt),motion.platforms,dt,{radius:9,height:53,mode:'body',footprint:'circle'});assert.equal(raw?.volumeId,'tool-roof');
 const result=stepRailBody(body,motion.platforms,dt,{groundAt:()=>-100000});
 assert.equal(body.support??null,null);assert.equal(body.onGround,false);assert.equal(result.kind,'air');assert.equal(body.vz,-1);assert.ok(localPoint(car.frame,body).z>84);
});
test('shifted actual roof phases all cross the foot plane and land without permanent toe hover',()=>{
 const motion=advanceConsist(path,specs,createConsist(path,specs,{cursor:2000,speed:0,brakePressure:1}),dt,{brake:1},TRAIN_MOTION_PROPOSAL),car=motion.platforms.find(p=>p.id==='morrow-tool-wagon');
 for(let n=0;n<=40;n++){const offset=8+n*.05,body=new E.Body({...worldPoint(car.frame,P(-8,0,84+offset)),r:9,height:53,gravity:700,onGround:false,vz:-50});
  for(let step=0;step<60;step++)stepRailBody(body,motion.platforms,dt,{relativeVelocity:P(),groundAt:()=>-100000});
  assert.equal(body.support?.surfaceId,'tool-roof',`offset ${offset}`);assert.ok(Math.abs(localPoint(car.frame,body).z-84)<1e-7);assert.ok(validateBodySupport(body,motion.platforms));
 }
});
test('matching tilted roof top cannot hide a later samecar wall before actual landing',()=>{
 const frame=makeFrame(P(0,0,100),P(1,0,.4)),platform={id:'car',previousFrame:frame,frame,surfaces:[{id:'deck',bounds:{min:P(-100,-100,10),max:P(100,100,10)},oneWay:true}],cover:[
  {id:'roof',bounds:{min:P(-100,-100,7),max:P(100,100,10)},bodySolid:true,projectileSolid:true},
  {id:'later-wall',bounds:{min:P(32,-100,-20),max:P(34,100,100)},bodySolid:true,projectileSolid:true}]},velocity=worldVector(frame,P(100,0,-200));
 const body=new E.Body({...worldPoint(frame,P(0,0,20)),vx:velocity.x,vy:velocity.y,vz:velocity.z,r:9,height:53,gravity:0,onGround:false});
 const result=stepRailBody(body,[platform],.1,{groundAt:()=>-10000});
 assert.equal(result.kind,'cover');assert.equal(result.contact.volumeId,'later-wall');assert.ok(Math.abs(result.contact.u-.39600039352651417)<1e-8);assert.equal(result.after.kind,'landed');
 const local=localPoint(frame,body);assert.ok(local.x<4,'remaining time is resolved from wall contact, never inside wall');assert.equal(body.support.surfaceId,'deck');assert.ok(validateBodySupport(body,[platform]));
 // The full world-vertical body remains on the wall exterior after landing.
 assert.ok(local.x+9*Math.hypot(frame.x.x,frame.x.y)+53*Math.max(0,frame.x.z)<=32+1e-5);
});
test('toe-top deferral requires the full authored foot footprint',()=>{
 const frame=makeFrame(P(0,0,100),P(1,0,.4)),platform={id:'edge',previousFrame:frame,frame,surfaces:[{id:'deck',bounds:{min:P(-20,-20,10),max:P(20,20,10)},oneWay:true}],cover:[{id:'roof',bounds:{min:P(-20,-20,7),max:P(20,20,10)},bodySolid:true,projectileSolid:true}]};
 const body=new E.Body({...worldPoint(frame,P(0,11.1,10.1)),r:9,height:53,gravity:0,onGround:false,vz:-1}),result=stepRailBody(body,[platform],dt,{groundAt:()=>-10000});
 assert.equal(result.kind,'cover');assert.equal(result.contact.volumeId,'roof');assert.equal(body.support??null,null);
});
