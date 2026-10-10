import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Journey,trainRecord} from './helpers/train-preparation-route.mjs';
import {capturePreparationBodyBounds,validatePreparationBodyBounds,validatePreparationCampSetup} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts,preparationNativeTorsoParts} from '../src/train-preparation-body-geometry.js';
import {createTrainHuman,prepareTrainPose,physicalProjection,rigWorldPoint} from '../src/train-native/rigs.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../src/train-held-volume.js';
import {makeFrame,localPoint} from '../src/rail-foundation/rigid-frame.js';
import {preparationStableWorldGeometry} from '../src/train-preparation-stable.js';
import {TRAIN_MASK_SOURCE,TRAIN_MASK_V3_APPROACHES} from '../content/campaign/train-gear-data.js';
const E=globalThis.My3D2dge,axes=['x','y','z'],copy=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z}),inside=(p,b)=>{const q=localPoint(b.frame,p);return axes.every(k=>Math.abs(q[k])<=b.halfExtents[k]+1e-7);};
const bytes=()=>gunzipSync(readFileSync(new URL('./fixtures/train-preparation-v2-before-mask-issue.json.gz',import.meta.url))).toString();
const raw=()=>JSON.parse(bytes());
function sourceRig(id,facing,down=0){const rig=createTrainHuman(E,{id}).rig;rig.t=0;rig.phase=0;rig.facing=facing;rig._cheat=0;rig.o.cheat=0;rig.downW=down;rig.poseW={cheer:0,cast:0,guard:0,kneel:0,crouch:0,wave:0,hips:0,block:0};rig._pose();return rig;}
// Independent native draw reconstruction: _drawHD's exact plate/skirt source
// vertices and down-offset transform, not the production bound implementation.
function drawnVertices(rig,root,sp){const o=rig.o,J=rig.J,a=(rig.downW||0)*Math.PI/2*.96,at=(p,f=0,r=0,z=0)=>rigWorldPoint(rig,root,[p[0]+f*Math.cos(a)-z*Math.sin(a),p[1]+r,p[2]+f*Math.sin(a)+z*Math.cos(a)]),mix=(a,b)=>P(...axes.map(k=>(a[k]+b[k])/2));
  const shL=at(J.shL,0,-.4),shR=at(J.shR,0,.4),plate=[shL,shR,mix(at(J.hipR,0,.2),shR),at(J.hipR,0,.25,.5),at(J.hipL,0,-.25,.5),mix(at(J.hipL,0,-.2),shL)],hz=Math.max(J.hipL[2],J.hipR[2])+.9,len=hz*.62,tail=-1.2-2.2*sp,dep=o.torsoW*.7;
  const lat=[[J.hipC[0],-o.hipHalf*1.25,hz],[J.hipC[0],o.hipHalf*1.25,hz],[J.hipC[0]+tail*.5,o.hipHalf*1.25*1.3,hz-len],[J.hipC[0]+tail*.5,-o.hipHalf*1.25*1.3,hz-len]].map(p=>at(p)),sag=[[J.hipC[0]+dep,0,hz],[J.hipC[0]+dep*.3,0,hz-len*.45],[J.hipC[0]-dep*1.3+tail,0,hz-len],[J.hipC[0]-dep,0,hz]].map(p=>at(p));return{plate,lat,sag,core:[at(J.hipC,0,0,.8),at(J.shC,0,0,-.4)]};
}
test('original-byte isolated v2 native Save and all old v2 site/body receipts restore exactly',()=>{
  const text=bytes();assert.equal(createHash('sha256').update(text).digest('hex'),'2797ae5b0dfe53913356b6407cebcefd67ea186e2d2da5ef84a97ef600685e54');const s=Journey.restoreCampaign(text);assert.ok(s,'original pre-issue graph remains valid without rewriting v2 geometry');assert.equal(Journey.serializeCampaign(s),text);const setup=trainRecord(s).train.preparation.campSetup;
  for(const r of Object.values(setup.sites)){assert.equal(r.geometryVersion,2);assert.ok(validatePreparationBodyBounds(s,r.bodyBounds));}assert.ok(validatePreparationCampSetup(s,setup));
  const old=capturePreparationBodyBounds(s,{geometryVersion:2}),next=capturePreparationBodyBounds(s,{geometryVersion:3});assert.ok(validatePreparationBodyBounds(s,old));assert.ok(validatePreparationBodyBounds(s,next));assert.ok(old.every(r=>r.geometryVersion===2));assert.ok(next.every(r=>r.geometryVersion===3));assert.notDeepEqual(old.find(r=>r.id==='mara').volumes,next.find(r=>r.id==='mara').volumes);
  const forged=copy(setup);for(const r of Object.values(forged.sites)){r.geometryVersion=3;for(const b of r.bodyBounds)b.geometryVersion=3;}assert.equal(validatePreparationCampSetup(s,forged),false,'a new marker cannot reinterpret old torso shapes');assert.equal(Journey.serializeCampaign(s),text);
});

