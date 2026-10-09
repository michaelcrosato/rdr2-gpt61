// Staged simulation-unit fixtures, not public-input or complete mission receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RIVAL_ID } from '../content/campaign/bellwether-works.js';
import { ENGRAVED_REVOLVER_ID as GUN, WEAPON_THIEF_ID as THIEF, advanceWeaponCustody, getWeaponInteractions, interactWeaponCustody, dropOwnedWeapon, recordCustodyShot, validateWeaponCustody } from '../src/rival-weapon-custody.js';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(obstacles=[]){
  const world={id:'bellwether-works',width:2000,height:1000,obstacles},r={status:'active',mission:{stage:5},rival:{weaponCustody:null},transactions:{},focus:{active:false,marks:[],queue:[],clock:0}};
  const s={elapsed:0,region:world.id,regions:{[world.id]:{},snowbound:{}},campaign:{activeMissionId:RIVAL_ID,missions:{[RIVAL_ID]:r,opening:{flags:{pavelChoice:'release',patientAlive:true}}}},entities:{},weapons:{'mara-revolver':{id:'mara-revolver',kind:'revolver',owner:'mara',capacity:6,ammo:3,reserve:18,location:'carried'}},companions:{bastian:{trust:0,requests:0}},honor:10};
  const person=(id,x,y)=>({id,x,y,z:0,hp:100,regionId:world.id,mounted:false,carrying:null,stamina:100});
  s.player=s.entities.mara={...person('mara',1020,200),equippedWeaponId:'mara-revolver'};
  s.entities.bastian={...person('bastian',1180,200),weapon:{id:GUN,kind:'revolver',capacity:6,condition:.83,owner:'bastian'},ammo:6,reserve:12};
  s.entities[THIEF]={...person(THIEF,1040,200),category:'enemy',active:true,weapon:{id:THIEF+'-carbine',kind:'carbine',capacity:7,ammoType:'tern-cartridge',owner:THIEF,condition:.9},ammo:4,reserve:14};
  const events=[],ctx={worldFor:()=>world,present:(state,kind,target,targetId,from,actorId)=>events.push({kind,targetId,actorId,target:clone(target)}),notice:()=>{}};
  const tick=(dt=.1)=>{s.elapsed+=dt;advanceWeaponCustody(s,dt,ctx,world);assert.equal(validateWeaponCustody(s),true);};
  const until=(predicate,max=200)=>{for(let i=0;i<max&&!predicate();i++)tick();assert.ok(predicate(),'fixture phase should eventually reach the requested physical condition');};
  return{s,r,world,ctx,events,tick,until};
}
function disarm(f){assert.ok(getWeaponInteractions(f.s).some(a=>a.id==='weapon:disarm-grappler'));assert.equal(interactWeaponCustody(f.s,'weapon:disarm-grappler',f.ctx),true);f.until(()=>f.r.rival.weaponCustody.phase==='pursuing');}
function steal(f){disarm(f);f.until(()=>f.r.rival.weaponCustody.phase==='grappling');f.until(()=>f.r.rival.weaponCustody.phase==='dropped');return f.s.weapons[GUN];}
function collect(f){steal(f);f.s.player.x=f.s.entities.bastian.x;f.s.player.y=f.s.entities.bastian.y;assert.equal(interactWeaponCustody(f.s,'weapon:collect-engraved',f.ctx),true);return f.s.weapons[GUN];}

