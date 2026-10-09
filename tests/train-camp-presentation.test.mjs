import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';
import '../my-3d2dge-agent.js';
import * as Journey from '../src/campaign-journey.js';
import {blockedAt}from'../src/campaign-navigation.js';
import {createTrainCampPresentation,ownsTrainCampActor,clinicBottleBounds}from'../src/train-camp-presentation.js';
import {getClinicBottleHuman}from'../src/train-camp-motion.js';
import {trainPortrait}from'../src/train-portraits.js';import{castPortrait}from'../src/cast-portraits.js';
import {TRAIN_ID,TRAIN_NEW_CAST}from'../content/campaign/brass-cutting.js';
const E=globalThis.My3D2dge,copy=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z});
const raw=gunzipSync(readFileSync(new URL('./fixtures/journey-v4-rival-webkit-current-reloaded.json.gz',import.meta.url))).toString();
function walk(s,target){const w=Journey.worldForCampaign(s),size=20,cols=Math.ceil(w.width/size),rows=Math.ceil(w.height/size),point=id=>({x:id%cols*size+10,y:Math.floor(id/cols)*size+10}),cell=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size),start=cell(s.player),end=cell(target),q=[start],prev=new Map([[start,null]]);for(let n=0;n<q.length&&!prev.has(end);n++)for(const off of[1,-1,cols,-cols]){const id=q[n]+off,p=point(id),a=point(q[n]);if(id<0||id>=cols*rows||Math.abs(p.x-a.x)>size+1||prev.has(id)||blockedAt(w,p.x,p.y,9))continue;prev.set(id,q[n]);q.push(id);}assert.ok(prev.has(end));const route=[target];for(let id=end;id!==start;id=prev.get(id))route.push(point(id));for(const node of route.reverse()){for(let i=0;i<1000&&Math.hypot(s.player.x-node.x,s.player.y-node.y)>3;i++){const n=Math.hypot(s.player.x-node.x,s.player.y-node.y);Journey.stepCampaign(s,.05,{mx:(node.x-s.player.x)/n,my:(node.y-s.player.y)/n});}assert.ok(Math.hypot(s.player.x-node.x,s.player.y-node.y)<=3);}}
function clinic(){const s=Journey.restoreCampaign(raw);assert.ok(s);walk(s,{x:385,y:1270});assert.equal(Journey.beginCampaignTrainClinic(s),true);for(let i=0;i<200&&s.campaign.missions[TRAIN_ID].train.prelude.arrivals.abel.arrivedAt===null;i++)Journey.stepCampaign(s,.05);assert.ok(Journey.getCampaignInteractions(s).some(a=>a.id==='train:bedside'));return s;}
function startBottle(s){Journey.interactCampaign(s,'train:bedside');for(let i=0;s.dialog&&i<8;i++)Journey.chooseCampaign(s,'train-speech-next');assert.equal(s.dialog,null);for(let i=0;i<240;i++){Journey.stepCampaign(s,1/60);const p=s.campaign.missions[TRAIN_ID].train.prelude;if(p.bottleWork.acceptedSeconds>0&&getClinicBottleHuman(s))return;}throw Error('Actual native bottle contact did not begin');}
const ctx=()=>new Proxy({globalAlpha:1,globalCompositeOperation:'source-over',measureText:s=>({width:s.length*5})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
function render(presentation,s,view=E.VIEWS.threequarter){const pending=[],r={view,w:(x,y,z=0)=>view.p(x,y,z),visible:()=>true,shadow:()=>{},queue:(x,y,z,fn)=>pending.push({key:view.order(x,y,z),fn})};const before=JSON.stringify(s),style=JSON.stringify(E.style);presentation.draw(r,s);pending.sort((a,b)=>a.key-b.key);const g=ctx();for(const q of pending)q.fn(g);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(E.style),style);return presentation.inspect();}
async function campComposition(s){const {createSnowboundRenderer}=await import('../src/snowbound-renderer.js'),game={reduceMotion:false,cam:{x:0,y:0},view:E.VIEWS.threequarter},renderer=createSnowboundRenderer(game),pending=[],g=ctx(),view=E.VIEWS.threequarter,base={game,ctx:g,view,H:800,W:1280,bw:1280,bh:800,ix:0,iy:0,w:(x,y,z=0)=>view.p(x,y,z),visible:()=>true,queue:(x,y,z,fn)=>pending.push({key:view.order(x,y,z),fn}),actor:(x,y,z,fn)=>pending.push({key:view.order(x,y,z),fn:g=>fn(g,...view.p(x,y,z))}),overlay:fn=>pending.push({key:Infinity,fn}),shadow:()=>{},sky:()=>{},box:()=>{}};const r=new Proxy(base,{get:(o,k)=>k in o?o[k]:()=>{}});renderer.update(.05,s);renderer.draw(r,s);pending.sort((a,b)=>a.key-b.key);for(const q of pending)q.fn(g);return renderer;}

test('genuine native clinic bodies render once with distinct profiles and one actual held bottle, without state writes',()=>{
 const s=clinic(),p=createTrainCampPresentation(E),before=JSON.stringify(s);p.update(.05,s);const result=render(p,s);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(result.actors.map(a=>a.id).sort(),['abel','nell','rivet']);assert.equal(new Set(result.actors.map(a=>a.id)).size,3);assert.equal(result.objects.filter(o=>o.id==='abel-watch-bottle').length,1);assert.equal(result.actors.find(a=>a.id==='rivet').mark,'right-eye-crescent');assert.ok(result.contacts.filter(c=>c.kind==='mounted-stirrup').length===2);assert.ok(result.contacts.every(c=>c.reachable&&c.error<=1e-5));assert.deepEqual(result.errors,[]);
 assert.equal(ownsTrainCampActor(s,s.entities.abel),true);assert.equal(ownsTrainCampActor(s,{...s.entities.abel}),false,'a copied body is never a second render authority');
});

test('actual physics cached Abel skeleton is reused without duplicate update, drawing the same reachable bottle contact',()=>{
 const s=clinic();startBottle(s);const h=getClinicBottleHuman(s),rig=h.rig,old=rig.update,joints=copy(rig.J),time=rig.t,p=createTrainCampPresentation(E),accepted=s.campaign.missions[TRAIN_ID].train.prelude.bottleWork.acceptedSeconds;assert.ok(h);
 rig.update=()=>{throw Error('Drawing must not update actual physics rig a second time');};
 try{p.update(1/60,s);const result=render(p,s),contact=result.contacts.find(c=>c.actorId==='abel'&&c.kind==='bottle-setdown'),object=result.objects.find(o=>o.id==='abel-watch-bottle');assert.ok(contact?.reachable);assert.ok(contact.error<1e-5);assert.deepEqual(object.world,contact.hit);assert.equal(result.actors.find(a=>a.id==='abel').physicsHuman,true);assert.deepEqual(rig.J,joints);assert.equal(rig.t,time);}finally{rig.update=old;}
 Journey.stepCampaign(s,1/60);assert.ok(s.campaign.missions[TRAIN_ID].train.prelude.bottleWork.acceptedSeconds>accepted,'drawing preserves next actual swept contact instead of resetting work');
});

test('actual completed setdown draws same canonical bottle only at its ground location',()=>{
 const s=clinic();startBottle(s);const bottle=s.campaign.missions[TRAIN_ID].train.prelude.bottle;for(let i=0;i<240&&bottle.location.type!=='ground';i++)Journey.stepCampaign(s,1/60);assert.equal(bottle.location.type,'ground');assert.equal(getClinicBottleHuman(s),null);const p=createTrainCampPresentation(E);p.update(.05,s);const result=render(p,s),objects=result.objects.filter(o=>o.id===bottle.id);assert.equal(objects.length,1);assert.equal(objects[0].location,'ground');assert.deepEqual(objects[0].world,bottle.location.point);assert.equal(objects[0].bounds.min.z,0,'grip-centre z4 places the actual mesh base on the floor');assert.ok(Math.abs(objects[0].bounds.max.z-9.3)<1e-7);assert.ok(Object.values(objects[0].bounds).every(p=>Object.values(p).every(Number.isFinite)));assert.throws(()=>clinicBottleBounds({x:NaN,y:0,z:4}));assert.ok(!result.contacts.some(c=>c.kind==='bottle-setdown'));assert.equal(s.campaign.missions[TRAIN_ID].train.prelude.bottle,bottle);
});

test('native mounted Nell and distinct Rivet retain physical stirrup/rein contacts in eight headings and reduced motion',()=>{
 // Controlled native pose fixtures only, not arrivals/progression/public input.
 for(let i=0;i<8;i++)for(const reduced of[false,true]){const horse={...copy(TRAIN_NEW_CAST.find(a=>a.id==='rivet')),x:100,y:200,z:0,facing:i*Math.PI/4},nell={...copy(TRAIN_NEW_CAST.find(a=>a.id==='nell')),x:100,y:200,z:0,facing:horse.facing,mounted:true,mountId:'rivet'},s={region:'snowbound',entities:{nell,rivet:horse}},p=createTrainCampPresentation(E,{reduceMotion:()=>reduced});p.update(.05,s);const r=render(p,s);assert.deepEqual(r.actors.map(a=>a.id).sort(),['nell','rivet']);assert.equal(r.contacts.filter(c=>c.kind==='mounted-stirrup').length,2);assert.equal(r.contacts.filter(c=>c.kind==='mounted-rein').length,2);assert.ok(r.contacts.every(c=>c.reachable&&c.error<1e-5));assert.deepEqual(r.actors.find(a=>a.id==='nell').world,P(100,200,0));assert.ok(r.actors.find(a=>a.id==='nell').drawRoot.z>0);}
});

test('unknown introduced face has original portrait but no leaked name or knowledge mutation',()=>{
 const s=clinic();Journey.interactCampaign(s,'train:bedside');assert.equal(s.dialog.speaker,'A visitor at the shelter');const before=JSON.stringify(s),unknown=castPortrait(s.dialog.speaker,s);assert.match(unknown,/data-train-portrait="abel"/);assert.ok(!unknown.includes('Abel Sedge'));assert.equal(JSON.stringify(s),before);Journey.chooseCampaign(s,'train-speech-next');assert.match(castPortrait(s.dialog.speaker,s),/data-train-portrait="abel"/);assert.ok(s.campaign.missions[TRAIN_ID].train.prelude.knownNames.includes('abel'));
 const face=label=>trainPortrait(label,s);assert.notEqual(face('Abel Sedge'),face('Nell Sarto'));assert.match(face('Rivet'),/right-eye-crescent/);assert.equal(trainPortrait('A rider from the south road',s),null,'a different dialogue cannot reveal an unintroduced rider');
});

test('undeclared briefing table/papers never appear in the real first clinic scene',()=>{const s=clinic(),p=createTrainCampPresentation(E);p.update(.05,s);const result=render(p,s);assert.ok(!result.objects.some(o=>o.id==='train-briefing-table'||o.id==='route-diagram'||o.id==='seizure-list'));assert.equal(s.campaign.missions[TRAIN_ID].train.briefingVersion,undefined);});

test('actual Snowbound composition updates/draws each new human once and retains owning full graph',async()=>{
 const s=clinic(),before=JSON.stringify(s),oldDocument=globalThis.document,oldUpdate=E.Humanoid.prototype.update,oldDraw=E.Humanoid.prototype.draw,rigIds=new WeakMap(),updates={},draws={};
 globalThis.document={createElement:()=>({getContext:()=>ctx()})};
 E.Humanoid.prototype.update=function(dt,body){rigIds.set(this,body.id);if(['abel','nell'].includes(body.id))updates[body.id]=(updates[body.id]||0)+1;return oldUpdate.call(this,dt,body);};
 E.Humanoid.prototype.draw=function(...args){const id=rigIds.get(this);if(['abel','nell'].includes(id))draws[id]=(draws[id]||0)+1;return oldDraw.apply(this,args);};
 try{
  const renderer=await campComposition(s);
  assert.deepEqual(updates,{abel:1,nell:1});assert.deepEqual(draws,{abel:1,nell:1});assert.deepEqual(renderer.inspectTrainCampAnimation().actors.map(a=>a.id).sort(),['abel','nell','rivet']);assert.equal(JSON.stringify(s),before);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)),'drawing still leaves an accepted owning graph');
 }finally{E.Humanoid.prototype.update=oldUpdate;E.Humanoid.prototype.draw=oldDraw;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});

