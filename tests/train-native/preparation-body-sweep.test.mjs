import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from '../helpers/train-preparation-route.mjs';
import {interactNative,chooseNative} from '../helpers/train-clinic-route.mjs';
import {TRAIN_STORE_MARA,TRAIN_CHILD_CONTACTS} from '../../content/campaign/train-preparation-camp.js';
import {capturePreparationBodyBounds} from '../../src/train-preparation-layout.js';
import {createTrainPreparationWorkProvider,sweptPreparationBodyBounds} from '../../src/train-preparation-work.js';

const clone=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z}),inside=(p,b)=>p.x>=b.x-1e-8&&p.x<=b.x+b.w+1e-8&&p.y>=b.y-1e-8&&p.y<=b.y+b.h+1e-8&&p.z>=b.z-1e-8&&p.z<=b.z+b.height+1e-8;
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
// Independent authored horse-envelope corners. The native Willow/Rival horse
// bound is asymmetric [-44,+60] forward, ±26 across, and at least90 high.
function corners(root,yaw){const c=Math.cos(yaw),s=Math.sin(yaw),out=[];for(const x of[-44,60])for(const y of[-26,26])for(const z of[0,90])out.push(P(root.x+c*x-s*y,root.y+s*x+c*y,root.z+z));return out;}
function horse(root,yaw,pose='standing'){
  const points=corners(root,yaw),min=k=>Math.min(...points.map(p=>p[k])),max=k=>Math.max(...points.map(p=>p[k]));
  return{id:'skein:0',bodyId:'skein',rootPoint:clone(root),bodyFacing:yaw,bodyPose:pose,bodyRadiusXY:Math.hypot(60,26),bodyMinZ:root.z,bodyMaxZ:root.z+90,x:min('x'),y:min('y'),z:min('z'),w:max('x')-min('x'),h:max('y')-min('y'),height:max('z')-min('z')};
}

test('horse0→π sweep includes the independently computed mid-yaw body and actual authored inspection target',()=>{
  const root=P(760,1298),previous=[horse(root,0)],current=[horse(root,Math.PI)],target=TRAIN_CHILD_CONTACTS['quarry-sealed-charge-1'].grip;
  assert.ok(!inside(target,previous[0])&&!inside(target,current[0]),'both endpoint projections are clear');assert.ok(inside(target,horse(root,Math.PI/2)),'the hand target is inside the intervening full body');
  const [sweep]=sweptPreparationBodyBounds(previous,current);assert.ok(inside(target,sweep));
  // The independent circumradius bounds all yaw angles, including ones that
  // maximize corner projection between endpoint and midpoint orientations.
  const radius=Math.hypot(60,26);assert.ok(Math.abs(sweep.x-(root.x-radius))<1e-8);assert.ok(Math.abs(sweep.y-(root.y-radius))<1e-8);
  for(let i=0;i<=257;i++)for(const p of corners(root,Math.PI*i/257))assert.ok(inside(p,sweep),`actual corner at yaw fraction ${i}/257 is contained`);
});

test('constant-pose translation encloses every translated full body without mutating source arrays',()=>{
  const previous=freeze([horse(P(100,200,3),0)]),current=freeze([horse(P(140,180,8),0)]),before=JSON.stringify({previous,current}),[sweep]=sweptPreparationBodyBounds(previous,current);
  assert.equal(JSON.stringify({previous,current}),before);assert.notEqual(sweep,current[0]);
  assert.deepEqual({x:sweep.x,y:sweep.y,z:sweep.z,w:sweep.w,h:sweep.h,height:sweep.height},{x:56,y:154,z:3,w:144,h:72,height:95});
  for(let i=0;i<=31;i++){const u=i/31;for(const p of corners(P(100+40*u,200-20*u,3+5*u),0))assert.ok(inside(p,sweep));}
});

test('turning plus translation and a changed body pose retain the whole body and vertical span',()=>{
  const a=horse(P(100,200,3),0),b=horse(P(140,180,8),Math.PI,'moving'),source=freeze({a:clone(a),b:clone(b)}),before=JSON.stringify(source),[sweep]=sweptPreparationBodyBounds([source.a],[source.b]);
  for(let i=0;i<=127;i++){const u=i/127;for(const p of corners(P(100+40*u,200-20*u,3+5*u),Math.PI*u))assert.ok(inside(p,sweep));}
  assert.equal(JSON.stringify(source),before);assert.ok(sweep.z<=3&&sweep.z+sweep.height>=98);
  const poseOnly={...b,bodyFacing:0},[poseSweep]=sweptPreparationBodyBounds([a],[poseOnly]);assert.ok(inside(P(100,200-Math.hypot(60,26),3),poseSweep),'a changed pose receives the full horizontal envelope even at unchanged yaw');
});

