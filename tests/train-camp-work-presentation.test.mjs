import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,clinicCompleteNative,moveNative,trainRecord,interactNative} from './helpers/train-clinic-route.mjs';
import {activeTrainCampWorkPose,ownsTrainCampActor} from '../src/train-camp-presentation.js';
import {getTrainCampWorkPose} from '../src/train-camp-work.js';
import {TRAIN_BRIEFING_APPROACHES,TRAIN_BRIEFING_HANDOFF_APPROACH,TRAIN_BRIEFING_PAPER_CONTACTS} from '../content/campaign/train-camp.js';

// These tests start with genuine checked-in prior-story bytes and earn clinic,
// setup, handoff and layout through actual movement, offered verbs and ticks.
// The fake canvas observes composition; it is not a browser or full Train proof.
const E=globalThis.My3D2dge,RIVAL='snowbound-the-names-they-took';
const closePoint=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-6,`actual contact ${JSON.stringify(a)} reaches ${JSON.stringify(b)}`);
const context=()=>new Proxy({globalAlpha:1,globalCompositeOperation:'source-over',measureText:s=>({width:s.length*5})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
function until(s,predicate,label,max=800){for(let i=0;!predicate()&&i<max;i++){Journey.stepCampaign(s,.05);assert.equal(s.failure,null,label);}assert.ok(predicate(),label);}
function beginSetup(name){const s=clinicCompleteNative(name);moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);Journey.campaignAction(s,'holster');interactNative(s,'train:brief-call');return s;}
function whole(s){assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)),'the unchanged owning graph restores');}

async function composition(s,workIds=[]){
 const {createSnowboundRenderer}=await import('../src/snowbound-renderer.js'),oldDocument=globalThis.document,oldUpdate=E.Humanoid.prototype.update,oldDraw=E.Humanoid.prototype.draw,rigIds=new WeakMap(),updates={},draws={},origins={},shared=[];
 for(const id of workIds){const entry=getTrainCampWorkPose(s,id);assert.ok(entry);rigIds.set(entry.human.rig,id);shared.push({id,rig:entry.human.rig,joints:structuredClone(entry.human.rig.J),time:entry.human.rig.t});}
 globalThis.document={createElement:()=>({getContext:()=>context()})};
 E.Humanoid.prototype.update=function(dt,body){rigIds.set(this,body.id);if(['mara','tomas','della'].includes(body.id))updates[body.id]=(updates[body.id]||0)+1;assert.ok(!shared.some(e=>e.rig===this),'the actual physics skeleton must not receive a second update');return oldUpdate.call(this,dt,body);};
 E.Humanoid.prototype.draw=function(...args){const id=rigIds.get(this);if(['mara','tomas','della'].includes(id)){draws[id]=(draws[id]||0)+1;(origins[id]??=[]).push(args.slice(1,3));}return oldDraw.apply(this,args);};
 const before=JSON.stringify(s),style=JSON.stringify(E.style);
 try{
  const game={reduceMotion:false,cam:{x:0,y:0},view:E.VIEWS.threequarter},renderer=createSnowboundRenderer(game),pending=[],g=context(),view=game.view,base={game,ctx:g,view,H:800,W:1280,bw:1280,bh:800,ix:0,iy:0,w:(x,y,z=0)=>view.p(x,y,z),visible:()=>true,queue:(x,y,z,fn)=>pending.push({key:view.order(x,y,z),fn}),actor:(x,y,z,fn)=>pending.push({key:view.order(x,y,z),fn:g=>fn(g,...view.p(x,y,z))}),overlay:fn=>pending.push({key:Infinity,fn}),shadow:()=>{},sky:()=>{},box:()=>{}};
  renderer.update(.05,s);renderer.draw(new Proxy(base,{get:(o,k)=>k in o?o[k]:()=>{}}),s);pending.sort((a,b)=>a.key-b.key);for(const q of pending)q.fn(g);
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(E.style),style);
  for(const item of shared){assert.equal(updates[item.id]||0,0);assert.equal(draws[item.id],1,'one actual actor has one drawer');assert.deepEqual(item.rig.J,item.joints);assert.equal(item.rig.t,item.time);}
  const result=renderer.inspectTrainCampAnimation();assert.deepEqual(result.errors,[]);whole(s);return{...result,composition:{updates,draws,origins}};
 }finally{E.Humanoid.prototype.update=oldUpdate;E.Humanoid.prototype.draw=oldDraw;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
}

