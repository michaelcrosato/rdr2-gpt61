import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../my-3d2dge-agent.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {TRAIN_STABLE_LEAD as LEAD} from '../content/campaign/train-stable-data.js';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts} from '../src/train-preparation-body-geometry.js';
import {makeFrame,worldPoint} from '../src/rail-foundation/rigid-frame.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../src/train-held-volume.js';
import {beginPreparationStable,stepPreparationStable,validatePreparationStable,completePreparationStable,preparationCaseCleared,preparationStableApproach,preparationStableWorldGeometry,inspectPreparationStableGrip,inspectPreparationStableMotion,currentPreparationStableLead,ownsPreparationStableActor,getPreparationStableInteractions} from '../src/train-preparation-stable.js';
const raw=()=>gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString();
const old=()=>JSON.parse(raw()),copy=structuredClone,axes=['x','y','z'];
const rows=s=>capturePreparationBodyBounds(s),proof=(s,a,b,mode,geometry=preparationStableWorldGeometry(s))=>inspectPreparationStableMotion(s,{before:a,after:b,mode,geometry});
function linked(s,q){const mare={...s.entities.skein,...q},p=worldPoint(makeFrame({x:mare.x,y:mare.y,z:mare.z},{x:Math.cos(mare.facing),y:Math.sin(mare.facing),z:0}),LEAD.leaderLocal),inez={...s.entities.inez,...p,facing:mare.facing+LEAD.leaderFacingOffset,holstered:true,vx:0,vy:0};return{...s,entities:{...s.entities,inez,skein:mare}};}
const staged=()=>{const s=old();return linked(s,{vx:0,vy:0});};

test('unchanged earned PR9 prefix cannot manufacture a watch, lead or case clearance',()=>{
  const s=old(),before=JSON.stringify(s);assert.equal(beginPreparationStable(s,{worldFor:()=>null}),false);assert.equal(stepPreparationStable(s,.05,{worldFor:()=>null}),false);
  for(const value of [null,{}, {schema:2,phase:'awaiting-stable-work',leadFinishedAt:s.elapsed,final:{point:LEAD.settle}}]){assert.equal(validatePreparationStable(s,value),false);assert.equal(preparationCaseCleared(s,value),false);assert.equal(completePreparationStable(s,value),false);}
  assert.equal(JSON.stringify(s),before,'negative ownership/work attempts do not rewrite original people, stock, time or history');assert.equal(s.campaign.missions[TRAIN_ID].train.preparation.stableDuty,null);
});

test('staged native right-hand rein fit preserves actual feet, rig and healthy-hand policy at eight headings',()=>{
  const source=old(),original=JSON.stringify(source);
  for(let n=0;n<8;n++){const s=linked(source,{x:620,y:1280,z:0,facing:n*Math.PI/4,vx:0,vy:0}),hit=inspectPreparationStableGrip(s,s.entities.inez,s.entities.skein);assert.ok(hit,'detached native contact only; no actor is moved in a live campaign');assert.ok(Math.hypot(...axes.map(k=>hit.hand[k]-hit.reinEnd[k]))<=1e-5);assert.ok(hit.halter.z>hit.reinEnd.z);const r=rows(s),horse=preparationNativeBodyParts(r.find(v=>v.id==='skein'),r),human=preparationNativeBodyParts(r.find(v=>v.id==='inez'),r);assert.equal(horse.find(p=>p.id==='root-foot').halfExtents.x,14);assert.equal(human.find(p=>p.id==='root-foot').halfExtents.x,9);
    for(const bad of [{toolHeld:'other-tool'},{injured:true,handInjury:{side:'right',recovered:false}},{mounted:true},{holstered:false}])assert.equal(inspectPreparationStableGrip(s,{...s.entities.inez,...bad},s.entities.skein),null);
  }assert.equal(JSON.stringify(source),original);
});

test('staged full native coupled west/turn/south route has continuous certificates, not waypoint-only samples',()=>{
  let s=staged();const source=JSON.stringify(s),initial=rows(s);assert.ok(proof(s,initial,initial,'grip'),'finite complete grasp-arm enclosure clears the real mare/world');
  const west=linked(s,{x:620,y:1280,vx:0,vy:0}),rWest=rows(west),pWest=proof(s,initial,rWest,'west');assert.ok(pWest);assert.deepEqual(pWest.departures.map(p=>p.partId).sort(),['gait--22','tail','tail-hair']);assert.ok(pWest.departures.every(p=>p.solidId==='rival-tack-west'));
  const turned=linked(west,{x:620,y:1280,facing:LEAD.turnFacing,vx:0,vy:0}),rTurn=rows(turned),pTurn=proof(s,rWest,rTurn,'turn');assert.ok(pTurn,'all orbital intermediate parts AND own world-foot pair are enclosed');assert.ok(pTurn.intervals>1);
  const south=linked(turned,{...LEAD.settle,vx:0,vy:0}),rSouth=rows(south);assert.ok(proof(s,rTurn,rSouth,'south'));const mare=rSouth.find(r=>r.id==='skein');assert.ok(mare.volumes.every(v=>v.max.x<657),'whole native mare clears the future case, not just its root');assert.ok(mare.volumes.every(v=>v.max.y<=1400));
  assert.equal(JSON.stringify(s),source);assert.equal(s.campaign.missions[TRAIN_ID].train.preparation.stableDuty,null,'detached certificate never earns duty, arrival, elapsed, watch or Save');
});

