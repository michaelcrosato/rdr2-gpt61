import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {createWeaponLoanFixture} from './helpers/train-weapon-loan-fixture.mjs';
import {validateRivalContinuation} from '../src/rival-continuation.js';
import {validateRivalWeaponLoans} from '../src/rival-weapon-loan.js';
import {emitTrainShot,requestTrainReload,stepTrainReload} from '../src/train-combat.js';

const project = process.env.DUST_MERCY_REPO_ROOT
  ? new URL(`file://${process.env.DUST_MERCY_REPO_ROOT.replace(/\/$/, '')}/`)
  : new URL('../', import.meta.url);
const Journey = await import(new URL('src/campaign-journey.js', project));
const { WILLOW_RUN_WORLD: HUNT_WORLD, HUNT_BOW } = await import(new URL('content/campaign/willow-run.js', project));
const { RIVAL_WORLD: WORLD, RIVAL_CAST, RIVAL_ENEMIES, RIVAL_PARTY, RIVAL_CARBINE, RIVAL_ENCOUNTER_WEAPON } = await import(new URL('content/campaign/bellwether-works.js', project));
const { QUARRY_POCKET_OBJECTS } = await import(new URL('content/campaign/quarry-papers.js', project));
const OPENING = 'snowbound-the-last-warm-light';
const RESCUE = 'snowbound-a-voice-under-ice';
const HUNT = 'snowbound-a-quiet-table';
const RIVAL = 'snowbound-the-names-they-took';
const fixtureDir = new URL('tests/fixtures/', project);
const manifest = JSON.parse(fs.readFileSync(new URL('journey-v3-provenance.json', fixtureDir), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const encode = state => JSON.parse(Journey.serializeCampaign(state));
function fixture(name) {
  const filename = `journey-v3-${name}.json.gz`;
  const provenance = manifest.fixtures.find(value => value.fixture === filename);
  assert.ok(provenance, `${filename} has public-control provenance`);
  const bytes = gunzipSync(fs.readFileSync(new URL(filename, fixtureDir)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sha256OfUncompressedOriginalBytes, 'no original Save bytes were rewritten');
  const result = JSON.parse(bytes);
  assert.equal(result.version, 3);
  return result;
}
function durableMission(value) {
  const result = clone(value);
  delete result.mission.name; delete result.mission.objective;
  return result;
}
function priorRivalHistory(value){
  const result=clone(value);
  assert.equal(result.continuationVersion,1);
  assert.deepEqual(result.continuation,{schema:1,initializedAt:null,baseline:null,requestSerial:0,requests:{},events:[]},'v5 adds only an explicitly empty continuation declaration');
  delete result.continuationVersion;delete result.continuation;return result;
}
function assertMigratedRelationships(previous,current,description) {
  for(const [id,before]of Object.entries(previous.companions))assert.deepEqual(current.companions[id],before,`${description}: ${id} prior relationship unchanged`);
  for(const id of Object.keys(current.companions).filter(id=>!Object.hasOwn(previous.companions,id))){
    assert.equal(previous.campaign.missions[RESCUE].mission.completed,true,'new relationship presence follows actual rescue');
    assert.ok(['ruth','bastian','emmett'].includes(id),'only authored new rivals have relationship records');
    assert.deepEqual(current.companions[id],{trust:0,requests:0},'cast presence awards no earned trust');
  }
}
function assertBodyMigration(previous, current, description) {
  assert.equal(current.version, 5, `${description}: current schema declared`);
  assert.equal(current.region, previous.region);
  assert.equal(current.campaign.activeMissionId, previous.campaign.activeMissionId);
  assert.deepEqual(current.party, previous.party, 'Mara/Copper authority stays intact');
  for (const key of ['inventory', 'itemInstances', 'camp', 'sideQuests', 'wanted', 'honor', 'stats', 'elapsed', 'day', 'time']) {
    assert.deepEqual(current[key], previous[key], `${description}: durable ${key} gains no earned resource or world tick`);
  }
  assertMigratedRelationships(previous,current,description);
  for (const [id,weapon] of Object.entries(previous.weapons)) assert.deepEqual(current.weapons[id],weapon, `${description}: original ${id} weapon/rounds/owner survive`);
  for (const id of Object.keys(current.weapons).filter(id=>!previous.weapons[id])) assert.equal(id,RIVAL_ENCOUNTER_WEAPON.id,'only the authored companion starting weapon may be present before acceptance');
  for (const id of [OPENING, RESCUE, HUNT]) assert.deepEqual(durableMission(current.campaign.missions[id]), durableMission(previous.campaign.missions[id]), `${description}: ${id} outcome/action/clinical/track history survives`);
  for (const [id, actor] of Object.entries(previous.entities)) assert.deepEqual(current.entities[id], actor, `${description}: ${id} is not recreated, renamed, healed, refilled or moved`);
  for (const [id, region] of Object.entries(previous.regions)) {
    for (const key of ['worldChanges', 'supplies', 'dropped']) assert.deepEqual(current.regions[id][key], region[key], `${description}: ${id}.${key} survives`);
    assert.deepEqual(current.regions[id].residentIds.filter(actorId => Object.hasOwn(previous.entities, actorId)), region.residentIds, `${description}: original residence has no duplicates`);
  }
  const record = current.campaign.missions[RIVAL];
  assert.ok(record, `${description}: independent rival record exists`);
  assert.equal(record.status, previous.campaign.missions[RESCUE].mission.completed ? 'unstarted' : 'locked');
  assert.equal(record.mission.stage, 0); assert.equal(record.mission.stageCount, 14);
  assert.equal(record.mission.completed, false); assert.equal(record.mission.rewardPaid, false);
  assert.equal(record.sourceRequirementId, 'campaign-old-friends');
  assert.deepEqual(record.transactions, {}, 'migration cannot fabricate a rival transaction');
  assert.equal(current.weapons[RIVAL_CARBINE.id], undefined, 'the Tern must be physically granted');
  if(current.weapons[RIVAL_ENCOUNTER_WEAPON.id])assert.equal(current.weapons[RIVAL_ENCOUNTER_WEAPON.id].owner,'bastian','new Bastian authored weapon is never migrated as a player acquisition');
  assert.equal(current.entities.levi?.attachment || null, null, 'migration invents no captivity');
  assert.equal(current.entities.skein?.dead || false, false, 'migration cannot invent a mount death');
  const bellwether = current.regions['bellwether-works'];
  assert.ok(bellwether);
  for (const [key, empty] of [['worldChanges', {}], ['supplies', []], ['dropped', {}]]) assert.deepEqual(bellwether[key], empty, `${description}: unvisited rival ${key} starts empty`);
  if (!previous.campaign.missions[RESCUE].mission.completed) {
    assert.deepEqual(bellwether.residentIds, [], 'locked region has no premature rival population');
    assert.equal(Object.keys(current.entities).length, Object.keys(previous.entities).length, 'unmet rescue adds no future cast');
  }
  for (const [key, value] of Object.entries(previous.campaign.unlocks)) {
    if (key === 'campaign-old-friends' && previous.campaign.missions[RESCUE].mission.completed) {
      assert.deepEqual(current.campaign.unlocks[key], { ...value, available: true }, 'only an actually implemented sibling becomes available');
    } else assert.deepEqual(current.campaign.unlocks[key], value, `${description}: ${key} has no invented acceptance`);
  }
}
function assertFullMigration(previous, current, description = 'root') {
  assertBodyMigration(previous, current, description);
  assert.deepEqual(Object.keys(current.checkpoints).sort(), Object.keys(previous.checkpoints).sort());
  for (const [id, checkpoint] of Object.entries(previous.checkpoints)) {
    const actual = current.checkpoints[id];
    for (const key of ['id', 'missionId', 'stage', 'label']) assert.equal(actual[key], checkpoint[key]);
    assertBodyMigration(checkpoint.data, actual.data, `${description} checkpoint ${id}`);
    for (const key of ['checkpoints', 'missionEntries', 'replayCanonical']) assert.equal(Object.hasOwn(actual.data, key), false, 'historical snapshots remain nonrecursive');
  }
  assert.deepEqual(Object.keys(current.missionEntries).sort(), Object.keys(previous.missionEntries).sort());
  for (const [id, body] of Object.entries(previous.missionEntries)) assertBodyMigration(body, current.missionEntries[id], `${description} entry ${id}`);
  assert.equal(Boolean(current.replayCanonical), Boolean(previous.replayCanonical));
  if (previous.replayCanonical) assertFullMigration(previous.replayCanonical, current.replayCanonical, `${description} canonical`);
}
function roundTrip(state, description = 'current scene') {
  const before = encode(state), restored = Journey.restoreCampaign(before);
  if(!restored)fs.writeFileSync(`/tmp/dust-mercy-rival-invalid-${description.replace(/[^a-z0-9]+/gi,'-')}.json`,JSON.stringify(before,null,2));
  assert.ok(restored, `${description} restores as a legal whole graph`);
  const after = encode(restored);
  for (const key of ['entities', 'weapons', 'regions', 'itemInstances', 'campaign', 'checkpoints', 'missionEntries', 'replayCanonical', 'inventory', 'camp', 'wanted', 'honor', 'stats', 'dialog', 'failure']) assert.deepEqual(after[key], before[key], `${description}: ${key} survives once`);
  return restored;
}
// Explicit unit proximity fixtures only. Positive progression never assigns
// mission stage, choice, inventory, grants, actor life, rope or earned outcome.
function standAt(state, target, dx=0, dy=0) {
  assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.y));
  Object.assign(state.player, { x:target.x+dx, y:target.y+dy, z:0 });
}
function interact(state, id, defaultContext=false) {
  const offered = Journey.getCampaignInteractions(state);
  if(!offered.some(action=>action.id===id))fs.writeFileSync(`/tmp/dust-mercy-rival-unoffered-${id.replace(/[^a-z0-9]+/gi,'-')}.json`,JSON.stringify(encode(state),null,2));
  assert.ok(offered.some(action => action.id===id), `${id} actually offered: ${offered.map(action => action.id).join(', ')}`);
  if (defaultContext) assert.equal(Journey.getCampaignInteraction(state)?.id, id, 'ordinary context chooses the required reachable action');
  Journey.interactCampaign(state, defaultContext ? null : id); return state;
}
function choose(state, id) {
  assert.ok(state.dialog?.choices.some(choice => choice.id===id), `${id} belongs to the current dialogue: ${JSON.stringify(state.dialog)}`);
  Journey.chooseCampaign(state, id); return state;
}
function tick(state, seconds, input={}) {
  for (let elapsed=0; elapsed<seconds-1e-8; elapsed+=.05) Journey.stepCampaign(state, Math.min(.05,seconds-elapsed),typeof input==='function'?input():input);
  return state;
}
const record = state => state.campaign.missions[RIVAL];
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function until(state, condition, seconds=30, description='physical action', input={}) {
  for(let frame=0;!condition() && frame<seconds/.05;frame++) {
    assert.equal(state.dialog,null, `${description} is not advanced through a dialogue`);
    tick(state,.05,typeof input==='function'?input():input);if(state.failure)fs.writeFileSync(`/tmp/dust-mercy-rival-failed-${description.replace(/[^a-z0-9]+/gi,'-')}.json`,JSON.stringify(encode(state),null,2));
    assert.equal(state.failure,null, `${description} stays safe`);
  }
  if(!condition())fs.writeFileSync(`/tmp/dust-mercy-rival-failed-${description.replace(/[^a-z0-9]+/gi,'-')}.json`,JSON.stringify(encode(state),null,2));
  assert.ok(condition(), `${description} finished within its authored physical bound`);return state;
}
function walk(state, target, input={}) {
  for(let frame=0;distance(state.player,target)>7 && frame<2200;frame++) {
    const length=distance(state.player,target);
    Journey.stepCampaign(state,.05,{...input,mx:(target.x-state.player.x)/length,my:(target.y-state.player.y)/length});
    assert.equal(state.dialog,null,'ordinary movement does not dismiss an open dialogue');
    assert.equal(state.failure,null,`movement toward ${target.x},${target.y} remains lawful`);
  }
  assert.ok(distance(state.player,target)<=7, `movement reaches ${target.x},${target.y}; actual ${state.player.x},${state.player.y},z${state.player.z},stage${state.mission.stage}`);
}

for (const provenance of manifest.fixtures) {
  const name = provenance.fixture.slice('journey-v3-'.length, -'.json.gz'.length);
  test(`v5 validates and migrates untouched public v3 ${name} plus every historical/canonical body`, () => {
    const previous=fixture(name), state=Journey.restoreCampaign(previous);
    assert.ok(state, 'the actual old public Save restores');
    assertFullMigration(previous, encode(state));
    assert.strictEqual(state.player,state.entities.mara);
    assert.strictEqual(state.horse,state.entities[state.party.mountId]);
    roundTrip(state,`migrated ${name}`);
  });
}

test('v3 strict prevalidation rejects fabricated new rival grant/record/cast before migration', () => {
  const original=fixture('hunt-complete');
  for (const [label, mutate] of [
    ['fourth mission disguised as v3', data=>{data.campaign.missions[RIVAL]=clone(data.campaign.missions[HUNT]);}],
    ['fourth region disguised as v3', data=>{data.regions['bellwether-works']={residentIds:[],worldChanges:{},supplies:[],dropped:{}};}],
    ['fabricated Tern gift', data=>{data.weapons['tern-lever-carbine']={id:'tern-lever-carbine',kind:'carbine',capacity:7,ammoType:'carbine-round',ammo:7,reserve:42,owner:'mara',loanMissionId:null,location:'carried',condition:1};}],
    ['fabricated Levi body', data=>{data.entities.levi={...clone(data.entities.silas),id:'levi'};data.regions.snowbound.residentIds.push('levi');}],
    ['earned bow ammo type altered', data=>{data.weapons['juno-ash-bow'].ammoType='carbine-round';}],
    ['two identities claim Copper rear load', data=>{data.entities['willow-creek-doe'].attachment={type:'large-load',targetId:'copper'};data.entities['willow-cedar-buck'].attachment={type:'large-load',targetId:'copper'};}],
    ['clinical body attached to an invented rival cell', data=>{data.entities.silas.attachment.targetId='levi-holding-anchor';}],
  ]) { const corrupted=clone(original);mutate(corrupted);assert.ok(Journey.restoreCampaign(corrupted)===null,label); }
});

test('v3 future complete Hunt checkpoint cannot be inserted into an earlier genuine Hunt body', () => {
  const earlier=fixture('hunt-loaded'), later=fixture('hunt-complete');
  const future=Object.values(later.checkpoints).find(value=>value.missionId===HUNT && value.data.campaign.missions[HUNT].mission.completed);
  assert.ok(future);
  earlier.checkpoints[future.id]=clone(future);
  assert.ok(Journey.restoreCampaign(earlier)===null,'coherent future body cannot launder completed progress through old-version migration');
});

for (const name of ['departure','gideon-carried','copper-owned','complete','bind-log','release-carry','release-log','kill-carry','kill-log']) {
  test(`actual original v1 ${name} keeps rival locked, preserving opening identities and earned fates`, () => {
    const previous=JSON.parse(fs.readFileSync(new URL(`opening-v1-${name}.json`,fixtureDir),'utf8'));
    assert.equal(previous.version,1);
    const state=Journey.restoreCampaign(previous);assert.ok(state,'genuine old public opening Save restores');
    const current=encode(state);assert.equal(current.version,5);
    const rival=current.campaign.missions[RIVAL];assert.equal(rival.status,'locked');assert.equal(rival.mission.stage,0);assert.equal(rival.mission.completed,false);
    assert.deepEqual(rival.transactions,{});assert.deepEqual(current.regions['bellwether-works'].residentIds,[]);
    for(const key of ['inventory','camp','companions','sideQuests','wanted','honor','stats','elapsed','day','time'])assert.deepEqual(current[key],previous[key],`v1 ${key} has no rival grant or clock tick`);
    assert.equal(current.campaign.missions[OPENING].flags.pavelChoice,previous.flags.pavelChoice);
    assert.equal(current.campaign.missions[OPENING].flags.rescuePriority,previous.flags.rescuePriority);
    assert.equal(current.entities['tomas-mount'].name,'Moth');assert.notEqual(current.entities['tomas-mount'].id,current.entities[current.party.mountId].id);
    assert.equal(current.weapons[RIVAL_CARBINE.id],undefined);assert.equal(current.entities.levi,undefined);
    roundTrip(state,`v1 ${name} through current schema`);
  });
}
for (const name of ['opening-departure','opening-carried','opening-complete','rescue-prepared','rescue-resting','rescue-carried','rescue-passenger','rescue-complete']) {
  test(`actual unmodified v2 ${name} and all old branches acquire no earned rival state`, () => {
    const original=JSON.parse(gunzipSync(fs.readFileSync(new URL(`journey-v2-${name}.json.gz`,fixtureDir))));
    assert.equal(original.version,2);
    const state=Journey.restoreCampaign(original);assert.ok(state);
    const current=encode(state);
    function inspect(before,after) {
      assert.equal(after.version,5);
      for(const key of ['inventory','camp','sideQuests','wanted','honor','stats','elapsed','day','time'])assert.deepEqual(after[key],before[key],`${key} is not earned by migration`);
      assertMigratedRelationships(before,after,'v2 branch');
      for(const [id,weapon]of Object.entries(before.weapons))assert.deepEqual(after.weapons[id],weapon,`${id} old weapon/rounds/owner survives`);
      for(const id of Object.keys(before.entities))assert.deepEqual(after.entities[id],before.entities[id],`${id} existing body survives old graph migration`);
      assert.equal(after.campaign.missions[RIVAL].status,before.campaign.missions[RESCUE].mission.completed?'unstarted':'locked');
      assert.deepEqual(after.campaign.missions[RIVAL].transactions,{});assert.equal(after.campaign.missions[RIVAL].mission.completed,false);
      assert.equal(after.weapons[RIVAL_CARBINE.id],undefined);assert.equal(after.entities.levi?.attachment||null,null);
      for(const [id,cp]of Object.entries(before.checkpoints||{}))inspect(cp.data,after.checkpoints[id].data);
      for(const [id,body]of Object.entries(before.missionEntries||{}))inspect(body,after.missionEntries[id]);
      if(before.replayCanonical)inspect(before.replayCanonical,after.replayCanonical);
    }
    inspect(original,current);roundTrip(state,`v2 ${name} through current schema`);
  });
}

// Independently traverse the already implemented sibling after completing the
// rival. This keeps the AND/order claim tied to real Hunt arrows/body/work,
// rather than assigning its completion flag in a fabricated prerequisite.
const huntRecord = state => state.campaign.missions[HUNT];
function pathWalk(state, points, input={}) { for (const point of points) walk(state,point,input); return state; }
function huntInvite(state) {
  standAt(state,state.entities.orla);interact(state,'talk:orla');choose(state,'ask-hunters');
  for (const [id,action] of [['moss','talk:moss-hunt'],['vera','talk:vera-hunt']]) {
    standAt(state,state.entities[id]);interact(state,action);choose(state,'leave');
  }
  standAt(state,state.entities.juno);interact(state,'talk:juno');choose(state,'accept-hunt');
  assert.equal(state.campaign.activeMissionId,HUNT);assert.equal(state.mission.stage,0);
  return state;
}
function huntEquipment(state) {
  huntInvite(state);standAt(state,HUNT_WORLD.camp.flourMap);
  until(state,()=>distance(state.entities.juno,HUNT_WORLD.camp.flourMap)<70,20,'Juno walks to the sibling Hunt flour map');
  interact(state,'accept:hunt');
  until(state,()=>huntRecord(state).flags.bowGranted,20,'Juno physically brings her bow to Copper after rival');
  standAt(state,state.horse,-24);interact(state,'rack:inspect-bow');choose(state,'leave');interact(state,'equip:ash-bow');
  until(state,()=>state.entities.juno.mounted,20,'Juno mounts actual Bracken for rival-first Hunt');
  return state;
}
function huntBank(state=huntEquipment(),closeSign=true) {
  interact(state,'mount',true);
  pathWalk(state,[{x:375,y:1140},{x:375,y:970},{x:600,y:970},HUNT_WORLD.travelGate]);
  until(state,()=>distance(state.entities.juno,state.player)<140,10,'mounted Juno catches up to the trail gate');
  interact(state,'depart:willow',true);
  assert.equal(state.region,HUNT_WORLD.id);assert.equal(state.mission.stage,2);
  pathWalk(state,HUNT_WORLD.trail);
  interact(state,'lesson:wind',true);choose(state,'leave');
  interact(state,'dismount');
  walk(state,HUNT_WORLD.hitch);
  interact(state,'hitch:bank',true);
  until(state,()=>state.mission.stage===3,8,'both mounts physically park at the bank');
  assert.equal(state.dialog.id,'hunt-sign-lesson');if(closeSign)choose(state,'leave');
  assert.ok(distance(state.horse,HUNT_WORLD.mountParking.copper)<12);
  assert.ok(distance(state.entities.bracken,HUNT_WORLD.mountParking.bracken)<12);
  assert.equal(state.horse.hitched,true);assert.equal(state.entities.bracken.hitched,true);
  return state;
}
function huntReed(state=huntBank()) {
  Journey.campaignAction(state,'crouch');
  walk(state,HUNT_WORLD.searchRoute[0],{crouch:true});
  walk(state,HUNT_WORLD.props.find(p=>p.id==='split-hoof'),{crouch:true});interact(state,'inspect:split-hoof',true);
  pathWalk(state,HUNT_WORLD.searchRoute.slice(1,3),{crouch:true});
  walk(state,HUNT_WORLD.props.find(p=>p.id==='cropped-stems'),{crouch:true});interact(state,'inspect:cropped-stems',true);
  walk(state,HUNT_WORLD.searchRoute.at(-1),{crouch:true});interact(state,'confirm:reed-trail',true);
  assert.equal(state.mission.stage,4);assert.equal(state.tracks.overlay,false,'physical signs need no tracking-overlay activation');
  return state;
}
function huntVitalTarget(actor) {
  // Public authored vital geometry, calculated independently of the collision
  // function. Aim is a point and height, never a zone/target-success command.
  return {x:actor.x+Math.cos(actor.facing)*11,y:actor.y+Math.sin(actor.facing)*11,z:(actor.z||0)+23};
}
function huntLoose(state,targetOrReader,hold=1.4) {
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
function huntTwoBodies(state=huntReed()) {
  const doe=state.entities['willow-creek-doe'];
  const firstHp=doe.hp;
  const arrow=huntLoose(state,()=>huntVitalTarget(doe));
  assert.equal(doe.hp,0,`first actual trajectory kills instead of assigning life: prior HP ${firstHp}, arrow ${JSON.stringify(arrow)}`);
  assert.equal(arrow.targetId,doe.id);assert.equal(state.mission.stage,5);
  assert.equal(doe.hunt.cleanKill,true);
  pathWalk(state,HUNT_WORLD.secondRoute.slice(0,3),{crouch:true});
  walk(state,HUNT_WORLD.props.find(p=>p.id==='ford-hoof'),{crouch:true});interact(state,'inspect:ford-hoof',true);
  pathWalk(state,HUNT_WORLD.secondRoute.slice(3,5),{crouch:true});
  walk(state,HUNT_WORLD.props.find(p=>p.id==='cedar-rub'),{crouch:true});interact(state,'inspect:cedar-rub',true);
  walk(state,HUNT_WORLD.secondRoute.at(-1),{crouch:true});
  const buck=state.entities['willow-cedar-buck'];
  const second=huntLoose(state,()=>huntVitalTarget(buck));
  assert.equal(buck.hp,0,`second actual trajectory kills: ${JSON.stringify(second)}`);
  assert.equal(second.targetId,buck.id);assert.equal(state.mission.stage,6);
  return state;
}
function huntLoaded(state=huntTwoBodies()) {
  const r=huntRecord(state),doe=state.entities[r.hunt.playerCarcassId],buck=state.entities[r.hunt.companionCarcassId];
  walk(state,buck);interact(state,'inspect:buck-body');
  walk(state,state.entities.juno);interact(state,'juno:load-bracken');choose(state,'leave');
  // Mara crosses the real ford back to her separate body while Juno lifts hers.
  pathWalk(state,[...HUNT_WORLD.secondRoute.slice(0,5).reverse(),doe]);
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
function huntKitchen(state=huntLoaded()) {
  interact(state,'mount',true);
  until(state,()=>state.entities.juno.mounted,12,'Juno mounts after loading her own mare');
  pathWalk(state,HUNT_WORLD.returnRoute.slice(0,3));
  assert.equal(huntRecord(state).flags.bearSeen,true);
  pathWalk(state,HUNT_WORLD.bearEncounter.detour);
  assert.equal(huntRecord(state).flags.bearDetour,true);
  until(state,()=>distance(state.entities.juno,state.player)<75,10,'both loaded mounts reach the sheltered hillside');
  interact(state,'talk:juno-return',true);choose(state,'leave');
  assert.equal(huntRecord(state).choices.order,'rival-first','return conversation derives its distinct rival captive from actual completed history');
  pathWalk(state,[{x:1580,y:1430},{x:1480,y:1430},...HUNT_WORLD.returnRoute.slice(5)]);
  until(state,()=>distance(state.entities.juno,state.player)<155,10,'both mounts return to the region gate');
  interact(state,'return:kitchen',true);
  assert.equal(state.region,'snowbound');assert.equal(state.mission.stage,8);
  pathWalk(state,[{x:600,y:970},{x:375,y:970},{x:375,y:1160},{x:270,y:1165}]);
  interact(state,'hitch:kitchen',true);
  until(state,()=>huntRecord(state).flags.kitchenHitched,10,'loaded mounts park beside the kitchen');
  walk(state,state.horse);interact(state,'unload:copper',true);
  pathWalk(state,HUNT_WORLD.camp.deliveryRoute);
  walk(state,{x:HUNT_WORLD.camp.benchMara.x+35,y:HUNT_WORLD.camp.benchMara.y});
  interact(state,'deliver:bench-mara',true);
  assert.equal(state.entities[huntRecord(state).hunt.playerCarcassId].attachment.targetId,HUNT_WORLD.camp.benchMara.id);
  routedWalk(state,state.entities.hob);interact(state,'talk:hob',true);choose(state,'leave');
  until(state,()=>state.mission.stage===9,50,'Juno delivers, Hob leaves through the doorway, and Juno rests');
  routedWalk(state,{x:165,y:1245});
  return state;
}
function huntProcessed(state=huntKitchen()) {
  walk(state,HUNT_WORLD.camp.knife);interact(state,'take:field-knife',true);
  walk(state,{...HUNT_WORLD.camp.benchMara,z:0});interact(state,'skin:bench-mara',true);
  until(state,()=>state.mission.stage===10,20,'two separate timed skinning jobs actually finish at their benches');
  return state;
}
function huntCompleted(state=huntProcessed(),hide='retain-hide') {
  walk(state,{...HUNT_WORLD.camp.benchMara,z:0});interact(state,'take:hide',true);
  pathWalk(state,[{x:205,y:1270},{x:270,y:1270},{x:270,y:1165},HUNT_WORLD.camp.hideRack]);
  interact(state,'hang:hide',true);
  routedWalk(state,state.entities.della);interact(state,'talk:della-yields',true);choose(state,hide);
  pathWalk(state,[{x:270,y:1165},{x:270,y:1270},{x:205,y:1270},HUNT_WORLD.camp.stove]);
  interact(state,'cook:broth',true);
  until(state,()=>huntRecord(state).flags.cooked,15,`Orla reaches stove ${JSON.stringify(HUNT_WORLD.camp.workpoints.cook)} and cooks counted portions`);
  walk(state,state.entities.orla);interact(state,'finish:hunt',true);
  assert.equal(state.mission.completed,true,`finish uses actual prerequisites: ${JSON.stringify(huntRecord(state).flags)}; notices ${JSON.stringify(state.notices)}`);assert.equal(state.dialog.id,'hunt-completed');choose(state,'leave');
  return state;
}


function accepted(state=Journey.restoreCampaign(fixture('rescue-complete'))) {
  assert.ok(state);
  if(state.campaign.activeMissionId!==RIVAL) {
    standAt(state,WORLD.camp.briefing||WORLD.camp.argumentRoom.participants.mara);
    interact(state,'rival:briefing');choose(state,'intervene');
  }
  assert.equal(state.campaign.activeMissionId,RIVAL);assert.equal(state.mission.stage,0);
  for(const who of ['ruth','emmett','bastian','inez'])if(!record(state).flags[`${who}Heard`]){
    if(who==='inez'&&record(state).rival.narrative){standAt(state,state.entities.ruth);until(state,()=>record(state).rival.narrative.opening.phase==='struck'&&record(state).rival.narrative.opening.activeSeconds>=.55,30,'Bastian actually approaches and strikes after the distinct objections');}
    standAt(state,state.entities[who]);interact(state,`talk:${who}`);choose(state,'leave');
  }
  if(record(state).rival.narrative){standAt(state,state.entities.ruth);interact(state,'narrative:interpose');until(state,()=>record(state).flags.intervened,30,'Mara and Inez physically stop Bastian');}

  standAt(state,state.entities.tomas);interact(state,'rival:accept');choose(state,'ask-motive');choose(state,'leave');
  interact(state,'rival:accept');choose(state,'accept-rival');
  assert.equal(state.mission.stage,1);
  return state;
}
function equipment(state=accepted()) {
  // Only camp starting proximity is placed. Tomas/Ruth/Inez must walk their own
  // bodies to the real Copper rack before equipment contact/grants happen.
  standAt(state,state.horse,-24);
  until(state,()=>!!state.weapons[RIVAL_CARBINE.id],40,'Tomas brings the actual Tern to Copper');
  interact(state,'rack:inspect-carbine');choose(state,'leave');
  interact(state,'rack:carbine');
  if(record(state).rival.equipment){
    standAt(state,state.entities.ruth);interact(state,'gear:cartridges');
    until(state,()=>record(state).rival.equipment.issued===42,30,'Ruth passes the separate counted spare cartridges at actual contact');
    Journey.campaignAction(state,'draw');
  }
  standAt(state,state.entities.inez);interact(state,'gear:lariat');
  until(state,()=>record(state).flags.lariatGranted,25,'Inez physically passes the requested working rope');
  if(state.dialog)choose(state,'leave');
  standAt(state,state.entities.emmett);interact(state,'gear:sightglass');
  until(state,()=>record(state).flags.sightglassGranted,25,'Emmett physically passes the requested sightglass');
  if(state.dialog)choose(state,'leave');
  standAt(state,state.horse,-24);
  until(state,()=>RIVAL_PARTY.every(member=>state.entities[member.actorId].mounted),40,'five companions mount their five distinct live mounts');
  return state;
}
function ridge(state=equipment()) {
  interact(state,'mount');
  pathWalk(state,[{x:700,y:1170},{x:700,y:950},WORLD.travelGate]);
  until(state,()=>RIVAL_PARTY.every(member=>distance(state.entities[member.actorId],state.player)<250),40,'expedition catches up at actual south gate');
  interact(state,'depart:bellwether');assert.equal(state.region,WORLD.id);assert.equal(state.mission.stage,2);
  pathWalk(state,WORLD.trail.slice(0,3));
  walk(state,WORLD.tracks.find(track=>track.id==='cart-grooves'));interact(state,'inspect:wagon-grooves');
  pathWalk(state,WORLD.trail.slice(3,4));
  walk(state,WORLD.tracks.find(track=>track.id==='return-hooves'));interact(state,'inspect:patrol-hooves');
  if(record(state).rival.narrative){walk(state,WORLD.props.find(p=>p.id==='branch-trail'));interact(state,'inspect:branch-trail');until(state,()=>record(state).rival.narrative.branch.observedAt!==null,10,'real survey-nail branch inspection');}
  pathWalk(state,WORLD.trail.slice(4));
  walk(state,WORLD.observation||WORLD.recon.viewpoint);
  for(const member of RIVAL_PARTY){const rider=state.entities[member.actorId],mount=state.entities[member.mountId];assert.equal(rider.z,mount.z,`${member.actorId} and its actual mount share the same ridge ground elevation`);}
  if(record(state).rival.narrative)until(state,()=>record(state).rival.narrative.travel.index===3,30,'the three riders finish their actual travel conversation');
  interact(state,'lesson:ridge');choose(state,'leave');
  assert.equal(state.mission.stage,3);
  return state;
}
function recon(state=ridge()) {
  if(state.player.mounted)interact(state,'dismount');pathWalk(state,WORLD.ridgeWalk);
  interact(state,'sightglass:raise');
  // Pan by continuous ordinary aiming input. Observing hidden facts by an
  // interaction ID would not exercise this physical sightglass contract.
  for(const [id,target]of [['calder',state.entities.calder],['levi',state.entities.levi],...WORLD.recon.landmarks.map(target=>[target.id==='screened-entry'?'entry':target.id,target])]) {
    for(let frame=0;!record(state).scope.observed[id]&&frame<240;frame++)tick(state,.05,{aimX:target.x,aimY:target.y,aimZ:(target.z||0)+30,sightglass:true});
    assert.equal(record(state).scope.observed[id],true,`actual held view follows and observes ${id}`);
  }
  if(record(state).rival.contractVersion===2){
    for(const event of ['card','strike','departure','dismissal']){
      const actor=state.entities[event==='dismissal'?'levi':'calder'];
      for(let n=0;!record(state).rival.reconWitness.receipts.some(e=>e.id===event)&&n<600;n++)tick(state,.05,{aimX:actor.x,aimY:actor.y,aimZ:30,scopeVisible:true});
      assert.ok(record(state).rival.reconWitness.receipts.some(e=>e.id===event),`actual framed ${event} is witnessed`);
    }
  }
  until(state,()=>record(state).flags.reconComplete,20,'the visible card tear, strike and departure establish the reconnaissance events');
  assert.equal(record(state).flags.reconComplete,true,'five physical observations and the acted event recorded');
  interact(state,'sightglass:raise');
  walk(state,state.entities.tomas);interact(state,'recon:plan');choose(state,'leave');
  assert.equal(state.mission.stage,4);
  return state;
}
function ready(state=recon()) {
  const route=WORLD.descent.route||WORLD.descent;
  routedWalk(state,route[0],{crouch:true});pathWalk(state,route.slice(1),{crouch:true});
  until(state,()=>Journey.getCampaignInteractions(state).some(action=>action.id==='choose-first'),45,'Tomas and west pair occupy actual ready positions',{crouch:true});
  assert.equal(state.mission.stage,4);
  return state;
}

// Kept separate from the public browser route: these positive state routes may
// use initial camp proximity placements, but never assign progression/life.
test('rival prelude requires actual rescue, dialogue intervention and acceptance before physical gifts',()=>{
  const state=Journey.restoreCampaign(fixture('rescue-complete'));
  const before=encode(state);
  Journey.beginCampaignReplay(state,RIVAL);
  for(const id of ['gear:lariat','gear:sightglass','rack:carbine','finish:rival'])Journey.interactCampaign(state,id);
  for(const key of ['entities','weapons','itemInstances','inventory','camp','campaign','checkpoints','missionEntries'])assert.deepEqual(encode(state)[key],before[key],`unoffered ${key} has no grant`);
  standAt(state,WORLD.camp.argumentRoom.participants.mara);interact(state,'rival:briefing');
  const invitation=roundTrip(state,'actual stove-room invitation');choose(invitation,'leave');
  assert.equal(invitation.campaign.missions[RIVAL].status,'unstarted');assert.equal(invitation.weapons[RIVAL_CARBINE.id],undefined);
  assert.deepEqual(invitation.inventory,before.inventory);assert.deepEqual(invitation.camp,before.camp);
  const expedition=accepted(invitation);
  assert.equal(expedition.weapons[RIVAL_CARBINE.id],undefined,'accepting precedes real rack delivery');
  assert.ok(expedition.missionEntries[RIVAL]);
  assert.equal(expedition.missionEntries[RIVAL].weapons[RIVAL_CARBINE.id],undefined,'restart owns the pre-grant entry');
  roundTrip(expedition,'accepted expedition before grant');
});

test('physical carbine/ranged tools have one owner and preserve earlier loadouts, mount health and clinic',()=>{
  const state=accepted(),old=encode(state),silas=state.entities.silas;
  equipment(state);
  const weapon=state.weapons[RIVAL_CARBINE.id];
  assert.equal(weapon.capacity,7);assert.equal(weapon.ammo+weapon.reserve,49);assert.equal(weapon.ammoType,'tern-cartridge');assert.equal(weapon.owner,'mara');
  assert.equal(state.player.equippedWeaponId,RIVAL_CARBINE.id);
  for(const [id,before]of Object.entries(old.weapons))if(id!==RIVAL_ENCOUNTER_WEAPON.id)assert.deepEqual(state.weapons[id],before,`${id} retains independent ammo/ownership`);
  for(const member of RIVAL_PARTY){assert.notEqual(member.mountId,state.party.mountId);assert.equal(state.entities[member.mountId].ownerId,old.entities[member.mountId].ownerId);assert.equal(state.entities[member.mountId].hp,old.entities[member.mountId].hp);}
  assert.equal(state.entities['tomas-mount'].name,'Moth');assert.equal(state.entities.thimble.name,'Thimble');
  assert.strictEqual(state.entities.silas,silas);assert.equal(silas.attachment.targetId,'silas-bed');assert.equal(state.entities.lark.hp,0);
  const grants=clone(record(state).transactions),ammo=weapon.ammo+weapon.reserve;
  for(const id of ['rack:carbine','gear:lariat','gear:sightglass'])Journey.interactCampaign(state,id);
  assert.equal(weapon.ammo+weapon.reserve,ammo);assert.deepEqual(record(state).transactions,grants);
  roundTrip(state,'received carbine/lariat/sightglass and actual distinct expedition mounts');
});

// Route planning reads authored collision geometry but moves only through the
// ordinary fixed-step input. Planning never relocates player/companion bodies.
function solid(world,x,y,radius=10) {
  return x<radius||y<radius||x>world.width-radius||y>world.height-radius||(world.obstacles||[]).some(o=>x>o.x-radius&&x<o.x+o.w+radius&&y>o.y-radius&&y<o.y+o.h+radius);
}
function lineClear(world,from,to,radius=1) {
  const count=Math.max(1,Math.ceil(distance(from,to)/4));
  for(let n=1;n<=count;n++){
    const fraction=n/count,x=from.x+(to.x-from.x)*fraction,y=from.y+(to.y-from.y)*fraction,z=(from.z||0)+((to.z||0)-(from.z||0))*fraction;
    if((world.obstacles||[]).some(o=>x>o.x-radius&&x<o.x+o.w+radius&&y>o.y-radius&&y<o.y+o.h+radius&&!o.impassable&&z<=(o.z||0)+(o.height||35)))return false;
  }
  return true;
}
function shotClear(world,from,to,state=null,targetId=null) {
  const length=Math.max(1,distance(from,to)),height=(from.z||0)+(from.mounted?64:29);
  const muzzle={x:from.x+(to.x-from.x)/length*16,y:from.y+(to.y-from.y)/length*16,z:height},end={...to,z:to.z-(to.z-height)*16/length};
  if(!lineClear(world,muzzle,end,3))return false;
  if(state)for(const actor of Object.values(state.entities)){
    if(actor.id===targetId||actor.id==='mara'||actor.category==='enemy'||actor.hp<=0||actor.hidden||actor.regionId!==state.region)continue;
    const dx=end.x-muzzle.x,dy=end.y-muzzle.y,total=dx*dx+dy*dy,u=Math.max(0,Math.min(1,((actor.x-muzzle.x)*dx+(actor.y-muzzle.y)*dy)/total));
    const x=muzzle.x+dx*u,y=muzzle.y+dy*u,z=muzzle.z+(end.z-muzzle.z)*u;
    if(Math.hypot(x-actor.x,y-actor.y)<(actor.kind==='horse'?24:15)&&z>(actor.z||0)+5&&z<(actor.z||0)+(actor.kind==='horse'?63:actor.mounted?91:56))return false;
  }
  return true;
}
function routedWalk(state,target,input={}) {
  const world=Journey.worldForCampaign(state),size=20,width=Math.ceil(world.width/size),height=Math.ceil(world.height/size);
  const point=id=>({x:(id%width)*size+10,y:Math.floor(id/width)*size+10});
  const cell=p=>Math.floor(p.y/size)*width+Math.floor(p.x/size);
  const start=cell(state.player),end=cell(target),queue=[start],previous=new Map([[start,null]]);
  for(let n=0;n<queue.length&&!previous.has(end);n++)for(const offset of [1,-1,width,-width]){
    const id=queue[n]+offset,place=point(id);
    if(id<0||id>=width*height||Math.abs(place.x-point(queue[n]).x)>size+1||previous.has(id)||solid(world,place.x,place.y,state.player.mounted?14:10))continue;
    previous.set(id,queue[n]);queue.push(id);
  }
  assert.ok(previous.has(end),`authored movement path exists toward ${target.x},${target.y}`);
  const points=[target];for(let id=end;id!==start;id=previous.get(id))points.push(point(id));
  pathWalk(state,points.reverse(),input);
}
const resolved=e=>e.hp<=0||e.surrendered||e.escaped;
function shot(state,target,z=44,movementMode='strafe') {
  const gun=state.weapons[state.player.equippedWeaponId];
  if(gun.ammo===0){const dx=target.x-state.player.x,dy=target.y-state.player.y,d=Math.hypot(dx,dy)||1;Journey.reloadCampaign(state);until(state,()=>state.player.reloadTimer===0,5,'counted rifle reload',movementMode==='pursuit'?()=>{const length=distance(state.player,target)||1;return length<85?{mx:0,my:0}:{mx:(target.x-state.player.x)/length,my:(target.y-state.player.y)/length,sprint:true,crouch:false};}:{mx:-dy/d,my:dx/d,crouch:false,sprint:true,focus:state.player.focus>40});}
  until(state,()=>state.player.shotTimer===0,3,'physical shot cadence');
  const observed={x:target.x,y:target.y};tick(state,.05);if(resolved(target))return state;
  const prior=state.stats.shots,flight=distance(state.player,target)/720,velocity={x:(target.x-observed.x)/.05,y:(target.y-observed.y)/.05};
  Journey.shootCampaign(state,target.x+velocity.x*flight,target.y+velocity.y*flight,{z:(target.z||0)+z});
  if(state.stats.shots!==prior+1)fs.writeFileSync('/tmp/dust-mercy-rival-failed-shot.json',JSON.stringify({target:clone(target),state:encode(state)},null,2));
  assert.equal(state.stats.shots,prior+1,'a genuine trigger spends one round and creates a real projectile');
  const dx=target.x-state.player.x,dy=target.y-state.player.y,length=Math.hypot(dx,dy)||1;
  tick(state,Math.min(1.25,flight+.16),movementMode==='pursuit'?()=>{const length=distance(state.player,target)||1;return length<85?{mx:0,my:0}:{mx:(target.x-state.player.x)/length,my:(target.y-state.player.y)/length,sprint:true,crouch:false};}:{mx:-dy/length,my:dx/length,crouch:false});
  if(state.failure)fs.writeFileSync('/tmp/dust-mercy-rival-failed-shot-outcome.json',JSON.stringify({target:clone(target),state:encode(state)},null,2));
  assert.equal(state.failure,null,'actual aimed projectile remains a lawful live simulation outcome');
}
function battle(state=ready(),first='player-first') {
  if(state.mission.stage===4){interact(state,'choose-first');choose(state,first);}
  assert.equal(state.mission.stage,5);
  const world=Journey.worldForCampaign(state),population=RIVAL_ENEMIES.filter(e=>e.wave==='yard').map(e=>state.entities[e.id]);
  assert.equal(population.length,13,'initial encounter keeps the complete original authored population');
  for(let round=0;state.mission.stage===5&&round<80;round++){
    if(state.player.hp<35&&state.inventory.tonic>0)Journey.useCampaignItem(state,'tonic');
    const remaining=population.filter(e=>!resolved(e));
    if(record(state).rival.pavelReturned&&!resolved(state.entities.pavel))remaining.push(state.entities.pavel);
    if(!remaining.length){tick(state,.05);break;}
    const target=remaining.sort((a,b)=>distance(state.player,a)-distance(state.player,b))[0];
    const aim={x:target.x,y:target.y,z:(target.z||0)+44};
    if(distance(state.player,target)>500||!shotClear(world,state.player,aim,state,target.id)){
      const candidates=[];
      for(const radius of [85,150,250,380])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
        const p={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius,z:0};
        p.z=(world.elevationZones||[]).find(zone=>p.x>zone.x+1e-7&&p.x<zone.x+zone.w-1e-7&&p.y>zone.y+1e-7&&p.y<zone.y+zone.h-1e-7)?.z||0;
        if(!solid(world,p.x,p.y)&&shotClear(world,p,aim,state,target.id))candidates.push(p);
      }
      assert.ok(candidates.length,`${target.id} has at least one actual shot angle around authored cover`);
      const destination=candidates.sort((a,b)=>distance(state.player,a)-distance(state.player,b))[0];
      routedWalk(state,destination,{crouch:false,sprint:true,focus:state.player.focus>40});
    }
    // Candidate planning must use the real terrain height and recheck the
    // observed firing position after movement, especially beside ridge mounts.
    if(!resolved(target)&&shotClear(world,state.player,{x:target.x,y:target.y,z:(target.z||0)+44},state,target.id))shot(state,target);
  }
  assert.equal(state.mission.stage,6,'real finite defenders resolve the first battle');
  assert.ok(population.every(resolved));
  return state;
}
function reinforcements(state=battle(),tactic='hold-yard') {
  const pocket=RIVAL_ENEMIES.filter(e=>e.wave==='yard').map(e=>state.entities[e.id]).find(e=>resolved(e)&&!e.escaped);
  assert.ok(pocket);routedWalk(state,{x:pocket.x-20,y:pocket.y});
  interact(state,`${pocket.surrendered?'search-surrendered':'loot'}:${pocket.id}`);
  until(state,()=>record(state).flags.patrolWarned,80,'existing patrol scouts physically reach the warning boundary');
  routedWalk(state,state.entities.tomas);interact(state,'battle:tactics');choose(state,tactic);
  assert.equal(state.mission.stage,7);
  const population=RIVAL_ENEMIES.filter(e=>e.wave!=='yard').map(e=>state.entities[e.id]);
  assert.equal(population.length,12);
  for(let round=0;state.mission.stage===7&&round<90;round++){
    if(state.player.hp<35&&state.inventory.tonic>0)Journey.useCampaignItem(state,'tonic');
    const remaining=population.filter(e=>!resolved(e));if(!remaining.length){tick(state,.05);break;}
    const target=remaining.sort((a,b)=>distance(state.player,a)-distance(state.player,b))[0];
    const aim={x:target.x,y:target.y,z:(target.z||0)+44};
    if(distance(state.player,target)>480||!shotClear(Journey.worldForCampaign(state),state.player,aim,state,target.id)){
      const candidates=[];
      for(const radius of [100,180,280])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const p={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius,z:0};if(!solid(WORLD,p.x,p.y)&&shotClear(WORLD,p,aim,state,target.id))candidates.push(p);}
      assert.ok(candidates.length,`${target.id} has a genuine patrol shot angle`);
      routedWalk(state,candidates.sort((a,b)=>distance(state.player,a)-distance(state.player,b))[0],{crouch:false,sprint:true,focus:state.player.focus>40});
    }
    if(!resolved(target))shot(state,target);
  }
  assert.equal(state.mission.stage,8);assert.ok(population.every(resolved));
  return state;
}
function searches(state=reinforcements(),depart=true) {
  for(const name of ['magazine','cap-wagon','weighhouse']){
    const target=WORLD.searchSites[name==='cap-wagon'?'capWagon':name];
    routedWalk(state,{x:target.x,y:target.y});interact(state,`search:${name}`);
  }
  routedWalk(state,{x:WORLD.charge.x,y:WORLD.charge.y});interact(state,'inspect:charges');
  until(state,()=>distance(state.entities.ruth,state.player)<48,40,'Ruth physically approaches the magazine inspection');
  interact(state,'pass:charge');choose(state,'leave');interact(state,'repack:charges');interact(state,'take:crate');
  routedWalk(state,{x:WORLD.plans.x,y:WORLD.plans.y});interact(state,'read:plans');choose(state,'leave');
  until(state,()=>record(state).flags.plansDelivered&&record(state).flags.horsesRetrieved,70,'Bastian gives real papers to Tomas and Inez retrieves distinct mounts');
  routedWalk(state,state.horse);interact(state,'mount');
  until(state,()=>RIVAL_PARTY.every(member=>state.entities[member.actorId].mounted),40,'all five companions remount after actual search work');
  if(!depart)return state;
  routedWalk(state,state.entities.tomas);interact(state,'convoy:depart');choose(state,'leave');if(state.dialog?.id==='rival-narrative-food-order')choose(state,'leave');
  assert.equal(state.mission.stage,9);
  return state;
}
function chase(state=searches()) {
  for(const node of WORLD.convoyRoute){walk(state,node);until(state,()=>RIVAL_PARTY.every(member=>distance(state.player,state.entities[member.actorId])<190),12,'returning convoy remains together');tick(state,.05);}
  until(state,()=>state.mission.stage===10,15,'visible Levi recognizes the returning convoy and physically bolts');
  assert.equal(record(state).captivity.state,'fleeing');assert.equal(state.entities.levi.mountId,'skein');
  return state;
}
function capture(state=chase(),method='lariat') {
  const levi=state.entities.levi;
  if(method==='lariat'){
    Journey.campaignAction(state,'equip:working-lariat');
    for(let frame=0;record(state).captivity.state==='fleeing'&&frame<550;frame++){
      const length=distance(state.player,levi);
      if(length<120&&record(state).rope.phase==='idle')Journey.shootCampaign(state,levi.x+(levi.vx||state.entities.skein.vx||0)*.18,levi.y+(levi.vy||state.entities.skein.vy||0)*.18,{z:levi.mounted?78:44});
      Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});
      assert.equal(state.failure,null,'moving lariat pursuit remains recoverable');
    }
    assert.equal(record(state).captivity.state,'roped');interact(state,'dismount');
    walk(state,{x:levi.x-22,y:levi.y});interact(state,'bind:levi');
  }else{
    // A lawful on-foot alternative requires a real living fleeing actor. This
    // test dismounts the fugitive through an actual lariat catch+release, then
    // pursues/tackles instead of assigning its mounted or captive state.
    Journey.campaignAction(state,'equip:working-lariat');
    for(let frame=0;record(state).captivity.state==='fleeing'&&frame<550;frame++){
      const length=distance(state.player,levi);
      if(length<120&&record(state).rope.phase==='idle')Journey.shootCampaign(state,levi.x+(levi.vx||state.entities.skein.vx||0)*.18,levi.y+(levi.vy||state.entities.skein.vy||0)*.18,{z:levi.mounted?78:44});
      Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);
    }
    assert.equal(levi.mounted,false);Journey.campaignAction(state,'cancel-rope');interact(state,'dismount');
    for(let frame=0;distance(state.player,levi)>23&&frame<300;frame++){
      const length=distance(state.player,levi);Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);
    }
    interact(state,'tackle:levi');interact(state,'bind:levi');
  }
  until(state,()=>state.mission.stage===11,6,'real timed knots bind the separate living Levi');
  assert.equal(levi.bound,true);assert.equal(levi.hp>0,true);assert.equal(levi.attachment,null);
  return state;
}
function initialPassengerStrap(state){
  until(state,()=>Journey.getCampaignInteractions(state).some(action=>action.id==='strap:levi'),4,'Copper actually stops beside unmounted Mara before the passenger strap');
  interact(state,'strap:levi');return state;
}
function transport(state=capture(),assurance='offer-assurance') {
  const levi=state.entities.levi;
  interact(state,'carry:levi');assert.equal(state.player.carrying,'levi');
  Journey.whistleCampaign(state);until(state,()=>distance(state.player,state.horse)<52,30,'actual Copper comes to the bound captive pickup');
  interact(state,'load:levi');assert.equal(state.player.carrying,null);assert.equal(levi.attachment.targetId,'copper');
  initialPassengerStrap(state);interact(state,'talk:levi-road');choose(state,assurance);interact(state,'mount');
  for(const node of WORLD.returnRoute){routedWalk(state,node);until(state,()=>RIVAL_PARTY.every(member=>distance(state.player,state.entities[member.actorId])<190),12,'physical passenger convoy keeps all riders');tick(state,.05);}
  interact(state,'return:kiln');assert.equal(state.region,'snowbound');assert.equal(state.mission.stage,12);
  return state;
}
function heldUnquestioned(state=transport()) {
  routedWalk(state,WORLD.camp.arrival);interact(state,'hitch:tack');interact(state,'unload:levi');
  routedWalk(state,WORLD.camp.doorway);interact(state,'deliver:levi');
  until(state,()=>distance(state.entities.ruth,state.player)<48,30,'Ruth approaches through the doorway to receive a real captive');
  if(!record(state).flags.delivered)interact(state,'deliver:levi');
  until(state,()=>record(state).flags.held,35,'Ruth moves the single captive body to its guarded holding anchor');
  routedWalk(state,WORLD.camp.holding);return state;
}
function questionCareMenu(state=heldUnquestioned(),objection=true) {
  interact(state,'talk:levi-evidence');
  if(record(state).rival.contractVersion===2){
    until(state,()=>!!state.dialog,90,'all actual holding-room speakers walk to their positions');
    while(state.dialog&&!['rival-questioning-care','rival-questioning-noStock'].includes(state.dialog.id)){
      choose(state,state.dialog.choices.some(choice=>choice.id==='question:object')?(objection?'question:object':'question:allow-order'):'question:continue');
    }
  }
  return state;
}
function questioning(state=transport(),care='care-levi') {
  questionCareMenu(heldUnquestioned(state));
  choose(state,care);
  while(state.dialog&&state.dialog.id.startsWith('rival-questioning-'))choose(state,'question:continue');
  assert.equal(state.mission.stage,13);
  return state;
}
function completed(state=questioning()) {
  routedWalk(state,WORLD.camp.charges);
  // Ruth first retrieves the unique crate from Plover, then walks to the store.
  // Each repeated request remains a real offered custody verb; no owner/flag is
  // assigned by the test to skip either physical leg.
  for(let attempt=0;!record(state).flags.chargesStored&&attempt<100;attempt++){
    interact(state,'deposit:charges');tick(state,.5);assert.equal(state.failure,null);
  }
  assert.equal(record(state).flags.chargesStored,true,'Ruth physically retrieves and deposits the sealed equipment once');
  routedWalk(state,WORLD.camp.ledger);interact(state,'finish:rival');choose(state,'leave');
  assert.equal(state.mission.completed,true);assert.equal(record(state).flags.accounted,true);
  return state;
}

