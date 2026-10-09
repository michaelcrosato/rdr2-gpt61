import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as Journey from '../src/campaign-journey.js';
const ID='snowbound-the-names-they-took',clone=v=>JSON.parse(JSON.stringify(v));
function genuineVisit(){
  const manifest=JSON.parse(fs.readFileSync(new URL('fixtures/rival-deprived-visit-provenance.json',import.meta.url),'utf8'));
  const bytes=gunzipSync(fs.readFileSync(new URL(`fixtures/${manifest.fixture}`,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256OfUncompressedOriginalBytes);
  return JSON.parse(bytes);
}
test('genuine earlier deprived-visit wire text restores without inventing scarcity or care on actual revisit',()=>{
  const raw=genuineVisit(),state=Journey.restoreCampaign(raw);
  assert.ok(state);assert.match(raw.dialog.text,/No meal was available/);
  assert.deepEqual(JSON.parse(Journey.serializeCampaign(state)).dialog,raw.dialog,'original wire text stays exact');
  const before=clone(state.campaign.missions[ID].rival.questioning),stock=clone(state.camp);
  assert.equal(before.care.mode,'deprive');assert.equal(before.care.foodBefore,15);assert.equal(before.care.foodUsed,0);
  Journey.chooseCampaign(state,'leave');
  assert.ok(Journey.getCampaignInteractions(state).some(a=>a.id==='rival:visit'));
  Journey.interactCampaign(state,'rival:visit');
  assert.match(state.dialog.text,/No meal was provided at the first holding decision\./);
  assert.doesNotMatch(state.dialog.text,/No meal was available/);
  assert.deepEqual(state.campaign.missions[ID].rival.questioning,before);
  assert.deepEqual(state.camp,stock,'corrected speech grants/consumes no provisions');
  const encoded=JSON.parse(Journey.serializeCampaign(state));assert.ok(Journey.restoreCampaign(encoded));
  for(const text of [state.dialog.text.replace('No meal was provided','A meal was provided'),state.dialog.text+' An invented promise.']){
    const forged=clone(encoded);forged.dialog.text=text;assert.equal(Journey.restoreCampaign(forged),null);
  }
});
test('v4 guards follow the actual spoken assignment while genuine earlier absent fields remain lawful',()=>{
  const raw=genuineVisit();assert.equal(raw.campaign.missions[ID].captivity.guardId,'bastian');
  for(const guard of ['calder','levi','ruth','hob','mara','',null,4,{},[],undefined]){
    const forged=clone(raw),captivity=forged.campaign.missions[ID].captivity;
    if(guard===undefined)delete captivity.guardId;else captivity.guardId=guard;
    assert.equal(Journey.restoreCampaign(forged),null,`unsupported or missing ordered guard ${JSON.stringify(guard)}`);
  }
  const older=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/rival-v4-search-before-supplies.json.gz',import.meta.url))));
  assert.equal(Object.hasOwn(older.campaign.missions[ID].captivity,'guardId'),false);
  assert.ok(Journey.restoreCampaign(older),'actual legacy pre-order absence gains no invented assignment');
});
