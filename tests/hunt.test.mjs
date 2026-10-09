import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// The staging override disappears naturally when this file moves into tests/.
const project = process.env.DUST_MERCY_REPO_ROOT
  ? new URL(`file://${process.env.DUST_MERCY_REPO_ROOT.replace(/\/$/, '')}/`)
  : new URL('../', import.meta.url);
const Journey = await import(new URL('src/campaign-journey.js', project));
const { HUNT_CAST, HUNT_ANIMALS, WILLOW_RUN_WORLD: WORLD, HUNT_BOW } = await import(new URL('content/campaign/willow-run.js', project));
const { RIVAL_CAST, RIVAL_ENEMIES } = await import(new URL('content/campaign/bellwether-works.js', project));
const OPENING = 'snowbound-the-last-warm-light';
const RESCUE = 'snowbound-a-voice-under-ice';
const HUNT = 'snowbound-a-quiet-table';
const fixtureDir = new URL('tests/fixtures/', project);
const manifest = JSON.parse(fs.readFileSync(new URL('journey-v2-provenance.json', fixtureDir), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const encode = state => JSON.parse(Journey.serializeCampaign(state));
function fixture(name) {
  const filename = `journey-v2-${name}.json.gz`;
  const record = manifest.fixtures.find(value => value.fixture === filename);
  assert.ok(record, `${filename} has public-control provenance`);
  const raw = gunzipSync(fs.readFileSync(new URL(filename, fixtureDir)));
  assert.equal(createHash('sha256').update(raw).digest('hex'), record.sha256OfUncompressedOriginalBytes, 'no original Save bytes were rewritten');
  const data = JSON.parse(raw);
  assert.equal(data.version, 2);
  return data;
}
function missionDurables(record) {
  const value = clone(record);
  // Authored display copy may be reconciled as the next story becomes available.
  delete value.mission.name;
  delete value.mission.objective;
  return value;
}
function noHuntGift(body, previous) {
  const hunt = body.campaign.missions[HUNT];
  assert.ok(hunt, 'migration adds a distinct mission record');
  assert.equal(hunt.status, previous.campaign.missions[RESCUE].mission.completed ? 'unstarted' : 'locked');
  assert.equal(hunt.mission.completed, false);
  assert.equal(hunt.mission.rewardPaid, false);
  assert.equal(hunt.mission.stage, 0);
  assert.equal(hunt.mission.stageCount, 11);
  assert.deepEqual(body.itemInstances, {}, 'old Saves cannot manufacture hunt item instances');
  const willow = body.regions['willow-run'];
  for (const [key, empty] of [['worldChanges', {}], ['supplies', []], ['dropped', {}]]) assert.deepEqual(willow[key], empty, `the new region has no completed ${key}`);
  for (const id of willow.residentIds) {
    const authored = HUNT_ANIMALS.find(animal => animal.id===id);
    assert.ok(authored, 'only newly authored hunting animals reside in the new region');
    const actor = body.entities[id];
    assert.equal(actor.hp, authored.hp, 'migration does not wound or kill a new animal');
    assert.equal(actor.processed, false);
    assert.equal(actor.attachment, null);
    if (authored.quality!==undefined) assert.equal(actor.hunt.quality, authored.quality, 'initial quality is authored state, not an earned kill record');
  }
  if (!previous.campaign.missions[RESCUE].mission.completed) assert.deepEqual(willow.residentIds, [], 'locked hunting does not add its animals early');
  assert.equal(body.weapons['juno-ash-bow'], undefined);
  for (const id of ['quietRation', 'rawVenison', 'tableBroth', 'kitchenStarterFuel']) {
    assert.equal(body.inventory[id] || 0, 0, `migration grants no ${id}`);
  }
}
function assertMigratedBody(previous, current) {
  assert.equal(current.version, 4);
  assert.equal(current.region, previous.region);
  assert.equal(current.campaign.activeMissionId, previous.campaign.activeMissionId);
  assert.deepEqual(current.party, previous.party);
  assert.deepEqual(current.weapons, previous.weapons, 'loan and earned ownership/ammo/rack state remain authoritative');
  for (const key of ['inventory', 'camp', 'sideQuests', 'wanted', 'honor', 'stats', 'day', 'time', 'elapsed']) {
    assert.deepEqual(current[key], previous[key], `${key} survives migration without a world tick or grant`);
  }
  for(const [id,before]of Object.entries(previous.companions))assert.deepEqual(current.companions[id],before,`${id} prior relationship unchanged`);
  for(const id of Object.keys(current.companions).filter(id=>!Object.hasOwn(previous.companions,id))){assert.equal(previous.campaign.missions[RESCUE].mission.completed,true);assert.ok(['ruth','bastian','emmett'].includes(id));assert.deepEqual(current.companions[id],{trust:0,requests:0});}
  for (const id of [OPENING, RESCUE]) {
    assert.deepEqual(missionDurables(current.campaign.missions[id]), missionDurables(previous.campaign.missions[id]), `existing ${id} choices, timers, clinical/track/transaction/progress history stay intact`);
  }
  for (const [id, before] of Object.entries(previous.entities)) {
    assert.deepEqual(current.entities[id], before, `the existing ${id} body/attachment/pack is not regenerated`);
  }
  for (const id of Object.keys(current.entities).filter(id => !previous.entities[id])) {
    assert.equal(previous.campaign.missions[RESCUE].mission.completed, true, 'new hunting cast is gated by this branch’s actual rescue completion');
    const authored = [...HUNT_CAST, ...HUNT_ANIMALS, ...RIVAL_CAST, ...RIVAL_ENEMIES].find(actor => actor.id===id);
    assert.ok(authored, `migration cannot fabricate an unrelated ${id} actor`);
    assert.equal(current.entities[id].hp, authored.hp);
    assert.equal(current.entities[id].attachment, null);
  }
  for (const [id, before] of Object.entries(previous.regions)) {
    const after = current.regions[id];
    for (const key of ['worldChanges', 'supplies', 'dropped']) assert.deepEqual(after[key], before[key], `${id}.${key} survives migration`);
    assert.deepEqual(after.residentIds.filter(actorId => previous.entities[actorId]), before.residentIds, `${id} retains existing residence without a duplicate body`);
  }
  for (const [key, value] of Object.entries(previous.campaign.unlocks)) {
    const expected=['campaign-the-aftermath-of-genesis','campaign-old-friends'].includes(key) && previous.campaign.missions[RESCUE].mission.completed
      ? {...value,available:true} : value;
    assert.deepEqual(current.campaign.unlocks[key], expected, `${key} retains metadata; only implemented hunt availability may change after actual Rescue completion`);
  }
  noHuntGift(current, previous);
}
function assertMigratedFull(previous, current) {
  assertMigratedBody(previous, current);
  assert.deepEqual(Object.keys(current.checkpoints).sort(), Object.keys(previous.checkpoints).sort());
  for (const [id, before] of Object.entries(previous.checkpoints)) {
    const after = current.checkpoints[id];
    for (const key of ['id', 'missionId', 'stage', 'label']) assert.equal(after[key], before[key]);
    assertMigratedBody(before.data, after.data);
    for (const key of ['checkpoints', 'missionEntries', 'replayCanonical']) assert.equal(Object.hasOwn(after.data, key), false, 'each historical body remains nonrecursive');
  }
  assert.deepEqual(Object.keys(current.missionEntries).sort(), Object.keys(previous.missionEntries).sort());
  for (const [id, before] of Object.entries(previous.missionEntries)) assertMigratedBody(before, current.missionEntries[id]);
  assert.equal(Boolean(current.replayCanonical), Boolean(previous.replayCanonical));
  if (previous.replayCanonical) assertMigratedFull(previous.replayCanonical, current.replayCanonical);
}

// Unit placement establishes proximity only. Stages, choices, prey life, grants
// and transaction histories are never assigned to manufacture progression.
function standAt(state, target, dx=0, dy=0) {
  assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.y));
  Object.assign(state.player, {x:target.x+dx, y:target.y+dy, z:0});
}
function interact(state, id, defaultContext=false) {
  const offered = Journey.getCampaignInteractions(state);
  assert.ok(offered.some(action => action.id===id), `${id} must be actually offered: ${offered.map(action=>action.id).join(', ')}`);
  if (defaultContext) assert.equal(Journey.getCampaignInteraction(state)?.id, id, 'ordinary E chooses the required nearby action');
  Journey.interactCampaign(state, defaultContext ? null : id);
  return state;
}
function choose(state, id) {
  assert.ok(state.dialog?.choices.some(choice=>choice.id===id), `${id} must belong to the actual open dialogue`);
  Journey.chooseCampaign(state, id);
  return state;
}
function tick(state, seconds, input={}) {
  for (let elapsed=0;elapsed<seconds-1e-8;elapsed+=.05) Journey.stepCampaign(state, Math.min(.05,seconds-elapsed), input);
  return state;
}
function roundTrip(state, description='current scene') {
  const before = encode(state);
  const restored = Journey.restoreCampaign(before);
  assert.ok(restored, `${description} is a legal full graph Save`);
  const after = encode(restored);
  for (const key of ['entities','weapons','regions','itemInstances','campaign','checkpoints','missionEntries','replayCanonical','inventory','camp','wanted','honor','stats','dialog','failure']) assert.deepEqual(after[key], before[key], `${description}: ${key} persists without duplicated resources`);
  return restored;
}
const record = state => state.campaign.missions[HUNT];
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function until(state, condition, seconds=20, description='physical action') {
  for(let count=0;!condition() && count<seconds/.05;count++) {
    assert.equal(state.dialog,null, `${description} is not advanced through an open dialogue`);
    tick(state,.05);
    assert.equal(state.failure,null, `${description} remains safe`);
  }
  assert.ok(condition(), `${description} finished within the authored route's reasonable bound`);
  return state;
}
function walk(state, target, input={}) {
  for(let frame=0;distance(state.player,target)>7 && frame<2000;frame++) {
    const length=distance(state.player,target);
    Journey.stepCampaign(state,.05,{...input,mx:(target.x-state.player.x)/length,my:(target.y-state.player.y)/length});
    assert.equal(state.dialog,null,'movement does not silently dismiss dialogue');
    assert.equal(state.failure,null,`actual movement toward ${target.x},${target.y} stays safe`);
  }
  assert.ok(distance(state.player,target)<=7, `actual movement reaches ${target.x},${target.y}`);
}
function invite() {
  const state=Journey.restoreCampaign(fixture('rescue-complete'));
  assert.ok(state);
  standAt(state,state.entities.orla);
  interact(state,'talk:orla',true);
  assert.equal(state.dialog.speaker,'Orla Venn');
  choose(state,'ask-hunters');
  for(const [who,action,speaker] of [['moss','talk:moss-hunt','Moss Laird'],['vera','talk:vera-hunt','Vera Holl']]) {
    standAt(state,state.entities[who]);interact(state,action,true);
    assert.equal(state.dialog.speaker,speaker);choose(state,'leave');
  }
  standAt(state,state.entities.juno);interact(state,'talk:juno',true);
  assert.equal(state.dialog.speaker,'Juno Mercier');choose(state,'accept-hunt');
  assert.equal(state.campaign.activeMissionId,HUNT);
  assert.equal(state.mission.stage,0);
  return state;
}
function acceptTable(state=invite()) {
  standAt(state,WORLD.camp.flourMap);
  until(state,()=>distance(state.entities.juno,WORLD.camp.flourMap)<70,20,'Juno walks through the kitchen doorway to the flour map');
  interact(state,'accept:hunt',true);
  assert.equal(state.mission.stage,1);
  return state;
}
function equipment(state=acceptTable()) {
  // Juno's movement is never assigned; the gift must wait for her actual
  // collision-respecting arrival beside the canonical Copper body.
  until(state,()=>record(state).flags.bowGranted,20,'Juno brings the bow to Copper');
  standAt(state,state.horse,-24);
  interact(state,'rack:inspect-bow',true);choose(state,'leave');
  interact(state,'equip:ash-bow',true);
  assert.equal(state.player.equippedWeaponId,HUNT_BOW.id);
  until(state,()=>state.entities.juno.mounted,20,'Juno saddles and mounts her separate Bracken');
  return state;
}

