import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative} from './helpers/train-preparation-route.mjs';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {TRAIN_MASK_V3_APPROACHES} from '../content/campaign/train-gear-data.js';
import {followPreparationActor,claimPreparationMovementFrame} from '../src/train-preparation-navigation.js';
import {preparationNativeBodyParts,preparationPartSolid} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,compileHeldSolidSet,heldBoxContacts} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
const ctx={worldFor:Journey.worldForCampaign},position=a=>({x:a.x,y:a.y,z:a.z||0}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){return structuredClone(acceptedBriefingNative());}
function footIntersects(s,id,otherId){const rows=capturePreparationBodyBounds(s),a=rows.find(r=>r.id===id),b=rows.find(r=>r.id===otherId),box=createHeldBox({id:'independent-foot-probe',frame:makeFrame({x:a.point.x,y:a.point.y,z:a.point.z+a.height/2},{x:1,y:0,z:0}),halfExtents:{x:a.radius,y:a.radius,z:a.height/2}}),set=compileHeldSolidSet(preparationNativeBodyParts(b,rows).map(p=>preparationPartSolid(p,b.id)),{id:'independent-native-foreign'});return heldBoxContacts(box,set).some(h=>h.interiorOverlap);}


test('actual native Ada makes bounded decreasing-overlap steps past Gideon/Neri to the authored mask approach',()=>{
  const s=acceptedBriefingNative(),before={ada:position(s.entities.ada),mara:position(s.entities.mara),guard:position(s.entities.bastian),inventory:structuredClone(s.inventory),weapons:structuredClone(s.weapons)},target=TRAIN_MASK_V3_APPROACHES.ada;
  assert.ok(footIntersects(s,'ada','neri'));assert.ok(footIntersects(s,'ada','gideon'));const steps=[];
  for(let i=0;i<200&&(dist(s.entities.ada,target)>.05||Math.abs(Math.atan2(Math.sin((s.entities.ada.facing||0)-target.facing),Math.cos((s.entities.ada.facing||0)-target.facing)))>1e-6);i++){
    Journey.stepCampaign(s,.1);const start=position(s.entities.ada),d=followPreparationActor(s,'ada',target,65,.1,ctx);assert.ok(d<=6.5+1e-7);steps.push(d);assert.ok(dist(start,s.entities.ada)<=6.5+1e-7);
    const after=position(s.entities.ada);assert.equal(followPreparationActor(s,'ada',target,65,.1,ctx),0,'same accepted frame cannot move Ada twice');assert.deepEqual(position(s.entities.ada),after);
  }
  assert.ok(steps.some(d=>d>0));assert.ok(dist(s.entities.ada,target)<=.05);assert.equal(footIntersects(s,'ada','neri'),false);assert.equal(footIntersects(s,'ada','gideon'),false);assert.deepEqual(position(s.entities.mara),before.mara);assert.deepEqual(position(s.entities.bastian),before.guard);assert.deepEqual(s.inventory,before.inventory);assert.deepEqual(s.weapons,before.weapons);
});

test('navigation never moves Mara, current guard, mounted/attached/dead/bound/tool-holding people or a mount',()=>{
  for(const [id,change]of [['mara',{}],['bastian',{}],['skein',{}],['ruth',{mounted:true}],['ruth',{attachment:{type:'rest',targetId:'levi-holding-anchor',regionId:'snowbound'}}],['ruth',{hp:0}],['ruth',{bound:true}],['ruth',{toolHeld:'current-tool'}]]){
    const s=fixture();Object.assign(s.entities[id],change);const before=structuredClone(s.entities[id]);assert.equal(followPreparationActor(s,id,{x:1000,y:1000,z:0},65,.1,ctx),0);assert.deepEqual(s.entities[id],before);
  }
});

test('an occupied destination waits without rotating a currently clear native footprint',()=>{
 // Explicit proximity geometry to isolate waiting, not earned travel/Save.
 const s=fixture();Object.assign(s.entities.ruth,{x:1000,y:1000,z:0,facing:Math.PI/2,vx:0,vy:0});Object.assign(s.entities.neri,{x:1200,y:1000,z:0});const before=structuredClone(s.entities.ruth),blocker=structuredClone(s.entities.neri);assert.equal(followPreparationActor(s,'ruth',{x:1200,y:1000,z:0},65,.05,ctx),0);assert.deepEqual(s.entities.ruth,before);assert.deepEqual(s.entities.neri,blocker);
});

