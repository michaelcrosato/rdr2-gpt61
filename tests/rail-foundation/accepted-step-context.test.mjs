/** Independent accepted-step immutability/time/contact regressions. */
import test from 'node:test';import assert from 'node:assert/strict';import '../../my-3d2dge-agent.js';
import {makeFrame as baseFrame,worldPoint} from '../../src/rail-foundation/rigid-frame.js';
import {createAcceptedStepContext,createImmutableFrameSource} from '../../src/rail-foundation/accepted-step-context.js';
import {sweepMovingCover,sweepMovingContact,stepRailBody,validateBodySupport,frameAt,supportPointVelocity,validPlatforms,jumpFromSupport} from '../../src/rail-foundation/moving-support.js';
import {createRailPath,createConsist,advanceConsist,compileCarSpecs,validateCarSpecs} from '../../src/rail-foundation/rail-consist.js';
const E=globalThis.My3D2dge,P=(x=0,y=0,z=0)=>({x,y,z}),clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const makeFrame=(origin,forward=P(1))=>baseFrame(origin,forward);
function platform(){return{id:'deck',previousFrame:makeFrame(P()),frame:makeFrame(P(10)),surfaces:[{id:'floor',bounds:{min:P(-40,-20,30),max:P(40,20,30)},oneWay:true}],cover:[{id:'wall',bounds:{min:P(20,-20,30),max:P(22,20,90)},bodySolid:true,projectileSolid:true}],contacts:[{id:'handle',kind:'control',local:P(5,0,60)}]};}
const car=()=>({id:'engine',length:80,width:40,mass:10000,wheelRadius:12,couplerGap:8,frontCoupler:P(40,0,12),rearCoupler:P(-40,0,12),surfaces:platform().surfaces,cover:platform().cover,contacts:platform().contacts});
test('immutable accepted geometry and exact-u frames detach from later input mutation and reject opaque closures',()=>{
 const p=platform(),c=createAcceptedStepContext([p],.1);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.platforms)&&Object.isFrozen(c.platforms[0].cover[0].bounds.min));const old=clone(c.platforms[0]);p.frame.origin.x=900;p.cover[0].bounds.min.x=-999;p.contacts[0].local.x=800;assert.equal(c.platforms[0].frame.origin.x,10);assert.equal(c.platforms[0].cover[0].bounds.min.x,20);assert.equal(c.platforms[0].contacts[0].local.x,5);assert.throws(()=>{c.platforms[0].frame.origin.x=1;},TypeError);
 const a=frameAt(c.platforms[0],.37123456789),b=frameAt(c.platforms[0],.37123456789);assert.equal(a,b);near(a.origin.x,3.7123456789);assert.ok(Object.isFrozen(a.origin));assert.equal(c.inspect().geometryValidations,1);assert.equal(c.inspect().frameSamples,1);
 assert.throws(()=>createAcceptedStepContext([{...platform(),frameAt:u=>makeFrame(P(u))}],.1),/opaque|snapshot/);assert.throws(()=>sweepMovingCover(P(),P(),{...c},.1));assert.throws(()=>sweepMovingCover(P(),P(),clone(c),.1));assert.ok(validPlatforms(c.platforms));
});
test('nested slices retain original root fractions and physical point velocity with strict duration matching',()=>{
 const c=createAcceptedStepContext([platform()],.1),child=c.slice(.2,.8).slice(.25,.75);near(child.dt,.03,1e-15);const [lo,hi]=child.inspect().rootInterval;near(lo,.35);near(hi,.65);const p=child.platforms[0];near(frameAt(p,.4).origin.x,4.7);near(supportPointVelocity(p,P(),child.dt).x,100,1e-6);assert.equal(c.slice(.2,.8),c.slice(.2,.8));assert.equal(child.inspect().geometryValidations,1);
 for(const bad of[NaN,-1,.2])assert.throws(()=>sweepMovingCover(P(),P(),child,bad));assert.throws(()=>sweepMovingCover(P(),P(),child,.031),/duration/);assert.throws(()=>createAcceptedStepContext([...c.platforms],.05),/duration/);assert.throws(()=>createAcceptedStepContext(c.platforms.map(p=>({...p})),.05),/duration/);assert.throws(()=>sweepMovingCover(P(),P(),child));assert.throws(()=>sweepMovingCover(P(),P(),[platform()]));assert.throws(()=>supportPointVelocity(p,P(),.1),/duration/);assert.throws(()=>c.slice(.7,.2));assert.throws(()=>c.slice(0,2));
 const zero=child.slice(.5,.5);assert.equal(zero.dt,0);assert.deepEqual(supportPointVelocity(zero.platforms[0],P(),0),P());assert.equal(sweepMovingCover(P(),P(),zero,0),null);
});
test('cached contexts preserve actual world contact/collision and freshly reject changed actor/support inputs',()=>{
 const raw=[platform()],c=createAcceptedStepContext(raw,.1),from=P(0,0,60),to=P(50,0,60),plain=sweepMovingCover(from,to,raw,.1),cached=sweepMovingCover(from,to,c,.1);near(cached.u,plain.u,1e-12);assert.equal(cached.volumeId,'wall');assert.deepEqual(cached.world,plain.world);
 const contact=sweepMovingContact(P(0,0,60),P(20,0,60),c,.1,{carId:'deck',contactId:'handle',radius:.5});assert.equal(contact.contactId,'handle');near(contact.distance,.5,1e-5);
 const local=P(0,0,30),body=new E.Body({...worldPoint(raw[0].previousFrame,local),r:3,height:53,onGround:true});body.support={carId:'deck',surfaceId:'floor',local,relativeVelocity:P()};stepRailBody(body,c,.1);assert.ok(validateBodySupport(body,c));assert.equal(c.inspect().geometryValidations,1);body.support.local.x+=1;assert.equal(validateBodySupport(body,c),false);assert.throws(()=>stepRailBody(body,c,.1));assert.throws(()=>sweepMovingCover(P(NaN),to,c,.1));assert.throws(()=>sweepMovingCover(from,to,c,.1,{radius:-1}));assert.throws(()=>sweepMovingCover(from,to,c,.1,{mode:'invented'}));
});
test('official rail frame sources preserve the accepted old step after mutable state adoption, path/spec and returned-state changes',()=>{
 const path=clone(createRailPath({id:'straight',segments:[{id:'a',kind:'line',from:P(),to:P(10000),maxSpeed:200}]})),specs=[car()],state=createConsist(path,specs,{cursor:1000,speed:85}),reference=advanceConsist(clone(path),clone(specs),clone(state),.1),motion=advanceConsist(path,specs,state,.1),c=createAcceptedStepContext(motion.platforms,.1);
 Object.assign(state,clone(motion.state));state.speed=400;path.segments[0].to.x=20000;path.segments[0].table[1].point.x=20000;specs[0].surfaces[0].bounds.max.z=999;motion.state.cars[0].frame.origin.x=7777;
 for(const u of[.137,.613,1])assert.deepEqual(frameAt(c.platforms[0],u),reference.platforms[0].frameAt(u));assert.equal(c.platforms[0].surfaces[0].bounds.max.z,30);
 const nextPath=createRailPath({id:'straight',segments:[{id:'a',kind:'line',from:P(),to:P(10000),maxSpeed:200}]}),next=advanceConsist(nextPath,[car()],reference.state,.1),n=createAcceptedStepContext(next.platforms,.1);assert.notEqual(frameAt(c.platforms[0],.137).origin.x,frameAt(n.platforms[0],.137).origin.x,'same carId in a new step cannot reuse an old frame');
});
test('snapshot-source factories freeze input data and reject inconsistent or nonfinite frame sources',()=>{
 const data={speed:10},source=createImmutableFrameSource(data,(d,u)=>makeFrame(P(d.speed*u)),.1),p=platform();p.frameAt=source;p.frame=makeFrame(P(10));data.speed=900;const c=createAcceptedStepContext([p],.1);near(frameAt(c.platforms[0],.33).origin.x,3.3);assert.throws(()=>createAcceptedStepContext([{...p,frame:makeFrame(P(11))}],.1),/endpoints/);
 const bad=createImmutableFrameSource({},()=>({origin:P(NaN),x:P(1),y:P(0,1),z:P(0,0,1)}),.1);assert.throws(()=>createAcceptedStepContext([{...p,frameAt:bad}],.1),/frame/);
});

