import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../my-3d2dge-agent.js';
import * as Journey from '../src/campaign-journey.js';
import {sweptPreparationBodyBounds,getPreparationWorkPose} from '../src/train-preparation-work.js';
import {requestPreparationInspection} from '../src/train-powder.js';
import {TRAIN_CHILD_CONTACTS,TRAIN_INSPECTION_V2_CONTACTS} from '../content/campaign/train-preparation-camp.js';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
import {createTrainHuman,prepareTrainPose,physicalProjection} from '../src/train-native/rigs.js';
const E=globalThis.My3D2dge,rawFor=name=>gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url))).toString();
const names=['train-preparation-pr9-inspection-pending','train-preparation-v2-before-mask-issue','train-preparation-pr9-mask-owned-bring','train-preparation-copper-recovery-webkit-v2-pending'];

test('historical inspection-bearing whole Saves preserve their exact original version and bytes',()=>{
 let inspected=0;for(const name of names){const raw=rawFor(name),s=Journey.restoreCampaign(raw);assert.ok(s,name);assert.equal(Journey.serializeCampaign(s),raw);const starts=s.campaign.missions['snowbound-what-the-line-carries'].train.powder.physicalEvents.filter(e=>e.kind==='preparation-inspection-started');inspected+=starts.length;for(const start of starts)assert.equal(Object.hasOwn(start.data.operation.options,'approachVersion'),false);}assert.ok(inspected>0);
});

test('inspection approach versions cannot be attached to other topics or malformed request shapes',()=>{
 const raw=rawFor(names[1]),s=Journey.restoreCampaign(raw);assert.ok(s);
 for(const spec of [null,{}, {topic:'primer-tin',ref:{sourceMissionId:'snowbound-the-names-they-took',objectId:'cap-tin'},actorIds:['mara','ruth'],approachVersion:2},...([null,1,4,'2'].map(approachVersion=>({topic:'child-seal',ref:{sourceMissionId:'snowbound-the-names-they-took',objectId:'quarry-sealed-charge-1'},actorIds:['mara','ruth'],approachVersion})))])assert.equal(requestPreparationInspection(s,spec,{}),null);
 assert.equal(Journey.serializeCampaign(s),raw);
});

test('version2 first-child authoring clears the real wall with the same walking body, original grip and unmodified native arm',()=>{
 // Detached prospective geometry only. Earned navigation/work is checked by
 // the native controller route; no actor position is assigned in this test.
 const raw=rawFor(names[1]),s=Journey.restoreCampaign(raw),rows=capturePreparationBodyBounds(s,{geometryVersion:3}),row=rows.find(r=>r.id==='ruth'),id='quarry-sealed-charge-1',old=TRAIN_CHILD_CONTACTS[id],next=TRAIN_INSPECTION_V2_CONTACTS[id];
 assert.equal(next.grip,old.grip);assert.equal(next.center,old.center);assert.equal(old.approach.x,747);assert.equal(next.approach.x,753);
 const world=Journey.worldForCampaign(s),solids=compileHeldBoxSet(world.obstacles.filter(o=>(o.height??35)>0).map((o,i)=>({box:createHeldBox({id:o.id||'world-'+i,frame:makeFrame({x:o.x+o.w/2,y:o.y+o.h/2,z:(o.z||0)+(o.height??35)/2},{x:1,y:0,z:0}),halfExtents:{x:o.w/2,y:o.h/2,z:(o.height??35)/2}}),ownerId:o.id||'world'})),{id:'actual-store-world'});
 const hits=approach=>preparationNativeBodyParts({...row,point:{x:approach.x,y:approach.y,z:0},pose:{...row.pose,facing:approach.facing,vx:1,vy:0}},rows).flatMap(part=>heldBoxContacts(part,solids).filter(h=>h.interiorOverlap).map(h=>({part:part.id,owner:h.ownerId})));
 assert.ok(hits(old.approach).some(h=>h.part==='stride'&&h.owner==='rival-tack-west'));assert.deepEqual(hits(next.approach),[]);
 const body={...s.entities.ruth,...next.approach,vx:0,vy:0},human=createTrainHuman(E,body),dimensions=JSON.stringify(human.rig.o);human.rig.update(0,body);
 physicalProjection(E,()=>{const pose=prepareTrainPose(E,human,body,null,{contacts:[{side:'R',target:next.grip,elbowHint:[0,0,1]}],freeHands:true});try{assert.ok(pose.diagnostics[0].reachable&&pose.diagnostics[0].error<1e-5);}finally{pose.restore();}});
 assert.equal(JSON.stringify(human.rig.o),dimensions);assert.equal(Journey.serializeCampaign(s),raw);
});