test('fourteen runtime stages follow actual routes, two finite battles, separately reached searches, physical capture/transport and resource-backed holding',()=>{
  const state=completed();
  assert.equal(state.mission.stage,13);assert.equal(record(state).status,'completed');
  assert.equal(state.entities.levi.attachment.targetId,WORLD.camp.holding.id);assert.equal(state.entities.levi.attachment.type,'rest');
  assert.equal(record(state).objects['charge-crate'].owner,'ruth');assert.equal(record(state).objects['charge-crate'].count,4);
  assert.equal(state.entities.silas.attachment.targetId,'silas-bed');assert.equal(state.entities.lark.hp,0);
  assert.equal(state.campaign.missions[HUNT].mission.completed,false,'rival alone does not complete its separate hunting prerequisite');
  assert.equal(state.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'].available,false,'later train runtime remains unavailable');
  roundTrip(state,'all fourteen physical rival scenes');
});

test('six rider travel and wrong-fork recovery preserve real identities and no remote ridge observation',()=>{
  const state=ridge(),r=record(state);
  assert.equal(state.region,'bellwether-works');assert.equal(state.mission.stage,3);
  assert.equal(r.flags.groovesRead,true);assert.equal(r.flags.hoovesRead,true);
  assert.equal(r.scope.raised,false);assert.deepEqual(r.scope.observed,{calder:false,levi:false,magazine:false,weighhouse:false,entry:false});
  assert.equal(new Set([state.party.mountId,...RIVAL_PARTY.map(member=>member.mountId)]).size,6);
  for(const member of RIVAL_PARTY){assert.equal(state.entities[member.actorId].mounted,false);assert.ok(state.entities[member.mountId].hp>0);}
  roundTrip(state,'actual separate six-rider trip before any observed quarry facts');
});

test('premature reconnaissance shooting produces persistent readable failure and restores the real observation checkpoint',()=>{
  const state=ridge(),before=encode(state),attempts=record(state).retryCount;
  Journey.shootCampaign(state,state.entities.calder.x,state.entities.calder.y,{z:44});assert.ok(state.failure);
  assert.match(state.failure.reason,/reconnaissance|concealed|exposed/);
  const failed=roundTrip(state,'early reconnaissance exposure failure');
  tick(failed,2);assert.ok(failed.failure,'key release or elapsed paused input cannot clear exposure');
  choose(failed,'retry');assert.equal(failed.failure,null);assert.equal(failed.mission.stage,3);
  assert.equal(record(failed).retryCount,attempts+1);
  for(const key of ['inventory','weapons','entities','camp','regions'])assert.deepEqual(encode(failed)[key],before.checkpoints[before.campaign.missions[RIVAL].checkpointId].data[key],`${key} restored from the real observation checkpoint`);
  roundTrip(failed,'observation checkpoint recovered');
});

test('sightglass earns five actual aimed observations before concealed descent and distinct first-shot choices',()=>{
  const state=ready();assert.equal(record(state).scope.raised,false);
  assert.ok(Object.values(record(state).scope.observed).every(Boolean));assert.equal(record(state).flags.approachReady,true);
  assert.equal(record(state).choices.firstShot,null);assert.equal(state.player.crouch,true);
  for(const id of ['tomas','ruth','bastian'])assert.ok(distance(state.entities[id],WORLD.yardCover[id])<110,`${id} physically occupies its own ready cover`);
  roundTrip(state,'physically screened approach ready before first-shot choice');
  interact(state,'choose-first');choose(state,'tomas-first');assert.equal(record(state).choices.firstShot,'tomas');
  assert.equal(state.mission.stage,5);assert.ok(state.bullets.some(bullet=>bullet.shooterId==='tomas'),'Tomas opening creates a real companion projectile');
  roundTrip(state,'distinct Tomas first-shot branch');
});

test('reconnaissance/descent cannot execute a future capture, loot, search, deposit or finish by requested ID',()=>{
  const state=ready(),before=encode(state);
  for(const id of ['bind:levi','carry:levi','load:levi','search:magazine','inspect:charges','deposit:charges','finish:rival'])Journey.interactCampaign(state,id);
  for(const key of ['campaign','weapons','entities','camp','inventory','regions','checkpoints','missionEntries'])assert.deepEqual(encode(state)[key],before[key],`unoffered future action cannot manufacture ${key}`);
  roundTrip(state,'ignored future-action attempts after real descent');
});

test('current schema rejects fabricated rival observations, trophies, loot transfers and custody before acceptance',()=>{
  const state=Journey.restoreCampaign(fixture('rescue-complete')),before=encode(state);
  for(const [name,mutate]of [
    ['fifteen head kills without a projectile history',data=>{const p=data.campaign.missions[RIVAL].performance;Object.assign(p,{shots:30,hits:30,headshots:15,kills:15});}],
    ['three focus kills without an activation or bodies',data=>{data.campaign.missions[RIVAL].performance.threeFocusKills=true;}],
    ['quick binding before any pursuit',data=>{data.campaign.missions[RIVAL].performance.quickCapture=true;}],
    ['finished operation time without completion',data=>{data.campaign.missions[RIVAL].performance.underTime=true;}],
    ['all five unseen sightglass facts',data=>{data.campaign.missions[RIVAL].scope.observed={calder:true,levi:true,magazine:true,weighhouse:true,entry:true};}],
    ['unearned invented finite-body loot transaction',data=>{data.campaign.missions[RIVAL].transactions[`${RIVAL}:loot:imaginary-body`]={completed:true};}],
    ['fabricated diagram in an invented work surface',data=>{data.campaign.missions[RIVAL].objects['route-diagram']={id:'route-diagram',kind:'document',owner:'mara',location:{type:'station',targetId:'nonexistent-magazine'}};}],
    ['new ammunition copied into a second inventory owner',data=>{data.inventory.ternCartridge=49;}],
  ]){const malformed=clone(before);mutate(malformed);assert.ok(Journey.restoreCampaign(malformed)===null,name);}
});

function completedFrom(state,options={}) {
  accepted(state);equipment(state);ridge(state);recon(state);ready(state);
  battle(state,options.first||'player-first');reinforcements(state,options.tactic||'hold-yard');
  searches(state);chase(state);capture(state,options.method||'lariat');transport(state);
  questioning(state,options.care||'care-levi');completed(state);return state;
}

for(const [first,tactic,captureMethod,care]of [['player-first','hold-yard','lariat','care-levi'],['tomas-first','advance-trees','tackle','deprive-levi']]){
  test(`${first}/${tactic}/${captureMethod}/${care} are independently causal branches with a persistent single captive`,()=>{
    const state=completedFrom(Journey.restoreCampaign(fixture('rescue-complete')),{first,tactic,method:captureMethod,care});
    assert.equal(record(state).choices.firstShot,first==='player-first'?'player':'tomas');
    assert.equal(record(state).choices.tactic,tactic==='hold-yard'?'hold':'advance');
    assert.equal(record(state).choices.care,care==='care-levi'?'care':'deprive');
    assert.equal(state.entities.levi.id,'levi');assert.notEqual(state.entities.levi.id,'pavel');assert.notEqual(state.entities.levi.id,'silas');
    assert.equal(state.entities.skein.ownerId,'levi');assert.equal(state.entities.levi.attachment.targetId,WORLD.camp.holding.id);
    assert.equal(state.player.carrying,null);
    assert.equal(Object.values(state.entities).filter(actor=>actor.attachment?.targetId==='copper'&&['carried','passenger','large-load'].includes(actor.attachment.type)).length,0,'the captive is no longer a second seat/body at camp');
    roundTrip(state,`${first}/${tactic}/${captureMethod}/${care} genuine end state`);
  });
}

test('finite dead-body pockets and exactly-once camp resources follow real body/action histories',()=>{
  const state=battle(),r=record(state),corpse=RIVAL_ENEMIES.filter(e=>e.wave==='yard').map(e=>state.entities[e.id]).find(e=>e.hp===0&&!e.escaped);
  routedWalk(state,{x:corpse.x-20,y:corpse.y});
  const previous={money:state.player.money,ammo:state.weapons[RIVAL_CARBINE.id].reserve,stock:clone(r.rival.loot[corpse.id])};
  interact(state,`loot:${corpse.id}`);
  assert.equal(state.player.money,previous.money+previous.stock.money);assert.equal(state.weapons[RIVAL_CARBINE.id].reserve,previous.ammo+previous.stock.cartridges);
  assert.equal(corpse.looted,true);assert.equal(r.rival.loot[corpse.id].money,0);assert.equal(r.rival.loot[corpse.id].cartridges,0);
  const once=encode(state);
  Journey.interactCampaign(state,`loot:${corpse.id}`);
  for(const key of ['campaign','weapons','entities','inventory','camp','stats'])assert.deepEqual(encode(state)[key],once[key],`${key} receives no repeated pocket transfer`);
  roundTrip(state,'finite accessible first body after real battle');
});

test('actual rival frames advance the permanent clinic clock; dialogue and failures pause subsequent frames',()=>{
  const state=equipment(),clinic=state.campaign.missions[RESCUE].rescue.silas;
  const before={elapsed:state.elapsed,hp:state.entities.silas.hp,hours:clinic.healingHours,injury:clinic.injury,attachment:clone(state.entities.silas.attachment)};
  tick(state,5);
  const elapsed=state.elapsed-before.elapsed;
  assert.ok(Math.abs(clinic.healingHours-Math.max(0,before.hours-elapsed/80))<1e-7);
  assert.ok(Math.abs(clinic.injury-Math.max(0,before.injury-elapsed/(80*18)))<1e-7);
  assert.ok(Math.abs(state.entities.silas.hp-Math.min(100,before.hp+elapsed/160))<1e-7);
  assert.deepEqual(state.entities.silas.attachment,before.attachment);assert.equal(state.entities.lark.hp,0);
  standAt(state,state.entities.tomas);interact(state,'rival:postpone');
  const paused={elapsed:state.elapsed,clinic:clone(clinic),hp:state.entities.silas.hp};tick(state,3);
  assert.equal(state.elapsed,paused.elapsed);assert.deepEqual(clinic,paused.clinic);assert.equal(state.entities.silas.hp,paused.hp);
  roundTrip(state,'postponed expedition keeps the real clinical schedule');
});

test('real Hunt-first completion keeps food, hides, prior animal/camp outcomes and the distinct rival-first obligation',()=>{
  const original=fixture('hunt-complete');
  const state=completedFrom(Journey.restoreCampaign(original));
  assert.equal(record(state).choices.order,'hunt-first');assert.equal(record(state).rival.huntAtEntry,true);
  assert.deepEqual(state.campaign.missions[HUNT],original.campaign.missions[HUNT],'actual completed hunting history survives the different sibling order');
  for(const [id,item]of Object.entries(original.itemInstances))assert.deepEqual(state.itemInstances[id],item,'earned earlier knife/hides remain indivisible');
  assert.equal(state.weapons[HUNT_BOW.id].ammo,original.weapons[HUNT_BOW.id].ammo);assert.equal(state.weapons[HUNT_BOW.id].reserve,original.weapons[HUNT_BOW.id].reserve);
  assert.equal(state.entities.juno.injured,true);assert.equal(state.entities['willow-creek-doe'].processed,true);assert.equal(state.entities['willow-cedar-buck'].processed,true);
  assert.equal(state.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'].prerequisitesComplete,true,'both actual completed siblings satisfy the AND predicate');
  assert.equal(state.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'].available,false,'an absent train runtime stays unavailable despite prerequisites');
  roundTrip(state,'actual Hunt-first plus rival completion');
});

test('actual rival-first then full Hunt uses real sibling arrows, carcasses, processing and retained permanent captivity',()=>{
  const state=completed(),rivalHistory=clone(record(state)),captive=clone(state.entities.levi),gun=clone(state.weapons[RIVAL_CARBINE.id]);
  assert.equal(state.campaign.missions[HUNT].status,'unstarted');
  huntEquipment(state);huntBank(state);huntReed(state);huntTwoBodies(state);huntLoaded(state);huntKitchen(state);huntProcessed(state);huntCompleted(state);
  assert.equal(state.campaign.missions[HUNT].mission.completed,true);
  assert.equal(huntRecord(state).choices.order,'rival-first');assert.equal(huntRecord(state).hunt.rivalAtReturn,true);
  assert.deepEqual(state.entities.levi.attachment,captive.attachment);assert.equal(state.entities.levi.hp,captive.hp);
  assert.equal(record(state).mission.completed,true);assert.deepEqual(record(state).choices,rivalHistory.choices);assert.deepEqual(record(state).objects,rivalHistory.objects);
  assert.deepEqual(state.weapons[RIVAL_CARBINE.id],gun,'the earned carbine receives no unexplained refill during the bow expedition');
  assert.equal(state.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'].prerequisitesComplete,true);
  assert.equal(state.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'].available,false);
  roundTrip(state,'actual rival-first then full eleven-scene Hunt');
});

test('every physically earned rival checkpoint owns the chronological whole graph and rejects later completed histories',()=>{
  const state=completed(),data=encode(state),stages=[];
  for(const [id,checkpoint]of Object.entries(data.checkpoints).filter(([,cp])=>cp.missionId===RIVAL)){
    const entries=Object.entries(data.checkpoints),history=Object.fromEntries(entries.slice(0,entries.findIndex(([key])=>key===id)+1));
    const branch={...clone(checkpoint.data),checkpoints:clone(history),missionEntries:clone(data.missionEntries),replayCanonical:null};
    for(const missionId of Object.keys(branch.missionEntries))if(missionId!==RIVAL&&!branch.campaign.missions[missionId].mission.completed)delete branch.missionEntries[missionId];
    const restored=Journey.restoreCampaign(branch);assert.ok(restored,`${id} is a lawful actual chronological checkpoint`);
    for(const key of ['entities','weapons','regions','itemInstances','campaign','inventory','camp'])assert.deepEqual(encode(restored)[key],checkpoint.data[key],`${id} actual ${key} restored`);
    stages.push(checkpoint.stage);
  }
  for(const stage of [0,1,3,4,5,6,7,8,9,10,11,12,13])assert.ok(stages.includes(stage),`actual stage${stage} checkpoint exists`);
  const earlier=encode(ridge()),future=Object.values(data.checkpoints).find(cp=>cp.missionId===RIVAL&&cp.data.campaign.missions[RIVAL].mission.completed);
  earlier.checkpoints[future.id]=clone(future);assert.ok(Journey.restoreCampaign(earlier)===null,'completed rival snapshot cannot be laundered into an earlier mission graph');
});

for(const id of [OPENING,RESCUE,HUNT,RIVAL])test(`historical ${id} replay after Rival restores every canonical actor, clinical schedule, weapon, resource and captive outcome`,()=>{
  const original=fixture('hunt-complete'),state=completedFrom(Journey.restoreCampaign(original));
  const canonical=encode(state);
  Journey.beginCampaignReplay(state,id);assert.equal(state.campaign.replayMissionId,id);assert.ok(state.replayCanonical);
  const replay=roundTrip(state,`${id} historical replay after actual fourth story`);
  // Explicit fatal-health negative fixture; no state is manufactured to obtain
  // a successful story or public-control route.
  replay.player.hp=0;tick(replay,.05);assert.ok(replay.failure);assert.ok(replay.dialog.choices.some(choice=>choice.id==='finish-replay'));
  const failed=roundTrip(replay,`${id} suspended replay failure`);choose(failed,'finish-replay');
  const actual=encode(failed);
  for(const key of ['entities','weapons','regions','itemInstances','campaign','checkpoints','missionEntries','inventory','camp','companions','wanted','honor','stats'])assert.deepEqual(actual[key],canonical[key],`${id} replay cannot replace canonical ${key}`);
  assert.equal(failed.entities.levi.attachment.targetId,WORLD.camp.holding.id);assert.equal(failed.entities.lark.hp,0);
  roundTrip(failed,`${id} permanent world restored`);
});

function focusOpportunity() {
  const state=ready();interact(state,'choose-first');choose(state,'player-first');
  routedWalk(state,{x:1500,y:1500},{crouch:false,sprint:true});
  const ids=WORLD.firstShotCover.focusOpportunity;
  for(const id of ids){const actor=state.entities[id];tick(state,.12,{focus:true,aimX:actor.x,aimY:actor.y,aimZ:(actor.z||0)+44});}
  return state;
}
test('earned reticle sweep creates three bounded marks and a finite queued physical head-shot sequence',()=>{
  const state=focusOpportunity(),r=record(state),gun=state.weapons[RIVAL_CARBINE.id];
  assert.equal(r.focus.unlocked,true);assert.equal(r.focus.marks.length,3,'actual clear reticle views mark three distinct living bodies');
  const activation=r.focus.activation,ids=r.focus.marks.map(mark=>mark.targetId),ammo=gun.ammo,shots=state.stats.shots,reserve=gun.reserve,focus=state.player.focus;
  assert.equal(new Set(ids).size,3);assert.ok(r.focus.marks.every(mark=>mark.activation===activation&&mark.weaponId===gun.id));
  const last=state.entities[ids.at(-1)];Journey.shootCampaign(state,last.x,last.y,{z:44});
  assert.equal(gun.ammo,ammo,'requesting the queue does not manufacture immediate hits or spend all rounds at once');assert.equal(r.focus.queue.length,3);
  tick(state,3.4,{focus:true});
  assert.equal(state.failure,null);assert.equal(gun.ammo,ammo-3);assert.equal(gun.reserve,reserve);assert.equal(state.stats.shots,shots+3);
  assert.ok(ids.every(id=>state.entities[id].hp===0),'each mark needs its own lethal physical intersection');
  assert.equal(r.performance.threeFocusKills,true);assert.equal(new Set(r.focus.killIds).size>=3,true);assert.ok(state.player.focus<focus);
  assert.ok(r.rival.shots.filter(shot=>shot.activation===activation&&shot.impact?.kill).length>=3);
  tick(state,.05,{focus:false});roundTrip(state,'three real marked projectile resolutions');
});

test('suspending an earned focus queue has the declared cancel-without-spend restore policy',()=>{
  const state=focusOpportunity(),r=record(state),last=state.entities[r.focus.marks.at(-1).targetId];
  Journey.shootCampaign(state,last.x,last.y,{z:44});assert.equal(r.focus.queue.length,3);
  const before=encode(state),restored=Journey.restoreCampaign(before);assert.ok(restored);
  assert.equal(record(restored).focus.active,false);assert.deepEqual(record(restored).focus.marks,[]);assert.deepEqual(record(restored).focus.queue,[]);
  const after=encode(restored),expectedEntities=clone(before.entities);expectedEntities.mara.focusActive=false;
  assert.deepEqual(after.entities,expectedEntities,'only the declared held-focus input is cancelled on the authoritative player body');
  for(const key of ['weapons','inventory','stats','checkpoints','missionEntries'])assert.deepEqual(after[key],before[key],`${key} remains unchanged when unspent marks are cancelled`);
  assert.deepEqual(record(restored).performance,r.performance);assert.equal(record(restored).rival.shots.length,0);
});

test('a real nonlethal owned coach shot can surrender a guard who is searched alive with a distinct finite verb',()=>{
  const state=ready();interact(state,'choose-first');choose(state,'player-first');
  const guard=state.entities['bellwether-runner'],world=Journey.worldForCampaign(state),aim={x:guard.x,y:guard.y,z:30};
  const candidates=[];
  for(const radius of [80,120,180])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const place={x:guard.x+Math.cos(angle)*radius,y:guard.y+Math.sin(angle)*radius,z:0};if(!solid(world,place.x,place.y)&&shotClear(world,place,aim,state,guard.id))candidates.push(place);}
  assert.ok(candidates.length);routedWalk(state,candidates.sort((a,b)=>distance(state.player,a)-distance(state.player,b))[0],{sprint:true,crouch:false,focus:true});
  Journey.campaignAction(state,'equip:coach-gun');assert.equal(state.player.equippedWeaponId,'coach-gun');
  shot(state,guard,30);assert.ok(guard.hp>0,'a genuine body impact leaves a wounded living opponent');
  tick(state,.1);assert.equal(guard.surrendered,true);assert.equal(guard.active,false);
  Journey.campaignAction(state,`equip:${RIVAL_CARBINE.id}`);battle(state);
  routedWalk(state,{x:guard.x-20,y:guard.y});
  assert.ok(!Journey.getCampaignInteractions(state).some(action=>action.id===`loot:${guard.id}`),'living surrender is never offered as a dead-body search');
  const health=guard.hp,money=state.player.money,stock=clone(record(state).rival.loot[guard.id]);
  interact(state,`search-surrendered:${guard.id}`);assert.equal(guard.hp,health);assert.equal(state.player.money,money+stock.money);assert.equal(guard.looted,true);
  const once=encode(state);Journey.interactCampaign(state,`search-surrendered:${guard.id}`);
  assert.equal(state.player.money,once.entities.mara.money);assert.deepEqual(record(state).transactions,once.campaign.missions[RIVAL].transactions);
  roundTrip(state,'living surrendered guard with one lawful pocket search');
});

test('career hostile-hit and kill totals follow real rival player impacts while ally resolutions remain separate',()=>{
  const before=fixture('rescue-complete'),state=battle(),r=record(state);
  assert.equal(state.stats.hostileHits,before.stats.hostileHits+r.performance.hits,'every actual player hostile impact reaches the permanent career counter');
  assert.equal(state.stats.kills,before.stats.kills+r.performance.kills,'player kills reach the permanent counter without attributing ally kills');
  roundTrip(state,'real rival battle and permanent career totals');
});

test('three actual mount impacts create a persistent dead-Skein fate and an independent on-foot tackle without a lariat catch',()=>{
  const state=chase(),levi=state.entities.levi,skein=state.entities.skein,honor=state.honor,health=levi.hp;
  Journey.campaignAction(state,`equip:${RIVAL_CARBINE.id}`);
  for(let frame=0;distance(state.player,skein)>100&&frame<200;frame++){const length=distance(state.player,skein);Journey.stepCampaign(state,.05,{mx:(skein.x-state.player.x)/(length||1),my:(skein.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);}
  for(let round=0;skein.hp>0&&round<4;round++)shot(state,skein,25,'pursuit');
  assert.equal(skein.hp,0,'real moving trajectories kill the mount without assigning its fate');assert.equal(levi.hp,health,'lower mount-body shots do not invent a human impact');
  assert.equal(levi.mounted,false);assert.ok(state.honor<=honor-5,'killing the nonhostile animal carries its actual moral cost');
  for(let frame=0;distance(state.player,levi)>62&&frame<300;frame++){
    const length=distance(state.player,levi);Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);
  }
  interact(state,'dismount');
  for(let frame=0;distance(state.player,levi)>23&&frame<300;frame++){
    const length=distance(state.player,levi);Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);
  }
  assert.equal(record(state).rope.phase,'idle');assert.equal(record(state).rope.targetId,null);
  interact(state,'tackle:levi');interact(state,'bind:levi');until(state,()=>state.mission.stage===11,5,'on-foot tackle and real binding after actual mount loss');
  assert.strictEqual(state.entities.levi,levi,'the captive is still the same living farrier');
  completed(questioning(transport(state)));
  assert.equal(state.entities.skein.hp,0);assert.equal(state.entities.skein.regionId,'bellwether-works','the actual dead mount remains at its own field body');
  assert.equal(Journey.entityRegion(state,state.entities.levi),'snowbound');assert.equal(state.entities.levi.attachment.targetId,WORLD.camp.holding.id);
  roundTrip(state,'dead original Skein and living captured Levi after lawful foot restraint and return');
});

for(const comparison of ['holding-record-matches','holding-demand-confession'])test(`two real holding visits conserve care stock and distinguish ${comparison} from the uncertain witness`,()=>{
  const state=completed(),r=record(state),initialFood=state.camp.food,initialClock=r.captivity.holdingHours;
  const crate=r.objects['charge-crate'];assert.equal(new Set(crate.chargeIds).size,4);
  for(const id of crate.chargeIds){assert.equal(r.objects[id].kind,'sealed-charge');assert.equal(r.objects[id].sealed,true);assert.equal(r.objects[id].owner,crate.owner);assert.deepEqual(r.objects[id].location,{type:'crate',targetId:crate.id});}
  assert.equal(state.entities.skein.regionId,'snowbound','the actual safely led surviving mount reaches camp');assert.equal(state.entities.skein.ownerId,'levi');
  routedWalk(state,WORLD.camp.holding);interact(state,'holding:first-visit');
  roundTrip(state,'first actual holding visit before additional care');
  for(const choice of ['holding-reassure','holding-feed','holding-denial','holding-check']){choose(state,choice);choose(state,'holding-first-return');}
  choose(state,'holding-first-finish');
  assert.equal(state.camp.food,initialFood-1);assert.equal(r.captivity.restraint,'loose');assert.equal(r.aftermath.holding.visit1.completed,true);
  assert.equal(r.aftermath.holding.careHistory.filter(event=>event.kind==='food').length,1);
  const first=encode(state);Journey.interactCampaign(state,'holding:first-visit');assert.equal(state.camp.food,first.camp.food);
  tick(state,8.1);assert.ok(r.captivity.holdingHours>initialClock,'the real accepted world clock ages the held person between visits');
  routedWalk(state,state.entities.tomas);interact(state,'holding:borrow-papers');
  for(const id of ['route-diagram','seizure-list'])assert.equal(r.objects[id].owner,'mara','the same recovered paper changes custody without duplication');
  routedWalk(state,WORLD.camp.holding);interact(state,'holding:second-visit');
  for(const choice of ['holding-read-route','holding-read-list','holding-read-card']){choose(state,choice);choose(state,'holding-second-return');}
  choose(state,'holding-compare');choose(state,comparison);choose(state,'holding-second-return');choose(state,'holding-second-finish');
  const testimony=r.aftermath.holding.testimony;
  assert.equal(testimony.length,4);assert.ok(testimony.some(statement=>statement.reliability==='uncertain'),'the absent witness is not fabricated by matched sums or coercion');
  assert.equal(r.aftermath.holding.visit2.comparison,comparison==='holding-record-matches'?'corroborated-facts':'pressured-answer');
  assert.equal(state.camp.food,initialFood-1);assert.equal(state.entities.levi.attachment.targetId,WORLD.camp.holding.id);assert.equal(r.captivity.state,'held');
  roundTrip(state,`two physical visits and ${comparison}`);
});

test('the four individually identified charges cannot be lost, duplicated or privately removed from their deposited parent crate in a Save',()=>{
  const original=encode(completed()),crate=original.campaign.missions[RIVAL].objects['charge-crate'];
  for(const [name,mutate]of [
    ['missing third physical charge',data=>{delete data.campaign.missions[RIVAL].objects[crate.chargeIds[2]];}],
    ['one child privately carried while the sealed crate declares four deposited charges',data=>{const child=data.campaign.missions[RIVAL].objects[crate.chargeIds[2]];child.owner='mara';child.location={type:'carried',targetId:'mara'};}],
    ['contained child has a different owner than its sealed parent',data=>{data.campaign.missions[RIVAL].objects[crate.chargeIds[1]].owner='mara';}],
    ['duplicate child identity in the manifest',data=>{data.campaign.missions[RIVAL].objects['charge-crate'].chargeIds[2]=crate.chargeIds[0];}],
    ['invented fifth sealed charge count',data=>{data.campaign.missions[RIVAL].objects['charge-crate'].count=5;}],
  ]){const data=clone(original);mutate(data);assert.ok(Journey.restoreCampaign(data)===null,name);}
});

test('each lawful inspected charge retains one custody through Ruth’s hand, repack, carriage, saddle and camp deposit',()=>{
  const state=reinforcements();
  for(const name of ['magazine','cap-wagon','weighhouse']){const target=WORLD.searchSites[name==='cap-wagon'?'capWagon':name];routedWalk(state,target);interact(state,`search:${name}`);}
  routedWalk(state,WORLD.charge);interact(state,'inspect:charges');
  const r=record(state),crate=r.objects['charge-crate'],ids=[...crate.chargeIds];
  function contained(owner,exception=null){
    assert.equal(new Set(ids).size,4);assert.deepEqual(crate.chargeIds,ids);
    for(const id of ids){const child=r.objects[id];assert.ok(child);assert.equal(child.sealed,true);assert.equal(child.inspected,true);assert.equal(child.owner,id===exception?'ruth':owner);assert.deepEqual(child.location,id===exception?{type:'carried',targetId:'ruth'}:{type:'crate',targetId:crate.id});}
  }
  contained('quarry-store');roundTrip(state,'four actual charges at the inspection surface');
  until(state,()=>distance(state.entities.ruth,state.player)<48,40,'Ruth arrives at the charge inspection');
  interact(state,'pass:charge');contained('quarry-store',ids[0]);roundTrip(state,'only the first charge lawfully held by Ruth for inspection');choose(state,'leave');
  interact(state,'repack:charges');contained('quarry-store');roundTrip(state,'same four charges repacked into the same crate');
  interact(state,'take:crate');assert.deepEqual(crate.location,{type:'carried',targetId:'ruth'});contained('ruth');roundTrip(state,'Ruth owns and carries all four contained charges');
  routedWalk(state,WORLD.plans);interact(state,'read:plans');choose(state,'leave');
  until(state,()=>r.flags.plansDelivered&&r.flags.horsesRetrieved,70,'actual paper transfer and horse retrieval');
  routedWalk(state,state.horse);interact(state,'mount');until(state,()=>RIVAL_PARTY.every(member=>state.entities[member.actorId].mounted),40,'actual crate custody moves to Plover during remount');
  assert.deepEqual(crate.location,{type:'saddle',targetId:'plover'});contained('ruth');roundTrip(state,'actual contained charges in Plover’s saddle custody');
  routedWalk(state,state.entities.tomas);interact(state,'convoy:depart');choose(state,'leave');if(state.dialog?.id==='rival-narrative-food-order')choose(state,'leave');
  chase(state);capture(state);transport(state);questioning(state);completed(state);
  assert.equal(crate.location.type,'station');assert.equal(crate.location.targetId,WORLD.camp.charges.id);assert.equal(crate.owner,'ruth');contained('ruth');roundTrip(state,'same four inspected charges under Ruth’s deposited crate custody');
});

test('post-patrol body searches transfer readable individual belongings once and preserve them through return and historical replay',()=>{
  const state=reinforcements(),r=record(state),found=[];
  for(const paper of QUARRY_POCKET_OBJECTS.filter(paper=>paper.sourceEntityId!=='pavel')){
    const actor=state.entities[paper.sourceEntityId];
    if(actor.escaped){assert.equal(r.objects[paper.id],undefined,'an escaped carrier does not surrender a remote object');continue;}
    assert.ok(resolved(actor),'the actual battle resolves the individual before its search');
    routedWalk(state,{x:actor.x-24,y:actor.y});
    const action=`${actor.surrendered?'search-surrendered':'loot'}:${actor.id}`;
    interact(state,action);found.push(paper.id);
    assert.deepEqual(r.objects[paper.id],{id:paper.id,kind:paper.kind,sourceEntityId:actor.id,owner:'mara',location:{type:'carried',targetId:'mara'}});
    assert.deepEqual(r.rival.loot[actor.id].transferredObjectIds,[paper.id]);
    assert.deepEqual(r.rival.loot[actor.id].objects,[]);
    assert.ok(paper.text.length>60,'the original belonging has actual readable authored content');
    const money=state.player.money,reserve=state.weapons[RIVAL_CARBINE.id].reserve;
    Journey.interactCampaign(state,action);
    assert.equal(state.player.money,money);assert.equal(state.weapons[RIVAL_CARBINE.id].reserve,reserve);
    roundTrip(state,`actual ${paper.id} pickup at its body`);
  }
  assert.ok(found.includes('quarry-unsent-letter'),'the former worker’s individual account remains readable');
  assert.ok(found.includes('quarry-reserve-order'),'later patrol bodies remain searchable after the separate battle');
  const saved=encode(state),itemId=found[0];
  for(const mutate of [data=>{delete data.campaign.missions[RIVAL].objects[itemId];},data=>{data.campaign.missions[RIVAL].objects[itemId].owner='bastian';},data=>{data.campaign.missions[RIVAL].objects[itemId].sourceEntityId='bellwether-scale-watch';}]){
    const bad=clone(saved);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,'ownership/source/receipt cannot be independently forged');
  }
  const returned=completed(questioning(transport(capture(chase(searches(state))))));
  const prior=clone(record(returned).objects);
  roundTrip(returned,'all collected belongings return under the same owner');
  const replay=Journey.beginCampaignReplay(returned,OPENING),permanent=Journey.campaignAction(replay,'finish-replay');
  assert.deepEqual(record(permanent).objects,prior,'earlier replay returns the full permanent belongings');
});

test('earned first projectile permits the timed optional disarm and one acquired engraved gun through full custody Saves and return',()=>{
  const state=ready(),r=record(state),gunId=RIVAL_ENCOUNTER_WEAPON.id;
  interact(state,'choose-first');choose(state,'player-first');
  assert.equal(r.rival.yardOpening.firedAt,null);
  const firstAmmo=state.weapons[RIVAL_CARBINE.id].ammo,firstShots=state.stats.shots;
  // A real harmless high shot opens combat; it assigns no hit, life or reward.
  Journey.shootCampaign(state,state.player.x,state.player.y+900,{z:120});
  assert.equal(state.weapons[RIVAL_CARBINE.id].ammo,firstAmmo-1);
  assert.equal(state.stats.shots,firstShots+1);assert.equal(state.bullets[0].shooterId,'mara');
  assert.equal(r.rival.yardOpening.shotSerial,r.performance.shots);

  // Explicitly staged encounter proximity after the causally earned first
  // projectile. Bodies/paths are placed only to isolate physical contact; no
  // stage, HP, kill, grant, custody phase or acquisition outcome is assigned.
  const thief=state.entities['bellwether-revolver-thief'],bastian=state.entities.bastian;
  Object.assign(bastian,{x:1160,y:1440,z:0});delete bastian.goal;bastian.route=[];
  Object.assign(thief,{x:1182,y:1440,z:0});thief.route=[];delete thief.routeTarget;
  Object.assign(state.player,{x:1182,y:1464,z:0,mounted:false});
  tick(state,.05);
  interact(state,'weapon:disarm-grappler');
  const disarmStarted=r.rival.weaponCustody.actionStartedAt;
  until(state,()=>r.rival.weaponCustody.disarmedAt!==null,3,'timed adjacent carbine disarm');
  assert.ok(r.rival.weaponCustody.disarmedAt-disarmStarted>=.599999,'actual contact time completes the disarm');
  assert.equal(thief.weapon,null);assert.equal(state.weapons[gunId],undefined);
  until(state,()=>r.rival.weaponCustody.phase==='grappling',3,'the actual disarmed guard reaches Bastian');
  assert.equal(state.weapons[gunId],undefined,'contact begins before the actual donor weapon leaves his hand');
  const grappleStarted=r.rival.weaponCustody.actionStartedAt;
  until(state,()=>!!state.weapons[gunId],3,'timed grapple drops the single actual engraved gun');
  assert.ok(r.rival.weaponCustody.createdAt-grappleStarted>=.899999,'actual grapple contact lasts before weapon displacement');
  const gun=state.weapons[gunId],captured=gun.ammo+gun.reserve;
  assert.equal(gun.owner,'bastian');assert.equal(gun.location,'dropped');assert.equal(bastian.weapon,null);
  assert.equal(captured,r.rival.weaponCustody.capturedRounds);
  roundTrip(state,'earned optional engraved gun dropped after timed grapple');
  const forged=encode(state);forged.entities.mara.equippedWeaponId=gunId;
  assert.equal(Object.hasOwn(forged,'player'),false,'the raw graph has no player alias');
  assert.equal(Journey.restoreCampaign(forged),null,'Mara cannot select Bastian’s actual dropped instance in a raw Save');

  interact(state,'weapon:collect-engraved');
  assert.equal(gun.owner,'mara');assert.equal(gun.location,'carried');
  roundTrip(state,'earned player pickup owns the same engraved instance');
  Journey.campaignAction(state,`equip:${gunId}`);assert.equal(state.player.equippedWeaponId,gunId);
  roundTrip(state,'lawfully selected actual acquired engraved gun');
  const loaded=gun.ammo,reserve=gun.reserve,shots=state.stats.shots,trust=state.companions.bastian.trust;
  Journey.shootCampaign(state,thief.x,thief.y,{z:44});
  assert.equal(state.stats.shots,shots+1);assert.equal(gun.ammo,loaded-1);assert.equal(gun.reserve,reserve);
  assert.ok(state.bullets.some(bullet=>bullet.shooterId==='mara'&&bullet.shotSerial===r.performance.shots));
  tick(state,.1);roundTrip(state,'actual acquired engraved shot spends one recorded round');
  interact(state,'weapon:return-engraved');
  assert.equal(state.weapons[gunId],undefined);assert.equal(bastian.weapon.id,gunId);assert.equal(bastian.weapon.owner,'bastian');
  assert.equal(bastian.ammo,loaded-1);assert.equal(bastian.reserve,reserve);assert.equal(bastian.ammo+bastian.reserve,captured-1);
  assert.equal(state.companions.bastian.trust,trust+2);assert.equal(state.player.equippedWeaponId,'mara-revolver');
  roundTrip(state,'engraved gun returned with the actual remaining ammunition');
  assert.equal(Object.keys(state.weapons).filter(id=>id===gunId).length,0,'return does not retain a duplicate registry copy');
});

test('actual Hunt-first Rival route can finish with its earned claimed engraved gun and disarmed Bastian intact',()=>{
  const state=ready(recon(ridge(equipment(accepted(Journey.restoreCampaign(fixture('hunt-complete'))))))),r=record(state),gunId=RIVAL_ENCOUNTER_WEAPON.id;
  interact(state,'choose-first');choose(state,'player-first');Journey.shootCampaign(state,state.player.x,state.player.y+900,{z:120});assert.ok(r.rival.yardOpening.firedAt!==null);
  // Explicit contact-proximity fixture only, after the real opening projectile.
  // No stage, HP, inventory, grant, life, custody phase or outcome is assigned.
  const thief=state.entities['bellwether-revolver-thief'],bastian=state.entities.bastian;
  Object.assign(bastian,{x:1160,y:1440,z:0});delete bastian.goal;bastian.route=[];
  Object.assign(thief,{x:1182,y:1440,z:0});thief.route=[];delete thief.routeTarget;
  Object.assign(state.player,{x:1182,y:1464,z:0,mounted:false});tick(state,.05);
  interact(state,'weapon:disarm-grappler');until(state,()=>r.rival.weaponCustody.disarmedAt!==null,3,'actual optional disarm before claimed gun route');
  until(state,()=>!!state.weapons[gunId],6,'actual grapple drops the only engraved gun');interact(state,'weapon:collect-engraved');interact(state,'weapon:keep-engraved');
  assert.equal(r.rival.weaponCustody.choice,'claimed');assert.equal(state.weapons[gunId].owner,'mara');assert.equal(bastian.weapon,null);assert.equal(bastian.gunDisarmed,true);
  battle(state);reinforcements(state);searches(state);chase(state);capture(state);transport(state);questioning(state);completed(state);
  const restored=roundTrip(state,'earned Hunt-first completed Rival with claimed engraved gun');assert.equal(record(restored).rival.weaponCustody.choice,'claimed');assert.equal(restored.entities.bastian.gunDisarmed,true);assert.equal(restored.entities.bastian.weapon,null);
  assert.equal(restored.weapons[gunId].owner,'mara');assert.equal(restored.campaign.missions[HUNT].mission.completed,true);
  if(process.env.DUST_MERCY_TRAIN_CLAIM_FIXTURE)fs.writeFileSync(process.env.DUST_MERCY_TRAIN_CLAIM_FIXTURE,Journey.serializeCampaign(restored));
  // Explicitly limited EMPTY Train component dispatch/hand-pose boundary, not
  // a playable Train start or full Train Save. The prior claim/three guns were
  // earned above; no ammunition, HP, stage, reward or outcome is assigned here.
  for(const weaponId of ['mara-revolver','coach-gun',RIVAL_CARBINE.id]){
    const f=createWeaponLoanFixture(restored,weaponId),gun=f.s.weapons[weaponId],before=gun.ammo+gun.reserve,oldPerformance=clone(record(f.s).performance),oldTrust=clone(f.s.companions.bastian),selected=f.s.entities.mara.equippedWeaponId;
    // Negative selection fixture only: refusal cannot silently switch Mara's
    // primary or transfer the selected gun. Restore before the positive route.
    f.s.entities.mara.equippedWeaponId=weaponId;assert.equal(f.request('lend-weapon'),null);assert.equal(f.s.entities.mara.equippedWeaponId,weaponId);assert.equal(gun.owner,'mara');f.s.entities.mara.equippedWeaponId=selected;
    assert.equal(f.request('lend-weapon').requiredSeconds,1);for(let i=0;i<12&&Object.keys(record(f.s).rival.continuation.requests).length;i++)f.tick(.1);
    assert.equal(gun.owner,'bastian');assert.equal(gun.ammo+gun.reserve,before);assert.equal(f.s.entities.mara.equippedWeaponId,selected);assert.equal(validateRivalContinuation(f.s),true);
    assert.equal(f.request('lend-weapon'),null,'only one active original gun loan is allowed');
    assert.equal(f.s.entities.bastian.ammo,0);assert.equal(f.s.entities.bastian.reserve,0);assert.equal(f.s.entities.bastian.weapon.registryOwned,true);
    // Only draw/holster input poses are staged at this component boundary.
    const borrower=f.s.entities.bastian;borrower.holstered=false;
    assert.ok(emitTrainShot(f.s,'bastian',{x:borrower.x+100,y:borrower.y,z:borrower.z+44},{faction:'ally'}));
    assert.equal(gun.ammo+gun.reserve,before-1);assert.equal(f.s.bullets.at(-1).weaponId,weaponId);assert.equal(validateRivalContinuation(f.s),true);
    if(gun.reserve>0&&gun.ammo<gun.capacity){assert.equal(requestTrainReload(f.s,'bastian'),true);for(let i=0;i<30&&borrower.reloadTimer>0;i++){f.tick(.1);stepTrainReload(f.s,'bastian',.1);}assert.equal(borrower.reloadTimer,0);assert.equal(gun.ammo+gun.reserve,before-1);}
    borrower.holstered=true;f.complete(f.request('return-weapon'));assert.equal(gun.owner,'mara');assert.equal(gun.ammo+gun.reserve,before-1);assert.equal(borrower.weapon,null);assert.equal(borrower.gunDisarmed,true);
    f.complete(f.request('lend-weapon'));assert.equal(gun.owner,'bastian');assert.equal(gun.ammo+gun.reserve,before-1);f.complete(f.request('return-weapon'));assert.equal(gun.owner,'mara');assert.equal(gun.ammo+gun.reserve,before-1,'a real second loan cycle never refills the gun');
    const oldLoanEvents=record(f.s).rival.continuation.events.length;f.settings.throwPhysical=true;f.complete(f.request('lend-weapon'),{success:false});
    assert.equal(gun.owner,'mara');assert.equal(gun.ammo+gun.reserve,before-1);assert.equal(borrower.weapon,null);assert.equal(borrower.gunDisarmed,true);assert.equal(record(f.s).rival.continuation.events.length,oldLoanEvents,'a failed owning physical result rolls the canonical weapon handoff back');
    assert.equal(validateRivalContinuation(f.s),true);assert.deepEqual(record(f.s).performance,oldPerformance);assert.deepEqual(f.s.companions.bastian,oldTrust,'later temporary loan preserves the earlier engraved claim cost');
    const bad=JSON.parse(JSON.stringify(f.s));bad.campaign.missions[RIVAL].rival.continuation.events.find(event=>event.kind==='return-weapon').weaponChange.stock.reserve++;assert.equal(validateRivalWeaponLoans(bad,bad.campaign.missions[RIVAL].rival.continuation.events),false,'a forged return cannot invent remaining ammunition');
  }
});

test('an untouched completed-Hunt ration heals during active Rival with its original once-only custody and a lawful full Save',()=>{
  const original=fixture('hunt-complete');assert.equal(original.inventory.quietRation,1);
  assert.equal(original.campaign.missions[HUNT].flags.rationUsed,false);
  const state=accepted(Journey.restoreCampaign(original)),r=record(state),hunt=state.campaign.missions[HUNT];
  const hp=state.player.hp,stamina=state.player.stamina,healing=r.performance.healingUses,grant=clone(hunt.transactions[`${HUNT}:grant:quiet-ration`]);
  assert.ok(hp<=92,'the actual imported player has room for the original eight health');
  Journey.useCampaignItem(state,'quietRation');
  assert.equal(state.inventory.quietRation,0);assert.equal(state.player.hp,hp+8);assert.equal(state.player.stamina,Math.min(100,stamina+70));
  assert.equal(hunt.flags.rationUsed,true);assert.deepEqual(hunt.transactions[`${HUNT}:use:quiet-ration`],{amount:1,completed:true});
  assert.deepEqual(hunt.transactions[`${HUNT}:grant:quiet-ration`],grant,'the original gifted ration is not granted again');
  assert.equal(hunt.mission.completed,true);assert.equal(r.performance.healingUses,healing+1);assert.equal(r.performance.noHealingItems,false);
  const after={hp:state.player.hp,stamina:state.player.stamina,uses:r.performance.healingUses,transactions:clone(hunt.transactions)};
  for(const id of ['quietRation','quiet-ration','eat:quiet-ration'])Journey.useCampaignItem(state,id);
  assert.deepEqual({hp:state.player.hp,stamina:state.player.stamina,uses:r.performance.healingUses,transactions:hunt.transactions},after,'once-only owner transactions prevent repeat benefits');
  const warmHp=state.player.hp,warmUses=r.performance.healingUses;assert.equal(state.inventory.warmRation,0);
  Journey.useCampaignItem(state,'warmRation');assert.equal(state.player.hp,warmHp);assert.equal(r.performance.healingUses,warmUses,'an unowned original rescue ration is not fabricated');
  roundTrip(state,'actual inherited Hunt ration used during active Rival');
});

test('original kitchen cider remains proximate to Orla and once-only while its actual Rival consumption counts',()=>{
  const state=accepted(Journey.restoreCampaign(fixture('hunt-complete'))),r=record(state),hunt=state.campaign.missions[HUNT];
  assert.equal(state.camp.pantry.warmCider,1);assert.ok(distance(state.player,state.entities.orla)>70);
  const hp=state.player.hp,uses=r.performance.healingUses;
  Journey.useCampaignItem(state,'warmCider');assert.equal(state.camp.pantry.warmCider,1);assert.equal(state.player.hp,hp);assert.equal(r.performance.healingUses,uses);
  // Explicit initial camp proximity for the original giver's offered drink.
  standAt(state,state.entities.orla);Journey.useCampaignItem(state,'warmCider');
  assert.equal(state.camp.pantry.warmCider,0);assert.equal(state.player.hp,Math.min(100,hp+5));assert.equal(hunt.flags.ciderUsed,true);
  assert.deepEqual(hunt.transactions[`${HUNT}:use:kitchen-cider`],{amount:1,completed:true});assert.equal(r.performance.healingUses,uses+1);
  Journey.useCampaignItem(state,'warmCider');assert.equal(r.performance.healingUses,uses+1);assert.equal(state.camp.pantry.warmCider,0);
  roundTrip(state,'actual original cider gifted by Orla used during Rival');
});

test('Rival bandage use requires an owned unit and injury, restores exactly thirty-five health and records only the consumption',()=>{
  const state=accepted(),r=record(state),originalHp=state.player.hp;
  assert.equal(state.inventory.bandages,0);Journey.useCampaignItem(state,'bandages');
  assert.equal(state.player.hp,originalHp);assert.equal(r.performance.healingUses,0);
  // Explicitly staged consumable-unit starting stock and injury. This isolates
  // ownership/health guards; it is not an earned bandage-acquisition receipt.
  state.inventory.bandages=2;state.player.hp=65;
  Journey.useCampaignItem(state,'bandages');assert.equal(state.inventory.bandages,1);assert.equal(state.player.hp,100);
  assert.equal(r.performance.healingUses,1);assert.equal(r.performance.noHealingItems,false);
  Journey.useCampaignItem(state,'bandages');assert.equal(state.inventory.bandages,1);assert.equal(state.player.hp,100);assert.equal(r.performance.healingUses,1,'full health neither spends stock nor counts a healing use');
  roundTrip(state,'staged owned bandage has lawful active Rival consumption');
});

test('consuming the actual retained Hunt ration after earned Rival completion preserves all awarded Rival performance',()=>{
  const state=completedFrom(Journey.restoreCampaign(fixture('hunt-complete'))),r=record(state),hunt=state.campaign.missions[HUNT];
  assert.equal(r.mission.completed,true);assert.equal(state.inventory.quietRation,1);
  const performance=clone(r.performance),hp=state.player.hp;
  Journey.useCampaignItem(state,'quietRation');assert.equal(state.inventory.quietRation,0);assert.equal(state.player.hp,Math.min(100,hp+8));
  assert.equal(hunt.flags.rationUsed,true);assert.deepEqual(hunt.transactions[`${HUNT}:use:quiet-ration`],{amount:1,completed:true});
  assert.deepEqual(r.performance,performance,'later care does not rewrite the earned mission result');
  // These are only units remaining from the actual imported world and battles.
  for(const id of ['tonic','meat','cookedMeat','broth'])if(state.inventory[id]>0)Journey.useCampaignItem(state,id);
  assert.deepEqual(r.performance,performance,'later actual tonic/food consumption also leaves awarded performance fixed');
  roundTrip(state,'actual cross-story ration and later supplies after completed Rival');
});

test('contract2 reconnaissance separates visible identities and places from the actual witnessed tear, strike and mounted departures',()=>{
  const state=ridge(),r=record(state),calder=state.entities.calder,levi=state.entities.levi;
  pathWalk(state,WORLD.ridgeWalk);interact(state,'sightglass:raise');
  const frame=(actors,target=calder)=>tick(state,.05,{aimX:target.x,aimY:target.y,aimZ:30,scopeVisible:true,scopeActors:actors});
  for(let n=0;n<80;n++)frame([]);
  assert.equal(r.scope.observed.calder,false,'off-lens actors cannot become an observed identity');
  assert.equal(r.rival.reconEventPhase,0);assert.equal(r.objects['levi-debt-card'],undefined);
  for(let n=0;n<100;n++)frame(['calder']);
  assert.equal(r.scope.observed.calder,true);assert.equal(r.rival.reconWitness.receipts.length,0);
  assert.equal(levi.hp,100,'a held commander alone does not claim a witnessed assault');
  roundTrip(state,'commander identified before the actual exchange');
  for(let n=0;r.rival.reconEventPhase<2&&n<100;n++)frame(['calder','levi']);
  assert.equal(levi.hp,94);assert.equal(levi.bruised,true);
  assert.deepEqual(r.rival.reconWitness.receipts.map(e=>e.id),['card','strike']);
  for(const [id,target]of [['levi',levi],...WORLD.recon.landmarks.map(target=>[target.id==='screened-entry'?'entry':target.id,target])]){
    for(let n=0;!r.scope.observed[id]&&n<100;n++)frame(id==='levi'?['levi']:[],target);
    assert.equal(r.scope.observed[id],true);
  }
  assert.equal(Object.values(r.scope.observed).every(Boolean),true);
  assert.equal(r.flags.reconComplete,false,'five identified views do not fabricate departures');
  const guessed=encode(state);guessed.campaign.missions[RIVAL].flags.reconComplete=true;
  assert.equal(Journey.restoreCampaign(guessed),null,'future event claims reject');
  for(let n=0;!r.rival.reconWitness.receipts.some(e=>e.id==='departure')&&n<500;n++)frame(['calder','grout']);
  assert.equal(calder.mounted,true);assert.ok(r.rival.reconWitness.receipts.some(e=>e.id==='departure'));
  assert.equal(r.flags.reconComplete,false,'the separate dismissal is still unseen');
  roundTrip(state,'actually watched northern departure before the separate dismissal');
  for(let n=0;!r.rival.reconWitness.receipts.some(e=>e.id==='dismissal')&&n<500;n++)frame(['levi','skein'],levi);
  assert.ok(r.rival.reconWitness.receipts.some(e=>e.id==='dismissal'));
  until(state,()=>r.flags.reconComplete,30,'Calder physically completes the departing road');
  assert.equal(calder.departed,true);assert.equal(state.entities.grout.departed,true);
  roundTrip(state,'all actual visible events and separate place observations earned');
  const saved=encode(state);
  for(const mutate of [data=>{data.campaign.missions[RIVAL].rival.reconWitness.receipts[1].actors[0].id='tomas';},data=>{data.campaign.missions[RIVAL].rival.reconWitness.receipts[2].actors[0].mounted=false;},data=>{data.campaign.missions[RIVAL].rival.reconWitness.receipts[3].at=data.elapsed+1;}]){
    const bad=clone(saved);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,'event actor, physical mount and time provenance are constrained');
  }
});



// These additions enter stage 8 through the existing real route helper. Camp
// acceptance proximity remains explicitly staged by that helper; searches,
// actor navigation, contact time, custody and completion are never assigned.
test('new search contract waits for Ruth and Bastian to reach and work at their own physical sites',()=>{
  const state=reinforcements(),r=record(state),ruth=state.entities.ruth,bastian=state.entities.bastian;
  const ruthStart={x:ruth.x,y:ruth.y},bastianStart={x:bastian.x,y:bastian.y},inventory=clone(state.inventory),pockets=clone(r.rival.loot);
  assert.equal(r.rival.contractVersion,2);
  routedWalk(state,WORLD.capTin);assert.ok(distance(ruth,WORLD.capTin)>55);
  interact(state,'search:cap-wagon');assert.equal(r.objects['cap-tin'],undefined,'Mara’s request cannot transfer the tin remotely');
  roundTrip(state,'new cap search assigned before Ruth arrives');
  until(state,()=>r.rival.searchWork.cap.phase==='working',45,'Ruth actually reaches the cap-wagon workpoint');
  assert.equal(r.objects['cap-tin'],undefined,'arrival alone has not completed the search');
  tick(state,.5);assert.equal(r.objects['cap-tin'],undefined);
  roundTrip(state,'Ruth working at the cap wagon before finding its tin');
  until(state,()=>r.rival.searchWork.cap.phase==='found',3,'Ruth finishes timed cap inspection');
  assert.ok(distance(ruthStart,ruth)>100);assert.equal(r.objects['cap-tin'].owner,'ruth');
  assert.ok(distance(r.rival.searchWork.cap.foundPosition,WORLD.searchSites.capTin.workpoint)<=8);
  assert.ok(r.rival.searchWork.cap.foundAt-r.rival.searchWork.cap.reachedAt>=1.5-1e-8);
  roundTrip(state,'Ruth physically found and carries the closed cap tin');
  routedWalk(state,WORLD.plans);assert.ok(distance(bastian,WORLD.plans)>55);
  interact(state,'search:weighhouse');
  for(const id of ['route-diagram','seizure-list'])assert.equal(r.objects[id],undefined,'Mara’s desk request cannot give distant Bastian a paper');
  assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='read:plans'));
  roundTrip(state,'Bastian assigned to the real weighhouse before paper ownership');
  until(state,()=>r.rival.searchWork.papers.phase==='working',50,'Bastian navigates through the real doorway to the ledger workpoint');
  tick(state,.5);assert.equal(r.objects['route-diagram'],undefined);
  roundTrip(state,'Bastian’s incomplete timed desk search');
  until(state,()=>r.rival.searchWork.papers.phase==='found',3,'Bastian finds both papers after contact time');
  assert.ok(distance(bastianStart,bastian)>100);
  assert.ok(distance(r.rival.searchWork.papers.foundPosition,WORLD.searchSites.plans.workpoint)<=8);
  for(const id of ['route-diagram','seizure-list'])assert.deepEqual(r.objects[id].location,{type:'carried',targetId:'bastian'});
  interact(state,'read:plans');roundTrip(state,'existing plan discussion with papers genuinely carried by their finder');choose(state,'leave');
  until(state,()=>r.rival.searchWork.papers.phase==='handing',50,'Bastian reaches Tomas for the separate paper handoff');
  assert.equal(r.flags.plansDelivered,false);assert.equal(r.objects['route-diagram'].owner,'bastian');
  tick(state,.5);assert.equal(r.objects['route-diagram'].owner,'bastian');roundTrip(state,'paper contact underway before custody transfer');
  until(state,()=>r.flags.plansDelivered,3,'the paper handoff completes its own contact time');
  for(const id of ['route-diagram','seizure-list'])assert.deepEqual(r.objects[id].location,{type:'carried',targetId:'tomas'});
  assert.ok(r.rival.searchWork.papers.handoff.finishedAt-r.rival.searchWork.papers.handoff.startedAt>=1.25-1e-8);
  assert.deepEqual(state.inventory,inventory);assert.deepEqual(r.rival.loot,pockets,'search work does not refill or strip any individual pocket');
  roundTrip(state,'the same physically found papers now carried by Tomas');
});