test('actual supported edge transfer and landed tail preserve root time, velocity and one native body',()=>{
 const p=platform();p.cover=[];p.surfaces[0].bounds.min.x=-20;p.surfaces[0].bounds.max.x=20;p.frame=makeFrame(P(5));const q={...clone(p),id:'next-deck',previousFrame:makeFrame(P(30)),frame:makeFrame(P(35))},raw=[p,q],c=createAcceptedStepContext(raw,.1),local=P(17,0,30);
 const body=()=>{const b=new E.Body({...worldPoint(p.previousFrame,local),r:2,height:53,onGround:true});b.support={carId:p.id,surfaceId:'floor',local:{...local},relativeVelocity:P()};return b;},a=body(),b=body();stepRailBody(a,raw,.1,{relativeVelocity:P(40)});stepRailBody(b,c,.1,{relativeVelocity:P(40)});
 assert.equal(b.support.carId,'next-deck');assert.ok(validateBodySupport(b,c));for(const key of['x','y','z','vx','vy','vz'])near(b[key],a[key],1e-6);near(b.x,26);near(b.vx,90);assert.equal(c.inspect().geometryValidations,2);
 assert.equal(jumpFromSupport(b,c,.1,220),true);assert.equal(b.support,null);near(b.vx,90);near(b.vz,220);assert.equal(b.onGround,false);
});