test('v3 finite torso pieces enclose actual native core, side plate and ALL moving coat vertices at eight headings and down poses',()=>{
  const root=P(600,900,0);
  for(const id of['mara','inez','hob'])for(const down of[0,1])for(let n=0;n<8;n++){
    const rig=sourceRig(id,n*Math.PI/4,down),before=JSON.stringify({J:rig.J,o:rig.o,facing:rig.facing}),parts=preparationNativeTorsoParts(rig,root,{moving:true}),byId=new Map(parts.map(p=>[p.id,p]));assert.ok(parts.every(Object.isFrozen));
    for(const sp of[0,.5,1]){const v=drawnVertices(rig,root,sp);for(const p of v.plate)assert.ok(inside(p,byId.get('torso-plate')),'plate lateral thickness comes from native vertices, not another torsoWidth added to shoulders');for(const p of v.lat)assert.ok(inside(p,byId.get('coat-side')),'native coat skirt remains occupied');for(const p of v.sag)assert.ok(inside(p,byId.get('coat-depth')),'full moving coat tail remains occupied');
      for(const c of v.core)for(const axis of axes)for(const sign of[-1,1]){const p={...c,[axis]:c[axis]+sign*rig.o.torsoW*.72*rig.o.size};assert.ok(inside(p,byId.get('torso')),'the actual central core radius remains occupied');}}
    assert.equal(JSON.stringify({J:rig.J,o:rig.o,facing:rig.facing}),before,'bounds never mutate the native skeleton/profile');
  }
});

test('staged authored V3 mask pair fits both actual right hands and clears full native moving bodies, worlds, foreign people and finite basket rails',()=>{
  const s=raw(),original=JSON.stringify(s),target=P(TRAIN_MASK_SOURCE.x,TRAIN_MASK_SOURCE.y,TRAIN_MASK_SOURCE.handZ),proposal=TRAIN_MASK_V3_APPROACHES,shadow={...s,entities:{...s.entities}};
  for(const [id,p]of Object.entries(proposal))shadow.entities[id]={...s.entities[id],x:p.x,y:p.y,z:p.z,facing:p.facing,vx:1,vy:0,holstered:true};const rows=capturePreparationBodyBounds(shadow,{geometryVersion:3}),geometry=preparationStableWorldGeometry(s),refs=geometry.filter(o=>o.height>0).map(o=>({box:createHeldBox({id:o.id,frame:makeFrame(P(o.x+o.w/2,o.y+o.h/2,o.z+o.height/2),P(1,0,0)),halfExtents:P(o.w/2,o.h/2,o.height/2)}),ownerId:'world'}));
  for(const r of rows)if(!['mara','ada'].includes(r.id)&&r.regionId==='snowbound')refs.push(...preparationNativeBodyParts(r,rows).map(box=>({box,ownerId:r.id})));const set=compileHeldBoxSet(refs,{id:'complete-staged-current-camp'});
  for(const [id,p]of Object.entries(proposal)){
    const a=shadow.entities[id],h=createTrainHuman(E,a);h.rig.t=0;h.rig.update(0,a);physicalProjection(E,()=>{const pose=prepareTrainPose(E,h,a,null,{contacts:[{side:'R',target,elbowHint:p.elbowHint}],freeHands:true});try{assert.equal(pose.diagnostics[0].reachable,true);assert.ok(pose.diagnostics[0].error<=1e-5);}finally{pose.restore();}});
    const parts=preparationNativeBodyParts(rows.find(r=>r.id===id),rows,{contact:{side:'R',target,elbowHint:p.elbowHint}});assert.equal(parts.find(p=>p.id==='root-foot').halfExtents.x,9);assert.ok(parts.some(p=>p.id==='stride'),'full normal moving envelope remains');assert.ok(parts.some(p=>p.id==='coat-depth'),'real coat remains');assert.ok(parts.every(p=>heldBoxContacts(p,set).length===0),id+' whole finite body clears every fixed/foreign solid');
  }
  const defaultMara=preparationNativeBodyParts(rows.find(r=>r.id==='mara'),rows,{contact:{side:'R',target}});assert.ok(defaultMara.some(p=>heldBoxContacts(p,set).some(h=>h.solidId.startsWith('ada-basket-')&&h.interiorOverlap)),'default bend genuinely remains blocked; the authored native bend fixes it');
  assert.equal(JSON.stringify(s),original,'staged geometry earns no route, watch, issue, body placement or Save');
});

test('malformed native torso and unknown geometry refuse without changing earlier captures',()=>{
  const s=raw(),rows=capturePreparationBodyBounds(s,{geometryVersion:3}),bad=copy(rows);bad[0].geometryVersion=4;assert.equal(validatePreparationBodyBounds(s,bad),false);const mixed=copy(rows);mixed[0].geometryVersion=2;assert.equal(validatePreparationBodyBounds(s,mixed),false);
  const r=sourceRig('mara',0),before=JSON.stringify(r.J);assert.throws(()=>preparationNativeTorsoParts(r,P(NaN,0,0)));r.o.torsoW=0;assert.throws(()=>preparationNativeTorsoParts(r,P()));assert.equal(JSON.stringify(r.J),before);
});