test('Mara can carry the cap tin and physically hand it to Ruth, with movement interrupting incomplete work',()=>{
  const state=reinforcements(),r=record(state);
  routedWalk(state,WORLD.capTin);interact(state,'search:cap-self');
  tick(state,.6);assert.equal(r.objects['cap-tin'],undefined);
  routedWalk(state,{x:WORLD.capTin.x,y:WORLD.capTin.y+100});
  assert.equal(r.rival.searchWork.cap.activeSeconds,0,'leaving the workpoint interrupts the incomplete manipulation');
  roundTrip(state,'Mara left the cap search before its completion');
  routedWalk(state,WORLD.searchSites.capTin.workpoint);
  until(state,()=>r.objects['cap-tin']?.owner==='mara',3,'Mara finishes the actual closed-tin search');
  assert.deepEqual(r.objects['cap-tin'].location,{type:'carried',targetId:'mara'});
  roundTrip(state,'Mara carries the same cap tin before giving it to Ruth');
  assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='handoff:cap-tin'),'distant Ruth has no handoff offer');
  until(state,()=>distance(state.player,state.entities.ruth)<=22,50,'Ruth walks close enough to receive Mara’s tin');
  interact(state,'handoff:cap-tin');assert.equal(r.objects['cap-tin'].owner,'mara');
  tick(state,.5);assert.equal(r.objects['cap-tin'].owner,'mara','custody waits for the contact to finish');
  const contactSave=encode(state),forgedOwner=clone(contactSave);forgedOwner.campaign.missions[RIVAL].objects['cap-tin'].owner='ruth';forgedOwner.campaign.missions[RIVAL].objects['cap-tin'].location={type:'carried',targetId:'ruth'};
  assert.equal(Journey.restoreCampaign(forgedOwner),null,'an unfinished handoff cannot give Ruth the tin');
  const resumed=roundTrip(state,'Mara-to-Ruth tin contact before ownership changes'),resumedRecord=record(resumed),startedAt=resumedRecord.rival.searchWork.cap.handoff.startedAt;
  until(resumed,()=>resumedRecord.objects['cap-tin'].owner==='ruth',3,'reloaded contact continues its remaining work without another pickup');
  assert.equal(resumedRecord.rival.searchWork.cap.handoff.startedAt,startedAt);assert.equal(resumedRecord.rival.searchWork.cap.phase,'transferred');
  assert.deepEqual(resumedRecord.transactions[`${RIVAL}:search:cap-tin`],r.transactions[`${RIVAL}:search:cap-tin`],'reloading the handoff does not run the source search again');
  roundTrip(resumed,'same cap tin after the interrupted Save resumes and completes its handoff');
  until(state,()=>r.objects['cap-tin'].owner==='ruth',3,'the closed-tin handoff finishes');
  assert.ok(distance(r.rival.searchWork.cap.handoff.from,r.rival.searchWork.cap.handoff.to)<=22);
  assert.equal(r.rival.searchWork.cap.phase,'transferred');roundTrip(state,'Ruth receives the single cap tin from Mara');
  const settled=encode(state);Journey.interactCampaign(state,'handoff:cap-tin');
  assert.deepEqual(record(state).objects,settled.campaign.missions[RIVAL].objects,'the finished handoff cannot produce a second tin');
});

