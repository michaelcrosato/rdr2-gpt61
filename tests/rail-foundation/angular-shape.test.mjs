/** Independent continuous shape-extent regressions; no mission fixture state. */
import test from 'node:test';import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
import {makeFrame,worldPoint} from '../../src/rail-foundation/rigid-frame.js';
import {sweepMovingCover} from '../../src/rail-foundation/moving-support.js';
const P=(x=0,y=0,z=0)=>({x,y,z}),start=makeFrame(P(),P(1)),end=makeFrame(P(),P(.5,0,Math.sqrt(3)/2));
const panel=z=>({id:'pivot-panel',previousFrame:start,frame:end,surfaces:[],cover:[{id:'thin-panel',bounds:{min:P(-.1,-.1,z),max:P(.1,.1,z+.1)},bodySolid:true,projectileSolid:true}]});
test('stationary-center sweeps still catch a thin rotating panel at the body extent maximum between all old sample times',()=>{
 const p=panel(26.5),angle=Math.atan(9/25),peak=makeFrame(P(),P(Math.cos(angle),0,Math.sin(angle))),world=worldPoint(peak,P(0,0,26.55));
 assert.ok(Math.hypot(world.x,world.y)<9&&Math.abs(world.z)<25,'the panel independently lies inside the actual world-vertical native cylinder');
 for(const footprint of['box','circle']){
  const query=frame=>sweepMovingCover(P(),P(),[{...p,previousFrame:frame,frame}],.1,{radius:9,height:50,mode:'body',footprint});
  for(const theta of[0,Math.PI/6,Math.PI/3])assert.equal(query(makeFrame(P(),P(Math.cos(theta),0,Math.sin(theta)))),null,'the old start/middle/end padding samples are all clear');
  assert.ok(query(peak),'the true intermediate maximum has real contact');const moving=sweepMovingCover(P(),P(),[p],.1,{radius:9,height:50,mode:'body',footprint});assert.equal(moving?.volumeId,'thin-panel');assert.ok(moving.u>0&&moving.u<.5);
 }
});
test('nearby rotating geometry beyond the maximum body extent stays clear',()=>{
 const maximum=Math.hypot(9,25),p=panel(maximum+.001);for(const footprint of['box','circle'])assert.equal(sweepMovingCover(P(),P(),[p],.1,{radius:9,height:50,mode:'body',footprint}),null);
});

test('platforms with no solid cover in the selected query mode require no motion sampling',()=>{
 let samples=0;const p={id:'actual-open-gangway',previousFrame:start,frame:end,frameAt(){samples++;return start;},surfaces:[],cover:[]};
 assert.equal(sweepMovingCover(P(),P(20),[p],.1,{radius:9,height:53,mode:'body',footprint:'circle'}),null);assert.equal(samples,0);
 p.cover=[{id:'decorative-volume',bounds:{min:P(-1,-1,-1),max:P(1,1,1)},bodySolid:false,projectileSolid:false}];
 for(const mode of['body','projectile'])assert.equal(sweepMovingCover(P(),P(20),[p],.1,{mode}),null);assert.equal(samples,0);
});
