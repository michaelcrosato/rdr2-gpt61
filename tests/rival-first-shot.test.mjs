// Staged stage-four module fixtures isolate shot ordering. They are not earned
// mission histories, valid full Saves, public-control or source-game evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RIVAL_ID,RIVAL_CAST,RIVAL_ENEMIES,RIVAL_WORLD as WORLD,RIVAL_CARBINE} from '../content/campaign/bellwether-works.js';
import {createRivalRecord,getRivalInteractions,interactRival,chooseRival,stepRival,shootRival,reloadRival,cancelRivalFocus} from '../src/rival-mission.js';

const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(ammo=7){
  const r=createRivalRecord();r.status='active';r.mission.stage=4;r.flags.approachReady=true;
  r.rival.reconEventPhase=3;r.rival.calderIndex=WORLD.calderEscape.length;r.rival.dismissalIndex=WORLD.recon.leviDismissal.length;
  const s={region:WORLD.id,elapsed:100,time:8,day:1,notices:[],log:[],bullets:[],dialog:null,failure:null,entities:{},inventory:{},companions:{ruth:{trust:0},bastian:{trust:0},emmett:{trust:0}},stats:{distance:0,shots:0,hostileHits:0,kills:0},campaign:{activeMissionId:RIVAL_ID,missions:{[RIVAL_ID]:r}},regions:{snowbound:{residentIds:[]},[WORLD.id]:{residentIds:[]}},weapons:{[RIVAL_CARBINE.id]:{...RIVAL_CARBINE,owner:'mara',location:'carried',ammo,reserve:49-ammo}}};
  const person=(id,place)=>({id,name:id,x:place.x,y:place.y,z:place.z||0,hp:100,stamina:100,focus:100,facing:0,mounted:false,carrying:null,shotTimer:0,reloadTimer:0,blockTimer:0,regionId:WORLD.id});
  for(const actor of [...RIVAL_CAST,...RIVAL_ENEMIES])s.entities[actor.id]=clone(actor);
  s.entities.mara={...person('mara',WORLD.readyCover),equippedWeaponId:RIVAL_CARBINE.id,holstered:false};
  s.entities.copper={...person('copper',{x:1280,y:1520}),kind:'horse',following:false};
  s.entities.tomas=person('tomas',WORLD.yardCover.tomas);s.entities.inez=person('inez',WORLD.yardCover.inez);
  for(const [actorId,mountId] of [['tomas','tomas-mount'],['inez','thimble'],['ruth','plover'],['bastian','cinder'],['emmett','button']]){
    Object.assign(s.entities[actorId],person(actorId,WORLD.yardCover[actorId]),{mountId});
    s.entities[mountId]={...person(mountId,{x:900,y:1150,z:72}),kind:'horse'};
  }
  s.player=s.entities.mara;s.horse=s.entities.copper;s.mission=r.mission;s.party={playerId:'mara',mountId:'copper'};
  const events=[],checkpoints=[],ctx={
    worldFor:()=>WORLD,addEntity:(state,actor)=>state.entities[actor.id],
    present:(state,kind,target,targetId,from,actorId)=>events.push({kind,actorId,targetId}),
    log:(state,text)=>state.log.push({text}),notice:()=>{},fail:(state,reason)=>{state.failure={reason};},
    talk:(state,id,speaker,text,choices)=>{state.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};},
    checkpoint:(state,key)=>checkpoints.push({key,state:clone(state)}),
  };
  const tick=(seconds,input={})=>{for(let age=0;age<seconds-1e-8;age+=.05)stepRival(s,Math.min(.05,seconds-age),input,ctx);assert.equal(s.failure,null);};
  const choose=(first='player-first')=>{assert.ok(getRivalInteractions(s,ctx).some(action=>action.id==='choose-first'));interactRival(s,'choose-first',ctx);assert.ok(s.dialog.choices.some(choice=>choice.id===first));chooseRival(s,first,ctx);};
  return {s,r,ctx,events,checkpoints,tick,choose};
}
const yard=state=>RIVAL_ENEMIES.filter(actor=>actor.wave==='yard').map(actor=>state.entities[actor.id]);
const shots=events=>events.filter(event=>event.kind==='shoot');