for (const name of ['opening-departure', 'opening-carried', 'opening-complete', 'rescue-prepared', 'rescue-resting', 'rescue-carried', 'rescue-passenger', 'rescue-complete']) {
  test(`version 4 migrates the unmodified public version-2 ${name} Save and every historical graph`, () => {
    const old = fixture(name);
    const state = Journey.restoreCampaign(old);
    assert.ok(state, 'the authentic older public Save restores');
    const current = encode(state);
    assertMigratedFull(old, current);
    assert.strictEqual(state.player, state.entities.mara);
    assert.strictEqual(state.horse, state.entities[state.party.mountId]);
    const restored = Journey.restoreCampaign(current);
    assert.ok(restored, 'the complete migrated graph is a legal current Save');
    const again = encode(restored);
    for (const key of ['entities', 'weapons', 'regions', 'itemInstances', 'campaign', 'checkpoints', 'missionEntries', 'replayCanonical']) assert.deepEqual(again[key], current[key], `${key} survives the current codec without grants or duplicated bodies`);
  });
}

test('version-2 validation happens before adding a third mission, region or rewards', () => {
  const base = fixture('rescue-complete');
  const malformed = [
    ['forged earned coach owner', data => { data.weapons['coach-gun'].owner = 'juno'; }],
    ['fabricated pre-migration bow', data => { data.weapons['juno-ash-bow'] = {id:'juno-ash-bow',kind:'bow',capacity:1,ammoType:'standard-arrow',ammo:1,reserve:21,owner:'mara',loanMissionId:null,location:'carried',condition:1}; }],
    ['third mission disguised as v2', data => { data.campaign.missions[HUNT] = clone(data.campaign.missions[RESCUE]); }],
    ['third region disguised as v2', data => { data.regions['willow-run'] = {residentIds:[],worldChanges:{},supplies:[],dropped:{}}; }],
    ['clinical bed attachment forged to a new bench', data => { data.entities.silas.attachment.targetId='hunt-bench-mara'; }],
    ['Copper authority duplicated in another region', data => { data.regions['north-cutting'].residentIds.push('copper'); }],
    ['old completed record contradicts earned state', data => { data.campaign.missions[RESCUE].mission.completed=false; }],
  ];
  for (const [label, change] of malformed) {
    const data = clone(base); change(data);
    assert.ok(Journey.restoreCampaign(data) === null, label);
  }
});

test('inactive future rescue checkpoint is rejected before version-2 migration', () => {
  const prepared = fixture('rescue-prepared');
  const completed = fixture('rescue-complete');
  const cp = Object.values(completed.checkpoints).find(value => value.missionId===RESCUE && value.stage===9);
  assert.ok(cp, 'the actual complete run contains a later rescue checkpoint');
  const id = 'independent-future-rescue';
  prepared.checkpoints[id] = {...clone(cp), id};
  assert.equal(Journey.restoreCampaign(prepared), null, 'adding a coherent future branch does not make it lawful for an earlier current graph');
});

test('unstarted hunting cannot replay, draw or process through a requested action ID', () => {
  const state = Journey.restoreCampaign(fixture('rescue-complete'));
  assert.ok(state);
  const before = encode(state);
  Journey.beginCampaignReplay(state, HUNT);
  assert.equal(state.replayCanonical, null);
  Journey.beginCampaignDraw(state, 1360, 1060, {z:23});
  Journey.releaseCampaignDraw(state, 1360, 1060, {z:23});
  Journey.cancelCampaignDraw(state);
  Journey.interactCampaign(state, 'skin:bench-mara');
  Journey.interactCampaign(state, 'finish:hunt');
  Journey.chooseCampaign(state, 'donate-hide');
  const after = encode(state);
  for (const key of ['entities','weapons','regions','itemInstances','campaign','inventory','camp','honor','stats','checkpoints','missionEntries']) assert.deepEqual(after[key], before[key], `unoffered actions cannot alter ${key}`);
  roundTrip(state, 'untaught hunt after ignored actions');
});

test('current save rejects living rear cargo and fabricated hunt outcomes before any teaching', () => {
  const state = Journey.restoreCampaign(fixture('rescue-complete'));
  assert.ok(state);
  const base = encode(state);
  const malformed = [
    ['missing typed instance registry', data => { delete data.itemInstances; }],
    ['living deer presented as Copper cargo', data => {
      const deer=data.entities['willow-creek-doe'];
      deer.regionId=null; deer.attachment={type:'large-load',targetId:'copper'};
      data.regions['willow-run'].residentIds=data.regions['willow-run'].residentIds.filter(id=>id!==deer.id);
    }],
    ['completed quality predicates without animal history', data => {
      Object.assign(data.campaign.missions[HUNT].performance,{deerKilled:2,oneArrowEach:true,noSpook:true,secondCleanKill:true});
    }],
    ['bow draw without owned bow or teaching', data => {
      Object.assign(data.campaign.missions[HUNT].bow,{drawing:true,charge:1,age:1});
    }],
    ['finished cooking flag without bodies or yields', data => { data.campaign.missions[HUNT].flags.cooked=true; }],
    ['fabricated completed skin transaction', data => {
      data.campaign.missions[HUNT].transactions[`${HUNT}:skin:willow-creek-doe`]={amount:6,completed:true};
    }],
  ];
  for (const [label, change] of malformed) {
    const data=clone(base);change(data);
    assert.ok(Journey.restoreCampaign(data) === null,label);
  }
});

