import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeldBox,translateHeldBox,compileHeldBoxSet,compileHeldSolidSet,heldBoxContacts,createHeldBoxMotion,sweepHeldBox} from '../../src/train-held-volume.js';
import {makeFrame} from '../../src/rail-foundation/rigid-frame.js';
import {preparationNativeBodyParts,preparationPartSolid,sweepPreparationNativeYaw} from '../../src/train-preparation-body-geometry.js';
const P=(x=0,y=0,z=0)=>({x,y,z}),axes=['x','y','z'],faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],copy=structuredClone;
const shape=(box,ownerId)=>({id:box.id,...(ownerId===undefined?{}:{ownerId}),vertices:box.vertices,faces});
const box=(id,origin=P(),half=P(2,3,6),yaw=0)=>createHeldBox({id,frame:makeFrame(origin,P(Math.cos(yaw),Math.sin(yaw))),halfExtents:half});

test('trusted translation exactly matches raw construction over normal, rebased and residual native frames',()=>{
  const cases=[{origin:P(33,-20,4),delta:P(-5,8,.5),yaw:.37},{origin:P(1e6,-2e6,400),delta:P(-1e6,2e6,-398),yaw:.31},{origin:P(100,200,12),delta:P(-99,-198,7),yaw:.81,residual:true}];
  for(const [i,c]of cases.entries()){
    const frame=makeFrame(c.origin,P(Math.cos(c.yaw),Math.sin(c.yaw),.02));if(c.residual){frame.x.x+=1e-9;frame.y.y-=5e-10;}
    const original=createHeldBox({id:`native-${i}`,frame,halfExtents:P(2,3,6),label:'preserved native metadata'}),before=JSON.stringify(original),delta=copy(c.delta),translated=translateHeldBox(original,delta),raw=createHeldBox({...original,frame:{...original.frame,origin:P(...axes.map(k=>original.frame.origin[k]+delta[k]))}});
    assert.deepEqual(translated,raw);assert.equal(translated.id,original.id);assert.deepEqual(translated.halfExtents,original.halfExtents);assert.equal(translated.label,original.label);assert.equal(JSON.stringify(original),before);
    delta.x+=100;assert.deepEqual(translated,raw,'later delta mutation cannot change accepted geometry');assert.ok(Object.isFrozen(translated)&&Object.isFrozen(translated.frame.origin)&&Object.isFrozen(translated.vertices)&&translated.vertices.every(Object.isFrozen));
  }
});

test('compiled branded box references preserve owners/IDs and match raw contacts at gap/penetration boundaries',()=>{
  const a=translateHeldBox(box('body',P(10,20,4),P(2,3,6),.3),P(2,-5,1)),b=box('thin-wall',P(18,15,5),P(1e-6,4,8)),refs=[{box:a,ownerId:'native-owner'},{box:b,ownerId:'terrain-owner'}],trusted=compileHeldBoxSet(refs,{id:'trusted'}),raw=compileHeldSolidSet(refs.map(e=>shape(e.box,e.ownerId)),{id:'raw'});
  assert.deepEqual(trusted.solids,raw.solids);
  for(const x of [12,15,17.999998,17.999999,18,18.000001,18.000002,25]){const probe=box('probe',P(x,15,5),P(1e-6,.2,.2));assert.deepEqual(heldBoxContacts(probe,trusted),heldBoxContacts(probe,raw));}
  refs[0].ownerId='replacement';refs[0].box=box('different',P(100,100,100));assert.equal(trusted.solids[0].ownerId,'native-owner');assert.equal(trusted.solids[0].id,'body');
  assert.ok(Object.isFrozen(trusted.solids)&&trusted.solids.every(s=>Object.isFrozen(s)&&Object.isFrozen(s.faces)&&s.faces.every(Object.isFrozen)));
  assert.throws(()=>{trusted.solids[0].vertices[0].x=0;});assert.throws(()=>{trusted.solids[0].faces[0][0]=7;});
});

