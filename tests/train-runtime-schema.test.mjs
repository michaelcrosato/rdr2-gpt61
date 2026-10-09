import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as Journey from '../src/campaign-journey.js';
import {createTrainRuntime,createTrainRuntimeSections} from '../src/train-runtime-schema.js';

test('declaring an empty native runtime neither enters a mission nor grants arrivals, kit, primers or accepted work',()=>{
  const state=Journey.restoreCampaign(gunzipSync(readFileSync(new URL('./fixtures/journey-v4-rival-webkit-current-reloaded.json.gz',import.meta.url))).toString());assert.ok(state);
  const before=Journey.serializeCampaign(state),one=createTrainRuntimeSections(state),two=createTrainRuntimeSections(state);
  assert.equal(Journey.serializeCampaign(state),before,'factory is read-only over the genuine migrated graph');
  assert.equal(one.train.chronicle.enteredAt,state.elapsed);assert.equal(one.train.chronicle.acceptedAt,null);assert.deepEqual(one.train.chronicle.stageEvents,[]);
  assert.deepEqual(one.train.prelude.arrivals,{});assert.deepEqual(one.train.prelude.acknowledged,[]);assert.equal(one.train.prelude.bottle,null);assert.deepEqual(one.train.powder.kit,{});assert.deepEqual(one.train.powder.custodyEventRefs,[]);
  one.train.powder.kit.negativeFixture={};one.train.prelude.acknowledged.push({negativeFixture:true});
  assert.deepEqual(two.train.powder.kit,{});assert.deepEqual(two.train.prelude.acknowledged,[],'new runtime containers cannot share mutable current authorities');assert.equal(Journey.serializeCampaign(state),before);
});

test('a runtime declaration cannot fabricate a nonfinite or earlier campaign clock',()=>{
  for(const elapsed of [NaN,Infinity,-1])assert.throws(()=>createTrainRuntime({elapsed}),TypeError);
});
