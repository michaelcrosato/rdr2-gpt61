import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative} from './helpers/train-preparation-route.mjs';
import {followPreparationActor} from '../src/train-preparation-navigation.js';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts,preparationPartSolid} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,createHeldBoxMotion,translateHeldBox,compileHeldSolidSet,sweepHeldBox} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('a staged room with only a north doorway retains its detour and independently clears every performed native body sweep',()=>{
 // Deliberate actor/world proximity fixture isolates routing. No positive
 // story, resource acquisition, custody, stage or whole-Save claim is made.
 const s=acceptedBriefingNative();Journey.stepCampaign(s,.1);Object.assign(s.entities.ruth,{x:1000,y:1000,z:0,facing:0,vx:0,vy:0});
 const obstacles=[{id:'west',x:1100,y:900,w:10,h:210,height:80},{id:'east',x:1300,y:900,w:10,h:210,height:80},{id:'south',x:1100,y:1100,w:210,h:10,height:80},{id:'north-west',x:1100,y:900,w:65,h:10,height:80},{id:'north-east',x:1235,y:900,w:75,h:10,height:80}],world={...Journey.worldForCampaign(s),obstacles},set=compileHeldSolidSet(obstacles.map(o=>preparationPartSolid(createHeldBox({id:o.id,frame:makeFrame({x:o.x+o.w/2,y:o.y+o.h/2,z:o.height/2},{x:1,y:0,z:0}),halfExtents:{x:o.w/2,y:o.h/2,z:o.height/2}}),'world')),{id:'independent-north-door-room'}),target={x:1200,y:1000,z:0,facing:0},player=point(s.entities.mara),guard=point(s.entities.bastian),materials=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].objects);
 let travelled=0,wentNorth=false;
 for(let i=0;i<180&&distance(s.entities.ruth,target)>.05;i++){
  Journey.stepCampaign(s,.1);const rows=capturePreparationBodyBounds(s),row=rows.find(r=>r.id==='ruth'),before=preparationNativeBodyParts({...row,pose:{...row.pose,vx:1,vy:0}},rows),from=point(s.entities.ruth),moved=followPreparationActor(s,'ruth',target,65,.1,{worldFor:()=>world}),afterRows=capturePreparationBodyBounds(s),after=preparationNativeBodyParts({...afterRows.find(r=>r.id==='ruth'),pose:{...row.pose,vx:1,vy:0}},afterRows);
  assert.ok(moved<=6.5+1e-7);assert.ok(Math.abs(distance(from,s.entities.ruth)-moved)<1e-7);assert.equal(before.length,after.length);
  const delta={x:s.entities.ruth.x-from.x,y:s.entities.ruth.y-from.y,z:0};
  for(let n=0;n<before.length;n++){assert.equal(before[n].id,after[n].id);const translated=translateHeldBox(before[n],delta);for(let v=0;v<translated.vertices.length;v++)for(const k of['x','y','z'])assert.ok(Math.abs(translated.vertices[v][k]-after[n].vertices[v][k])<1e-7,'independently reconstructed native endpoint differs only by floating-point derivation');assert.equal(sweepHeldBox(createHeldBoxMotion(before[n],translated),set,{contactMode:'interior'}).clear,true,`performed ${before[n].id} sweep at frame ${i}`);}
  travelled+=moved;wentNorth||=s.entities.ruth.y<890;assert.deepEqual(point(s.entities.mara),player);assert.deepEqual(point(s.entities.bastian),guard);
 }
 assert.ok(distance(s.entities.ruth,target)<=.05,`the actual controller reaches the interior through its only doorway: ${JSON.stringify({position:point(s.entities.ruth),facing:s.entities.ruth.facing,travelled,wentNorth})}`);assert.ok(wentNorth);assert.ok(travelled>300,'it takes a real detour instead of crossing the west wall');assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].objects,materials);
});