test('choosing Mara holds both sides through idle time and the ready checkpoint until an actual round leaves her gun',()=>{
  const f=fixture();f.choose();f.tick(8);
  assert.equal(f.r.mission.stage,5);assert.equal(f.r.performance.shots,0);assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,7);
  assert.deepEqual(shots(f.events),[]);assert.ok(yard(f.s).every(actor=>!actor.active&&actor.ammo===7));
  assert.ok(['mara','tomas','ruth','bastian','emmett','inez'].every(id=>f.s.entities[id].hp===100));
  const checkpoint=f.checkpoints.find(entry=>entry.key==='yard-battle').state;
  assert.equal(checkpoint.campaign.missions[RIVAL_ID].rival.yardOpening.shotSerial,null);
  assert.ok(yard(checkpoint).every(actor=>!actor.active));assert.deepEqual(checkpoint.bullets,[]);
  const target=yard(f.s)[0];shootRival(f.s,target.x,target.y,f.ctx,{z:44});
  assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,6);assert.equal(f.r.performance.shots,1);
  assert.equal(f.s.bullets[0].shooterId,'mara');assert.equal(shots(f.events)[0].actorId,'mara');
  assert.equal(f.r.rival.yardOpening.shotSerial,1);assert.equal(f.r.rival.yardOpening.firedAt,f.s.elapsed);
  assert.ok(yard(f.s).every(actor=>actor.active));
});

test('holstered and dry triggers and a real reload never substitute for Mara’s signal projectile',()=>{
  const f=fixture(0);f.choose();const target=yard(f.s)[0];
  f.s.player.holstered=true;shootRival(f.s,target.x,target.y,f.ctx,{z:44});f.s.player.holstered=false;
  shootRival(f.s,target.x,target.y,f.ctx,{z:44});f.tick(3);assert.deepEqual(shots(f.events),[]);
  reloadRival(f.s,f.ctx);f.tick(2.5);assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,7);
  assert.equal(f.r.rival.yardOpening.firedAt,null);assert.ok(yard(f.s).every(actor=>!actor.active));
  shootRival(f.s,target.x,target.y,f.ctx,{z:44});assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,6);
  assert.equal(f.s.bullets[0].shooterId,'mara');assert.ok(yard(f.s).every(actor=>actor.active));
});

test('poised visible targets can be marked and cancelled; the focus queue releases the yard only when its first shot actually fires',()=>{
  const f=fixture();f.choose();
  // Explicit local aiming-proximity fixture, without changing targets, rounds,
  // life, focus outcomes or the pending signal established by the actual choice.
  Object.assign(f.s.player,{x:1500,y:1500,z:0});
  for(const id of WORLD.firstShotCover.focusOpportunity){const target=f.s.entities[id];f.tick(.1,{focus:true,aimX:target.x,aimY:target.y,aimZ:44});}
  assert.equal(f.r.focus.marks.length,3);assert.ok(f.s.player.focus<100);assert.deepEqual(shots(f.events),[]);
  cancelRivalFocus(f.s);assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,7);assert.equal(f.r.rival.yardOpening.firedAt,null);
  for(const id of WORLD.firstShotCover.focusOpportunity){const target=f.s.entities[id];f.tick(.1,{focus:true,aimX:target.x,aimY:target.y,aimZ:44});}
  const target=f.s.entities[WORLD.firstShotCover.focusOpportunity[2]];shootRival(f.s,target.x,target.y,f.ctx,{z:44});
  assert.equal(f.r.focus.queue.length,3);assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,7);assert.ok(yard(f.s).every(actor=>!actor.active));
  f.tick(.05,{focus:true});assert.equal(f.s.weapons[RIVAL_CARBINE.id].ammo,6);assert.equal(f.s.bullets[0].shooterId,'mara');
  assert.equal(shots(f.events)[0].actorId,'mara');assert.equal(f.r.rival.yardOpening.shotSerial,1);assert.ok(yard(f.s).every(actor=>actor.active));
});

test('Tomas’s choice spends his real round and places his signal projectile in the ready checkpoint before either side can fire',()=>{
  const f=fixture();f.choose('tomas-first');
  assert.equal(f.r.choices.firstShot,'tomas');assert.equal(f.r.performance.shots,0);assert.equal(f.s.entities.tomas.ammo,6);
  assert.equal(f.s.bullets[0].shooterId,'tomas');assert.equal(shots(f.events)[0].actorId,'tomas');
  const checkpoint=f.checkpoints.find(entry=>entry.key==='yard-battle').state;
  assert.equal(checkpoint.bullets[0].shooterId,'tomas');assert.equal(checkpoint.entities.tomas.ammo,6);
  assert.ok(yard(f.s).every(actor=>actor.active));
});
