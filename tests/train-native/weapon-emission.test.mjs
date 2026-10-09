/** Explicit component fixtures. These are not valid Journeys or earned train
 * scenes; they isolate registry/private-stock and native-motion emission rules. */
import test from 'node:test';import assert from 'node:assert/strict';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {createTrainCombat,resolveTrainWeapon,emitTrainShot,requestTrainReload,stepTrainReload} from '../../src/train-combat.js';
function fixture(){return{elapsed:12,dialog:null,failure:null,stats:{shots:0},bullets:[],campaign:{activeMissionId:TRAIN_ID,missions:{[TRAIN_ID]:{performance:{shots:0},train:{combat:createTrainCombat()}}}},entities:{mara:{id:'mara',hp:100,x:10,y:20,z:84,vx:85,vy:0,vz:1,holstered:false,equippedWeaponId:'test-carbine',shotTimer:0,reloadTimer:0},helper:{id:'helper',hp:100,x:20,y:20,z:26,holstered:false,ammo:2,reserve:5,weapon:{id:'helper-private',kind:'revolver',capacity:6,owner:'helper'}}},weapons:{'test-carbine':{id:'test-carbine',kind:'carbine',capacity:7,ammo:1,reserve:9,owner:'mara',location:'carried'}}};}
test('moving shot consumes exactly its original registry round and inherits actual muzzle-body velocity',()=>{
  const s=fixture(),gun=s.weapons['test-carbine'],target={x:1000,y:20,z:113};
  const bullet=emitTrainShot(s,'mara',target);assert.ok(bullet);assert.equal(gun.ammo,0);assert.equal(gun.reserve,9);
  assert.equal(s.stats.shots,1);assert.equal(s.campaign.missions[TRAIN_ID].performance.shots,1);
  assert.equal(bullet.vx,805);assert.equal(bullet.vy,0);assert.equal(bullet.vz,1);assert.equal(s.bullets.length,1);
  assert.equal(emitTrainShot(s,'mara',target),false);assert.equal(s.bullets.length,1,'empty/cooling trigger creates no duplicate emission');
  assert.ok(requestTrainReload(s,'mara'));for(let i=0;i<23;i++)stepTrainReload(s,'mara',.1);
  assert.equal(gun.ammo,0,'pending reload has not spent or loaded stock');stepTrainReload(s,'mara',.1);
  assert.equal(gun.ammo,7);assert.equal(gun.reserve,2);assert.equal(gun.ammo+gun.reserve,9);
});
test('NPC private and registry descriptors resolve one current stock and interrupt reload on ownership change',()=>{
  const s=fixture(),helper=s.entities.helper;
  assert.equal(resolveTrainWeapon(s,'helper').stock,helper);assert.ok(emitTrainShot(s,'helper',{x:400,y:20,z:55},{faction:'ally'}));assert.equal(helper.ammo,1);assert.equal(helper.reserve,5);
  assert.ok(requestTrainReload(s,'helper'));helper.weapon.registryOwned=true;helper.equippedWeaponId='borrowed';
  s.weapons.borrowed={id:'borrowed',kind:'revolver',capacity:6,ammo:3,reserve:4,owner:'elsewhere',location:'carried'};
  assert.equal(stepTrainReload(s,'helper',.1),false);assert.equal(helper.reloadTimer,0);assert.equal(helper.ammo,1);assert.equal(s.weapons.borrowed.ammo,3);
});
test('malformed aim, inherited velocity and unavailable gun actions spend no stock or fabricate a bullet',()=>{
  for(const change of [s=>s.entities.mara.vx=NaN,s=>s.entities.mara.z=NaN,s=>s.entities.mara.attachment={type:'passenger',targetId:'mount'},s=>s.weapons['test-carbine'].location='saddle',s=>s.weapons['test-carbine'].capacity=999,s=>s.entities.mara.hp=0]){
    const s=fixture();change(s);assert.equal(emitTrainShot(s,'mara',{x:100,y:20,z:113}),false);assert.equal(s.weapons['test-carbine'].ammo,1);assert.equal(s.bullets.length,0);
  }
  const s=fixture();assert.equal(emitTrainShot(s,'mara',{x:Infinity,y:20,z:113}),false);assert.equal(s.weapons['test-carbine'].ammo,1);
});