test('actual frozen platform/spec snapshots remain validated when input accessors change their read results',()=>{
 const p=platform(),good=clone(p.surfaces),bad=clone(good);bad[0].bounds.min.x=500;let reads=0;Object.defineProperty(p,'surfaces',{enumerable:true,get(){return++reads<=4?good:bad;}});const c=createAcceptedStepContext([p],.1);assert.ok(validPlatforms(c.platforms),'a changing getter cannot brand an invalid frozen platform');assert.equal(c.platforms[0].surfaces[0].bounds.min.x,-40);
 const spec=car(),valid=clone(spec.surfaces),invalid=clone(valid);invalid[0].bounds.max.x=-500;let specReads=0;Object.defineProperty(spec,'surfaces',{enumerable:true,get(){return++specReads<=3?valid:invalid;}});const compiled=compileCarSpecs([spec]);assert.ok(validateCarSpecs(compiled),'the actual frozen specification is what receives validation');assert.ok(Object.isFrozen(compiled[0].surfaces[0].bounds.max));
 const broken=platform();Object.defineProperty(broken,'surfaces',{enumerable:true,get:()=>bad});assert.throws(()=>createAcceptedStepContext([broken],.1),/geometry/);const brokenSpec=car();Object.defineProperty(brokenSpec,'surfaces',{enumerable:true,get:()=>invalid});assert.throws(()=>compileCarSpecs([brokenSpec]),/geometry/);
 const first=platform(),second=platform();let idReads=0;Object.defineProperty(second,'id',{enumerable:true,get:()=>++idReads===1?'other':'deck'});try{const ids=createAcceptedStepContext([first,second],.1);assert.equal(new Set(ids.platforms.map(p=>p.id)).size,ids.platforms.length);}catch(error){assert.match(error.message,/identities/);}
});
