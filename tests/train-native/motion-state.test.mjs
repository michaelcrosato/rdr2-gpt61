import test from 'node:test';
import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
import {worldPoint} from '../../src/rail-foundation/rigid-frame.js';
import {createTrainConsist,validateTrainConsist,trainGeometry,advanceTrainConsist,stepTrainBody,jumpTrainBody,validateTrainSupport} from '../../src/train-motion.js';
const copy=v=>JSON.parse(JSON.stringify(v));
test('actual mission consist round trip preserves seven car frames and wheel travel across accepted steps',()=>{
  let original=createTrainConsist(),restored=copy(original);assert.ok(validateTrainConsist(restored));
  for(let i=0;i<12;i++){
    original=advanceTrainConsist(original,1/120,{throttle:0,brake:.4}).state;
    restored=advanceTrainConsist(restored,1/120,{throttle:0,brake:.4}).state;
  }
  assert.deepEqual(restored,original);assert.ok(validateTrainConsist(copy(original)));
  const before=JSON.stringify(original),geometry=trainGeometry(original);
  assert.equal(geometry.platforms.length,25);assert.equal(trainGeometry(original),geometry);
  assert.equal(JSON.stringify(original),before,'derived geometry never writes the owning state');
  const wrongWheel=copy(original);wrongWheel.cars[2].wheelAngle+=.1;assert.equal(validateTrainConsist(wrongWheel),false);
  assert.throws(()=>advanceTrainConsist(wrongWheel,1/120,{}),/Invalid owning train motion/,'generic rail validation cannot brand a forged mission wheel phase');
  const wrongIdentity=copy(original);wrongIdentity.id='invented-consist';
  assert.throws(()=>advanceTrainConsist(wrongIdentity,1/120,{}),/Invalid owning train motion/);
  const wrongCar=copy(original);wrongCar.cars[2].frame.origin.x+=1;assert.equal(validateTrainConsist(wrongCar),false);
  const mutableRestore=copy(original);trainGeometry(mutableRestore);mutableRestore.cars[0].frame.origin.x+=1;
  assert.throws(()=>trainGeometry(mutableRestore),/Invalid owning train motion/,'mutable restored input cannot reuse a stale trusted cache');
});
test('supported authoritative actor follows the same accepted train frames and native jump inherits velocity',()=>{
  const original=createTrainConsist(),geometry=trainGeometry(original),platform=geometry.platforms.find(p=>p.id==='morrow-tool-wagon');
  const local={x:0,y:0,z:84},body={id:'motion-test',...worldPoint(platform.frame,local),vx:0,vy:0,vz:0,r:9,footRadius:9,height:53,gravity:700,onGround:true,support:{carId:platform.id,surfaceId:'tool-roof',local,relativeVelocity:{x:0,y:0,z:0}}};
  assert.ok(validateTrainSupport(body,original));
  assert.equal(jumpTrainBody(body,geometry),false,'restore-only geometry cannot lose inherited moving velocity');
  const step=advanceTrainConsist(original,1/120,{throttle:0,brake:0});stepTrainBody(body,step.geometry,{relativeVelocity:{x:0,y:0,z:0}});
  assert.ok(validateTrainSupport(body,step.state));const velocity={x:body.vx,y:body.vy,z:body.vz};
  assert.ok(jumpTrainBody(body,step.geometry));assert.equal(body.support,null);assert.equal(body.onGround,false);
  assert.equal(body.vx,velocity.x);assert.equal(body.vy,velocity.y);assert.ok(Math.abs(body.vz-velocity.z-220)<1e-7);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(body)),'jump'),false,'native method is not persistent authority');
  const attached={...body,onGround:true,attachment:{type:'passenger',targetId:'test-mount'}};
  assert.equal(jumpTrainBody(attached,step.geometry),false,'an attached passenger cannot also become a jumping free body');
  for(const speed of [NaN,Infinity,-1,0]){
    const ground={...body,onGround:true,support:null},before=copy(ground);
    assert.equal(jumpTrainBody(ground,step.geometry,speed),false);assert.deepEqual(ground,before,'invalid jump input never mutates the grounded body');
  }
});