test('new search Save validation rejects remote ownership, invented finds, short contacts and paper delivery without its physical receipt',()=>{
  const pending=reinforcements();routedWalk(pending,WORLD.capTin);interact(pending,'search:cap-wagon');
  const assigned=encode(pending);
  const invented=clone(assigned);invented.campaign.missions[RIVAL].objects['cap-tin']={id:'cap-tin',kind:'cap-tin',owner:'ruth',location:{type:'carried',targetId:'ruth'}};
  assert.equal(Journey.restoreCampaign(invented),null,'a requested search cannot give distant Ruth the tin');
  const settled=encode(searches());
  for(const [name,mutate]of [
    ['paper acquired by the wrong finder',d=>{d.campaign.missions[RIVAL].rival.searchWork.papers.actorId='emmett';}],
    ['paper find away from its workpoint',d=>{const r=d.campaign.missions[RIVAL];r.rival.searchWork.papers.foundPosition={x:500,y:500,z:0};r.transactions[`${RIVAL}:search:papers`].position={x:500,y:500,z:0};}],
    ['cap found in zero time',d=>{const r=d.campaign.missions[RIVAL];r.rival.searchWork.cap.foundAt=r.rival.searchWork.cap.reachedAt;r.transactions[`${RIVAL}:search:cap-tin`].at=r.rival.searchWork.cap.foundAt;}],
    ['paper transferred across the yard',d=>{const r=d.campaign.missions[RIVAL];r.rival.searchWork.papers.handoff.to.x+=200;r.transactions[`${RIVAL}:handoff:papers`].to.x+=200;}],
    ['paper finder restored as station ownership after delivery',d=>{const r=d.campaign.missions[RIVAL];r.objects['route-diagram'].owner='bastian';r.objects['route-diagram'].location={type:'station',targetId:WORLD.plans.id};}],
    ['missing source search receipt',d=>{delete d.campaign.missions[RIVAL].transactions[`${RIVAL}:search:papers`];}],
    ['missing paper contact receipt',d=>{delete d.campaign.missions[RIVAL].transactions[`${RIVAL}:handoff:papers`];}],
    ['physical history removed from a new-contract convoy',d=>{delete d.campaign.missions[RIVAL].rival.searchWork;}],
    ['unsupported duplicate cap receipt',d=>{d.campaign.missions[RIVAL].transactions[`${RIVAL}:search:cap-tin-again`]={completed:true};}],
  ]){const corrupt=clone(settled);mutate(corrupt);assert.equal(Journey.restoreCampaign(corrupt),null,name);}
});