test('distinct physical kitchen conversations and map confirmation grant no imaginary pantry reset', () => {
  const state=invite();
  const old=fixture('rescue-complete');
  assert.equal(record(state).flags.orlaMet,true);
  assert.equal(record(state).flags.mossHeard,true);
  assert.equal(record(state).flags.veraHeard,true);
  assert.equal(record(state).flags.junoMet,true);
  assert.equal(state.inventory.quietRation || 0,0,'invitation precedes the actual ration gift');
  assert.equal(state.weapons[HUNT_BOW.id],undefined);
  const entry=state.missionEntries[HUNT];
  assert.ok(entry,'mission records its real entry before the gifts');
  assert.equal(entry.inventory.quietRation || 0,0);
  assert.equal(entry.weapons[HUNT_BOW.id],undefined);
  assert.deepEqual(state.campaign.missions[OPENING],old.campaign.missions[OPENING]);
  for(const key of ['food','medicine','materials','morale','upgrades']) assert.deepEqual(state.camp[key],old.camp[key],`existing camp${key} is conserved`);
  roundTrip(state,'accepted invitation before the flour map');
  acceptTable(state);
  assert.equal(state.inventory.quietRation,1);
  assert.equal(state.camp.pantry.kitchenStarterFuel,1,'kitchen fuel is its own authored gift');
  assert.equal(state.camp.pantry.warmCider,1);
  const cp=state.checkpoint;
  assert.equal(cp.data.inventory.quietRation || 0,0,'accepted-table checkpoint precedes the gift, enabling clean retry');
  const gifts=clone(record(state).transactions);
  Journey.interactCampaign(state,'accept:hunt');
  assert.equal(state.inventory.quietRation,1);
  assert.deepEqual(record(state).transactions,gifts,'reopening an unavailable confirmation cannot duplicate gifts');
  roundTrip(state,'map confirmed and ration actually gifted');
});

test('rack inspection waits for actual Juno arrival and the owned bow keeps other ammunition separate', () => {
  const state=acceptTable();
  standAt(state,state.horse,-24);
  assert.equal(state.weapons[HUNT_BOW.id],undefined,'Juno has not walked from the flour map to Copper yet');
  assert.ok(!Journey.getCampaignInteractions(state).some(action=>['rack:inspect-bow','equip:ash-bow'].includes(action.id)), 'an absent bow cannot be inspected or equipped');
  const otherWeapons=clone(state.weapons);
  equipment(state);
  const bow=state.weapons[HUNT_BOW.id];
  assert.equal(bow.owner,'mara');assert.equal(bow.kind,'bow');assert.equal(bow.ammoType,'arrow');
  assert.equal(bow.ammo+bow.reserve,22);
  assert.equal(bow.location,'carried');assert.equal(bow.loanMissionId,null);
  assert.equal(state.entities.bracken.ownerId,'juno');assert.equal(state.entities.juno.mounted,true);
  for(const [id,weapon] of Object.entries(otherWeapons)) assert.deepEqual(state.weapons[id],weapon,`${id} rounds/ownership stay independent from arrows`);
  const saved=roundTrip(state,'equipped bow and physically mounted Juno');
  const ammunition=saved.weapons[HUNT_BOW.id].ammo+saved.weapons[HUNT_BOW.id].reserve;
  Journey.interactCampaign(saved,'rack:inspect-bow');Journey.interactCampaign(saved,'accept:hunt');
  assert.equal(saved.weapons[HUNT_BOW.id].ammo+saved.weapons[HUNT_BOW.id].reserve,ammunition);
  assert.equal(Object.values(saved.weapons).filter(weapon=>weapon.kind==='bow').length,1);
});

test('satchel bow selection preserves the first rack inspection and subsequent legal equipment saves',()=>{
  const state=acceptTable();
  until(state,()=>record(state).flags.bowGranted,20,'Juno physically delivers the satchel-listed bow');
  standAt(state,state.horse,-24);
  const guns=clone(Object.fromEntries(Object.entries(state.weapons).filter(([,weapon])=>weapon.kind!=='bow')));
  for(const action of ['equip:juno-ash-bow','equip:bow']){
    Journey.campaignAction(state,action);
    assert.equal(record(state).flags.bowInspected,false);
    assert.equal(record(state).flags.bowEquipped,false,'the satchel cannot replace the first rack lesson');
    assert.equal(state.weapons[HUNT_BOW.id].location,'saddle');
    assert.ok(Journey.getCampaignInteractions(state).some(action=>action.id==='rack:inspect-bow'),'the nearby inspection remains available after the rejected shortcut');
    roundTrip(state,`uninspected bow after ${action}`);
  }
  interact(state,'rack:inspect-bow',true);choose(state,'leave');
  Journey.campaignAction(state,'equip:juno-ash-bow');
  assert.equal(state.player.equippedWeaponId,HUNT_BOW.id);
  assert.equal(record(state).flags.equipmentCheckpoint,true,'a legal satchel equip earns the same equipment checkpoint');
  assert.equal(state.checkpoint.id,`${HUNT}:equipment-secured`);
  roundTrip(state,'first inspected bow selected through the satchel');
  Journey.campaignAction(state,'rack:store-bow');
  Journey.campaignAction(state,'equip:coach-gun');
  assert.equal(state.player.equippedWeaponId,'coach-gun','owned guns remain independently selectable');
  Journey.campaignAction(state,'equip:bow');
  assert.equal(state.player.equippedWeaponId,HUNT_BOW.id,'the inspected bow can be retrieved again by its kind');
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,22,'equipment changes never consume or grant arrows');
  for(const [id,weapon]of Object.entries(guns))assert.deepEqual(state.weapons[id],weapon,`${id} ammunition and ownership remain unchanged`);
  roundTrip(state,'legal satchel re-equipment after storing the inspected bow');
});

test('Orla reports real prior pantry stock and legal early dialogue suspends without equipment grants', () => {
  const state=Journey.restoreCampaign(fixture('rescue-complete'));
  assert.ok(state);
  standAt(state,state.entities.orla);interact(state,'talk:orla',true);
  const conversation=roundTrip(state,'Orla’s initial three-choice conversation');
  choose(conversation,'ask-pantry');
  assert.ok(conversation.dialog.text.includes(`${conversation.camp.food} food portions`));
  assert.ok(conversation.dialog.text.includes(`${conversation.camp.medicine} medicine`));
  assert.ok(conversation.dialog.text.includes(`${conversation.camp.materials} repair materials`));
  assert.equal(conversation.inventory.quietRation || 0,0);
  assert.equal(conversation.weapons[HUNT_BOW.id],undefined);
  roundTrip(conversation,'Orla’s live-stock account');
  const forged=encode(state);
  forged.dialog.choices.push({id:'donate-hide',label:'Award a contribution without a hide.'});
  assert.equal(Journey.restoreCampaign(forged),null,'scene text cannot introduce a legally named choice from a different future scene');
});

test('hunting time continues Silas’s existing bedside recovery without replacing earlier people or regions', () => {
  const state=equipment();
  const silas=state.entities.silas;
  const clinical=state.campaign.missions[RESCUE].rescue.silas;
  const before={elapsed:state.elapsed,hp:silas.hp,hours:clinical.healingHours,injury:clinical.injury,scar:silas.scars,attachment:clone(silas.attachment),opening:clone(state.campaign.missions[OPENING]),north:clone(state.regions['north-cutting'].worldChanges)};
  tick(state,8);
  const elapsed=state.elapsed-before.elapsed;
  assert.ok(elapsed>7.9 && elapsed<8.1,'actual hunting frames advance world time');
  assert.ok(Math.abs(clinical.healingHours-Math.max(0,before.hours-elapsed/80))<1e-7);
  assert.ok(Math.abs(clinical.injury-Math.max(0,before.injury-elapsed/(80*18)))<1e-7);
  assert.ok(Math.abs(silas.hp-Math.min(100,before.hp+elapsed/160))<1e-7);
  assert.deepEqual(silas.attachment,before.attachment);
  assert.deepEqual(silas.scars,before.scar,'scars remain permanent despite scheduled healing');
  assert.deepEqual(state.campaign.missions[OPENING],before.opening);
  assert.deepEqual(state.regions['north-cutting'].worldChanges,before.north);
  assert.equal(state.entities.lark.hp,0,'the rescue’s lost mount stays dead');
  assert.equal(state.entities.juno.injured,true,'Juno’s own injury does not vanish with the bow gift');
  roundTrip(state,'hunting elapsed time and the persistent clinical graph');
});

