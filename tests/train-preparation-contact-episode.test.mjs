import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeldBox,translateHeldBox} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
import {nativeInitialContactEpisode} from '../src/train-preparation-contact-resolution.js';
const delta=x=>({x,y:0,z:0});
const box=(id,x)=>createHeldBox({id,frame:makeFrame(delta(x),{x:1,y:0,z:0}),halfExtents:{x:1,y:1,z:1}});

test('a complete connected contact episode permits bounded redistribution and preserves its original barrier across a saved prefix',()=>{
 const parts=[box('front',0),box('rear',-2.5)],foreign=[[box('fixed',0)]];
 const complete=nativeInitialContactEpisode(parts,foreign,delta(6));assert.ok(complete);assert.equal(complete.bodies[0].limit,2);assert.equal(complete.bodies[0].maximumDepth,2);assert.equal(complete.finalEnergy,0);
 const prefix=parts.map(p=>translateHeldBox(p,delta(2.25)));
 assert.equal(nativeInitialContactEpisode(prefix,foreign,delta(3.75)),null,'resetting to the smaller current penetration cannot replace the original episode');
 const continued=nativeInitialContactEpisode(prefix,foreign,delta(3.75),{depthLimits:complete.bodies.map(c=>c.limit)});assert.ok(continued);assert.ok(continued.bodies[0].initialDepth<continued.bodies[0].maximumDepth);assert.equal(continued.barrierEnergy,complete.barrierEnergy);
});

test('clear endpoints cannot hide a deeper interior penetration or reentry into an already cleared body',()=>{
 assert.equal(nativeInitialContactEpisode([box('moving',1.8)],[[box('fixed',0)]],delta(-4)),null,'exact SAT partitions catch the interior maximum despite a clear destination');
 assert.equal(nativeInitialContactEpisode([box('front',0),box('rear',-6)],[[box('fixed',0)]],delta(10)),null,'separated pair-contact intervals cannot masquerade as one old contact episode');
 assert.equal(nativeInitialContactEpisode([box('moving',-4)],[[box('fixed',0)]],delta(8),{depthLimits:[2]}),null,'an old numeric limit never authorizes a body that is currently clear to be entered again');
});

test('an unfinished endpoint and invalid numerical episode inputs are refused',()=>{
 assert.equal(nativeInitialContactEpisode([box('moving',0)],[[box('fixed',0)]],delta(.5)),null);
 for(const limits of [[-1],[Infinity],[],[2,2]])assert.throws(()=>nativeInitialContactEpisode([box('moving',0)],[[box('fixed',0)]],delta(3),{depthLimits:limits}),TypeError);
 assert.throws(()=>nativeInitialContactEpisode([box('moving',0)],[[box('fixed',0)]],{x:NaN,y:0,z:0}),TypeError);
});
