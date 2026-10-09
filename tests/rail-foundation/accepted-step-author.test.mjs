/** Actual authored geometry, short accepted-step parity only; no mission route. */
import test from 'node:test';import assert from 'node:assert/strict';import '../../my-3d2dge-agent.js';
import * as D from '../../proposals/brass-cutting.js';
import {createRailPath,createConsist,advanceConsist,compileCarSpecs} from '../../src/rail-foundation/rail-consist.js';
import {createAcceptedStepContext} from '../../src/rail-foundation/accepted-step-context.js';
import {createGangwayPlatforms} from '../../src/rail-foundation/moving-gangways.js';
import {stepRailBody,frameAt,validateBodySupport} from '../../src/rail-foundation/moving-support.js';
import {worldPoint} from '../../src/rail-foundation/rigid-frame.js';
const E=My3D2dge,P=(x=0,y=0,z=0)=>({x,y,z}),clone=v=>JSON.parse(JSON.stringify(v)),dt=1/120;
const people=[...D.TRAIN_MOVING_CREW,...D.TRAIN_NEW_CAST.filter(a=>a.initialSupport).map(a=>({...a,...a.initialSupport}))];
function bodies(platforms){return people.map(a=>{const p=platforms.find(p=>p.id===a.carId),b=new E.Body({...worldPoint(p.previousFrame,a.local),r:9,height:53,onGround:true});b.id=a.id;b.support={carId:a.carId,surfaceId:a.surfaceId,local:clone(a.local),relativeVelocity:P()};return b;});}
function setup(){const path=createRailPath(D.TRAIN_TRACK),specs=compileCarSpecs(D.TRAIN_CARS),state=createConsist(path,specs,{cursor:2400,speed:85}),motion=advanceConsist(path,specs,state,dt,{},D.TRAIN_MOTION_PROPOSAL),cars=createAcceptedStepContext(motion.platforms,dt),defs=clone(D.TRAIN_GANGWAYS),bridges=createGangwayPlatforms(cars,defs),context=createAcceptedStepContext([...cars.platforms,...bridges],dt);return{motion,cars,defs,bridges,context};}
test('all12 actual authored bodies preserve exact raw-path collision/support results with shared geometry validated once',()=>{
 const {motion,context}=setup(),raw=[...motion.platforms,...createGangwayPlatforms(motion.platforms,D.TRAIN_GANGWAYS)],a=bodies(raw),b=bodies(context.platforms),before=context.inspect().geometryValidations;assert.equal(before,25);assert.equal(a.length,12);
 for(let i=0;i<a.length;i++){const plain=stepRailBody(a[i],raw,dt,{relativeVelocity:P()}),cached=stepRailBody(b[i],context,dt,{relativeVelocity:P()});assert.deepEqual(cached,plain,a[i].id);assert.deepEqual(JSON.parse(JSON.stringify(b[i])),JSON.parse(JSON.stringify(a[i])),a[i].id);assert.ok(validateBodySupport(b[i],context));}
 assert.equal(context.inspect().geometryValidations,before,'fresh actors never repeat shared geometry validation');assert.ok(context.inspect().frameSamples<context.inspect().frameRequests,'exact fraction requests reuse actual immutable samples');
});
test('derived gangways memoize exact frozen frames and ignore later mutable definition/state changes',()=>{
 const {motion,cars,defs,bridges,context}=setup(),bridge=context.platforms.find(p=>p.id===defs[0].id),reference=createGangwayPlatforms(motion.platforms,clone(defs))[0],u=.137123456789,expected=frameAt(reference,u);defs[0].maxSpan=.01;defs[0].forward.contactId='missing';motion.state.cars[0].frame.origin.x+=4000;
 assert.deepEqual(frameAt(bridge,u),expected);assert.equal(frameAt(bridge,u),frameAt(bridge,u));assert.ok(Object.isFrozen(frameAt(bridge,u).origin));assert.throws(()=>{frameAt(bridge,u).origin.x=3;},TypeError);assert.throws(()=>createAcceptedStepContext([...cars.platforms,bridges[0],bridges[0]],dt),/identities/);
});
