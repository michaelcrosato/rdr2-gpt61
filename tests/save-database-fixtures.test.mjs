import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {restoreCampaign,serializeCampaign} from '../src/campaign-journey.js';
const dir=new URL('fixtures/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('save-database-native-provenance.json',dir),'utf8'));
for(const item of manifest.fixtures)test(`unchanged earned native ${item.fixture} retains all four stories and exceeds a five-MiB UTF-16 single-slot budget`,()=>{
  const bytes=gunzipSync(fs.readFileSync(new URL(item.fixture,dir)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256OfUncompressedOriginalBytes);
  assert.equal(bytes.length,item.bytes);const raw=bytes.toString('utf8');assert.equal(raw.length,item.codeUnits);assert.ok(raw.length*2>5*1024*1024,'large size comes from actual gameplay/history, not padding');
  const original=JSON.parse(raw),restored=restoreCampaign(original);assert.ok(restored,'the current owning codec accepts the entire original graph');
  const world=original.replayCanonical||original;assert.equal(Object.keys(world.campaign.missions).length,4);assert.ok(Object.values(world.campaign.missions).every(record=>record.mission.completed));
  const again=JSON.parse(serializeCampaign(restored));for(const key of ['campaign','entities','weapons','camp','inventory','checkpoints','missionEntries','replayCanonical'])assert.deepEqual(again[key],original[key],`${key} survives without truncation or invented outcomes`);
});