test('initial real tack contact must strictly decrease unturned; deeper, lateral and early turns refuse',()=>{
  const s=staged(),before=rows(s);for(const [mode,q]of [['west',{x:681,y:1280}],['west',{x:679,y:1281}],['turn',{x:680,y:1280,facing:s.entities.skein.facing-.01}]])assert.equal(proof(s,before,rows(linked(s,q)),mode),null);
  assert.ok(proof(s,before,rows(linked(s,{x:678.8,y:1280})),'west'),'the finite first west step resolves only the existing named wall contact');
});

test('thin intervening wall, missing world and a false endpoint binding cannot certify held lead work',()=>{
  const s=staged(),before=rows(s),west=linked(s,{x:620,y:1280}),after=rows(west),geometry=preparationStableWorldGeometry(s),wall={id:'thin-in-between',x:649.999999,y:1200,z:0,w:.000002,h:170,height:90};assert.equal(proof(s,before,after,'west',[...geometry,wall]),null,'both roots ending clear cannot skip a whole body crossed between endpoints');
  for(const absent of [null,[],[{...wall,w:0}]])assert.equal(proof(s,before,after,'west',absent),null);
  const turn=linked(west,{facing:LEAD.turnFacing}),forged={...turn,entities:{...turn.entities,inez:{...turn.entities.inez,x:turn.entities.inez.x+1}}};assert.equal(proof(s,rows(west),rows(forged),'turn'),null,'individually valid rows must still follow the coupled orbital frame');
});

test('continuous orbital turn catches an intermediate panel despite clear native endpoints and never mutates arrays',()=>{
  const source=staged(),s=linked(source,{x:620,y:1280}),turn=linked(s,{facing:LEAD.turnFacing}),a=rows(s),b=rows(turn),before=JSON.stringify([a,b]),geometry=preparationStableWorldGeometry(s),middle=(s.entities.skein.facing+LEAD.turnFacing)/2,mid=linked(s,{facing:middle}),native=rows(mid),head=preparationNativeBodyParts(native.find(r=>r.id==='skein'),native).find(p=>p.id==='ear--1').frame.origin;
  const panel={id:'mid-turn-ear',x:head.x-.000001,y:head.y-.000001,z:head.z-.000001,w:.000002,h:.000002,height:.000002},solid=createHeldBox({id:panel.id,frame:makeFrame(head,{x:1,y:0,z:0}),halfExtents:{x:.000001,y:.000001,z:.000001}}),set=compileHeldBoxSet([{box:solid,ownerId:'mid-panel'}],{id:'mid-panel'});
  for(const endpoint of[a,b])for(const id of['inez','skein'])assert.ok(preparationNativeBodyParts(endpoint.find(r=>r.id===id),endpoint).every(part=>heldBoxContacts(part,set).length===0),'both actual native endpoint compounds clear this panel');
  assert.equal(proof(source,a,b,'turn',[...geometry,panel]),null);assert.equal(JSON.stringify([a,b]),before);
});

test('another registered body crossing between clear endpoints blocks the complete lead interval',()=>{
  const source=staged(),s={...source,entities:{...source.entities,ruth:{...source.entities.ruth,x:600,y:1200,vx:0,vy:0,facing:0}}},west=linked(s,{x:620,y:1280}),after={...west,entities:{...west.entities,ruth:{...west.entities.ruth,x:600,y:1300}}};
  assert.equal(proof(s,rows(s),rows(after),'west'),null,'the full foreign-body swept enclosure crosses the coupled path');assert.equal(source.campaign.missions[TRAIN_ID].train.preparation.stableDuty,null);
});

test('a hand-authored duty cannot make the live step move Inez or Skein without the canonical watch',()=>{
  const s=old(),p=s.campaign.missions[TRAIN_ID].train.preparation;p.stableDuty={schema:2,phase:'approach',startedAt:s.elapsed-.05,lastAdvancedAt:s.elapsed-.05,watch:{guardId:'hob'},initial:{bodyBounds:rows(s),mountOwnerId:'levi',mountOwned:true},steps:[],gripSeconds:0,local:null,facingOffset:null,leadFinishedAt:null,final:null};const before=JSON.stringify(s);
  assert.equal(stepPreparationStable(s,.05,{worldFor:()=>({id:'snowbound',width:1800,height:1400,obstacles:[]})}),false);assert.equal(JSON.stringify(s),before);assert.equal(validatePreparationStable(s,p.stableDuty),false);
  assert.equal(currentPreparationStableLead(s),null,'an assigned schema/phase cannot claim the actual native presentation');assert.equal(ownsPreparationStableActor(s,'inez'),false);assert.equal(ownsPreparationStableActor(s,'skein'),false);assert.deepEqual(getPreparationStableInteractions(s,{worldFor:()=>null}),[]);assert.equal(JSON.stringify(s),before);
});