// Explicit staged compatibility-policy fixture: this removes the new marker
// before any rival actions, including historical root bodies. It proves that
// the old runtime remains legal, not untouched historical v4 byte provenance.
test('absent-contractVersion v4 histories retain old search custody without invented work or contact receipts',()=>{
  const state=Journey.restoreCampaign(fixture('rescue-complete'));
  function historical(body){for(const key of ['contractVersion','narrative','narrativeVersion','transportVersion','transport','questioningVersion','questioning','equipment','reconWitness','searchWork'])delete body.campaign.missions[RIVAL].rival[key];for(const c of Object.values(body.checkpoints||{}))historical(c.data);for(const entry of Object.values(body.missionEntries||{}))historical(entry);if(body.replayCanonical)historical(body.replayCanonical);}
  historical(state);
  const done=completedFrom(state),r=record(done);
  assert.equal(r.rival.contractVersion,undefined);assert.equal(r.rival.searchWork,undefined);
  for(const key of ['search:cap-tin','search:papers','handoff:cap-tin','handoff:papers'])assert.equal(r.transactions[`${RIVAL}:${key}`],undefined);
  const restored=roundTrip(done,'staged old v4 policy preserves earned original custody');
  assert.equal(record(restored).rival.searchWork,undefined,'import cannot invent a past search or handoff');
});


