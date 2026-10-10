import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import './helpers/train-clinic-route.mjs';
import * as Journey from '../src/campaign-journey.js';
import {followPreparationOwnedMount} from '../src/train-preparation-navigation.js';
const load=()=>{const s=Journey.restoreCampaign(gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString());assert.ok(s);return s;},p=a=>({x:a.x,y:a.y,z:a.z||0});

test('actual ordinary Copper call earns one bounded separation step with no grant, re-ownership or moved companion',()=>{
 const s=load(),start=p(s.entities.copper),plover=structuredClone(s.entities.plover),skein=structuredClone(s.entities.skein),score=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].performance),objects=structuredClone(s.campaign.missions['snowbound-the-names-they-took'].objects),stock=structuredClone(s.inventory);
 assert.equal(s.entities.copper.following,false);assert.equal(s.entities.copper.follow,true,'old Opening flag is historical and is not current follow authority');Journey.stepCampaign(s,.05);assert.deepEqual(p(s.entities.copper),start,'a prior Opening flag never fabricates the current call');
 Journey.whistleCampaign(s);assert.equal(s.entities.copper.following,true);assert.ok(s.notices.some(n=>n.text==='Copper heard your call. Leave a clear path.'));Journey.stepCampaign(s,.05);const moved=p(s.entities.copper),distance=Math.hypot(moved.x-start.x,moved.y-start.y);assert.ok(distance>0&&distance<=95*.05+1e-7);assert.equal(followPreparationOwnedMount(s,.05,{worldFor:Journey.worldForCampaign}),0,'same accepted frame cannot move the mount again');assert.deepEqual(p(s.entities.copper),moved);
 assert.deepEqual(s.entities.plover,plover);assert.deepEqual(s.entities.skein,skein);assert.deepEqual(s.inventory,stock);assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].objects,objects);assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].performance,score);assert.equal(s.campaign.missions['snowbound-the-names-they-took'].captivity.guardId,'bastian');const raw=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(raw));assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(raw)),raw);
});

test('owned-follow API refuses uncalled/unowned/non-Copper, mounted, loaded and malformed sources',()=>{
 // Negative source mutations only. None earns a mount, movement or Save.
 for(const mutate of [s=>s.entities.copper.owned=false,s=>s.entities.copper.following=false,s=>s.party.mountId='skein',s=>s.entities.copper.hp=0,s=>s.entities.copper.hidden=true,s=>s.entities.mara.mounted=true,s=>s.entities.levi.attachment={type:'passenger',targetId:'copper'}]){const s=load();Journey.whistleCampaign(s);mutate(s);const before=structuredClone(s.entities);assert.equal(followPreparationOwnedMount(s,.05,{worldFor:Journey.worldForCampaign}),0);assert.deepEqual(s.entities,before);}
 for(const dt of [0,.2,NaN]){const s=load();Journey.whistleCampaign(s);const before=structuredClone(s.entities);assert.equal(followPreparationOwnedMount(s,dt,{worldFor:Journey.worldForCampaign}),0);assert.deepEqual(s.entities,before);}
});
