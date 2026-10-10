import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../my-3d2dge-agent.js';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts,sweepPreparationCompoundYaw} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
const P=(x=0,y=0,z=0)=>({x,y,z}),source=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url)))),panel=(id,p,half=P(.01,.01,.01))=>compileHeldBoxSet([{box:createHeldBox({id,frame:makeFrame(p,P(1,0,0)),halfExtents:half}),ownerId:'fixed-panel'}],{id});
test('genuinely registered mounted Nell/Rivet compound is derived without source mutation and reports the actual owner',()=>{
  const s=source(),before=JSON.stringify(s),root=s.entities.rivet;assert.equal(s.entities.nell.mounted,true);assert.equal(s.entities.nell.mountId,'rivet');assert.deepEqual(P(s.entities.nell.x,s.entities.nell.y,s.entities.nell.z),P(root.x,root.y,root.z));
  const far=panel('far',P(2000,2000,100));assert.equal(sweepPreparationCompoundYaw(s,'rivet',root.facing+.5,far).clear,true);
  const seat=panel('seat',P(root.x,root.y,70)),hit=sweepPreparationCompoundYaw(s,'rivet',root.facing+.5,seat);assert.equal(hit.clear,false);assert.ok(hit.partId.startsWith('nell:'),'the mounted rider remains an explicit included body');assert.equal(JSON.stringify(s),before);
});
test('all owning world-foot prisms remain full and fixed while the horse and rider turn',()=>{
  const s=source(),h=s.entities.rivet,set=panel('foot-corner',P(h.x+13,h.y+13,80)),before=JSON.stringify(s),hit=sweepPreparationCompoundYaw(s,'rivet',h.facing+Math.PI/2,set);assert.equal(hit.clear,false);assert.equal(hit.partId,'rivet:root-foot');assert.equal(JSON.stringify(s),before);
});
test('combined root-orbital certificate catches an intermediate native ear despite clear complete endpoints',()=>{
  const s=source(),h=s.entities.rivet,rows=capturePreparationBodyBounds(s),row=rows.find(r=>r.id==='rivet'),ear=preparationNativeBodyParts(row,rows).find(p=>p.id==='ear--1').frame.origin,a=Math.PI/4,dx=ear.x-h.x,dy=ear.y-h.y,p=P(h.x+dx*Math.cos(a)-dy*Math.sin(a),h.y+dx*Math.sin(a)+dy*Math.cos(a),ear.z),set=panel('mid-orbit',p,P(1e-6,1e-6,1e-6)),before=JSON.stringify(s);
  // Detached endpoint geometry only: no live actor/binding/time/Save is changed.
  const end={...s,entities:{...s.entities,nell:{...s.entities.nell,facing:s.entities.nell.facing+Math.PI/2},rivet:{...h,facing:h.facing+Math.PI/2}}};
  for(const state of[s,end]){const captured=capturePreparationBodyBounds(state);for(const r of captured.filter(r=>r.rootId==='rivet'))assert.ok(preparationNativeBodyParts(r,captured).every(part=>!heldBoxContacts(part,set).length));}
  const hit=sweepPreparationCompoundYaw(s,'rivet',h.facing+Math.PI/2,set);assert.equal(hit.clear,false);assert.equal(hit.solidId,'mid-orbit');assert.equal(JSON.stringify(s),before);
});
test('caller fixed-ID/box/callback substitutions and invalid mounted co-location never inherit compound authority',()=>{
  const s=source(),h=s.entities.rivet,set=panel('far',P(2000,2000,100)),before=JSON.stringify(s);
  for(const options of[{fixedPartIds:['rivet:head']},{parts:[]},{frameAt:()=>({})},{spatialTolerance:0},{maxIntervals:0}])assert.throws(()=>sweepPreparationCompoundYaw(s,'rivet',h.facing+.5,set,options));
  for(const fixed of[null,{}, {...set}])assert.throws(()=>sweepPreparationCompoundYaw(s,'rivet',h.facing+.5,fixed));
  for(const facing of[NaN,Infinity,h.facing+2*Math.PI])assert.throws(()=>sweepPreparationCompoundYaw(s,'rivet',facing,set));assert.throws(()=>sweepPreparationCompoundYaw(s,'mara',0,set));
  const invalid=source();invalid.entities.nell.x+=1;const malformed=JSON.stringify(invalid);assert.throws(()=>sweepPreparationCompoundYaw(invalid,'rivet',invalid.entities.rivet.facing+.5,set));assert.equal(JSON.stringify(invalid),malformed);assert.equal(JSON.stringify(s),before);
});