test('trusted compiled geometry matches raw continuous translation contact and actual thin-wall intervals',()=>{
  const wall=box('paper-thin',P(5,0,0),P(5e-7,2,2)),trusted=compileHeldBoxSet([{box:wall,ownerId:'wall'}],{id:'trusted-wall'}),raw=compileHeldSolidSet([shape(wall,'wall')],{id:'raw-wall'}),from=box('moving',P(),P(1,1,1)),to=translateHeldBox(from,P(10,0,0)),motion=createHeldBoxMotion(from,to,{duration:.1});
  const hit=sweepHeldBox(motion,trusted);assert.deepEqual(hit,sweepHeldBox(motion,raw));assert.equal(hit.clear,false);assert.equal(hit.closedFormTranslation,true);assert.ok(Math.abs(hit.interval[0]-.39999995)<1e-6);
  const clear=createHeldBoxMotion(from,translateHeldBox(from,P(2,0,0)));assert.equal(sweepHeldBox(clear,trusted).clear,true);
});

test('trusted sets retain intermediate box rotation and full native root-orbital yaw collisions',()=>{
  const from=box('rotor',P(),P(2,1,1)),to=box('rotor',P(),P(2,1,1),Math.PI/2),panel=box('corner-panel',P(Math.sqrt(5)-1e-6,0,0),P(1e-7,.01,.1)),trusted=compileHeldBoxSet([{box:panel,ownerId:'panel'}],{id:'trusted-corner'}),raw=compileHeldSolidSet([shape(panel,'panel')],{id:'raw-corner'}),motion=createHeldBoxMotion(from,to);
  assert.equal(heldBoxContacts(from,trusted).length,0);assert.equal(heldBoxContacts(to,trusted).length,0);assert.deepEqual(sweepHeldBox(motion,trusted),sweepHeldBox(motion,raw));assert.equal(sweepHeldBox(motion,trusted).clear,false);
  // Pure detached native compound fixture; no actor, watch, lead or Save fact.
  const row={geometryVersion:2,id:'skein',kind:'horse',category:'mount',hp:100,dead:false,point:P(1000,900),radius:14,height:53,binding:{type:'free',regionId:'snowbound'},pose:{facing:0,vx:0,vy:0,fear:0,bound:false,restrained:false,surrendered:false,crouch:false,down:false,pose:null,extended:false,rig:null}},rows=[row],native=preparationNativeBodyParts(row,rows),obstruction=box('orbit-panel',P(1000,937,52),P(1e-6,.01,.1)),set=compileHeldBoxSet([{box:obstruction,ownerId:'fixture'}],{id:'root-orbit'});
  assert.ok(native.every(p=>heldBoxContacts(p,set).length===0));assert.equal(sweepPreparationNativeYaw(row,rows,Math.PI,set).clear,false);
});

test('trusted APIs reject unbranded copies, malformed references and finite translations that collapse geometry',()=>{
  const original=box('small');for(const raw of [{...original},copy(original),JSON.parse(JSON.stringify(original)),null]){assert.throws(()=>translateHeldBox(raw,P(1,2,3)));assert.throws(()=>compileHeldBoxSet([{box:raw}],{id:'forged'}));}
  for(const delta of [null,P(NaN,0,0),P(Infinity,0,0),P(1e20,0,0),P(1e308,0,0)])assert.throws(()=>translateHeldBox(original,delta));
  assert.throws(()=>compileHeldBoxSet([],{id:'empty'}));assert.throws(()=>compileHeldBoxSet([{box:original,ownerId:()=> 'dynamic'}],{id:'callback'}));assert.throws(()=>compileHeldBoxSet([{box:original},{box:original}],{id:'duplicate'}));
  const before=JSON.stringify(original);assert.throws(()=>translateHeldBox(original,P(1e20,0,0)));assert.equal(JSON.stringify(original),before,'unresolved translation leaves original geometry untouched');
});