const oldSearchManifest=JSON.parse(fs.readFileSync(new URL('rival-v4-search-provenance.json',fixtureDir),'utf8'));
for(const provenance of oldSearchManifest.fixtures)test(`untouched original ${provenance.fixture} preserves all historical search custody without invented contacts`,()=>{
  const bytes=gunzipSync(fs.readFileSync(new URL(provenance.fixture,fixtureDir)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256OfUncompressedOriginalBytes,'original public Save bytes were not normalized or rewritten');
  assert.equal(bytes.length,provenance.bytes);
  const original=JSON.parse(bytes),state=Journey.restoreCampaign(original);assert.ok(state,'the genuine old v4 public Save remains accepted');
  assert.equal(original.version,4);assert.equal(original.campaign.missions[RIVAL].rival.contractVersion,undefined);
  function noInventedWork(before,after){
    const old=before.campaign.missions[RIVAL],current=after.campaign.missions[RIVAL];
    assert.deepEqual(priorRivalHistory(current.rival),old.rival,'all prior operation history remains unchanged');
    assert.deepEqual(current.objects,old.objects,'actual previous tin, paper, charge and personal-object custody remains unchanged');
    assert.deepEqual(current.transactions,old.transactions,'no contact receipt is inferred from already-held equipment');
    for(const [id,c]of Object.entries(before.checkpoints||{}))noInventedWork(c.data,after.checkpoints[id].data);
    for(const [id,entry]of Object.entries(before.missionEntries||{}))noInventedWork(entry,after.missionEntries[id]);
    if(before.replayCanonical)noInventedWork(before.replayCanonical,after.replayCanonical);
  }
  noInventedWork(original,encode(state));roundTrip(state,`unchanged original ${provenance.fixture}`);
});

test('Ruth physically hands over finite spare cartridges and the inspected carbine can be stored and recovered without refilling',()=>{
  const state=accepted(),r=record(state);
  // Labelled initial camp proximity, then actual giver work and normal verbs.
  standAt(state,state.horse,-24);
  until(state,()=>r.flags.carbineGranted,40,'Tomas walks the loaded gun to Copper');
  const gun=state.weapons[RIVAL_CARBINE.id];
  assert.equal(gun.ammo,7);assert.equal(gun.reserve,0,'Ruth’s separate packet has not been granted remotely');
  roundTrip(state,'loaded gun before separate reserve issue');
  interact(state,'rack:inspect-carbine');choose(state,'leave');interact(state,'rack:carbine');
  Journey.interactCampaign(state,'gear:cartridges');assert.equal(r.rival.equipment.pending,false,'an out-of-reach handoff is unavailable');
  routedWalk(state,state.entities.ruth);interact(state,'gear:cartridges');
  until(state,()=>r.rival.equipment.contact>.35,20,'Ruth reaches the actual receiver');
  assert.equal(gun.reserve,0,'partial contact cannot mint the packet');
  walk(state,{x:state.player.x+55,y:state.player.y+20});
  assert.equal(gun.reserve,0);roundTrip(state,'interrupted cartridge contact');
  until(state,()=>r.rival.equipment.issued===42,30,'the actual giver catches up and finishes counted contact');
  assert.equal(gun.reserve,42);assert.equal(r.rival.equipment.receipt.count,42);
  assert.ok(r.rival.equipment.receipt.contact>=1.1-1e-9);
  const transaction=clone(r.transactions[`${RIVAL}:grant:spare-cartridges`]);
  Journey.interactCampaign(state,'gear:cartridges');assert.equal(gun.reserve,42);assert.deepEqual(r.transactions[`${RIVAL}:grant:spare-cartridges`],transaction);
  Journey.campaignAction(state,'draw');const shots=state.stats.shots;
  Journey.shootCampaign(state,state.player.x+120,state.player.y-240,{z:100});assert.equal(state.stats.shots,shots+1);tick(state,.5);
  assert.equal(state.failure,null);assert.equal(gun.ammo,6);
  routedWalk(state,{x:state.horse.x-24,y:state.horse.y});
  interact(state,'rack:store-carbine');assert.equal(gun.location,'saddle');assert.equal(gun.rackMountId,state.horse.id);
  assert.equal(state.player.equippedWeaponId,'mara-revolver');
  assert.equal(r.flags.carbineEquipped,true,'previous inspection/retrieval remains historical');
  assert.ok(Journey.getCampaignInteractions(state).some(a=>a.id==='rack:carbine'),'stored inspected longarm exposes its recovery action');
  roundTrip(state,'finite fired gun on Copper’s rack');
  for(let n=0;n<3;n++){
    interact(state,'rack:carbine');assert.equal(gun.ammo,6);assert.equal(gun.reserve,42);
    interact(state,'rack:store-carbine');assert.equal(gun.location,'saddle');
  }
  const saved=encode(state);
  for(const mutate of [data=>{data.campaign.missions[RIVAL].rival.equipment.receipt.count=43;},data=>{data.campaign.missions[RIVAL].rival.equipment.receipt.giver.x+=90;},data=>{data.campaign.missions[RIVAL].rival.equipment.receipt.contact=.2;},data=>{data.weapons[RIVAL_CARBINE.id].reserve++;}]){
    const bad=clone(saved);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,'count/contact/ownership receipt cannot independently refill the gun');
  }
  roundTrip(state,'three physical store/retrieve cycles retain the same spent round');
});


