import test from 'node:test';import assert from 'node:assert/strict';import '../../my-3d2dge-agent.js';
import {createRailPath,placeConsist} from '../../src/rail-foundation/rail-consist.js';
import {legacyPlaceConsist} from './fixtures/legacy-coupler-placement.mjs';
import {length,sub} from '../../src/rail-foundation/rigid-frame.js';
import {TRAIN_TRACK,TRAIN_CARS} from '../../proposals/brass-cutting.js';
test('machine-stagnation exit preserves every original60-iteration placement bit across straight/curved/grade track',()=>{
 const path=createRailPath(TRAIN_TRACK);for(const cursor of[1200,1400,1750,1800,1900,2100,2300,2400,2600,2800,3100,3500,3900,4100,4700,5100,5400]){const current=placeConsist(path,TRAIN_CARS,cursor);assert.deepEqual(current,legacyPlaceConsist(path,TRAIN_CARS,cursor));for(let i=1;i<current.length;i++){assert.ok(current[i].cursor<current[i-1].cursor);assert.ok(Math.abs(length(sub(current[i].frontCoupler,current[i-1].rearCoupler))-TRAIN_CARS[i].couplerGap)<1e-5);}}
});