test('same actual resting Silas draws once in native flat bed pose before and during clinic without changing injury or attachment',async()=>{
 const sources=[Journey.restoreCampaign(raw),clinic()],oldDocument=globalThis.document,oldUpdate=E.Humanoid.prototype.update,oldDraw=E.Humanoid.prototype.draw,rigIds=new WeakMap();let poses=[];
 globalThis.document={createElement:()=>({getContext:()=>ctx()})};E.Humanoid.prototype.update=function(dt,body){rigIds.set(this,body.id);return oldUpdate.call(this,dt,body);};E.Humanoid.prototype.draw=function(...args){if(rigIds.get(this)==='silas')poses.push(this.downW);return oldDraw.apply(this,args);};
 try{for(const s of sources){const before=JSON.stringify(s),patient=s.entities.silas;assert.equal(patient.attachment.type,'rest');assert.equal(patient.attachment.targetId,'silas-bed');poses=[];const renderer=await campComposition(s);assert.deepEqual(poses,[1]);assert.deepEqual(renderer.inspectRestingPatient().drawn,['silas'],'scoped drawer owns only existing patient, not another player/companion');assert.equal(s.entities.silas,patient);assert.equal(JSON.stringify(s),before);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)));}}
 finally{E.Humanoid.prototype.update=oldUpdate;E.Humanoid.prototype.draw=oldDraw;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
