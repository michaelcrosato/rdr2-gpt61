import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative} from './helpers/train-preparation-route.mjs';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {TRAIN_MASK_APPROACHES} from '../content/campaign/train-gear-data.js';
import {followPreparationActor} from '../src/train-preparation-navigation.js';
const ctx={worldFor:Journey.worldForCampaign},position=a=>({x:a.x,y:a.y,z:a.z||0}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){return structuredClone(acceptedBriefingNative());}
function footIntersects(s,id,otherId){const rows=capturePreparationBodyBounds(s),a=rows.find(r=>r.id===id),b=rows.find(r=>r.id===otherId),p=a.point,r=a.radius;return b.volumes.some(v=>p.x+r>v.min.x+1e-7&&p.x-r<v.max.x-1e-7&&p.y+r>v.min.y+1e-7&&p.y-r<v.max.y-1e-7&&p.z+a.height>v.min.z+1e-7&&p.z<v.max.z-1e-7);}

test('actual native Ada makes bounded decreasing-overlap steps past Gideon/Neri to the authored mask approach',()=>{
  const s=acceptedBriefingNative(),before={ada:position(s.entities.ada),mara:position(s.entities.mara),guard:position(s.entities.bastian),inventory:structuredClone(s.inventory),weapons:structuredClone(s.weapons)},target=TRAIN_MASK_APPROACHES.ada;
  assert.ok(footIntersects(s,'ada','neri'));assert.ok(footIntersects(s,'ada','gideon'));const steps=[];
  for(let i=0;i<10&&dist(s.entities.ada,target)>.05;i++){
    Journey.stepCampaign(s,.1);const start=position(s.entities.ada),d=followPreparationActor(s,'ada',target,65,.1,ctx);assert.ok(d<=6.5+1e-7);steps.push(d);assert.ok(s.entities.ada.x>=start.x-1e-7);
    const after=position(s.entities.ada);assert.equal(followPreparationActor(s,'ada',target,65,.1,ctx),0,'same accepted frame cannot move Ada twice');assert.deepEqual(position(s.entities.ada),after);
  }
  assert.ok(steps.some(d=>d>0));assert.ok(dist(s.entities.ada,target)<=.05);assert.equal(footIntersects(s,'ada','neri'),false);assert.equal(footIntersects(s,'ada','gideon'),false);assert.deepEqual(position(s.entities.mara),before.mara);assert.deepEqual(position(s.entities.bastian),before.guard);assert.deepEqual(s.inventory,before.inventory);assert.deepEqual(s.weapons,before.weapons);
});

test('navigation never moves Mara, current guard, mounted/attached/dead/bound/tool-holding people or a mount',()=>{
  for(const [id,change]of [['mara',{}],['bastian',{}],['skein',{}],['ruth',{mounted:true}],['ruth',{attachment:{type:'rest',targetId:'levi-holding-anchor',regionId:'snowbound'}}],['ruth',{hp:0}],['ruth',{bound:true}],['ruth',{toolHeld:'current-tool'}]]){
    const s=fixture();Object.assign(s.entities[id],change);const before=structuredClone(s.entities[id]);assert.equal(followPreparationActor(s,id,{x:1000,y:1000,z:0},65,.1,ctx),0);assert.deepEqual(s.entities[id],before);
  }
});

test('staged inherited guard overlap cannot be used to walk Ruth through or move Bastian',()=>{
  // Explicit geometry placement only, not earned mission/state/Save proof.
  const s=fixture();Object.assign(s.entities.ruth,{x:747,y:1220,z:0,vx:0,vy:0});Object.assign(s.entities.bastian,{x:747,y:1232,z:0,vx:0,vy:0});const guard=structuredClone(s.entities.bastian);
  assert.ok(footIntersects(s,'ruth','bastian'));const d=followPreparationActor(s,'ruth',{x:747,y:1260,z:0},65,.1,ctx);assert.ok(d<=6.5+1e-7);assert.ok(s.entities.ruth.y<=1220+1e-7,'separation cannot first deepen entry toward the guard');assert.deepEqual(s.entities.bastian,guard);
});

test('normal staged approach stays outside every occupied guard volume and base wall',()=>{
  const s=fixture();Object.assign(s.entities.ruth,{x:747,y:1190,z:0,vx:0,vy:0});Object.assign(s.entities.bastian,{x:747,y:1232,z:0,vx:0,vy:0});
  assert.equal(footIntersects(s,'ruth','bastian'),false);for(let i=0;i<20;i++){s.elapsed+=.1;const old=position(s.entities.ruth);followPreparationActor(s,'ruth',{x:747,y:1280,z:0},65,.1,ctx);assert.ok(dist(old,s.entities.ruth)<=6.5+1e-7);assert.equal(footIntersects(s,'ruth','bastian'),false);}
});

test('registered physical bodies are not omitted merely by hidden/departed flags',()=>{
  const a=fixture(),b=fixture();b.entities.neri.hidden=true;b.entities.neri.departed=true;const target=TRAIN_MASK_APPROACHES.ada;
  const first=followPreparationActor(a,'ada',target,65,.1,ctx),second=followPreparationActor(b,'ada',target,65,.1,ctx);assert.equal(second,first);assert.deepEqual(position(b.entities.ada),position(a.entities.ada));
});

test('incompatible inherited penetrations and malformed step budgets refuse rather than ghost',()=>{
  const s=fixture();Object.assign(s.entities.ruth,{x:500,y:500,z:0,vx:0,vy:0});const base=Journey.worldForCampaign(s),world={...base,obstacles:[{id:'left',x:480,y:480,w:25,h:40,height:70},{id:'right',x:495,y:480,w:25,h:40,height:70}]},old=position(s.entities.ruth);
  assert.equal(followPreparationActor(s,'ruth',{x:500,y:600,z:0},65,.1,{worldFor:()=>world}),0);assert.deepEqual(position(s.entities.ruth),old);
  for(const [speed,dt]of [[1e9,.1],[65,1],[65,0],[NaN,.1]])assert.equal(followPreparationActor(s,'ruth',{x:600,y:500,z:0},speed,dt,ctx),0);
  const broken=fixture(),before=structuredClone(broken.entities.ruth);assert.equal(followPreparationActor(broken,'ruth',{x:1000,y:1000,z:0},65,.1,{worldFor:()=>({...base,obstacles:[{id:'invalid',x:NaN,y:0,w:1,h:1}]})}),0);assert.deepEqual(broken.entities.ruth,before);
});