test('genuine version3 inspection restores its first paused pose and advances the same accepted prefix',()=>{
 const raw=rawFor('train-preparation-inspection-v3-pending'),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);const t=s.campaign.missions['snowbound-what-the-line-carries'].train,before=structuredClone(t.powder.pending[0]);assert.ok(before.acceptedSeconds>0);
 Journey.getCampaignInteractions(s);for(const id of ['mara','ruth']){const pose=getPreparationWorkPose(s,id);assert.ok(pose?.reachable&&pose.usable);assert.equal(pose.workId,before.workId);assert.equal(pose.at,s.elapsed);}assert.equal(Journey.serializeCampaign(s),raw,'first-draw reconstruction changes no serialized fact');
 Journey.stepCampaign(s,.05,{});const continued=t.powder.pending.find(w=>w.workId===before.workId);assert.ok(continued&&continued.acceptedSeconds>before.acceptedSeconds);assert.deepEqual(continued.intervals.slice(0,before.intervals.length),before.intervals);assert.equal(t.powder.physicalEvents.some(e=>e.kind==='work-cancelled'&&e.data.workId===before.workId),false);const next=Journey.serializeCampaign(s);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(next)),next);
});

test('unchanged PR9 pending inspection continues its original unmarked contact and prefix',()=>{
 const raw=rawFor('train-preparation-pr9-inspection-pending'),s=Journey.restoreCampaign(raw);assert.ok(s);const beforeHob=projectBody(s,'hob',1),hobRoot={x:s.entities.hob.x,y:s.entities.hob.y,z:s.entities.hob.z||0,facing:s.entities.hob.facing};const t=s.campaign.missions['snowbound-what-the-line-carries'].train,before=structuredClone(t.powder.pending[0]),start=t.powder.physicalEvents.find(e=>e.id===before.workId);assert.equal(start.data.operation.options.approachVersion,undefined);
 Journey.getCampaignInteractions(s);assert.equal(Journey.serializeCampaign(s),raw);Journey.stepCampaign(s,.05,{});const after=t.powder.pending.find(w=>w.workId===before.workId);assert.ok(after&&after.acceptedSeconds>before.acceptedSeconds);assert.deepEqual(after.intervals.slice(0,before.intervals.length),before.intervals);assert.equal(t.preparation.work.storeApproachVersion,undefined);assert.equal(start.data.operation.options.approachVersion,undefined);const afterHob=projectBody(s,'hob',1),swept=sweptPreparationBodyBounds(beforeHob,afterHob);assert.deepEqual({x:s.entities.hob.x,y:s.entities.hob.y,z:s.entities.hob.z||0,facing:s.entities.hob.facing},hobRoot);assert.equal(Math.hypot(s.entities.hob.vx,s.entities.hob.vy),0);assert.ok(beforeHob.length>afterHob.length);assert.equal(swept.length,beforeHob.length,'the removed old gait volume is retained');for(const box of [...beforeHob,...afterHob]){const span=swept.find(v=>v.id===box.id);assert.ok(span);for(const [k,length]of [['x','w'],['y','h'],['z','height']]){assert.ok(span[k]<=box[k]+1e-7);assert.ok(span[k]+span[length]>=box[k]+box[length]-1e-7);}}assert.ok(Math.min(...swept.map(b=>b.x))>s.player.x+9,'stopping does not invent a yaw disk into Mara');const saved=Journey.serializeCampaign(s);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(saved)),saved);
});

function projectBody(s,id,geometryVersion){const row=capturePreparationBodyBounds(s,{geometryVersion}).find(r=>r.id===id),radius=Math.max(...row.volumes.flatMap(v=>[v.min.x,v.max.x].flatMap(x=>[v.min.y,v.max.y].map(y=>Math.hypot(x-row.point.x,y-row.point.y))))),meta={bodyId:id,rootPoint:structuredClone(row.point),bodyFacing:row.pose.facing,bodyPose:JSON.stringify([row.pose,row.binding,row.radius,row.height]),bodyRadiusXY:radius,bodyMinZ:Math.min(...row.volumes.map(v=>v.min.z)),bodyMaxZ:Math.max(...row.volumes.map(v=>v.max.z))};return row.volumes.map((v,i)=>({id:id+':'+i,...meta,x:v.min.x,y:v.min.y,z:v.min.z,w:v.max.x-v.min.x,h:v.max.y-v.min.y,height:v.max.z-v.min.z}));}