test('actual setup hands reuse both physics humans only while reachable work is current; table appears once after completion',async()=>{
 const s=beginSetup();
 assert.equal(activeTrainCampWorkPose(s,s.entities.tomas),null,'approaching actors remain in their ordinary walking drawer');
 until(s,()=>trainRecord(s).train.briefing.setup.acceptedSeconds>=.2,'actual accepted setup contact');
 for(const id of ['tomas','della'])assert.equal(activeTrainCampWorkPose(s,s.entities[id])?.kind,'setup');
 let result=await composition(s,['tomas','della']);assert.ok(!result.objects.some(o=>o.id==='train-briefing-table'));
 for(const id of ['tomas','della']){const entry=getTrainCampWorkPose(s,id),contact=result.contacts.find(c=>c.actorId===id&&c.kind==='briefing-setup');assert.ok(contact?.reachable);closePoint(contact.hit,entry.contact);}
 until(s,()=>trainRecord(s).train.briefing.setup.finishedAt!==null,'real setup finishes');
 for(const id of ['tomas','della']){assert.ok(getTrainCampWorkPose(s,id),'the same-elapsed provider can still contain its last contact');assert.equal(ownsTrainCampActor(s,s.entities[id]),false,'completed cache never takes ownership');}
 result=await composition(s);assert.equal(result.objects.filter(o=>o.id==='train-briefing-table').length,1);assert.ok(!result.objects.some(o=>Object.hasOwn(TRAIN_BRIEFING_PAPER_CONTACTS,o.id)));
});

test('on-foot Tomas in the actual phase-one camp draws at his body instead of the unrelated first mount',async()=>{
 const s=clinicCompleteNative(),t=s.entities.tomas;assert.equal(trainRecord(s).mission.stage,1);assert.equal(!!t.mounted,false);assert.equal(ownsTrainCampActor(s,t),false);assert.notEqual(s.mounts[0].id,'tomas-mount');
 const result=await composition(s),expected=E.VIEWS.threequarter.p(t.x,t.y,t.z||0);assert.equal(result.composition.draws.tomas,1);assert.deepEqual(result.composition.origins.tomas,[expected]);assert.notDeepEqual(expected,E.VIEWS.threequarter.p(s.mounts[0].x,s.mounts[0].y,0));
});

test('genuine borrowed sheets hand off once between both actual native hands, then each original is laid once at its real slot',async()=>{
 const s=beginSetup('train-briefing-borrowed-prerequisites-v4-native');until(s,()=>trainRecord(s).train.briefing.setup.finishedAt!==null,'borrowed setup');
 moveNative(s,{x:650,y:TRAIN_BRIEFING_HANDOFF_APPROACH.y});moveNative(s,TRAIN_BRIEFING_HANDOFF_APPROACH);
 const t=s.entities.tomas,d=Math.hypot(t.x-s.player.x,t.y-s.player.y);Journey.stepCampaign(s,.01,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});interactNative(s,'train:brief-return-papers');
 until(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='return-papers'&&w.acceptedSeconds>=.2),'actual handoff contact');
 for(const id of ['mara','tomas'])assert.equal(activeTrainCampWorkPose(s,s.entities[id])?.kind,'handoff');
 let result=await composition(s,['mara','tomas']);
 const contacts=result.contacts.filter(c=>c.kind==='briefing-paper-handoff');assert.equal(contacts.length,2);assert.deepEqual(contacts[0].hit,contacts[1].hit);
 for(const id of Object.keys(TRAIN_BRIEFING_PAPER_CONTACTS)){const rows=result.objects.filter(o=>o.id===id);assert.equal(rows.length,1);assert.equal(rows[0].owner,'mara');assert.deepEqual(rows[0].world,contacts[0].hit);assert.equal(s.campaign.missions[RIVAL].objects[id].owner,'mara');}
 until(s,()=>s.campaign.missions[RIVAL].objects['route-diagram'].owner==='tomas','real shared handoff finishes');
 assert.equal(activeTrainCampWorkPose(s,s.entities.mara),null);assert.equal(activeTrainCampWorkPose(s,s.entities.tomas),null);whole(s);moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);
 for(const id of Object.keys(TRAIN_BRIEFING_PAPER_CONTACTS)){
  interactNative(s,`train:brief-layout:${id}`);until(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='move-object'&&w.acceptedSeconds>=.2),`real ${id} layout contact`);
  assert.equal(activeTrainCampWorkPose(s,s.entities.tomas)?.objectId,id);result=await composition(s,['tomas']);const paper=result.objects.filter(o=>o.id===id);assert.equal(paper.length,1);assert.equal(paper[0].location,'carried');assert.equal(paper[0].owner,'tomas');const hand=result.contacts.find(c=>c.actorId==='tomas'&&c.kind==='briefing-paper-layout');assert.deepEqual(paper[0].world,hand.hit);
  until(s,()=>s.campaign.missions[RIVAL].objects[id].location.targetId===TRAIN_BRIEFING_PAPER_CONTACTS[id].id,`real ${id} placement`);assert.equal(activeTrainCampWorkPose(s,s.entities.tomas),null,'an old contact cannot draw a placed original at the hand');
  result=await composition(s);const placed=result.objects.filter(o=>o.id===id);assert.equal(placed.length,1);assert.equal(placed[0].location,'station');assert.deepEqual(placed[0].world,{x:TRAIN_BRIEFING_PAPER_CONTACTS[id].x,y:TRAIN_BRIEFING_PAPER_CONTACTS[id].y,z:TRAIN_BRIEFING_PAPER_CONTACTS[id].z});whole(s);
 }
 assert.equal(result.objects.filter(o=>o.id==='train-briefing-table').length,1);assert.equal(result.objects.filter(o=>Object.hasOwn(TRAIN_BRIEFING_PAPER_CONTACTS,o.id)).length,2);
});
