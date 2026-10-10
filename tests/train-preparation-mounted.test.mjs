import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import './helpers/train-clinic-route.mjs';
import * as Journey from '../src/campaign-journey.js';
import {stepPreparationMounted,followPreparationOwnedMount} from '../src/train-preparation-navigation.js';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts} from '../src/train-preparation-body-geometry.js';
const load=()=>{const s=Journey.restoreCampaign(gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString());assert.ok(s);return s;},ctx={worldFor:Journey.worldForCampaign};
function component(){const s=load();
 // Explicit control-only starting binding/clearance fixture. This does not
 // earn mounting, herd recovery, a watch exchange, progression or Save proof.
 Object.assign(s.entities.copper,{x:1000,y:1000,z:0,facing:0,vx:0,vy:0,hitched:false});Object.assign(s.entities.mara,{x:1000,y:1000,z:0,facing:0,vx:0,vy:0,mounted:true,mountId:'copper'});return s;}

test('scoped mounted controller moves the actual horse/rider compound once, preserving resources and fixed actors',()=>{
 const s=component(),before=structuredClone(s.entities),stock=JSON.stringify({inventory:s.inventory,items:s.itemInstances,weapons:s.weapons,rival:s.campaign.missions['snowbound-the-names-they-took']}),elapsed=s.elapsed;
 assert.equal(stepPreparationMounted(s,.05,{mx:1,my:0},125,ctx),6.25);assert.equal(s.entities.copper.x,1006.25);assert.equal(s.entities.mara.x,1006.25);assert.equal(s.entities.mara.y,s.entities.copper.y);assert.equal(s.entities.mara.vx,125);assert.equal(s.entities.copper.vx,125);assert.equal(s.elapsed,elapsed);assert.equal(stepPreparationMounted(s,.05,{mx:1,my:0},125,ctx),0);assert.equal(followPreparationOwnedMount(s,.05,ctx),0);
 for(const id of Object.keys(before))if(!['mara','copper'].includes(id))assert.deepEqual(s.entities[id],before[id]);assert.equal(JSON.stringify({inventory:s.inventory,items:s.itemInstances,weapons:s.weapons,rival:s.campaign.missions['snowbound-the-names-they-took']}),stock);
});

test('the native head blocks a mounted translation before the ground footprint reaches a thin wall',()=>{
 const s=component(),rows=capturePreparationBodyBounds(s),parts=rows.filter(r=>r.rootId==='copper').flatMap(r=>preparationNativeBodyParts(r,rows)),edge=Math.max(...parts.flatMap(p=>p.vertices.map(v=>v.x))),world=Journey.worldForCampaign(s),blocked={worldFor:()=>({...world,obstacles:[...world.obstacles,{id:'component-thin-wall',x:edge+1,y:900,z:0,w:.1,h:200,height:200}]})},before={horse:structuredClone(s.entities.copper),player:structuredClone(s.entities.mara)};
 assert.ok(edge>s.entities.copper.x+14);assert.equal(stepPreparationMounted(s,.05,{mx:1,my:0},125,blocked),0);assert.deepEqual(s.entities.copper,before.horse);assert.deepEqual(s.entities.mara,before.player);
});

test('mounted yaw is bounded for both actual root members and consumes the same movement allowance',()=>{
 const s=component(),before={x:s.entities.copper.x,y:s.entities.copper.y};assert.equal(stepPreparationMounted(s,.05,{mx:0,my:-1},125,ctx),0);assert.equal(s.entities.copper.facing,-.12);assert.equal(s.entities.mara.facing,-.12);assert.equal(s.entities.copper.x,before.x);assert.equal(s.entities.mara.y,before.y);assert.equal(stepPreparationMounted(s,.05,{mx:1,my:0},125,ctx),0);assert.equal(s.entities.copper.facing,-.12);
});

test('mounted controls refuse actual unmounted and malformed bindings without snapping either actor',()=>{
 const original=load(),before=JSON.stringify(original.entities);assert.equal(stepPreparationMounted(original,.05,{mx:1,my:0},125,ctx),0);assert.equal(JSON.stringify(original.entities),before);
 for(const mutate of [s=>s.entities.mara.x++,s=>s.entities.mara.facing=.5,s=>s.entities.copper.owned=false,s=>s.entities.copper.hitched=true,s=>s.entities.mara.mountId='plover',s=>s.party.mountId='plover',s=>s.entities.levi.attachment={type:'passenger',targetId:'copper'}]){const s=component();mutate(s);const raw=JSON.stringify(s.entities);assert.equal(stepPreparationMounted(s,.05,{mx:1,my:0},125,ctx),0);assert.equal(JSON.stringify(s.entities),raw);}
 for(const [dt,input,speed]of [[0,{mx:1,my:0},125],[.2,{mx:1,my:0},125],[.05,{mx:NaN,my:0},125],[.05,{mx:1,my:0,free:true},125],[.05,{mx:1,my:0},Infinity]]){const s=component(),raw=JSON.stringify(s.entities);assert.equal(stepPreparationMounted(s,dt,input,speed,ctx),0);assert.equal(JSON.stringify(s.entities),raw);}
});