test('contract-two questions require actual room speakers and acknowledged distinct answers before care or completion',()=>{
  const state=heldUnquestioned(),r=record(state),dellaBefore={x:state.entities.della.x,y:state.entities.della.y};
  assert.equal(r.rival.contractVersion,2);assert.equal(r.flags.questioned,false);assert.deepEqual(r.captivity.questions,{card:false,signatures:false});
  interact(state,'talk:levi-evidence');assert.equal(state.dialog,null,'distant speakers do not narrate a compressed room summary');
  roundTrip(state,'actual speakers requested before their room walk');
  until(state,()=>!!state.dialog,90,'Della and the actual council reach the holding room');
  assert.ok(distance(dellaBefore,state.entities.della)>30,'the original Della physically travels to the room');
  const order=['cardQuestion','leviCard','signatureQuestion','signatureAnswer','identityDenial','coercion','objection','temporaryHold'];
  const actors=['della','levi','mara','levi','levi','bastian','mara','tomas'];
  for(let index=0;index<order.length;index++){
    assert.equal(state.dialog.id,`rival-questioning-${order[index]}`);
    assert.equal(state.dialog.speaker,state.entities[actors[index]].name);
    assert.ok(distance(state.player,state.entities[actors[index]])<=65,'the spoken line belongs to an actual nearby body');
    assert.equal(r.captivity.questions.card,index>=2);assert.equal(r.captivity.questions.signatures,index>=4);assert.equal(r.flags.questioned,false);
    roundTrip(state,`before actual ${order[index]} acknowledgment`);
    choose(state,index===5?'question:object':'question:continue');
  }
  assert.equal(r.flags.questioned,true);assert.deepEqual(r.rival.questioning.seen.map(entry=>entry.lineId),order);
  assert.equal(state.dialog.id,'rival-questioning-care');assert.equal(r.choices.care,null);
  const food=state.camp.food,blankets=state.camp.blankets;choose(state,'care-levi');
  assert.equal(state.camp.food,food-1);assert.equal(state.camp.blankets,blankets-1);assert.equal(r.rival.questioning.care.foodUsed,1);assert.equal(r.rival.questioning.care.blanketUsed,1);
  completed(state);roundTrip(state,'all actual exchanges and full counted care completed');
  assert.ok(!Journey.getCampaignInteractions(state).some(action=>action.id==='finish:rival'),'a completed operation offers its continuing visit, not another account finish');
});

test('contract-two evidence rejects invented heard answers, transplanted voices and missing actual documents',()=>{
  const state=questionCareMenu(),original=encode(state);
  for(const [name,mutate]of [
    ['missing actual signature answer',raw=>{raw.campaign.missions[RIVAL].rival.questioning.seen.splice(3,1);}],
    ['transplanted speaker attribution',raw=>{raw.campaign.missions[RIVAL].rival.questioning.seen[0].actorId='tomas';}],
    ['future testimony timestamp',raw=>{raw.campaign.missions[RIVAL].rival.questioning.seen[0].at=raw.elapsed+1;}],
    ['missing actual torn card',raw=>{delete raw.campaign.missions[RIVAL].objects['levi-debt-card'];}],
    ['a remote speaker masquerading in the open care dialogue',raw=>{raw.entities.ruth.x=500;raw.entities.ruth.y=1000;}],
  ]){const raw=clone(original);mutate(raw);assert.equal(Journey.restoreCampaign(raw),null,name);}
  choose(state,'question:leave');roundTrip(state,'care pause retains all heard exchanges without committing a decision');
  const paused=encode(state);paused.campaign.missions[RIVAL].rival.questioning.cursor='invented-answer';assert.equal(Journey.restoreCampaign(paused),null,'an unavailable resumed scene is rejected');
});

for(const [foodMissing,blanketMissing,mode,foodUsed,blanketUsed]of [[false,true,'partial',1,0],[true,false,'partial',0,1],[true,true,'assurance',0,0]])test(`actual ${mode} care records food=${foodUsed} blanket=${blanketUsed} without inventing unavailable stock`,()=>{
  const state=heldUnquestioned(),r=record(state);
  // Explicit shortage boundary fixture only: remove existing stock. All
  // mission progress, bodies, dialogue and resulting care are actually earned.
  if(foodMissing)state.camp.food=0;if(blanketMissing)state.camp.blankets=0;
  questionCareMenu(state,false);const food=state.camp.food,blankets=state.camp.blankets;
  choose(state,'care-levi');assert.equal(state.dialog.id,'rival-questioning-noStock');assert.equal(r.choices.care,null);assert.equal(state.camp.food,food);assert.equal(state.camp.blankets,blankets);
  choose(state,'question:leave');assert.equal(state.dialog,null);roundTrip(state,'a shortage can be left for supplies without forced deprivation');
  routedWalk(state,WORLD.camp.ledger);assert.ok(!Journey.getCampaignInteractions(state).some(action=>action.id.startsWith('care:bring:')),'no already-owned provisions are invented for the fetch route');
  routedWalk(state,WORLD.camp.holding);interact(state,'talk:levi-evidence');
  choose(state,mode==='partial'?'care:partial':'care:assure');if(state.dialog)choose(state,'question:continue');
  assert.equal(state.mission.stage,13);assert.equal(state.camp.food,food-foodUsed);assert.equal(state.camp.blankets,blankets-blanketUsed);
  assert.equal(r.rival.questioning.care.foodUsed,foodUsed);assert.equal(r.rival.questioning.care.blanketUsed,blanketUsed);
  completed(state);assert.equal(r.captivity.care.mealCount,foodUsed);assert.equal(r.captivity.care.blanketCount,blanketUsed);assert.equal(r.captivity.restraint,'loose');
  tick(state,20);assert.equal(r.captivity.withholdingHours,0,'unavailable food is distinguished from a voluntary punitive withholding');
  assert.ok(Math.abs(r.captivity.hunger-r.captivity.holdingHours*(foodUsed?8:12))<1e-7);
  roundTrip(state,`actual ${mode} initial resource custody and later hunger`);
  const raw=encode(state);raw.campaign.missions[RIVAL].rival.questioning.care.foodUsed=1-foodUsed;assert.equal(Journey.restoreCampaign(raw),null,'a fictitious supplied meal cannot alter its counted receipt');
});

test('new deprivation speaks Bastian’s demand and Levi’s response before committing the actual guarded consequence',()=>{
  const state=questionCareMenu(heldUnquestioned(),false),r=record(state),food=state.camp.food,blankets=state.camp.blankets;
  choose(state,'deprive-levi');assert.equal(state.dialog.id,'rival-questioning-deprivation');assert.equal(r.choices.care,null);
  choose(state,'question:continue');assert.equal(state.dialog.id,'rival-questioning-deprivationResponse');assert.equal(r.choices.care,null);roundTrip(state,'actual deprivation answer remains unheard until acknowledged');
  choose(state,'question:continue');assert.equal(r.choices.care,'deprive');assert.equal(state.camp.food,food);assert.equal(state.camp.blankets,blankets);
  completed(state);tick(state,21);assert.equal(r.captivity.care.mealCount,0);assert.equal(r.captivity.care.blanketCount,0);assert.equal(r.captivity.restraint,'tight');
  assert.ok(r.captivity.withholdingHours>0);assert.ok(state.entities.levi.holdingWristMarks);roundTrip(state,'actual punitive holding leaves its distinct resource and binding history');
});

test('no-stock assurance remains guarded and later food must come from the actual sibling Hunt before its separate holding visit',()=>{
  const state=heldUnquestioned(),r=record(state);
  // Explicit shortage fixture removes stock; it grants no food, blanket, stage,
  // life, capture or mission result. Later food is produced by real Hunt work.
  state.camp.food=0;state.camp.blankets=0;questionCareMenu(state);choose(state,'care:assure');choose(state,'question:continue');completed(state);
  assert.equal(r.captivity.care.mealCount,0);assert.equal(r.captivity.care.blanketCount,0);assert.equal(state.entities.levi.blanket,false);
  huntEquipment(state);huntBank(state);huntReed(state);huntTwoBodies(state);huntLoaded(state);huntKitchen(state);huntProcessed(state);
  assert.ok(state.camp.food>0,'the actual two animal bodies and timed processing produce provisions');
  routedWalk(state,WORLD.camp.holding);interact(state,'holding:first-visit');choose(state,'holding-feed');choose(state,'holding-first-return');
  assert.equal(r.captivity.care.mealCount,1);assert.equal(r.aftermath.holding.visit1.foodGiven,true);assert.equal(r.captivity.care.provisions,'limited');
  roundTrip(state,'the later actual Hunt serving supplies the previously unavailable holding food');
});


// Contract-v2 transport probes reuse the actual native route above. The only
// proximity staging is its labelled initial camp fixture. No positive test
// assigns a stage, actor health/life, attachment, pressure or earned outcome.
function transportContractLoad(state=capture(),strap=true){
  interact(state,'carry:levi');Journey.whistleCampaign(state);
  until(state,()=>distance(state.player,state.horse)<52,30,'actual Copper reaches the bound passenger');
  interact(state,'load:levi');if(strap)initialPassengerStrap(state);return state;
}
function transportContractReturn(state){
  if(!record(state).choices.assurance){interact(state,'talk:levi-road');choose(state,'offer-assurance');}
  if(!state.player.mounted)interact(state,'mount');
  until(state,()=>record(state).rival.skeinRecovered&&RIVAL_PARTY.every(member=>distance(state.player,state.entities[member.actorId])<190),30,'Inez actually leads the surviving mare to the recovered passenger before departure');
  for(const node of WORLD.returnRoute){routedWalk(state,node);until(state,()=>RIVAL_PARTY.every(member=>distance(state.player,state.entities[member.actorId])<190),12,'real return convoy remains together');tick(state,.05);}
  interact(state,'return:kiln');return state;
}
function transportContractLane(state,range=260){
  const world=Journey.worldForCampaign(state);
  for(const [mx,my]of[[1,0],[-1,0],[0,-1],[0,1]]){
    let clear=true;for(let moved=4;moved<=range;moved+=4)if(solid(world,state.player.x+mx*moved,state.player.y+my*moved,14)){clear=false;break;}
    if(clear)return {mx,my};
  }
  throw new Error('No actual clear short transport test lane');
}

test('contract2 one real lower mount impact leaves living wounded Skein and a separately reachable foot tackle',()=>{
  const state=chase(),levi=state.entities.levi,skein=state.entities.skein,health=levi.hp,honor=state.honor;
  Journey.campaignAction(state,`equip:${RIVAL_CARBINE.id}`);
  for(let frame=0;distance(state.player,skein)>95&&frame<250;frame++){const length=distance(state.player,skein);Journey.stepCampaign(state,.05,{mx:(skein.x-state.player.x)/(length||1),my:(skein.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);}
  shot(state,skein,25,'pursuit');
  assert.equal(skein.hp,55,'one actual carbine body impact wounds without killing or assigning health');assert.equal(levi.hp,health,'the lower mounted-body trajectory does not hit Levi');assert.equal(levi.mounted,false);
  const t=record(state).rival.transport;assert.equal(t.skein.footReason,'wounded');assert.ok(t.skein.woundShotSerial>0);assert.equal(record(state).rival.shots.find(s=>s.serial===t.skein.woundShotSerial).impact.targetId,'skein');
  assert.equal(skein.ownerId,'levi');assert.equal(skein.dead||false,false);assert.equal(state.honor,honor-2);assert.equal(record(state).rope.phase,'idle');
  roundTrip(state,'actual living wounded mare and on-foot fugitive');
  for(let frame=0;distance(state.player,levi)>58&&frame<300;frame++){const length=distance(state.player,levi);Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);}
  interact(state,'dismount');
  for(let frame=0;distance(state.player,levi)>23&&frame<300;frame++){const length=distance(state.player,levi);Journey.stepCampaign(state,.05,{mx:(levi.x-state.player.x)/(length||1),my:(levi.y-state.player.y)/(length||1),sprint:true});assert.equal(state.failure,null);}
  interact(state,'tackle:levi');interact(state,'bind:levi');until(state,()=>state.mission.stage===11,5,'real foot tackle and restraint after nonlethal mount damage');
  assert.strictEqual(state.entities.levi,levi);assert.strictEqual(state.entities.skein,skein);
  completed(questioning(transportContractReturn(transportContractLoad(state))));
  assert.equal(skein.hp,55);assert.equal(skein.regionId,'snowbound');assert.equal(skein.ownerId,'levi');assert.ok(record(state).rival.skeinLeadDistance>40,'Inez physically leads the same living wounded mare');assert.equal(record(state).performance.healingUses,0);
  roundTrip(state,'wounded original Skein and living Levi after actual lead and return');
});

test('contract2 unsafe unsecured ride warns then drops the same living bound passenger and actual lift/load/strap recovers him',()=>{
  const state=transportContractLoad(capture(),false),levi=state.entities.levi,hp=levi.hp;
  interact(state,'mount');const input=transportContractLane(state);
  tick(state,1.25,{...input,sprint:true});
  assert.equal(state.failure,null,'the unsafe drop is a recoverable setback');assert.strictEqual(state.entities.levi,levi);assert.equal(levi.hp,hp);assert.equal(levi.bound,true);assert.equal(levi.attachment,null);assert.equal(record(state).captivity.state,'bound');
  assert.ok(state.notices.some(n=>/slipping|slipped/.test(n.text)),'an actual warning accompanies the observed unsafe ride');assert.equal(record(state).rival.transport.dropCount,1);
  assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='return:kiln'),'historical load flags cannot return without the actual passenger');
  roundTrip(state,'same living bound actor dropped on legal snow');
  interact(state,'dismount');routedWalk(state,{x:levi.x+24,y:levi.y});interact(state,'carry:levi');Journey.whistleCampaign(state);
  until(state,()=>distance(state.player,state.horse)<52,30,'actual Copper returns for the dropped person');interact(state,'load:levi');initialPassengerStrap(state);
  assert.equal(record(state).rival.transport.reloadCount,1);assert.equal(levi.attachment.targetId,'copper');assert.equal(levi.attachment.strap,true);assert.equal(Object.values(state.entities).filter(a=>a.attachment?.type==='passenger').length,1);
  completed(questioning(transportContractReturn(state)));
  assert.equal(levi.hp,hp);assert.equal(levi.attachment.targetId,WORLD.camp.holding.id);assert.equal(record(state).performance.healingUses,0);
  roundTrip(state,'unsafe dropped captive recovered through real reload and complete handoff');
});