let originalPendingBytes;
function pendingNativeBytes(){
  if(originalPendingBytes)return originalPendingBytes;
  // Genuine prior Save, real clinic/briefing, ordinary player movement and
  // offered preparation verbs earn this base. No body/HP/stock/time/stage is
  // assigned while building it. Later probes are explicitly staged negatives.
  const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});interactNative(s,'train:prepare-call');moveNative(s,TRAIN_STORE_MARA);interactNative(s,'train:prepare-talk:store');
  for(let i=0;i<400&&!s.dialog;i++)Journey.stepCampaign(s,.05);assert.ok(s.dialog);while(s.dialog)chooseNative(s,'train-prepare-next');
  interactNative(s,'train:prepare-inspect:quarry-sealed-charge-1');for(let i=0;i<400&&!trainRecord(s).train.powder.pending.some(w=>w.kind==='inspect-child-seal');i++)Journey.stepCampaign(s,.05);
  assert.ok(trainRecord(s).train.powder.pending.some(w=>w.kind==='inspect-child-seal'),'actual original inspection work exists');originalPendingBytes=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(originalPendingBytes));return originalPendingBytes;
}
function stagedContact(){
  const s=Journey.restoreCampaign(pendingNativeBytes()),slot=TRAIN_CHILD_CONTACTS['quarry-sealed-charge-1'];assert.ok(s);
  // STAGED provider component inputs only. They never become positive Save,
  // earned travel, accepted work time, stock changes or whole-route evidence.
  Object.assign(s.entities.mara,TRAIN_STORE_MARA,{vx:0,vy:0});Object.assign(s.entities.ruth,slot.approach,{vx:0,vy:0});Object.assign(s.entities.skein,{x:760,y:1298,z:0,facing:0,vx:0,vy:0});
  const pending=trainRecord(s).train.powder.pending.find(w=>w.kind==='inspect-child-seal'),op=trainRecord(s).train.powder.physicalEvents.find(e=>e.id===pending.workId).data.operation;
  const provider=createTrainPreparationWorkProvider(globalThis.My3D2dge,Journey.worldForCampaign),ctx=provider.context(s,{prepareCampWork(){}},.05);
  return{s,ctx,op};
}
function endpoint(f){const before=JSON.stringify(f.s),w=f.ctx.powderContactWindow(f.s,f.op,{start:f.s.elapsed,finish:f.s.elapsed});assert.equal(JSON.stringify(f.s),before,'a physical endpoint query writes no body, stock or progress');return w;}

test('actual native provider refuses the original staged rotating-horse interval despite clear endpoint hands',()=>{
  const f=stagedContact();f.ctx.prepareCampWork(f.s);assert.equal(endpoint(f).sweptClear,true,'the original endpoint is genuinely clear');const start=f.s.elapsed;
  f.s.elapsed+=.05;f.s.entities.skein.facing=Math.PI;
  const before=JSON.stringify(f.s),w=f.ctx.powderContactWindow(f.s,f.op,{start,finish:f.s.elapsed});assert.equal(JSON.stringify(f.s),before);assert.equal(w.sweptClear,false,'the mid-yaw occupied body blocks accepted contact');
  f.s.entities.skein.facing=Math.PI/2;const middle=capturePreparationBodyBounds(f.s).find(r=>r.id==='skein').volumes[0],target=TRAIN_CHILD_CONTACTS['quarry-sealed-charge-1'].grip;
  assert.ok(target.x>middle.min.x&&target.x<middle.max.x&&target.y>middle.min.y&&target.y<middle.max.y&&target.z>middle.min.z&&target.z<middle.max.z);
});

test('native static contact remains available with an actual preceding body sample (staged component control)',()=>{
  const f=stagedContact();f.ctx.prepareCampWork(f.s);assert.equal(endpoint(f).sweptClear,true);const start=f.s.elapsed;f.s.elapsed+=.05;
  const before=JSON.stringify(f.s),w=f.ctx.powderContactWindow(f.s,f.op,{start,finish:f.s.elapsed});assert.equal(w.sweptClear,true);assert.equal(JSON.stringify(f.s),before);
});

test('missing and stale predecessor body samples refuse nonzero native spans but permit current endpoint queries',()=>{
  const missing=stagedContact();assert.equal(endpoint(missing).sweptClear,true);const start=missing.s.elapsed;missing.s.elapsed+=.05;missing.s.entities.skein.facing=Math.PI;
  assert.equal(missing.ctx.powderContactWindow(missing.s,missing.op,{start,finish:missing.s.elapsed}).sweptClear,false,'an arm endpoint cache does not substitute for prior other-body geometry');
  const stale=stagedContact();stale.ctx.prepareCampWork(stale.s);endpoint(stale);const first=stale.s.elapsed;stale.s.elapsed+=.05;assert.equal(stale.ctx.powderContactWindow(stale.s,stale.op,{start:first,finish:stale.s.elapsed}).sweptClear,true);
  const second=stale.s.elapsed;stale.s.elapsed+=.05;assert.equal(stale.ctx.powderContactWindow(stale.s,stale.op,{start:second,finish:stale.s.elapsed}).sweptClear,false,'a matching native-arm cache cannot retime an old body sample');
});

test('other-body disappearance and arrival refuse native intervals instead of dropping occupied geometry',()=>{
  for(const direction of ['leave','arrive']){
    const f=stagedContact(),body=f.s.entities.saboteur;if(direction==='arrive')body.regionId='north-cutting';f.ctx.prepareCampWork(f.s);endpoint(f);const start=f.s.elapsed;f.s.elapsed+=.05;body.regionId=direction==='leave'?'north-cutting':'snowbound';
    assert.equal(f.ctx.powderContactWindow(f.s,f.op,{start,finish:f.s.elapsed}).sweptClear,false,`${direction} changes the required other-body set`);
  }
});