// Beyond the explicitly labelled camp proximity setup, these helpers advance
// only through ordinary movement, offered verbs, actual draw/release and time.
function pathWalk(state, points, input={}) { for(const node of points) walk(state,node,input); return state; }
function bank(state=equipment(),closeSign=true) {
  interact(state,'mount',true);
  pathWalk(state,[{x:375,y:1140},{x:375,y:970},{x:600,y:970},WORLD.travelGate]);
  until(state,()=>distance(state.entities.juno,state.player)<140,10,'mounted Juno catches up to the trail gate');
  interact(state,'depart:willow',true);
  assert.equal(state.region,WORLD.id);assert.equal(state.mission.stage,2);
  pathWalk(state,WORLD.trail);
  interact(state,'lesson:wind',true);choose(state,'leave');
  interact(state,'dismount');
  walk(state,WORLD.hitch);
  interact(state,'hitch:bank',true);
  until(state,()=>state.mission.stage===3,8,'both mounts physically park at the bank');
  assert.equal(state.dialog.id,'hunt-sign-lesson');if(closeSign)choose(state,'leave');
  assert.ok(distance(state.horse,WORLD.mountParking.copper)<12);
  assert.ok(distance(state.entities.bracken,WORLD.mountParking.bracken)<12);
  assert.equal(state.horse.hitched,true);assert.equal(state.entities.bracken.hitched,true);
  return state;
}
function reed(state=bank()) {
  Journey.campaignAction(state,'crouch');
  walk(state,WORLD.searchRoute[0],{crouch:true});
  walk(state,WORLD.props.find(p=>p.id==='split-hoof'),{crouch:true});interact(state,'inspect:split-hoof',true);
  pathWalk(state,WORLD.searchRoute.slice(1,3),{crouch:true});
  walk(state,WORLD.props.find(p=>p.id==='cropped-stems'),{crouch:true});interact(state,'inspect:cropped-stems',true);
  walk(state,WORLD.searchRoute.at(-1),{crouch:true});interact(state,'confirm:reed-trail',true);
  assert.equal(state.mission.stage,4);assert.equal(state.tracks.overlay,false,'physical signs need no tracking-overlay activation');
  return state;
}
function vitalTarget(actor) {
  // Public authored vital geometry, calculated independently of the collision
  // function. Aim is a point and height, never a zone/target-success command.
  return {x:actor.x+Math.cos(actor.facing)*11,y:actor.y+Math.sin(actor.facing)*11,z:(actor.z||0)+23};
}
function loose(state,targetOrReader,hold=1.4) {
  const readTarget=typeof targetOrReader==='function'?targetOrReader:()=>targetOrReader;
  let target=readTarget();
  const shots=state.stats.shots,ammo=state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve;
  Journey.beginCampaignDraw(state,target.x,target.y,{z:target.z});
  assert.equal(state.bow.drawing,true);
  for(let elapsed=0;elapsed<hold-1e-8;elapsed+=.05){
    target=readTarget();tick(state,Math.min(.05,hold-elapsed),{aimX:target.x,aimY:target.y,aimZ:target.z,drawHeld:true});
  }
  target=readTarget();
  Journey.releaseCampaignDraw(state,target.x,target.y,{z:target.z});
  assert.equal(state.stats.shots,shots+1);
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,ammo-1);
  const arrow=state.bow.arrows.at(-1);
  assert.equal(arrow.phase,'flying','release creates a trajectory before any body intersection');
  tick(state,.7);
  return arrow;
}
function twoBodies(state=reed()) {
  const doe=state.entities['willow-creek-doe'];
  const firstHp=doe.hp;
  const arrow=loose(state,()=>vitalTarget(doe));
  assert.equal(doe.hp,0,`first actual trajectory kills instead of assigning life: prior HP ${firstHp}, arrow ${JSON.stringify(arrow)}`);
  assert.equal(arrow.targetId,doe.id);assert.equal(state.mission.stage,5);
  assert.equal(doe.hunt.cleanKill,true);
  pathWalk(state,WORLD.secondRoute.slice(0,3),{crouch:true});
  walk(state,WORLD.props.find(p=>p.id==='ford-hoof'),{crouch:true});interact(state,'inspect:ford-hoof',true);
  pathWalk(state,WORLD.secondRoute.slice(3,5),{crouch:true});
  walk(state,WORLD.props.find(p=>p.id==='cedar-rub'),{crouch:true});interact(state,'inspect:cedar-rub',true);
  walk(state,WORLD.secondRoute.at(-1),{crouch:true});
  const buck=state.entities['willow-cedar-buck'];
  const second=loose(state,()=>vitalTarget(buck));
  assert.equal(buck.hp,0,`second actual trajectory kills: ${JSON.stringify(second)}`);
  assert.equal(second.targetId,buck.id);assert.equal(state.mission.stage,6);
  return state;
}
function loaded(state=twoBodies()) {
  const r=record(state),doe=state.entities[r.hunt.playerCarcassId],buck=state.entities[r.hunt.companionCarcassId];
  walk(state,buck);interact(state,'inspect:buck-body');
  walk(state,state.entities.juno);interact(state,'juno:load-bracken');choose(state,'leave');
  // Mara crosses the real ford back to her separate body while Juno lifts hers.
  pathWalk(state,[...WORLD.secondRoute.slice(0,5).reverse(),doe]);
  interact(state,'inspect:doe-body');
  interact(state,`carry:${doe.id}`);
  assert.equal(state.player.carrying,doe.id);
  assert.deepEqual(doe.attachment,{type:'carried',targetId:'mara'});
  Journey.whistleCampaign(state);
  until(state,()=>distance(state.horse,state.player)<54,15,'Copper actually walks from the bank to Mara’s load');
  interact(state,'load:copper',true);
  assert.equal(state.player.carrying,null);
  assert.equal(doe.attachment.type,'large-load');assert.equal(doe.attachment.targetId,'copper');
  until(state,()=>state.mission.stage===7,20,'Juno carries the second actual body to Bracken');
  assert.equal(buck.attachment.type,'large-load');assert.equal(buck.attachment.targetId,'bracken');
  assert.ok(r.hunt.junoCarryDistance>20,'Juno traverses distance while carrying rather than handing off at range');
  return state;
}
function kitchen(state=loaded()) {
  interact(state,'mount',true);
  until(state,()=>state.entities.juno.mounted,12,'Juno mounts after loading her own mare');
  pathWalk(state,WORLD.returnRoute.slice(0,3));
  assert.equal(record(state).flags.bearSeen,true);
  pathWalk(state,WORLD.bearEncounter.detour);
  assert.equal(record(state).flags.bearDetour,true);
  until(state,()=>distance(state.entities.juno,state.player)<75,10,'both loaded mounts reach the sheltered hillside');
  interact(state,'talk:juno-return',true);choose(state,'leave');
  assert.equal(record(state).choices.order,'hunt-first','the unimplemented rival cannot invent a captive or finished operation');
  pathWalk(state,[{x:1580,y:1430},{x:1480,y:1430},...WORLD.returnRoute.slice(5)]);
  until(state,()=>distance(state.entities.juno,state.player)<155,10,'both mounts return to the region gate');
  interact(state,'return:kitchen',true);
  assert.equal(state.region,'snowbound');assert.equal(state.mission.stage,8);
  pathWalk(state,[{x:600,y:970},{x:375,y:970},{x:375,y:1160},{x:270,y:1165}]);
  interact(state,'hitch:kitchen',true);
  until(state,()=>record(state).flags.kitchenHitched,10,'loaded mounts park beside the kitchen');
  walk(state,state.horse);interact(state,'unload:copper',true);
  pathWalk(state,WORLD.camp.deliveryRoute);
  walk(state,{x:WORLD.camp.benchMara.x+35,y:WORLD.camp.benchMara.y});
  interact(state,'deliver:bench-mara',true);
  assert.equal(state.entities[record(state).hunt.playerCarcassId].attachment.targetId,WORLD.camp.benchMara.id);
  walk(state,state.entities.hob);interact(state,'talk:hob',true);choose(state,'leave');
  until(state,()=>state.mission.stage===9,25,'Juno delivers, Hob leaves through the doorway, and Juno rests');
  return state;
}
function processed(state=kitchen()) {
  walk(state,WORLD.camp.knife);interact(state,'take:field-knife',true);
  walk(state,{...WORLD.camp.benchMara,z:0});interact(state,'skin:bench-mara',true);
  until(state,()=>state.mission.stage===10,20,'two separate timed skinning jobs actually finish at their benches');
  return state;
}
function completed(state=processed(),hide='retain-hide') {
  walk(state,{...WORLD.camp.benchMara,z:0});interact(state,'take:hide',true);
  pathWalk(state,[{x:205,y:1270},{x:270,y:1270},{x:270,y:1165},WORLD.camp.hideRack]);
  interact(state,'hang:hide',true);
  walk(state,state.entities.della);interact(state,'talk:della-yields',true);choose(state,hide);
  pathWalk(state,[{x:270,y:1165},{x:270,y:1270},{x:205,y:1270},WORLD.camp.stove]);
  interact(state,'cook:broth',true);
  until(state,()=>record(state).flags.cooked,15,`Orla reaches stove ${JSON.stringify(WORLD.camp.workpoints.cook)} and cooks counted portions`);
  walk(state,state.entities.orla);interact(state,'finish:hunt',true);
  assert.equal(state.mission.completed,true,`finish uses actual prerequisites: ${JSON.stringify(record(state).flags)}; notices ${JSON.stringify(state.notices)}`);assert.equal(state.dialog.id,'hunt-completed');choose(state,'leave');
  return state;
}

