import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Journey,acceptedBriefingNative} from './helpers/train-preparation-route.mjs';
import {capturePreparationBodyBounds} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,translateHeldBox,compileHeldBoxSet,heldBoxContacts} from '../src/train-held-volume.js';
import {makeFrame} from '../src/rail-foundation/rigid-frame.js';
import {nativeTranslationPenetrationDecreases as decreases,nativeTranslationPenetrationNonIncreasing as nonIncreasing,nativeHerdTranslationDepthDecreases as herdDecreases,nativeHerdTranslationPotential as herdPotential} from '../src/train-preparation-contact-resolution.js';
const box=(id,x)=>createHeldBox({id,frame:makeFrame({x,y:0,z:1},{x:1,y:0,z:0}),halfExtents:{x:1,y:1,z:1}});

test('native depth separates a genuine fixed-shape penetration and refuses a deeper approach or a plateau as earned exit',()=>{
 const a=[box('actor',0)],b=[box('foreign',.5)],before=JSON.stringify([a,b]);assert.equal(decreases(a,b,{x:-.25,y:0,z:0}),true);assert.equal(decreases(a,b,{x:.25,y:0,z:0}),false);assert.equal(nonIncreasing(a,b,{x:0,y:0,z:0}),true);assert.equal(decreases(a,b,{x:0,y:0,z:0}),false);assert.equal(JSON.stringify([a,b]),before);
});

test('unchanged historical Hob east motion has lower endpoints yet a deeper middle and must refuse',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);const before=raw,rows=capturePreparationBodyBounds(s,{geometryVersion:3}),a=preparationNativeBodyParts(rows.find(r=>r.id==='hob'),rows),b=preparationNativeBodyParts(rows.find(r=>r.id==='levi'),rows),set=compileHeldBoxSet(b.map(box=>({box,ownerId:'levi'})),{id:'independent-held-levi'}),depth=x=>Math.max(0,...a.flatMap(box=>heldBoxContacts(translateHeldBox(box,{x,y:0,z:0}),set)).map(h=>h.penetration));
 // These are read-only projections of genuine native parts, not performed
 // movement or handover/Save proof. Endpoint-only acceptance misses this rise.
 assert.ok(depth(3.25)<depth(0));assert.ok(depth(3.25*7/8)>depth(3.25*6/8)+.1);assert.equal(decreases(a,b,{x:3.25,y:0,z:0}),false);
 const angle=9*Math.PI/8;assert.equal(decreases(a,b,{x:Math.cos(angle)*3.25,y:Math.sin(angle)*3.25,z:0}),true,'the actual north-west native depth decreases continuously, without the earlier numerical tie refusal');assert.equal(Journey.serializeCampaign(s),before);
});

test('native resolution rejects copied geometry and malformed displacement instead of trusting its vertices',()=>{
 const a=[box('actor',0)],b=[box('foreign',.5)];assert.throws(()=>decreases(structuredClone(a),b,{x:-.25,y:0,z:0}));for(const d of [null,{x:NaN,y:0,z:0},{x:1,y:0,z:0,free:true}])assert.throws(()=>decreases(a,b,d));
});

test('owned herd recovery certifies decreasing squared body depths while refusing an interior increase or mere redistribution',()=>{
 const a=[box('actor',0)],right=[box('right',.5)],left=[box('left',-1.5)],d={x:-.25,y:0,z:0},before=JSON.stringify([a,right,left]);
 assert.equal(decreases(a,left,d),false,'one existing contact deepens');assert.equal(herdDecreases(a,[right,left],d),true,'the total squared actual body depth decreases for the whole interval');
 assert.equal(herdPotential(a,[right,left],{x:0,y:0,z:0}),2.5);assert.equal(herdPotential(a,[right,left],d),2.125,'ranking uses the same squared per-body depths');
 assert.equal(herdDecreases(a,[[box('equal-right',.5)],[box('equal-left',-.5)]],d),false,'a derivative that starts zero then increases is refused');assert.equal(herdDecreases(a,[right,left],{x:0,y:0,z:0}),false,'no net repair is not movement');assert.throws(()=>herdDecreases(structuredClone(a),[right,left],d));assert.equal(JSON.stringify([a,right,left]),before);
 const s=acceptedBriefingNative(),rows=capturePreparationBodyBounds(s),hob=preparationNativeBodyParts(rows.find(r=>r.id==='hob'),rows),levi=preparationNativeBodyParts(rows.find(r=>r.id==='levi'),rows);assert.equal(herdDecreases(hob,[levi],{x:3.25,y:0,z:0}),false,'the genuine Hob depth rise also fails the global derivative check');
});