test('a clear authored arrival permits safe local progress when its wider travel pose would touch a thin panel',()=>{
 // Explicit geometry fixture isolates the arrival-orientation counterexample;
 // it earns no campaign travel, work, custody or Save acceptance.
 const s=fixture();Object.assign(s.entities.ruth,{x:1000,y:1000,z:0,facing:0,vx:0,vy:0});
 const panel={id:'arrival-side-panel',x:1182,y:970,z:0,w:1,h:60,height:75},world={...Journey.worldForCampaign(s),obstacles:[panel]},target={x:1200,y:1000,z:0,facing:Math.PI/2},rows=capturePreparationBodyBounds(s),source=rows.find(r=>r.id==='ruth'),set=compileHeldSolidSet([{id:panel.id,vertices:createHeldBox({id:panel.id,frame:makeFrame({x:1182.5,y:1000,z:37.5},{x:1,y:0,z:0}),halfExtents:{x:.5,y:30,z:37.5}}).vertices,faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]}],{id:'arrival-panel-world'});
 const arrivalParts=facing=>preparationNativeBodyParts({...source,point:{x:target.x,y:target.y,z:0},pose:{...source.pose,facing,vx:1,vy:0}},rows);
 assert.ok(arrivalParts(0).some(p=>heldBoxContacts(p,set).some(h=>h.interiorOverlap)),'the current travel orientation really touches the panel');
 assert.equal(arrivalParts(target.facing).some(p=>heldBoxContacts(p,set).some(h=>h.interiorOverlap)),false,'the requested full walking arrival really clears it');
 const guard=structuredClone(s.entities.bastian),player=structuredClone(s.entities.mara),before=position(s.entities.ruth);
 const moved=followPreparationActor(s,'ruth',target,65,.1,{worldFor:()=>world});
 assert.ok(moved>0&&moved<=6.5+1e-7,'the remote clear arrival does not prevent a bounded locally checked step');
 assert.ok(Math.abs(dist(before,s.entities.ruth)-moved)<1e-7);
 const currentRows=capturePreparationBodyBounds(s),current=currentRows.find(r=>r.id==='ruth');
 assert.equal(preparationNativeBodyParts(current,currentRows).some(p=>heldBoxContacts(p,set).some(h=>h.interiorOverlap)),false,'the performed travel body still clears the panel');
 assert.deepEqual(s.entities.bastian,guard);assert.deepEqual(s.entities.mara,player);
});

test('fixed movement owners share one accepted-frame allowance with generic navigation',()=>{
 const s=acceptedBriefingNative(),before=structuredClone(s.entities.ada);assert.equal(claimPreparationMovementFrame(s,'ada'),true);assert.equal(claimPreparationMovementFrame(s,'ada'),false);assert.equal(followPreparationActor(s,'ada',{x:390,y:1160,z:0},65,.05,ctx),0);assert.deepEqual(s.entities.ada,before);assert.equal(claimPreparationMovementFrame(s,'missing'),false);Journey.stepCampaign(s,.05);assert.equal(claimPreparationMovementFrame(s,'ada'),true,'an actual new accepted frame receives one new allowance');assert.equal(claimPreparationMovementFrame(s,'ada'),false);
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
  const a=fixture(),b=fixture();b.entities.neri.hidden=true;b.entities.neri.departed=true;const target=TRAIN_MASK_V3_APPROACHES.ada;
  const first=followPreparationActor(a,'ada',target,65,.1,ctx),second=followPreparationActor(b,'ada',target,65,.1,ctx);assert.equal(second,first);assert.deepEqual(position(b.entities.ada),position(a.entities.ada));
});

test('incompatible inherited penetrations and malformed step budgets refuse rather than ghost',()=>{
  const s=fixture();Object.assign(s.entities.ruth,{x:500,y:500,z:0,vx:0,vy:0});const base=Journey.worldForCampaign(s),world={...base,obstacles:[{id:'left',x:480,y:480,w:25,h:40,height:70},{id:'right',x:495,y:480,w:25,h:40,height:70}]},old=position(s.entities.ruth);
  assert.equal(followPreparationActor(s,'ruth',{x:500,y:600,z:0},65,.1,{worldFor:()=>world}),0);assert.deepEqual(position(s.entities.ruth),old);
  for(const [speed,dt]of [[1e9,.1],[65,1],[65,0],[NaN,.1]])assert.equal(followPreparationActor(s,'ruth',{x:600,y:500,z:0},speed,dt,ctx),0);
  const broken=fixture(),before=structuredClone(broken.entities.ruth);assert.equal(followPreparationActor(broken,'ruth',{x:1000,y:1000,z:0},65,.1,{worldFor:()=>({...base,obstacles:[{id:'invalid',x:NaN,y:0,w:1,h:1}]})}),0);assert.deepEqual(broken.entities.ruth,before);
});


test('genuine inherited Inez and Hob contacts permit bounded real native separation with unchanged guard, materials and whole Save',()=>{
 for(const [id,target]of [['inez',{x:865,y:1207,z:0}],['hob',{x:885,y:1270,z:0}]]){
  const s=acceptedBriefingNative();Journey.stepCampaign(s,.05);const bodies=structuredClone(s.entities),materials=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].objects),score=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].performance),start=position(s.entities[id]),d=followPreparationActor(s,id,target,65,.05,ctx);
  assert.ok(d>0&&d<=3.25+1e-7,`${id} makes a bounded actual separation step`);assert.ok(Math.abs(dist(start,s.entities[id])-d)<1e-7);assert.equal(s.entities[id].facing,bodies[id].facing,'inherited separation does not turn the body through its neighbour');
  for(const [other,body]of Object.entries(bodies))if(other!==id)assert.deepEqual(s.entities[other],body,'the requested NPC is the only changed body');assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].objects,materials);assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].performance,score);assert.equal(s.campaign.missions['snowbound-the-names-they-took'].captivity.guardId,'bastian');
  const raw=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(raw);assert.ok(restored);assert.equal(Journey.serializeCampaign(restored),raw,'actual finite separation is a valid whole graph, without any handover credit');
 }
});