test('all eleven Hunt stages follow actual routes, arrows, separate carries and timed kitchen processing',()=>{
  const state=completed();
  assert.equal(state.mission.stage,10);assert.equal(record(state).status,'completed');
  assert.equal(record(state).performance.arrowsReleased,2);
  assert.equal(record(state).performance.arrowHits,2);
  assert.equal(record(state).performance.deerKilled,2);
  assert.equal(record(state).performance.oneArrowEach,true);
  assert.equal(record(state).performance.secondCleanKill,true);
  assert.equal(record(state).performance.noSpook,true);
  assert.equal(state.camp.pantry.rawVenison,10);assert.equal(state.camp.pantry.tableBroth,2);
  assert.equal(state.camp.pantry.kitchenStarterFuel,0);
  assert.equal(state.camp.food,fixture('rescue-complete').camp.food+12);
  assert.equal(state.entities['willow-creek-doe'].processed,true);
  assert.equal(state.entities['willow-cedar-buck'].processed,true);
  assert.equal(state.itemInstances['hunt-hide-doe'].owner,'mara');
  assert.equal(state.itemInstances['hunt-hide-buck'].owner,'community');
  assert.equal(state.entities.silas.attachment.targetId,'silas-bed');
  assert.equal(state.weapons['coach-gun'].owner,'mara');
  assert.equal(state.entities.lark.hp,0);
  roundTrip(state,'completed eleven-stage Hunt and prior campaign');
});

test('held draw cancels on restore without spending arrows or changing optional performance history',()=>{
  const state=reed(),target=vitalTarget(state.entities['willow-creek-doe']);
  Journey.beginCampaignDraw(state,target.x,target.y,{z:target.z});tick(state,1.1,{drawHeld:true});
  assert.equal(state.bow.drawing,true);assert.ok(state.bow.charge>.7);
  const before=encode(state),restored=Journey.restoreCampaign(before);
  assert.ok(restored,'a genuine suspended draw is valid before restore cancellation');
  assert.equal(restored.bow.drawing,false);assert.equal(restored.bow.age,0);assert.equal(restored.bow.charge,0);
  assert.equal(restored.bow.canceled,state.bow.canceled+1);
  for(const key of ['weapons','entities','checkpoints','missionEntries'])assert.deepEqual(encode(restored)[key],before[key],`${key} preserves the validated draw history without a projectile`);
  assert.deepEqual(restored.performance,state.performance);
  assert.equal(restored.stats.shots,state.stats.shots);
});

test('short release and deliberate overdraw cancellation spend no arrow or kill predicate',()=>{
  const state=reed(),target=vitalTarget(state.entities['willow-creek-doe']);
  const ammo=state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,shots=state.stats.shots;
  Journey.beginCampaignDraw(state,target.x,target.y,{z:target.z});tick(state,.1,{drawHeld:true});Journey.releaseCampaignDraw(state,target.x,target.y,{z:target.z});
  assert.equal(state.bow.drawing,false);assert.equal(state.bow.serial,0);
  Journey.beginCampaignDraw(state,target.x,target.y,{z:target.z});tick(state,3.3,{drawHeld:true});
  assert.ok(state.bow.sway>0);assert.equal(state.bow.fatigueWarned,true);assert.ok(state.player.stamina<97);
  Journey.cancelCampaignDraw(state);
  assert.equal(state.bow.serial,0);assert.equal(state.stats.shots,shots);
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,ammo);
  assert.equal(state.performance.oneArrowEach,false);roundTrip(state,'cancelled long draw');
});

test('a real missed trajectory lands and is recoverable exactly once without erasing its miss',()=>{
  const state=reed(),arrow=loose(state,{x:1530,y:1400,z:45});tick(state,2.5);
  assert.equal(arrow.phase,'ground');assert.equal(state.performance.arrowMisses,1);
  assert.equal(state.entities['willow-creek-doe'].hp,100);
  // Proximity fixture only; the missed projectile itself was entirely physical.
  standAt(state,arrow);interact(state,`recover:${arrow.id}`,true);
  assert.equal(arrow.phase,'recovered');assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,22);
  Journey.interactCampaign(state,`recover:${arrow.id}`);
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,22);
  assert.equal(state.performance.arrowMisses,1);assert.equal(state.performance.arrowsReleased,1);
  roundTrip(state,'recovered physical miss');
});
function wounded(){
  const state=reed(),deer=state.entities['willow-creek-doe'];
  loose(state,()=>({x:deer.x,y:deer.y,z:13}));
  assert.equal(deer.hunt.life,'wounded');assert.ok(deer.hp>0&&deer.hp<100);
  assert.equal(deer.hunt.cleanKill,false);assert.equal(deer.hunt.quality,2);
  return state;
}
test('body intersection wounds, creates a real blood trail, and can be humanely finished',()=>{
  const state=wounded(),deer=state.entities['willow-creek-doe'];tick(state,2);
  assert.ok(state.tracks.samples[deer.id].some(sample=>sample.kind==='blood'));
  roundTrip(state,'tracked living wounded animal');
  // A placement fixture establishes the humane-finishing range, without
  // assigning animal health, life, stage, ammunition or grading.
  standAt(state,deer,-20);interact(state,`finish:${deer.id}`,true);
  assert.equal(deer.hp,0);assert.equal(deer.hunt.deathMethod,'humane-finish');
  tick(state,.05);assert.equal(state.mission.stage,5);
  assert.equal(state.performance.oneArrowEach,false);assert.equal(deer.hunt.cleanKill,false);
  roundTrip(state,'humanely finished wound');
});
test('leaving an actual arrow wound to bleed out lowers honor and keeps its suffering history',()=>{
  const state=wounded(),deer=state.entities['willow-creek-doe'],honor=state.honor;
  tick(state,43);
  assert.equal(deer.hp,0);assert.equal(deer.hunt.deathMethod,'bleedout');assert.equal(state.honor,honor-2);
  assert.equal(deer.hunt.cleanKill,false);assert.equal(state.performance.secondCleanKill,false);
  assert.equal(state.performance.deerKilled,1);roundTrip(state,'actual bleedout');
});

test('real arrows protect Juno and both required mounts, with readable failure and full checkpoint retry',()=>{
  for(const id of ['juno','copper','bracken']){
    const state=bank(),actor=state.entities[id];
    // Negative contact fixture only: the arrow still travels and intersects an
    // actual protected body; no health loss or failure field is injected.
    standAt(state,actor,-90,-35);
    loose(state,()=>({x:actor.x,y:actor.y,z:id==='juno'?23:20}));
    assert.ok(state.failure,`${id} cannot be used as a target`);
    assert.match(state.failure.reason,/struck|safely/);
    const attempts=record(state).retryCount;
    const failed=roundTrip(state,`${id} projectile failure`);
    Journey.chooseCampaign(failed,'retry');
    assert.equal(failed.failure,null);assert.equal(failed.dialog,null);assert.equal(failed.mission.stage,3);
    assert.equal(record(failed).retryCount,attempts+1);assert.equal(failed.entities[id].hp,failed.checkpoint.data.entities[id].hp);
    roundTrip(failed,`${id} full checkpoint retry`);
  }
});
function carriedUnit(){
  const state=twoBodies(),deer=state.entities['willow-creek-doe'];
  // Target-placement fixture tests attachment states; kills are real arrows.
  standAt(state,deer,-20);interact(state,'inspect:doe-body');interact(state,`carry:${deer.id}`);
  return state;
}
test('whole-body carrying saves one authoritative corpse and rejects mounted carriers, live or duplicate cargo',()=>{
  const state=carriedUnit(),before=encode(state);
  assert.equal(state.player.carrying,'willow-creek-doe');
  assert.equal(before.entities['willow-creek-doe'].regionId,null);
  assert.ok(!before.regions['willow-run'].residentIds.includes('willow-creek-doe'));
  assert.equal(Object.hasOwn(before.entities.copper,'largeLoad'),false,'rear load is a derived view, never a second serialized owner');
  roundTrip(state,'Mara carries one real whole body');
  for(const [name,mutate]of [
    ['mounted carrier',data=>{data.entities.mara.mounted=true;}],
    ['living transported deer',data=>{data.entities['willow-creek-doe'].hp=100;data.entities['willow-creek-doe'].dead=false;}],
    ['duplicate body in residency',data=>{data.regions['willow-run'].residentIds.push('willow-creek-doe');}],
    ['forged carried-body backlink',data=>{data.entities.mara.carrying='willow-cedar-buck';}],
    ['dead corpse riding as patient',data=>{data.entities['willow-creek-doe'].attachment={type:'passenger',targetId:'copper',strap:true};data.entities.mara.carrying=null;}],
  ]){const data=clone(before);mutate(data);assert.ok(Journey.restoreCampaign(data)===null,name);}
});

