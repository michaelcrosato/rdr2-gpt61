import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import './helpers/train-clinic-route.mjs';
import * as Journey from '../src/campaign-journey.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
const original=()=>gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),load=()=>{const s=Journey.restoreCampaign(original());assert.ok(s);return s;};

test('unchanged earlier preparation bytes retain absent staging, with no invented future work',()=>{
 const bytes=original(),s=load(),p=s.campaign.missions[TRAIN_ID].train.preparation;assert.equal(Object.hasOwn(p,'campStaging'),false);assert.equal(Journey.serializeCampaign(s),bytes);
});

test('optional null/empty staging is incomplete and never admits invented performed duty',()=>{
 // Explicit codec-shape negatives/incomplete boundaries only. No placement,
 // stage, resource, duty, heard exchange or positive route is manufactured.
 for(const value of [null,{schema:1,plover:null}]){const s=load(),before={inventory:structuredClone(s.inventory),objects:structuredClone(s.campaign.missions['snowbound-the-names-they-took'].objects),guard:s.campaign.missions['snowbound-the-names-they-took'].captivity.guardId};s.campaign.missions[TRAIN_ID].train.preparation.campStaging=value;const raw=Journey.serializeCampaign(s),copy=Journey.restoreCampaign(raw);assert.ok(copy);assert.equal(Journey.serializeCampaign(copy),raw);assert.deepEqual(copy.inventory,before.inventory);assert.deepEqual(copy.campaign.missions['snowbound-the-names-they-took'].objects,before.objects);assert.equal(copy.campaign.missions['snowbound-the-names-they-took'].captivity.guardId,before.guard);}
 for(const value of [{schema:2,plover:null},{schema:1,plover:null,delivered:true},{schema:1,plover:{phase:'completed'}},{schema:1}]){const s=load();s.campaign.missions[TRAIN_ID].train.preparation.campStaging=value;assert.equal(Journey.restoreCampaign(Journey.serializeCampaign(s)),null,'malformed/unevidenced performed staging is refused');}
});

test('new optional care/recovery records require their fixed owners while genuine old bytes remain absent',()=>{
 for(const field of ['stableCare','copperRecovery']){const old=load();assert.equal(Object.hasOwn(old.campaign.missions[TRAIN_ID].train.preparation,field),false);assert.equal(Journey.serializeCampaign(old),original());const empty=load();empty.campaign.missions[TRAIN_ID].train.preparation[field]=null;const raw=Journey.serializeCampaign(empty);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(raw)),raw);for(const value of [{schema:1},{schema:1,completed:true}]){const s=load();s.campaign.missions[TRAIN_ID].train.preparation[field]=value;assert.equal(Journey.restoreCampaign(Journey.serializeCampaign(s)),null,'no arbitrary non-null future proof is admitted');}}
});