test('contract2 moving snow burden changes actual pace/stamina and a timed hands-on check and resecure repair earned wear',()=>{
  const state=transportContractLoad(),r=record(state),levi=state.entities.levi;
  interact(state,'talk:levi-road');choose(state,'offer-assurance');interact(state,'mount');
  const stamina=state.horse.stamina,input=transportContractLane(state,260),start={x:state.player.x,y:state.player.y};
  tick(state,1,input);const moved=distance(state.player,start);
  assert.ok(moved<160*.86,'actual weather burden slows the previously authored passenger pace');
  for(let second=0;second<12;second++)tick(state,1,{mx:input.mx*(second%2?-1:1),my:input.my*(second%2?-1:1)});assert.ok(state.horse.stamina<stamina,'moving load reduces actual mount stamina rather than a cosmetic meter');
  assert.equal(r.rival.transport.weatherWarned,true);assert.ok(state.notices.some(n=>/burden slows|tires under/.test(n.text)));assert.ok(r.rival.transport.strapQuality<1);
  assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='transport:check'),'mounted moving player cannot remotely check the rear load');
  interact(state,'dismount');tick(state,.1);interact(state,'transport:check');
  until(state,()=>r.rival.transport.checkRemaining===0,3,'real stopped breathing and strap contact');assert.equal(r.rival.transport.checkCount,1);
  const before=r.rival.transport.strapQuality;interact(state,'transport:resecure');tick(state,.5);assert.equal(r.rival.transport.resecureCount,0,'starting the hands-on repair does not complete it immediately');
  until(state,()=>r.rival.transport.resecureRemaining===0,3,'actual timed resecure');assert.ok(before<1);assert.equal(r.rival.transport.strapQuality,1);assert.equal(r.rival.transport.resecureCount,1);assert.equal(levi.attachment.strap,true);assert.equal(r.performance.healingUses,0);
  roundTrip(state,'timed checked and resecured real passenger with measured burden');
  fs.writeFileSync('/tmp/dust-mercy-transport-ui-unit-state.json',Journey.serializeCampaign(state)); // Labelled native route, initial camp proximity fixture; never public-input proof.
});

test('contract2 transport rejects fabricated pressure history and a malformed partial marker deletion',()=>{
  const actual=transportContractLoad(),raw=encode(actual);
  const forged=clone(raw);forged.campaign.missions[RIVAL].rival.transport.dropCount=1;
  assert.equal(Journey.restoreCampaign(forged),null,'negative mutation cannot invent a dropped-person event');
  const legacy=clone(raw);delete legacy.campaign.missions[RIVAL].rival.contractVersion;delete legacy.campaign.missions[RIVAL].rival.transport;
  assert.equal(Journey.restoreCampaign(legacy),null,'removing the umbrella marker while retaining newer declarations/receipts does not create genuine older bytes');
});


test('contract2 a check interrupted by actual separation earns no completed breathing or strap inspection',()=>{
  const state=transportContractLoad(),t=record(state).rival.transport;until(state,()=>Journey.getCampaignInteractions(state).some(a=>a.id==='transport:check'),4,'actual Copper stops before the hands-on check');interact(state,'transport:check');
  assert.equal(t.checkRemaining,1);tick(state,.25);assert.ok(t.checkRemaining>0);const input=transportContractLane(state,180);tick(state,.7,{...input,sprint:true});
  assert.equal(t.checkRemaining,0);assert.equal(t.checkCount,0);assert.equal(t.lastCheckAt,null);assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='transport:resecure'));
  roundTrip(state,'interrupted actual stopped passenger inspection');
});

test('contract2 field unload and voluntary set-down retain the same bound body and make a previously earned strap available again on reload',()=>{
  const state=transportContractLoad(),levi=state.entities.levi,hp=levi.hp;
  until(state,()=>Journey.getCampaignInteractions(state).some(a=>a.id==='unload:levi'),4,'actual stopped field unload offered');
  interact(state,'unload:levi');assert.equal(levi.attachment.type,'carried');assert.equal(state.player.carrying,'levi');
  interact(state,'transport:set-down');assert.strictEqual(state.entities.levi,levi);assert.equal(levi.hp,hp);assert.equal(levi.bound,true);assert.equal(levi.attachment,null);
  assert.equal(record(state).rival.transport.dropCount,1);assert.equal(record(state).flags.strapped,true,'historical secure milestone remains earned');
  interact(state,'carry:levi');Journey.whistleCampaign(state);until(state,()=>distance(state.player,state.horse)<52,10,'actual field reload pickup');interact(state,'load:levi');
  assert.equal(levi.attachment.strap,false);initialPassengerStrap(state);assert.ok(record(state).flags.strapped,'historical strap flag cannot hide the new unsecured attachment once the actual stopped contact is reached');assert.equal(levi.attachment.strap,true);
  assert.equal(record(state).rival.transport.reloadCount,1);roundTrip(state,'physical unload, voluntary set-down and reloaded original Levi');
});



const {RIVAL_DIALOGUE: NARRATIVE_LINES}=await import(new URL('content/campaign/bellwether-works.js',project));
const {validateRivalDialog: narrativeDialogValid}=await import(new URL('src/rival-dialogue-validation.js',project));
test('fresh opening voices and strike/intervention are earned through real camp movement, contact and one lasting wound',()=>{
 const state=Journey.restoreCampaign(fixture('rescue-complete')),r=record(state),ruth=state.entities.ruth,initialHp=ruth.hp,trust=state.companions.ruth.trust;
 routedWalk(state,WORLD.camp.briefing);interact(state,'rival:briefing');assert.equal(state.dialog.speaker,NARRATIVE_LINES.quarrel.speaker);assert.equal(state.dialog.text,NARRATIVE_LINES.quarrel.text);assert.equal(r.flags.intervened,false);roundTrip(state,'new original quarrel before any strike');choose(state,'intervene');
 for(const [who,key]of[['ruth','ruthReply'],['emmett','emmettReply'],['bastian','routeBastian']]){routedWalk(state,state.entities[who]);interact(state,`talk:${who}`);assert.equal(state.dialog.text,NARRATIVE_LINES[key].text);assert.equal(narrativeDialogValid(state),true);choose(state,'leave');}
 routedWalk(state,ruth);until(state,()=>r.rival.narrative.opening.phase==='struck'&&r.rival.narrative.opening.activeSeconds>=.55,20,'Bastian’s actual close strike becomes visible before Inez speaks');
 assert.equal(ruth.hp,initialHp-2);assert.equal(r.flags.intervened,false);assert.equal(state.companions.ruth.trust,trust);roundTrip(state,'lasting authored shoulder wound before intervention');
 routedWalk(state,state.entities.inez);interact(state,'talk:inez');assert.equal(state.dialog.text,NARRATIVE_LINES.intervene.text);choose(state,'leave');routedWalk(state,ruth);interact(state,'narrative:interpose');
 until(state,()=>distance(state.entities.inez,state.player)<=22,20,'Inez actually approaches Mara’s position beside Ruth');Journey.campaignAction(state,'draw');tick(state,.2);assert.equal(r.rival.narrative.opening.activeSeconds,0,'a drawn gun interrupts free-hand intervention');Journey.campaignAction(state,'holster');tick(state,.2);assert.equal(r.flags.intervened,false,'being in range has not completed the physical block');
 const resumed=roundTrip(state,'real intervention contact partly completed'),nr=record(resumed);until(resumed,()=>nr.flags.intervened,3,'saved intervention resumes its remaining contact');assert.equal(resumed.companions.ruth.trust,trust+1);assert.equal(resumed.entities.ruth.hp,initialHp-2);assert.ok(nr.rival.narrative.opening.intervention);roundTrip(resumed,'one performed strike and one performed intervention');
 const raw=encode(resumed);for(const [label,change]of[['missing strike',d=>{d.campaign.missions[RIVAL].rival.narrative.opening.strike=null;}],['distant intervention',d=>{d.campaign.missions[RIVAL].rival.narrative.opening.intervention.inez.x+=300;}],['summary substituted for Ruth’s actual voice',d=>{d.campaign.missions[RIVAL].rival.narrative.speech.find(e=>e.id==='ruth').key='care';}]]){const bad=clone(raw);change(bad);assert.equal(Journey.restoreCampaign(bad),null,label);}
});

test('earned travel dialogue pauses for an explicitly staged separation and resumes without inventing or repeating heard lines',()=>{
 const state=equipment(),r=record(state);interact(state,'mount');pathWalk(state,[{x:700,y:1170},{x:700,y:950},WORLD.travelGate]);until(state,()=>RIVAL_PARTY.every(m=>distance(state.entities[m.actorId],state.player)<250),40,'six riders gather');interact(state,'depart:bellwether');pathWalk(state,WORLD.trail.slice(0,2));tick(state,.2);
 const n=r.rival.narrative,t=n.travel,prior=t.activeSeconds,index=t.index;
 // Staged separation only: this isolates conversation interruption. The rider
 // and his actual mount remain paired; their return uses ordinary NPC movement.
 state.entities.cinder.x-=320;state.entities.bastian.x=state.entities.cinder.x;tick(state,.1);assert.equal(t.paused,true);assert.equal(t.activeSeconds,prior);assert.equal(t.index,index);roundTrip(state,'explicitly staged separated rider pauses earned conversation');
 until(state,()=>!t.paused,30,'the actual rider and mount rejoin before speech resumes');until(state,()=>t.index===3,30,'all three travel voices complete');
 assert.deepEqual(n.speech.filter(e=>e.id.startsWith('trail-')).map(e=>e.key),['routeTomas','routeRuth','routeBastian']);assert.equal(new Set(n.speech.map(e=>e.id)).size,n.speech.length);
 walk(state,WORLD.props.find(p=>p.id==='branch-trail'));interact(state,'inspect:branch-trail');tick(state,.2);routedWalk(state,{x:WORLD.props.find(p=>p.id==='branch-trail').x-120,y:WORLD.props.find(p=>p.id==='branch-trail').y});assert.equal(n.branch.observedAt,null);assert.equal(n.branch.activeSeconds,0);
 routedWalk(state,WORLD.props.find(p=>p.id==='branch-trail'));until(state,()=>n.branch.observedAt!==null,20,'Mara finishes the real branch inspection with Emmett nearby');roundTrip(state,'survey-nail observation and completed distinct travel voices');
});

test('Pavel recognition is available only for his actual released identity and has separate bank-backed responses',()=>{
 const state=ready(),r=record(state);interact(state,'choose-first');choose(state,'player-first');assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='narrative:pavel'),'the genuinely held opening adversary is not invented in this yard');
 // Explicit conditional-history/proximity unit fixture; not an earned released
 // campaign or a valid whole Save. This tests the individual scene contract.
 state.campaign.missions[OPENING].flags.pavelChoice='release';r.rival.pavelReturned=true;Object.assign(state.entities.pavel,{regionId:WORLD.id,x:state.player.x+20,y:state.player.y,z:0,hp:100,bound:false});
 interact(state,'narrative:pavel');assert.equal(state.dialog.text,NARRATIVE_LINES.pavelRecognition.text);assert.equal(narrativeDialogValid(state),true);const dialog=clone(state.dialog);
 choose(state,'narrative-pavel-reply');assert.equal(state.dialog.text,NARRATIVE_LINES.maraPavel.text);assert.equal(narrativeDialogValid(state),true);choose(state,'leave');
 for(const fate of['bind','kill']){state.campaign.missions[OPENING].flags.pavelChoice=fate;state.dialog=clone(dialog);assert.equal(narrativeDialogValid(state),false,'another prior fate cannot inherit released Pavel’s line');state.dialog=null;}
 state.campaign.missions[OPENING].flags.pavelChoice='release';state.entities.pavel.hp=0;state.dialog=clone(dialog);assert.equal(narrativeDialogValid(state),false,'a dead body does not speak');
});

test('a safe unprompted opening earns its own reprimand only after an actual shot, unlike the chosen opening',()=>{
 const state=ready(),r=record(state),target=state.entities['bellwether-gallery-watch'];Journey.shootCampaign(state,target.x,target.y,{z:(target.z||0)+44});assert.equal(r.rival.narrative.firstShot.mode,'unprompted');assert.equal(r.rival.narrative.firstShot.reprimand.serial,1);assert.equal(r.rival.narrative.speech.find(e=>e.id==='ready-reprimand').key,'readyReprimand');roundTrip(state,'actual safe early shot and distinct original reprimand');
 const other=ready();interact(other,'choose-first');choose(other,'player-first');Journey.shootCampaign(other,target.x,target.y,{z:44});assert.equal(record(other).rival.narrative.firstShot.reprimand,null,'the invited shot has no invented reprimand');
 const bad=encode(state);bad.campaign.missions[RIVAL].rival.narrative.firstShot.reprimand.serial=99;assert.equal(Journey.restoreCampaign(bad),null);
});

for(const order of['rival-first','hunt-first'])test(`convoy challenge names real wounds and keeps the original ${order} food conversation separate`,()=>{
 const start=order==='hunt-first'?Journey.restoreCampaign(fixture('hunt-complete')):Journey.restoreCampaign(fixture('rescue-complete'));
 const state=searches(reinforcements(battle(ready(recon(ridge(equipment(accepted(start))))))),false),r=record(state);
 routedWalk(state,state.entities.tomas);interact(state,'convoy:depart');assert.equal(state.dialog.text,NARRATIVE_LINES.convoy.text);assert.ok(r.rival.narrative.convoy.wounds.length>0);for(const wound of r.rival.narrative.convoy.wounds){assert.equal(wound.hp,state.entities[wound.id].hp);assert.equal(wound.name,state.entities[wound.id].name);}
 choose(state,'challenge-injuries');assert.equal(state.dialog.text,NARRATIVE_LINES.challengeInjuries.text);roundTrip(state,'Mara names actual injured convoy members');choose(state,'leave');assert.equal(state.dialog.text,NARRATIVE_LINES.injuriesAnswer.text);choose(state,'leave');assert.ok(!state.dialog.choices.some(c=>c.id==='challenge-injuries'),'the same challenge is not counted twice');choose(state,'leave');assert.equal(state.dialog.text,NARRATIVE_LINES[order==='hunt-first'?'huntFirst':'rivalFirst'].text);assert.equal(r.choices.order,order);roundTrip(state,'true earlier Hunt order in its own original conversation');choose(state,'leave');assert.equal(state.dialog,null);assert.ok(r.rival.narrative.convoy.closedAt!==null);roundTrip(state,'convoy conversation and named wound account complete');
});


test('unchanged native earned contract-2 pre-narrative Save keeps all past history without inventing missing conversations',()=>{
 const provenance=JSON.parse(fs.readFileSync(new URL('rival-narrative-provenance.json',fixtureDir),'utf8')),bytes=gunzipSync(fs.readFileSync(new URL(provenance.fixture,fixtureDir)));assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256OfUncompressedOriginalBytes);
 const original=JSON.parse(bytes),state=Journey.restoreCampaign(original);assert.ok(state);assert.equal(original.campaign.missions[RIVAL].rival.contractVersion,2);assert.equal(original.campaign.missions[RIVAL].rival.narrative,undefined);assert.deepEqual(priorRivalHistory(record(state).rival),original.campaign.missions[RIVAL].rival);roundTrip(state,'native pre-narrative completed operation with no inferred past conversations');
});


test('fresh narrative Saves cannot lose their required record, branch observation or any of the three travel voices',()=>{
 const original=encode(completed());assert.equal(original.campaign.missions[RIVAL].rival.narrativeVersion,1);
 for(const [name,mutate]of[['missing fresh narrative record',d=>{delete d.campaign.missions[RIVAL].rival.narrative;}],['missing performed intervention',d=>{d.campaign.missions[RIVAL].rival.narrative.opening.intervention=null;}],['missing actual branch observation',d=>{d.campaign.missions[RIVAL].rival.narrative.branch.observedAt=null;}],['missing Ruth’s separate travel response',d=>{const n=d.campaign.missions[RIVAL].rival.narrative;n.speech=n.speech.filter(e=>e.id!=='trail-1');}],['unsupported narrative version',d=>{d.campaign.missions[RIVAL].rival.narrativeVersion=9;}],['non-numeric claimed wound',d=>{d.campaign.missions[RIVAL].rival.narrative.opening.strike.hpBefore='100';}],['out-of-world conversation receipt',d=>{const e=d.campaign.missions[RIVAL].rival.narrative.speech[0];e.from.x=e.listener.x=1e50;}]]){const bad=clone(original);mutate(bad);assert.equal(Journey.restoreCampaign(bad),null,name);}
});

test('fresh independent questioning and transport declarations require their empty records and reject missing or unsupported feature versions',()=>{
  const state=Journey.restoreCampaign(fixture('rescue-complete')),raw=encode(state),r=record(state);
  assert.equal(r.rival.questioningVersion,1);assert.equal(r.rival.transportVersion,1);
  assert.equal(r.rival.questioning.phase,'unstarted');assert.equal(r.rival.questioning.startedAt,null);assert.equal(r.rival.questioning.initialStock,null);
  assert.deepEqual(r.rival.questioning.seen,[]);assert.deepEqual(r.rival.questioning.careSeen,[]);assert.deepEqual(r.rival.transport.events,[]);
  roundTrip(state,'fresh declared features contain no inferred event, stock or testimony');
  for(const [name,mutate]of [
    ['missing declared questioning record',body=>{delete body.campaign.missions[RIVAL].rival.questioning;}],
    ['missing questioning declaration with retained newer record',body=>{delete body.campaign.missions[RIVAL].rival.questioningVersion;}],
    ['unsupported questioning feature version',body=>{body.campaign.missions[RIVAL].rival.questioningVersion=9;}],
    ['missing declared transport record',body=>{delete body.campaign.missions[RIVAL].rival.transport;}],
    ['missing transport declaration with retained newer record',body=>{delete body.campaign.missions[RIVAL].rival.transportVersion;}],
    ['unsupported transport feature version',body=>{body.campaign.missions[RIVAL].rival.transportVersion=9;}],
  ]){const body=clone(raw);mutate(body);assert.equal(Journey.restoreCampaign(body),null,name);}
});

test('an untouched earlier contract-two world keeps legacy feature predicates and never acquires new pressure or questioning during ordinary continuation',async()=>{
  const provenance=JSON.parse(fs.readFileSync(new URL('rival-narrative-provenance.json',fixtureDir),'utf8'));
  const bytes=gunzipSync(fs.readFileSync(new URL(provenance.fixture,fixtureDir)));assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256OfUncompressedOriginalBytes);
  const state=Journey.restoreCampaign(JSON.parse(bytes));assert.ok(state);const before=clone(record(state).rival),care=clone(record(state).captivity.care);
  const {usesRivalTransport,rivalTransportPace,getRivalTransportInteractions}=await import(new URL('src/rival-transport.js',project));
  const {usesQuestioningContract}=await import(new URL('src/rival-questioning.js',project));
  assert.equal(record(state).rival.contractVersion,2);assert.equal(usesRivalTransport(state),false);assert.equal(usesQuestioningContract(record(state)),false);
  assert.equal(rivalTransportPace(state),1);assert.deepEqual(getRivalTransportInteractions(state,Journey.worldForCampaign(state)),[]);
  tick(state,.2);assert.deepEqual(record(state).rival,before,'old live continuation creates no future feature declaration, event, heard line or stock receipt');
  assert.deepEqual(record(state).captivity.care,care,'the original provided care remains original');roundTrip(state,'unchanged earlier contract-two continuation without inferred features');
});


test('declared transport initial strap cannot bypass stopped unmounted contact through a mounted or moving offered action',()=>{
 const state=transportContractLoad(capture(),false),levi=state.entities.levi;
 interact(state,'mount');assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='strap:levi'));
 Journey.interactCampaign(state,'strap:levi');assert.equal(levi.attachment.strap,false);assert.equal(record(state).flags.strapped,false);
 const direction=transportContractLane(state,100);tick(state,.2,{...direction,sprint:true});assert.ok(record(state).rival.transport.motionSpeed>8);
 assert.ok(!Journey.getCampaignInteractions(state).some(a=>a.id==='strap:levi'));Journey.interactCampaign(state,'strap:levi');assert.equal(levi.attachment.strap,false);
 interact(state,'dismount');until(state,()=>Journey.getCampaignInteractions(state).some(a=>a.id==='strap:levi'),4,'actual unmounted Mara and Copper stop at contact before the first strap');
 interact(state,'strap:levi');assert.equal(levi.attachment.strap,true);assert.equal(record(state).flags.strapped,true);assert.equal(record(state).rival.transport.strapQuality,1);
 roundTrip(state,'actual initial stopped passenger strap after moving mounted denial');
});