test('exclusive loaded corpses and actual Juno carry persist through a loaded checkpoint retry',()=>{
  const state=loaded(),before=encode(state),deer=state.entities['willow-creek-doe'];
  assert.equal(state.horse.largeLoad,deer.id);
  assert.strictEqual(state.entities[state.horse.largeLoad],deer);
  assert.equal(state.entities.bracken.largeLoad,'willow-cedar-buck');
  roundTrip(state,'both exclusive rear loads');
  const bad=clone(before);bad.entities['willow-cedar-buck'].attachment.targetId='copper';
  assert.ok(Journey.restoreCampaign(bad)===null,'one mount cannot own both corpse attachments');
  Journey.useCampaignItem(state,'quietRation');assert.equal(state.inventory.quietRation,0);
  state.player.hp=0;tick(state,.05);assert.ok(state.failure,'explicit damage fault fixture exercises full loaded retry');
  Journey.chooseCampaign(state,'retry');
  assert.equal(state.inventory.quietRation,before.inventory.quietRation);
  assert.equal(state.horse.largeLoad,'willow-creek-doe');assert.equal(state.entities.bracken.largeLoad,'willow-cedar-buck');
  assert.equal(state.entities.juno.carrying,null);assert.equal(record(state).hunt.junoCarryDistance,before.campaign.missions[HUNT].hunt.junoCarryDistance);
  assert.equal(state.entities.silas.attachment.targetId,'silas-bed');roundTrip(state,'loaded checkpoint restored');
});

test('a real loading request cannot disable abandonment when Mara leaves Juno and Bracken behind',()=>{
  const state=twoBodies();
  const checkpointAbandonment=state.checkpoint.data.campaign.missions[HUNT].timers.abandonment;
  walk(state,state.entities.juno);interact(state,'juno:load-bracken');choose(state,'leave');
  pathWalk(state,[...WORLD.secondRoute.slice(0,5).reverse(),{x:1280,y:1130},{x:1170,y:1130},{x:1050,y:1190},{x:900,y:1228},{x:840,y:1320},{x:700,y:1350},{x:700,y:1410},{x:410,y:1550},WORLD.entry],{sprint:true});
  assert.equal(record(state).flags.junoLoading,true,'the companion is completing the requested physical loading task');
  assert.ok(distance(state.player,state.entities.juno)>420,'ordinary movement actually leaves the party behind');
  tick(state,40);
  assert.ok(state.failure?.reason.includes('abandoned'),'sustained separation remains a failure during companion loading');
  roundTrip(state,'abandonment failure after walking away from the loading party');
  choose(state,'retry');
  assert.equal(state.failure,null);
  assert.equal(state.mission.stage,6,'retry returns to the two actual carcasses before the abandoned loading attempt');
  assert.equal(record(state).flags.junoLoading,false);
  assert.equal(record(state).timers.abandonment,checkpointAbandonment,'retry preserves the actual checkpoint timer instead of rewriting its history');
  walk(state,state.entities.juno,{sprint:true});tick(state,.05);
  assert.equal(record(state).timers.abandonment,0,'actually returning to Juno clears the sustained-separation timer');
  roundTrip(state,'recoverable second-deer checkpoint after abandonment retry');
});

test('later distinct shots can ruin a required carcass without inventing a new animal or reward',()=>{
  const state=twoBodies(),deer=state.entities['willow-creek-doe'];
  // Contact-range fixture only; all three later projectile impacts are real.
  standAt(state,deer,-100,-40);
  for(let n=0;n<3;n++)loose(state,()=>({x:deer.x,y:deer.y,z:19}));
  assert.equal(deer.hunt.carcassCondition,0);assert.equal(deer.hunt.life,'ruined');assert.ok(state.failure);
  assert.match(state.failure.reason,/carcass|destroyed/);
  roundTrip(state,'required ruined physical carcass');
});

for(const branch of ['retain-hide','donate-hide'])test(`${branch} yields meat/hides once, records ownership and pays no imaginary trade money`,()=>{
  const state=processed(),priorFood=fixture('rescue-complete').camp.food,money=state.player.money,honor=state.honor;
  assert.equal(state.camp.food,priorFood+12);assert.equal(state.camp.pantry.rawVenison,12);
  assert.equal(Object.values(state.itemInstances).filter(item=>item.kind==='deer-hide').length,2);
  assert.equal(Object.values(state.itemInstances).filter(item=>item.kind==='field-knife').length,1);
  assert.equal(state.entities['willow-creek-doe'].attachment.type,'rest');assert.equal(state.entities['willow-creek-doe'].processed,true);
  roundTrip(state,'both physically processed bench bodies');
  const done=completed(state,branch),hide=done.itemInstances['hunt-hide-doe'];
  assert.equal(hide.owner,branch==='donate-hide'?'community':'mara');assert.equal(hide.location.type,'drying-rack');
  assert.equal(done.player.money,money);assert.equal(done.honor,honor+2+(branch==='donate-hide'?1:0));
  const unchanged={camp:clone(done.camp),items:clone(done.itemInstances),honor:done.honor,transactions:clone(record(done).transactions)};
  for(const id of ['skin:bench-mara','take:field-knife','cook:broth','finish:hunt'])Journey.interactCampaign(done,id);
  Journey.chooseCampaign(done,'donate-hide');tick(done,.1);
  assert.deepEqual(done.camp,unchanged.camp);assert.deepEqual(done.itemInstances,unchanged.items);assert.equal(done.honor,unchanged.honor);assert.deepEqual(record(done).transactions,unchanged.transactions);
  if(branch==='donate-hide')assert.ok(!Journey.getCampaignInteractions(done).some(action=>action.id==='take:retained-hide'));
  roundTrip(done,`${branch} completion without duplicate grant`);
});

test('retained hide transfers through rack, hands and Copper saddle as one typed owned instance',()=>{
  const state=completed(),hide=state.itemInstances['hunt-hide-doe'];
  walk(state,{x:205,y:1270});pathWalk(state,[{x:270,y:1270},{x:270,y:1165},WORLD.camp.hideRack]);
  interact(state,'take:retained-hide',true);assert.equal(hide.location.type,'carried');
  walk(state,state.horse);interact(state,'store:retained-hide');assert.deepEqual(hide.location,{type:'saddle',targetId:'copper'});
  const saved=roundTrip(state,'retained hide in actual saddle');
  Journey.campaignAction(saved,'take-hide:hunt-hide-doe');assert.equal(saved.itemInstances[hide.id].location.type,'carried');
  Journey.campaignAction(saved,'store-hide:hunt-hide-doe');assert.equal(saved.itemInstances[hide.id].location.type,'saddle');
  assert.equal(Object.keys(saved.itemInstances).length,3);roundTrip(saved,'owned hide saddle transfer');
});

test('forged hide, knife, yield and ownership transactions are rejected across the full current graph',()=>{
  const state=completed(),base=encode(state);
  for(const [label,mutate]of [
    ['hide source mismatch',data=>{data.itemInstances['hunt-hide-doe'].sourceEntityId='willow-cedar-buck';}],
    ['hide quality differs from actual carcass',data=>{data.itemInstances['hunt-hide-doe'].quality=1;}],
    ['unrelated fake hide instance',data=>{data.itemInstances['free-hide']={...data.itemInstances['hunt-hide-doe'],id:'free-hide'};}],
    ['invented knife owner',data=>{data.itemInstances['field-knife'].owner='juno';}],
    ['knife cannot become a second high-quality hide',data=>{data.itemInstances['field-knife'].quality=3;}],
    ['unknown saddle location',data=>{data.itemInstances['hunt-hide-doe'].location={type:'saddle',targetId:'silas'};}],
    ['nonexistent processing surface',data=>{data.itemInstances['hunt-hide-doe'].location={type:'bench',targetId:'free-workbench',regionId:'snowbound'};}],
    ['processed corpse becomes living again',data=>{data.entities['willow-creek-doe'].hp=100;data.entities['willow-creek-doe'].dead=false;}],
    ['missing real yield ledger',data=>{delete data.campaign.missions[HUNT].transactions[`${HUNT}:yield:willow-creek-doe`];}],
    ['doubled completed yield',data=>{data.campaign.missions[HUNT].transactions[`${HUNT}:yield:willow-creek-doe`].amount=12;}],
    ['wrong region on drying-rack item',data=>{data.itemInstances['hunt-hide-doe'].location.regionId='willow-run';}],
    ['forged donation contradicts retained owner',data=>{data.campaign.missions[HUNT].choices.hide='donate';}],
    ['communal hide moved into private saddle',data=>{data.itemInstances['hunt-hide-buck'].location={type:'saddle',targetId:'copper'};}],
  ]){const data=clone(base);mutate(data);assert.ok(Journey.restoreCampaign(data)===null,label);}
});