test('a real adjacent disarm takes time and preserves the displaced carbine and ammo',()=>{
  const f=fixture(),before=clone(f.s.entities[THIEF]);assert.equal(interactWeaponCustody(f.s,'weapon:disarm-grappler',f.ctx),true);
  for(let i=0;i<5;i++)f.tick();assert.equal(f.s.entities[THIEF].weapon.id,before.weapon.id);assert.equal(f.s.weapons[GUN],undefined);f.tick();
  const c=f.r.rival.weaponCustody;assert.equal(c.phase,'pursuing');assert.equal(c.guardWeapon.id,before.weapon.id);assert.equal(c.guardWeapon.ammo,4);assert.equal(c.guardWeapon.reserve,14);assert.equal(c.guardWeapon.dropPoint.x,before.x);assert.equal(f.s.entities[THIEF].weapon,null);assert.equal(f.s.player.stamina,92);assert.equal(f.s.entities[THIEF].hp,100);
});
test('separation, a mounted donor and solid obstruction prevent remote grapple completion',()=>{
  const f=fixture();disarm(f);f.until(()=>f.r.rival.weaponCustody.phase==='grappling');for(let i=0;i<8;i++)f.tick();assert.equal(f.s.weapons[GUN],undefined);f.s.entities.bastian.x+=100;f.tick();assert.equal(f.r.rival.weaponCustody.phase,'pursuing');assert.equal(f.s.weapons[GUN],undefined);
  f.s.entities.bastian.mounted=true;for(let i=0;i<30;i++)f.tick();assert.equal(f.s.weapons[GUN],undefined);assert.equal(f.r.rival.weaponCustody.phase,'pursuing');
  const blocked=fixture([{id:'solid-wall',x:1100,y:0,w:20,h:1000,height:80}]);disarm(blocked);for(let i=0;i<80;i++)blocked.tick();assert.ok(blocked.s.entities[THIEF].x<1100);assert.equal(blocked.s.weapons[GUN],undefined);
});
test('exactly one engraved instance is displaced after an actual 0.9-second contact',()=>{
  const f=fixture(),initial=f.s.entities.bastian.ammo+f.s.entities.bastian.reserve;disarm(f);const x=f.s.entities[THIEF].x;f.until(()=>f.r.rival.weaponCustody.phase==='grappling');assert.ok(f.s.entities[THIEF].x>x);const started=f.s.elapsed;for(let i=0;i<8;i++)f.tick();assert.equal(f.s.weapons[GUN],undefined);f.tick();
  const w=f.s.weapons[GUN];assert.ok(f.s.elapsed-started>=.899999);assert.equal(w.owner,'bastian');assert.equal(w.location,'dropped');assert.equal(w.dropPoint.x,f.s.entities.bastian.x);assert.equal(w.ammo+w.reserve,initial);assert.equal(w.condition,.83);assert.equal(f.s.entities.bastian.weapon,null);assert.equal(f.s.entities.bastian.ammo,0);assert.equal(f.s.entities.bastian.reserve,0);assert.equal(f.s.entities.bastian.gunDisarmed,true);
});
test('a killed guard never completes the pending disarm or invents Bastian’s gun',()=>{
  const f=fixture();assert.equal(interactWeaponCustody(f.s,'weapon:disarm-grappler',f.ctx),true);f.tick();f.s.entities[THIEF].hp=0;f.tick();f.tick();assert.equal(f.s.weapons[GUN],undefined);assert.equal(f.s.entities.bastian.weapon.id,GUN);assert.equal(f.s.entities.bastian.ammo,6);assert.equal(f.s.player.stamina,100);
});
test('player and thief pickups contest the same object without double ownership or ammo',()=>{
  const f=fixture(),w=collect(f);assert.equal(w.owner,'mara');assert.equal(w.location,'carried');assert.equal(interactWeaponCustody(f.s,'weapon:collect-engraved',f.ctx),false);f.tick();assert.equal(f.s.entities[THIEF].equippedWeaponId,undefined);assert.equal(w.ammo,6);assert.equal(w.reserve,12);assert.equal(f.s.companions.bastian.trust,0);
});
test('the thief can approach, take and spend registry ammunition; death drops the same remainder',()=>{
  const f=fixture();steal(f);f.until(()=>f.r.rival.weaponCustody.phase==='thief-held');const w=f.s.weapons[GUN];assert.equal(w.owner,THIEF);assert.equal(f.s.entities[THIEF].equippedWeaponId,GUN);assert.equal(f.s.entities[THIEF].ammo,0);assert.equal(f.s.entities[THIEF].reserve,0);assert.equal(f.s.entities[THIEF].weapon.registryOwned,true);
  // Simulated core projectile consumption, not a fabricated controller receipt.
  w.ammo--;assert.equal(recordCustodyShot(f.s,THIEF,GUN),true);f.s.entities[THIEF].hp=0;assert.equal(dropOwnedWeapon(f.s,THIEF,f.ctx),true);assert.equal(w.location,'dropped');assert.equal(w.ammo,5);assert.equal(w.dropPoint.x,f.s.entities[THIEF].x);assert.equal(dropOwnedWeapon(f.s,THIEF,f.ctx),false);assert.equal(validateWeaponCustody(f.s),true);
});
test('return restores the private donor weapon with its actual remaining rounds and once-only effects',()=>{
  const f=fixture(),w=collect(f);w.ammo=2;f.r.rival.shots=Array.from({length:4},()=>({weaponId:GUN}));f.s.player.equippedWeaponId=GUN;assert.equal(interactWeaponCustody(f.s,'weapon:return-engraved',f.ctx),true);assert.equal(f.s.weapons[GUN],undefined);assert.equal(f.s.entities.bastian.weapon.id,GUN);assert.equal(f.s.entities.bastian.weapon.condition,.83);assert.equal(f.s.entities.bastian.ammo,2);assert.equal(f.s.entities.bastian.reserve,12);assert.equal(f.s.player.equippedWeaponId,'mara-revolver');assert.equal(f.s.companions.bastian.trust,2);assert.equal(f.s.honor,11);assert.equal(interactWeaponCustody(f.s,'weapon:return-engraved',f.ctx),false);assert.equal(validateWeaponCustody(f.s),true);
});
test('keeping records one disputed claim without a second gun or repeat reward',()=>{
  const f=fixture();collect(f);assert.equal(interactWeaponCustody(f.s,'weapon:keep-engraved',f.ctx),true);assert.equal(f.s.companions.bastian.trust,-2);assert.equal(f.s.honor,9);assert.equal(interactWeaponCustody(f.s,'weapon:keep-engraved',f.ctx),false);assert.equal(interactWeaponCustody(f.s,'weapon:return-engraved',f.ctx),false);assert.equal(Object.keys(f.s.weapons).filter(id=>id===GUN).length,1);assert.equal(validateWeaponCustody(f.s),true);
});
test('unreachable or obstructed pickup and return never transfer ownership',()=>{
  const f=fixture();steal(f);f.s.player.x=10;assert.equal(interactWeaponCustody(f.s,'weapon:collect-engraved',f.ctx),false);f.s.player.x=f.s.entities.bastian.x+34;f.s.player.y=f.s.entities.bastian.y;f.world.obstacles.push({id:'pickup-screen',x:f.s.player.x-20,y:150,w:5,h:100,height:70});assert.equal(interactWeaponCustody(f.s,'weapon:collect-engraved',f.ctx),false);assert.equal(f.s.weapons[GUN].owner,'bastian');
});
test('serialized custody is finite and preserves prior histories; duplicate/private/future fabrication is rejected',()=>{
  const f=fixture(),prior=clone(f.s.campaign.missions.opening);collect(f);assert.equal(validateWeaponCustody(clone(f.s)),true);assert.deepEqual(f.s.campaign.missions.opening,prior);
  const duplicate=clone(f.s);duplicate.entities.bastian.weapon={id:GUN,kind:'revolver',capacity:6,owner:'bastian'};duplicate.entities.bastian.ammo=6;duplicate.entities.bastian.reserve=12;assert.equal(validateWeaponCustody(duplicate),false);
  const future=clone(f.s);future.campaign.missions[RIVAL_ID].rival.weaponCustody.createdAt=future.elapsed+1;assert.equal(validateWeaponCustody(future),false);
  const refill=clone(f.s);refill.weapons[GUN].ammo=7;assert.equal(validateWeaponCustody(refill),false);
  const wrongOwner=clone(f.s);wrongOwner.weapons[GUN].owner='calder';assert.equal(validateWeaponCustody(wrongOwner),false);
});
test('an owner death drops an existing returned gun without recreating original ammunition',()=>{
  const f=fixture();collect(f);assert.equal(interactWeaponCustody(f.s,'weapon:return-engraved',f.ctx),true);f.s.entities.bastian.ammo=1;assert.equal(recordCustodyShot(f.s,'bastian',GUN,5),true);f.s.entities.bastian.hp=0;assert.equal(dropOwnedWeapon(f.s,'bastian',f.ctx),true);assert.equal(f.s.weapons[GUN].ammo,1);assert.equal(f.s.weapons[GUN].reserve,12);assert.equal(validateWeaponCustody(f.s),true);
  const untouched=fixture();assert.equal(dropOwnedWeapon(untouched.s,'bastian',untouched.ctx),false);assert.equal(untouched.s.weapons[GUN],undefined);
});
test('captured rounds and actual NPC/player receipts reject bounded refills and unearned owner transfers',()=>{
  const f=fixture();collect(f);f.s.weapons[GUN].ammo--;f.r.rival.shots=[{weaponId:GUN}];assert.equal(validateWeaponCustody(f.s),true);
  const refill=clone(f.s);refill.weapons[GUN].ammo=6;assert.equal(validateWeaponCustody(refill),false,'within-capacity refill still fabricates a spent round');
  const uncollected=fixture();steal(uncollected);uncollected.s.weapons[GUN].owner='mara';uncollected.s.weapons[GUN].location='carried';delete uncollected.s.weapons[GUN].dropPoint;uncollected.r.rival.weaponCustody.phase='player-held';assert.equal(validateWeaponCustody(uncollected.s),false);
});
test('lawful later-mission consumption uses an explicit external-shot hook without changing Rival receipts',()=>{
  const f=fixture();collect(f);f.s.campaign.activeMissionId='snowbound-a-quiet-table';f.s.weapons[GUN].ammo--;assert.equal(recordCustodyShot(f.s,'mara',GUN),true);assert.equal(f.r.rival.weaponCustody.externalShots,1);assert.equal((f.r.rival.shots||[]).length,0);assert.equal(validateWeaponCustody(f.s),true);
});
test('Mara can select only her actually collected carried gun, including raw Saves without player aliases',()=>{
  const dropped=fixture();steal(dropped);
  assert.equal(dropped.s.weapons[GUN].owner,'bastian');
  assert.equal(dropped.s.weapons[GUN].location,'dropped');
  const thief=fixture();steal(thief);thief.until(()=>thief.r.rival.weaponCustody.phase==='thief-held');
  assert.equal(thief.s.weapons[GUN].owner,THIEF);
  assert.equal(thief.s.weapons[GUN].location,'carried');
  const collected=fixture();collect(collected);collected.s.player.equippedWeaponId=GUN;
  assert.equal(validateWeaponCustody(collected.s),true,'the timed theft and actual collection authorize selection');
  for(const raw of [false,true]){
    const lawful=clone(collected.s);if(raw)delete lawful.player;else lawful.player=lawful.entities.mara;
    assert.equal(validateWeaponCustody(lawful),true,`owned carried selection remains valid with raw=${raw}`);
    for(const [description,source] of [['Bastian-owned dropped gun',dropped.s],['thief-owned carried gun',thief.s]]){
      assert.equal(validateWeaponCustody(source),true,'the earned custody state is legal before the negative selection mutation');
      const forged=clone(source);forged.entities.mara.equippedWeaponId=GUN;
      if(raw)delete forged.player;else forged.player=forged.entities.mara;
      assert.equal(validateWeaponCustody(forged),false,`${description} cannot become Mara’s selected weapon with raw=${raw}`);
    }
  }
  assert.equal(dropOwnedWeapon(collected.s,'mara',collected.ctx),true,'a later real owner drop switches to a lawful fallback');
  assert.equal(collected.s.player.equippedWeaponId,'mara-revolver');
  const forgedDrop=clone(collected.s);delete forgedDrop.player;forgedDrop.entities.mara.equippedWeaponId=GUN;
  assert.equal(validateWeaponCustody(forgedDrop),false,'Mara’s prior ownership does not authorize a dropped weapon');
});
