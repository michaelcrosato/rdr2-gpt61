import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import './helpers/train-clinic-route.mjs';
import * as Journey from '../src/campaign-journey.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {preparationWatchFixture,preparationWatchPrefix,selectPreparationWatchFixture} from '../src/train-preparation-watch.js';
import {facePreparationWatchGuard} from '../src/train-preparation-navigation.js';
import {createTrainCampWorkProvider} from '../src/train-camp-work.js';
const bytes=()=>gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),load=()=>{const s=Journey.restoreCampaign(bytes());assert.ok(s);return s;};

test('genuine PR9 graph remains exact and gains no watch hearing, fixture or relief on restore',()=>{
 const raw=bytes(),s=load();assert.equal(Journey.serializeCampaign(s),raw);assert.equal(preparationWatchPrefix(s),null);assert.equal(s.campaign.missions[TRAIN_ID].train.preparation.work,null);assert.equal(s.campaign.missions[RIVAL_ID].captivity.guardId,'bastian');
 assert.equal(selectPreparationWatchFixture(s,{kind:'guard-handover',actorIds:['mara','bastian','inez'],refs:[],to:null,options:{fromActorId:'bastian',toActorId:'inez'}},Journey.worldForCampaign(s)),null,'actual holding hearing is required before a native relief can even be routed');assert.equal(Journey.serializeCampaign(s),raw);
});

test('new watch intents cannot invent earlier holding hearing or replace the canonical keeper',()=>{
 for(const to of ['inez','hob']){const s=JSON.parse(bytes());s.campaign.missions[RIVAL_ID].captivity.guardId=to;assert.equal(Journey.restoreCampaign(s),null,'unguarded registry edits cannot stand in for a canonical handover');}
 const s=JSON.parse(bytes()),p=s.campaign.missions[TRAIN_ID].train.preparation;p.work={kind:'watch',args:{fromActorId:'bastian',toActorId:'inez'},requestedAt:s.elapsed,workId:null,requestId:null,watchFixture:null};assert.equal(Journey.restoreCampaign(s),null,'a new typed native intent needs the actual completed holding exchange');
});

test('four detached holding contact orientations use actual native hands and preserve the outgoing root',()=>{
 // Explicit geometric fixtures only: no route, handover, stock, elapsed, stage,
 // guard history or whole Save is earned by assigning these detached poses.
 const s=load(),before=Journey.serializeCampaign(s),anchor={x:s.entities.bastian.x,y:s.entities.bastian.y,z:s.entities.bastian.z||0};
 for(const rotation of [0,1,2,3]){const f=preparationWatchFixture(anchor,rotation,'bastian','inez'),shadow={...s,entities:{...s.entities}};for(const [id,role]of Object.entries(f.actors))shadow.entities[id]={...s.entities[id],...role.pose,vx:0,vy:0,holstered:true,aiming:false};const provider=createTrainCampWorkProvider(globalThis.My3D2dge,()=>({id:'explicit-contact-fixture',obstacles:[]}));assert.deepEqual({x:f.actors.bastian.pose.x,y:f.actors.bastian.pose.y,z:f.actors.bastian.pose.z},anchor);
  for(const [id,role]of Object.entries(f.actors)){const e=provider.prepareNativeActor(shadow,id,role.target);assert.ok(e.reachable&&e.usable,`${rotation}:${id} reaches its own real hand target`);assert.ok(Math.hypot(e.joints[2].x-role.target.x,e.joints[2].y-role.target.y,e.joints[2].z-role.target.z)<1e-5);assert.ok(Math.hypot(role.target.x-f.station.x,role.target.y-f.station.y,role.target.z-f.station.z)<=22,'each actual hand is near the same outside acknowledgement contact');}
 }
 assert.equal(Journey.serializeCampaign(s),before);
});

test('a caller cannot turn Mara or an unrequested keeper through the watch-only facing API',()=>{
 const s=load(),before=Journey.serializeCampaign(s);for(const id of ['mara','bastian','inez','hob'])assert.equal(facePreparationWatchGuard(s,id,.05,{worldFor:Journey.worldForCampaign}),false);assert.equal(Journey.serializeCampaign(s),before);
});