test('completed Hunt replay preserves all three canonical missions, clinical schedules, typed items and packed stock',()=>{
  const state=completed(),hide=state.itemInstances['hunt-hide-doe'];
  // A proximity fixture invokes real pack conservation before isolating replay.
  standAt(state,state.horse,-25);Journey.storeCampaignItem(state,'tonic');
  const canonical=encode(state);
  Journey.beginCampaignReplay(state,HUNT);
  assert.equal(state.campaign.replayMissionId,HUNT);assert.ok(state.replayCanonical);
  assert.equal(state.mission.stage,0);assert.equal(state.weapons[HUNT_BOW.id],undefined);assert.deepEqual(state.itemInstances,{});
  const replay=roundTrip(state,'isolated Hunt replay with full cared canonical graph');
  assert.deepEqual(encode(replay).replayCanonical,canonical);
  replay.player.hp=0;tick(replay,.05);assert.ok(replay.failure);
  assert.ok(replay.dialog.choices.some(choice=>choice.id==='finish-replay'));
  const failed=roundTrip(replay,'failed Hunt replay keeps its canonical graph');
  Journey.chooseCampaign(failed,'finish-replay');assert.equal(failed.replayCanonical,null);
  const restored=encode(failed);
  for(const key of ['entities','weapons','regions','itemInstances','campaign','checkpoints','missionEntries','inventory','camp','companions','wanted','honor','stats'])assert.deepEqual(restored[key],canonical[key],`${key} comes only from the canonical three-mission world`);
  assert.equal(failed.itemInstances[hide.id].owner,'mara');roundTrip(failed,'canonical world after failed Hunt replay exit');
});

test('replaying the older opening after Hunt preserves later bow, carcasses, kitchens and clinical history',()=>{
  const state=completed(),canonical=encode(state);
  Journey.beginCampaignReplay(state,OPENING);assert.equal(state.mission.id,OPENING);assert.ok(state.replayCanonical);
  const replay=roundTrip(state,'older opening replay after three completed missions');
  replay.player.hp=0;tick(replay,.05);assert.ok(replay.failure);
  const failed=roundTrip(replay,'older opening failure after full Hunt');Journey.chooseCampaign(failed,'finish-replay');
  const final=encode(failed);
  for(const key of ['entities','weapons','regions','itemInstances','campaign','checkpoints','missionEntries','inventory','camp','stats'])assert.deepEqual(final[key],canonical[key],`${key} survives playing an earlier mission in isolation`);
});

test('every physically earned Hunt checkpoint restores its complete isolated graph without future progress',()=>{
  const state=completed(),data=encode(state);
  const stages=[];
  for(const [id,cp]of Object.entries(data.checkpoints).filter(([,cp])=>cp.missionId===HUNT)){
    const checkpoints=Object.entries(data.checkpoints);
    const history=Object.fromEntries(checkpoints.slice(0,checkpoints.findIndex(([key])=>key===id)+1));
    const branch={...clone(cp.data),checkpoints:clone(history),missionEntries:clone(data.missionEntries),replayCanonical:null};
    for(const missionId of Object.keys(branch.missionEntries))if(!branch.campaign.missions[missionId].mission.completed&&missionId!==HUNT)delete branch.missionEntries[missionId];
    const restored=Journey.restoreCampaign(branch);
    assert.ok(restored,`${id} is a coherent full checkpoint scene`);
    assert.equal(restored.mission.stage,cp.stage);
    for(const key of ['entities','weapons','regions','itemInstances','inventory','camp','campaign'])assert.deepEqual(encode(restored)[key],cp.data[key],`${id} owns real ${key}`);
    stages.push(cp.stage);
  }
  assert.ok(stages.includes(0)&&stages.includes(1)&&stages.includes(3)&&stages.includes(4)&&stages.includes(5)&&stages.includes(6)&&stages.includes(7)&&stages.includes(9)&&stages.includes(10));
  const earlier=encode(loaded());
  const future=Object.values(data.checkpoints).find(cp=>cp.missionId===HUNT&&cp.data.campaign.missions[HUNT].mission.completed);
  earlier.checkpoints[future.id]=clone(future);
  assert.ok(Journey.restoreCampaign(earlier)===null,'completed-body checkpoint cannot be smuggled into a loaded earlier hunt');
});

test('skin work begins only after physical bench contact and suspended work yields once after restore',()=>{
  const state=kitchen();walk(state,WORLD.camp.knife);interact(state,'take:field-knife',true);
  walk(state,{x:165,y:1245});interact(state,'skin:bench-mara',true);
  assert.equal(state.processing.player.phase,'approach');assert.equal(state.processing.player.age,0);
  const before=roundTrip(state,'accepted skin approach before tool contact');
  until(before,()=>before.processing.player?.phase==='working',8,'Mara physically reaches the bench workpoint');
  assert.ok(distance(before.player,WORLD.camp.workpoints.mara)<3);
  tick(before,1.4);assert.ok(before.processing.player.age>1);
  const middle=roundTrip(before,'suspended physical skin contact');
  until(middle,()=>middle.mission.stage===10,20,'resumed independent skinning work');
  assert.equal(middle.camp.pantry.rawVenison,12);assert.equal(middle.camp.food,fixture('rescue-complete').camp.food+12);
  assert.equal(Object.keys(record(middle).transactions).filter(id=>id.includes(':yield:')).length,2);
  roundTrip(middle,'exactly-once yields after suspended contact');
});

test('late stored-bow retrieval remains possible beside the real parked mount without freezing Juno',()=>{
  const state=bank();walk(state,state.horse);Journey.campaignAction(state,'rack:store-bow');
  assert.equal(state.weapons[HUNT_BOW.id].location,'saddle');
  walk(state,WORLD.searchRoute[0],{crouch:true});
  assert.ok(!Journey.getCampaignInteractions(state).some(action=>action.id==='rack:retrieve-bow'),'remote saddle retrieval is unavailable');
  const juno={x:state.entities.juno.x,y:state.entities.juno.y};tick(state,1);
  assert.ok(distance(state.entities.juno,juno)>0,'the teacher remains physically responsive while waiting for retrieval');
  walk(state,{x:900,y:1228},{crouch:true});walk(state,state.horse,{crouch:true});
  interact(state,'rack:retrieve-bow',true);assert.equal(state.weapons[HUNT_BOW.id].location,'carried');
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,22);
  roundTrip(state,'actual late saddle retrieval');
});

test('an ignored future finish and one-kill body pickup cannot skip second prey or field teaching',()=>{
  const state=reed(),doe=state.entities['willow-creek-doe'];
  for(const id of ['return:kitchen','skin:bench-mara','load:copper','finish:hunt','deliver:bench-mara'])Journey.interactCampaign(state,id);
  assert.equal(state.mission.stage,4);assert.equal(state.entities['willow-cedar-buck'].hp,110);
  loose(state,()=>vitalTarget(doe));assert.equal(state.mission.stage,5);
  standAt(state,doe,-20);
  Journey.interactCampaign(state,'inspect:doe-body');Journey.interactCampaign(state,`carry:${doe.id}`);
  assert.equal(state.player.carrying,null,'one body cannot manufacture two-kill stage6');
  assert.equal(state.mission.stage,5);assert.equal(state.performance.deerKilled,1);
  roundTrip(state,'ignored unoffered one-body skips');
});

for(const target of ['mara','juno','copper','bracken'])test(`fatal ${target} fault detaches real cargo safely, suspends failure and restores a complete loaded checkpoint`,()=>{
  const state=loaded(),doe=state.entities['willow-creek-doe'],buck=state.entities['willow-cedar-buck'];
  state.entities[target].hp=0;tick(state,.05);
  assert.ok(state.failure,'explicit fatal-health fault fixture reaches protected survival gate');
  if(target==='copper'||target==='bracken'){
    const d=target==='copper'?doe:buck;
    assert.equal(d.attachment,null,'dead required mount cannot remain cargo authority');
    assert.equal(d.regionId,'willow-run');assert.equal(d.z,0);
  }
  const failed=roundTrip(state,`suspended ${target} cargo failure`);
  Journey.chooseCampaign(failed,'retry');
  assert.equal(failed.failure,null);assert.equal(failed.mission.stage,7);
  assert.equal(failed.horse.largeLoad,'willow-creek-doe');assert.equal(failed.entities.bracken.largeLoad,'willow-cedar-buck');
  assert.equal(failed.entities[target].hp,failed.checkpoint.data.entities[target].hp);
  assert.equal(failed.entities.silas.attachment.targetId,'silas-bed');roundTrip(failed,`loaded graph retry after ${target}`);
});

test('fatal health during a held bow draw cancels unspent before encoding the failure',()=>{
  const state=reed(),target=vitalTarget(state.entities['willow-creek-doe']);
  Journey.beginCampaignDraw(state,target.x,target.y,{z:target.z});tick(state,1,{drawHeld:true});
  const ammo=clone(state.weapons[HUNT_BOW.id]),shots=state.stats.shots;
  state.player.hp=0;tick(state,.05,{drawHeld:true});
  assert.ok(state.failure);assert.equal(state.bow.drawing,false);assert.equal(state.bow.serial,0);
  assert.deepEqual(state.weapons[HUNT_BOW.id],ammo);assert.equal(state.stats.shots,shots);
  roundTrip(state,'fatal health cancels held string without creating an arrow');
});

test('both real broth servings conserve pantry/food and restore only with their consumption ledger',()=>{
  const state=completed(),before=state.camp.food,oldPreserved=state.camp.broth;
  assert.equal(state.player.hp,75,'actual imported rescue leaves Mara with recoverable health');
  Journey.useCampaignItem(state,'tableBroth');
  assert.equal(state.player.hp,90);assert.equal(state.camp.food,before-1);assert.equal(state.camp.pantry.tableBroth,1);
  assert.ok(record(state).transactions[`${HUNT}:use:table-broth-1`]);
  const first=roundTrip(state,'actual first fresh broth consumption');
  Journey.useCampaignItem(first,'tableBroth');
  assert.equal(first.player.hp,100);assert.equal(first.camp.food,before-2);assert.equal(first.camp.pantry.tableBroth,0);
  assert.equal(first.camp.broth,oldPreserved,'fresh broth does not consume preserved opening broth');
  const saved=roundTrip(first,'actual two fresh broth servings');
  Journey.useCampaignItem(saved,'tableBroth');assert.equal(saved.camp.food,before-2);
  const base=encode(saved);
  for(const [name,mutate]of [
    ['cooked portion returned without undoing actual use',data=>{data.camp.pantry.tableBroth++;}],
    ['lost first serving ledger',data=>{delete data.campaign.missions[HUNT].transactions[`${HUNT}:use:table-broth-1`];}],
    ['double serving amount',data=>{data.campaign.missions[HUNT].transactions[`${HUNT}:use:table-broth-2`].amount=2;}],
    ['venison added without real yield',data=>{data.camp.pantry.rawVenison++;}],
    ['starter fuel replenished after cooking',data=>{data.camp.pantry.kitchenStarterFuel++;}],
    ['fresh food counter copied into inventory',data=>{data.inventory.tableBroth=1;}],
  ]){const wire=clone(base);mutate(wire);assert.ok(Journey.restoreCampaign(wire)===null,name);}
});

test('real spooking relocates the first deer with new sign and repeated pursuit can cause an escape failure',()=>{
  const state=reed(),deer=state.entities['willow-creek-doe'],initial={x:deer.x,y:deer.y};
  // Four labelled proximity fixtures stand openly near the animal; neither its
  // alert, route nor life is assigned. The simulation creates each relocation.
  for(let attempt=0;attempt<4&&!state.failure;attempt++){
    standAt(state,deer,25,10);Journey.campaignAction(state,'stand');tick(state,6,{crouch:false});
    if(attempt===0){
      assert.equal(deer.hunt.spookedEver,true);assert.ok(deer.hunt.relocations>=1);
      assert.ok(distance(deer,initial)>20,'spooked prey physically moved, leaving recoverable hoof samples');
      assert.ok(state.tracks.samples[deer.id].length>WORLD.habitats.find(h=>h.animalId===deer.id).initialTracks.length);
      assert.equal(state.failure,null,'first spook remains recoverable');roundTrip(state,'actual first recoverable relocation');
    }
    tick(state,2);
  }
  tick(state,25);
  assert.ok(state.failure,'continued repeated pursuit makes the actual route irretrievable');
  assert.match(state.failure.reason,/escaped|carcasses/);assert.equal(deer.hunt.life,'escaped');
  assert.equal(state.performance.noSpook,false);assert.equal(state.performance.deerKilled,0);
  roundTrip(state,'actual unrecoverable prey escape');
});

test('alternate owned coach-gun fires one trigger and its remaining pellets cannot ruin a newly killed deer',()=>{
  const state=reed(),deer=state.entities['willow-creek-doe'];
  // Shot-angle fixture only; legitimate earned coach ownership and live prey
  // are preserved. Actual pellets must collide and cause this lethal outcome.
  standAt(state,deer,-75,-15);Journey.campaignAction(state,'equip:coach-gun');
  const arrows=state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve;
  const before=state.weapons['coach-gun'].ammo,shots=state.stats.shots,target=vitalTarget(deer);
  Journey.shootCampaign(state,target.x,target.y,{z:target.z});tick(state,.5);
  assert.equal(deer.hp,0);assert.equal(deer.hunt.deathMethod,'gun');assert.equal(deer.hunt.cleanKill,false);
  assert.equal(deer.hunt.carcassCondition,100,'same-trigger pellets are absorbed by the body that trigger just killed');
  assert.equal(state.performance.gunShots,1);assert.equal(state.stats.shots,shots+1);assert.equal(state.weapons['coach-gun'].ammo,before-1);
  assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,arrows);
  assert.equal(state.performance.oneArrowEach,false);assert.equal(state.mission.stage,5);
  roundTrip(state,'one real alternate-gun trigger and intact low-quality carcass');
});

test('low-quality humane first carcass remains edible through all physical delivery and processing gates',()=>{
  const state=wounded(),doe=state.entities['willow-creek-doe'];
  standAt(state,doe,-20);interact(state,`finish:${doe.id}`,true);tick(state,.05);
  Journey.reloadCampaign(state);tick(state,.4);
  pathWalk(state,[{x:1340,y:1050},...WORLD.secondRoute.slice(1,3)],{crouch:true});
  walk(state,WORLD.props.find(p=>p.id==='ford-hoof'),{crouch:true});interact(state,'inspect:ford-hoof');
  pathWalk(state,WORLD.secondRoute.slice(3,5),{crouch:true});walk(state,WORLD.props.find(p=>p.id==='cedar-rub'),{crouch:true});interact(state,'inspect:cedar-rub');
  walk(state,WORLD.secondRoute.at(-1),{crouch:true});loose(state,()=>vitalTarget(state.entities['willow-cedar-buck']));
  assert.equal(state.mission.stage,6);
  const done=completed(processed(kitchen(loaded(state))));
  assert.equal(done.mission.completed,true);assert.equal(done.camp.pantry.rawVenison,10);assert.equal(done.camp.pantry.tableBroth,2);
  assert.equal(done.itemInstances['hunt-hide-doe'].quality,1);
  assert.equal(done.performance.oneArrowEach,false);assert.equal(done.performance.secondCleanKill,true);
  roundTrip(done,'usable low-quality first carcass and separate clean second prey');
});

test('clinical recovery counts the actual auto-dialogue/failure frame and pauses only subsequent frozen frames',()=>{
  const state=equipment(),clinic=state.campaign.missions[RESCUE].rescue.silas;
  const before={elapsed:state.elapsed,hours:clinic.healingHours,injury:clinic.injury,hp:state.entities.silas.hp};
  bank(state,false);assert.equal(state.dialog.id,'hunt-sign-lesson');
  const elapsed=state.elapsed-before.elapsed;
  assert.ok(Math.abs(clinic.healingHours-Math.max(0,before.hours-elapsed/80))<1e-7,'automatic sign-dialogue frame has already advanced both mission world and bedside time');
  assert.ok(Math.abs(clinic.injury-Math.max(0,before.injury-elapsed/(80*18)))<1e-7);
  assert.ok(Math.abs(state.entities.silas.hp-Math.min(100,before.hp+elapsed/160))<1e-7);
  const paused={elapsed:state.elapsed,clinic:clone(clinic),hp:state.entities.silas.hp};tick(state,3);
  assert.equal(state.elapsed,paused.elapsed);assert.deepEqual(clinic,paused.clinic);assert.equal(state.entities.silas.hp,paused.hp);
  roundTrip(state,'automatic sign lesson freezes later dialogue frames');
  choose(state,'leave');state.player.hp=0;tick(state,.05);
  assert.ok(state.failure);const failingElapsed=state.elapsed-paused.elapsed;
  assert.ok(Math.abs(clinic.healingHours-Math.max(0,paused.clinic.healingHours-failingElapsed/80))<1e-7,'accepted final failure frame remains included');
  const failedHours=clinic.healingHours;tick(state,2);assert.equal(clinic.healingHours,failedHours);
});

test('aiming across the bear shoulder spends nothing; an actual cover-blocked arrow report frightens mounts without a fake hit',()=>{
  const state=loaded();interact(state,'mount',true);
  until(state,()=>state.entities.juno.mounted,10,'Juno mounts her loaded mare before the gorge');
  pathWalk(state,WORLD.returnRoute.slice(0,3));
  assert.equal(record(state).flags.bearSeen,true);
  const bear=state.entities['willow-gorge-bear'],hp=bear.hp,target={x:bear.x,y:bear.y,z:25};
  const arrows=state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,shots=state.stats.shots;
  tick(state,.05,{aimX:target.x,aimY:target.y,aimZ:target.z});
  assert.equal(record(state).flags.bearAimed,true);assert.equal(record(state).flags.bearFired,false);
  assert.equal(state.stats.shots,shots);assert.equal(state.weapons[HUNT_BOW.id].ammo+state.weapons[HUNT_BOW.id].reserve,arrows);
  const projectile=loose(state,target);
  assert.equal(projectile.phase,'broken','the raised shoulder actually blocks the trajectory');
  assert.equal(projectile.targetId,null,'report response cannot invent a bear intersection');
  assert.equal(bear.hp,hp,'obstruction and bear damage remain independent');
  assert.equal(record(state).flags.bearFired,true);assert.equal(record(state).choices.bear,'warning-fired');
  assert.equal(bear.phase,'retreat');assert.ok(state.horse.fear>50);assert.ok(state.entities.bracken.fear>50);
  roundTrip(state,'original aimed report response behind physical shoulder cover');
});
