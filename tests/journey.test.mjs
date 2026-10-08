import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Opening from '../src/campaign.js';
import * as Journey from '../src/campaign-journey.js';
import { SNOWBOUND_WORLD } from '../content/campaign/snowbound.js';

const OPENING = 'snowbound-the-last-warm-light';
const RESCUE = 'snowbound-a-voice-under-ice';
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/opening-v1-${name}.json`, import.meta.url), 'utf8'));
const wire = state => JSON.parse(Journey.serializeCampaign(state));
function migrate(name) {
  const raw = fixture(name);
  assert.ok(Opening.restoreCampaign(raw), `the unmodified ${name} ordinary-control v1 Save is valid`);
  const state = Journey.restoreCampaign(raw);
  assert.ok(state, `the ${name} Save migrates`);
  return { raw, state };
}
function durable(state) {
  const value = wire(state);
  for (const key of ['notices', 'bullets', 'log', 'elapsed', 'lastSave']) delete value[key];
  return value;
}
function assertLegacyCore(raw, state) {
  for (const key of ['inventory', 'camp', 'companions', 'sideQuests', 'wanted', 'honor', 'stats']) assert.deepEqual(state[key], raw[key], `${key} survives migration`);
  for (const key of ['hp', 'stamina', 'focus', 'money', 'coldcoat', 'lantern', 'carrying', 'mounted', 'weaponOwned']) assert.equal(state.player[key], raw.player[key], `player ${key} survives migration`);
  assert.equal(state.player.ammo, raw.player.ammo);
  assert.equal(state.player.reserve, raw.player.reserve);
  assert.deepEqual(state.flags, raw.flags);
  assert.deepEqual(state.timers, raw.timers);
  assert.deepEqual(state.performance, raw.performance);
  assert.deepEqual(state.worldChanges, raw.worldChanges);
  assert.deepEqual(state.supplies, raw.supplies);
  assert.deepEqual(state.dropped, raw.dropped);
  assert.equal(state.horse.id, raw.horse.id);
  for (const key of ['hp', 'stamina', 'bond', 'fear', 'owned', 'hitched', 'careUnlocked', 'ridingUnlocked', 'storageUnlocked', 'pack']) assert.deepEqual(state.horse[key], raw.horse[key], `authoritative horse ${key} survives migration`);
}
function assertSingleResidence(state) {
  for (const actor of Object.values(state.entities)) {
    const homes = Object.entries(state.regions).filter(([, region]) => region.residentIds.includes(actor.id));
    assert.equal(homes.length, actor.attachment ? 0 : 1, `${actor.id} has one body and one residency or attachment`);
    assert.ok(Journey.entityRegion(state, actor), `${actor.id} resolves a region`);
    if (!actor.attachment) assert.equal(homes[0][0], actor.regionId);
  }
}
function packedLegacy() {
  const old = Opening.restoreCampaign(fixture('complete'));
  // Fixture placement, then the actual permitted pack verb; no stage/choice mutation.
  Object.assign(old.player, { x: old.horse.x - 20, y: old.horse.y });
  Opening.storeCampaignItem(old, 'tonic');
  assert.equal(old.horse.pack.tonic, 1);
  assert.equal(old.inventory.tonic, 0);
  return old;
}
function suspendedFailure() {
  const old = packedLegacy();
  Opening.campaignAction(old, 'replay');
  // A zero-health fault fixture tests the codec's already-authored death/replay branch.
  // It is not presented as an ordinary-control actor-damage proof.
  old.player.hp = 0;
  Opening.stepCampaign(old, 0.05);
  assert.ok(old.failure);
  assert.ok(old.replayCanonical);
  assert.ok(Opening.restoreCampaign(Opening.serializeCampaign(old)));
  return old;
}

for (const name of ['departure', 'copper-owned', 'gideon-carried', 'complete']) {
  test(`v2 migrates the actual v1 ${name} Save with durable actor, inventory and branch state`, () => {
    const { raw, state } = migrate(name);
    assert.equal(state.version, 2);
    assert.equal(state.campaignId, 'dust-and-mercy');
    assertLegacyCore(raw, state);
    assertSingleResidence(state);
    const restored = Journey.restoreCampaign(Journey.serializeCampaign(state));
    assert.ok(restored, 'migrated state also survives the v2 codec');
    assert.deepEqual(durable(restored), durable(state));
    assert.strictEqual(restored.player, restored.entities.mara);
    assert.strictEqual(restored.horse, restored.entities[restored.party.mountId]);
    assert.equal(restored.campaign.missions[RESCUE].status, raw.mission.completed ? 'unstarted' : 'locked');
  });
}

test('wire format stores one entity/weapon graph and nonenumerable compatible root aliases', () => {
  const state = Journey.createCampaignState();
  const data = wire(state);
  for (const key of ['player', 'horse', 'npcs', 'enemies', 'animals', 'mounts', 'mission', 'flags', 'timers', 'performance', 'checkpoint', 'supplies', 'dropped', 'worldChanges']) {
    assert.equal(Object.hasOwn(data, key), false, `${key} is not another authoritative save copy`);
    assert.equal(Object.getOwnPropertyDescriptor(state, key).enumerable, false);
  }
  assert.equal(Object.hasOwn(data.entities.mara, 'ammo'), false);
  assert.equal(Object.hasOwn(data.entities.mara, 'reserve'), false);
  state.player.ammo = 3;
  assert.equal(state.weapons['mara-revolver'].ammo, 3, 'the compatibility setter writes actual weapon ammunition');
  assert.equal(state.player.ammo, 3);
  assert.equal(Journey.worldForCampaign(state).id, 'snowbound');
  for (const checkpoint of Object.values(data.checkpoints)) {
    for (const key of ['checkpoints', 'missionEntries', 'replayCanonical']) assert.equal(Object.hasOwn(checkpoint.data, key), false, 'checkpoint bodies are nonrecursive');
  }
});

test('Copper identity authority and each historical checkpoint migrate independently', () => {
  const { raw, state } = migrate('copper-owned');
  assert.strictEqual(state.animals.find(actor => actor.id === 'copper'), state.horse, 'animal view and owned mount are the same Copper body');
  assert.equal(Object.hasOwn(state.entities, 'juniper'), false, 'absent legacy Juniper is not invented after ownership');
  assert.equal(state.checkpoint.data.party.mountId, raw.checkpoint.data.horse.id);
  const earlier = state.checkpoint.data.entities[state.checkpoint.data.party.mountId];
  assert.deepEqual(earlier.pack, raw.checkpoint.data.horse.pack);
  assert.equal(state.checkpoint.data.entities.copper.owned, raw.checkpoint.data.animals.find(actor => actor.id === 'copper').owned);
  assert.equal(state.checkpoint.data.campaign.missions[OPENING].flags.pavelChoice, raw.checkpoint.data.flags.pavelChoice);
});

test('mid-carry migration encodes Gideon only as a carried attachment and keeps retry history', () => {
  const { raw, state } = migrate('gideon-carried');
  assert.deepEqual(state.entities.gideon.attachment, { type: 'carried', targetId: 'mara' });
  assert.equal(state.entities.gideon.regionId, null);
  assert.equal(state.player.carrying, 'gideon');
  assert.equal(Journey.entityRegion(state, state.entities.gideon), state.player.regionId);
  assert.ok(!state.regions.snowbound.residentIds.includes('gideon'));
  assert.equal(state.entities.gideon.x, state.player.x);
  assert.equal(state.entities.gideon.y, state.player.y);
  assert.equal(state.checkpoint.stage, raw.checkpoint.data.mission.stage);
  Journey.campaignAction(state, 'retry');
  assert.equal(state.player.carrying, raw.checkpoint.data.player.carrying);
  assert.equal(state.horse.id, raw.checkpoint.data.horse.id);
  assert.equal(state.flags.rescuePriority, raw.checkpoint.data.flags.rescuePriority);
  assert.deepEqual(state.inventory, raw.checkpoint.data.inventory);
  assertSingleResidence(state);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('actual pack transfers survive migration and the facade preserves item conservation', () => {
  const raw = JSON.parse(Opening.serializeCampaign(packedLegacy()));
  const state = Journey.restoreCampaign(raw);
  assert.ok(state);
  assert.equal(state.horse.pack.tonic, 1);
  assert.equal(state.inventory.tonic, 0);
  assert.equal(typeof Journey.takeCampaignItem, 'function');
  assert.equal(typeof Journey.storeCampaignItem, 'function');
  Journey.takeCampaignItem(state, 'tonic');
  assert.equal(state.inventory.tonic, 1);
  assert.equal(state.horse.pack.tonic || 0, 0);
  Journey.storeCampaignItem(state, 'tonic');
  assert.equal(state.inventory.tonic, 0);
  assert.equal(state.horse.pack.tonic, 1);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('completed v1 migration adds unstarted rescue actors once without gun/kit/completion grants', () => {
  const { state } = migrate('complete');
  const before = Object.keys(state.entities).sort();
  for (let count = 0; count < 3; count++) Journey.getCampaignInteractions(state);
  assert.deepEqual(Object.keys(state.entities).sort(), before);
  assert.equal(state.weapons['coach-gun'], undefined);
  assert.equal(state.inventory.warmRation || 0, 0);
  assert.equal(state.inventory.rescueDressing || 0, 0);
  assert.equal(state.inventory.rescueRope || 0, 0);
  assert.equal(state.campaign.missions[RESCUE].mission.completed, false);
  assert.equal(state.entities.lark.hp, 0, 'authored dead Lark is not resurrected as a mount reward');
  assertSingleResidence(state);
});

test('suspended failed v1 replay migrates local and canonical Copper/pack/checkpoint branches separately', () => {
  const old = suspendedFailure();
  const state = Journey.restoreCampaign(Opening.serializeCampaign(old));
  assert.ok(state);
  assert.equal(state.horse.id, 'juniper');
  assert.equal(state.replayCanonical.party.mountId, 'copper');
  assert.equal(state.replayCanonical.entities.copper.pack.tonic, 1);
  assert.equal(state.replayCanonical.campaign.missions[OPENING].flags.pavelChoice, 'bind');
  assert.ok(state.dialog.choices.some(choice => choice.id === 'finish-replay'));
  const restored = Journey.restoreCampaign(Journey.serializeCampaign(state));
  assert.ok(restored, 'suspended migrated failure round-trips');
  const permanentCheckpoint = restored.replayCanonical.checkpoints[restored.replayCanonical.campaign.missions[OPENING].checkpointId];
  assert.equal(permanentCheckpoint.data.party.mountId, old.replayCanonical.horse.id);
  assert.equal(permanentCheckpoint.data.campaign.missions[OPENING].flags.pavelChoice, old.replayCanonical.flags.pavelChoice);
  assert.deepEqual(permanentCheckpoint.data.entities.copper.pack, old.replayCanonical.horse.pack, 'the canonical recovery checkpoint is built from the canonical branch, not the replay branch');
  Journey.chooseCampaign(restored, 'finish-replay');
  assert.equal(restored.failure, null);
  assert.equal(restored.replayCanonical, null);
  assert.equal(restored.horse.id, 'copper');
  assert.equal(restored.horse.pack.tonic, 1);
  assertLegacyCore(old.replayCanonical, restored);
  assertSingleResidence(restored);
});

test('legacy two-choice failed replay remains recoverable and exits through the offered migrated choice', () => {
  const old = JSON.parse(Opening.serializeCampaign(suspendedFailure()));
  old.dialog.choices = old.dialog.choices.filter(choice => choice.id !== 'finish-replay');
  const state = Journey.restoreCampaign(old);
  assert.ok(state);
  assert.ok(state.dialog.choices.some(choice => choice.id === 'finish-replay'));
  Journey.chooseCampaign(state, 'finish-replay');
  assert.equal(state.horse.id, 'copper');
  assert.equal(state.mission.completed, true);
});

test('new v2 opening replay restores the complete canonical graph after a suspended failure', () => {
  const state = Journey.restoreCampaign(Opening.serializeCampaign(packedLegacy()));
  assert.ok(state);
  const permanent = durable(state);
  Journey.beginCampaignReplay(state, OPENING);
  assert.equal(state.mission.stage, 0);
  assert.equal(state.mission.completed, false);
  assert.equal(state.horse.id, 'juniper');
  state.player.hp = 0; Journey.stepCampaign(state, 0.05);
  assert.ok(state.failure);
  const restored = Journey.restoreCampaign(Journey.serializeCampaign(state));
  assert.ok(restored);
  Journey.chooseCampaign(restored, 'finish-replay');
  assert.deepEqual(durable(restored), permanent, 'deaths, branches, pack, regions, equipment, records and checkpoint bodies return to the canonical campaign');
});

const mutations = {
  'unknown actor ID': data => { data.entities.duplicate = { ...data.entities.mara, id: 'duplicate' }; },
  'wrong player category': data => { data.entities.mara.category = 'npc'; },
  'missing active mount': data => { delete data.entities[data.party.mountId]; },
  'duplicate regional residency': data => { data.regions.snowbound.residentIds.push('mara'); },
  'wrong regional residency': data => { data.regions['north-cutting'].residentIds.push('mara'); },
  'attachment self-cycle': data => { data.entities.mara.attachment = { type: 'carried', targetId: 'mara' }; data.entities.mara.regionId = null; data.regions.snowbound.residentIds = data.regions.snowbound.residentIds.filter(id => id !== 'mara'); },
  'missing attachment target': data => { data.entities.mara.attachment = { type: 'carried', targetId: 'unknown' }; data.entities.mara.regionId = null; data.regions.snowbound.residentIds = data.regions.snowbound.residentIds.filter(id => id !== 'mara'); },
  'wrong revolver ammunition type': data => { data.weapons['mara-revolver'].ammoType = 'coach-shell'; },
  'overloaded revolver chamber': data => { data.weapons['mara-revolver'].ammo = 7; },
  'negative ammunition reserve': data => { data.weapons['mara-revolver'].reserve = -1; },
  'invalid opening record status': data => { data.campaign.missions[OPENING].status = 'invented'; },
  'future active checkpoint metadata': data => { data.checkpoints[data.campaign.missions[OPENING].checkpointId].stage = 8; },
  'recursive checkpoint body': data => { data.checkpoints[data.campaign.missions[OPENING].checkpointId].data.checkpoints = {}; },
  'invalid actor coordinates': data => { data.entities.mara.x = 1000000; },
  'missing protected companion runtime record': data => { delete data.companions.tomas; },
  'invalid horse pack item': data => { data.entities[data.party.mountId].pack = { nonexistent: 1 }; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`strict v2 restore rejects ${name}`, () => {
    const data = wire(migrate('departure').state);
    mutate(data);
    assert.ok(!Journey.restoreCampaign(data), `restore must reject ${name}`);
  });
}

test('future inactive historical checkpoint cannot be inserted into an earlier campaign', () => {
  const early = wire(migrate('departure').state);
  const completed = migrate('complete').state;
  const future = clone(completed.checkpoint);
  future.id = `${OPENING}:forged-future`;
  early.checkpoints[future.id] = future;
  assert.ok(!Journey.restoreCampaign(early), 'all checkpoint histories obey their mission record progress, not only the active pointer');
});

test('carried attachment and carrier carrying field cannot disagree in a migrated opening Save', () => {
  const data = wire(migrate('gideon-carried').state);
  data.entities.gideon.attachment.targetId = 'tomas';
  assert.ok(!Journey.restoreCampaign(data), 'Gideon cannot attach to Tomas while Mara still claims to carry him');
});

test('an attached living actor cannot use a dead mount as a passenger target', () => {
  const data = wire(migrate('complete').state);
  data.entities.gideon.attachment = { type: 'passenger', targetId: 'lark', strap: true };
  data.entities.gideon.regionId = null;
  data.regions.snowbound.residentIds = data.regions.snowbound.residentIds.filter(id => id !== 'gideon');
  assert.ok(!Journey.restoreCampaign(data));
});

test('migration rejects malformed legacy actor, mount and checkpoint authority before conversion', () => {
  for (const mutate of [
    data => { data.horse.pack = { invented: 1 }; },
    data => { delete data.mounts; },
    data => { data.npcs[0].x = 'far'; },
    data => { data.player.ammo = 7; },
    data => { data.checkpoint.data.mission.stage = 8; },
  ]) {
    const data = fixture('departure'); mutate(data);
    assert.ok(!Journey.restoreCampaign(data), 'v1 validation precedes migration and is not bypassed by v2 conversion');
  }
});

test('the v2 facade preserves ordinary E/default opening priority for coat then lantern', () => {
  const state = Journey.createCampaignState();
  const prop = id => SNOWBOUND_WORLD.props.find(item => item.id === id);
  Object.assign(state.player, { x: prop('coat').x, y: prop('coat').y });
  assert.equal(Journey.getCampaignInteraction(state)?.id, 'coat');
  Journey.interactCampaign(state);
  assert.equal(state.flags.coatTaken, true);
  assert.equal(state.flags.lanternTaken, false);
  Object.assign(state.player, { x: prop('lantern').x, y: prop('lantern').y });
  assert.equal(Journey.getCampaignInteraction(state)?.id, 'lantern');
  Journey.interactCampaign(state);
  assert.equal(state.flags.lanternTaken, true);
  assert.equal(state.mission.stage, 0, 'both actual pickup inputs still require Tomas’s briefing');
});

test('actual migrated public station-safe return and deposit keep every historical v2 completion checkpoint restorable', () => {
  const data = fixture('station-safe');
  const state = Journey.restoreCampaign(data);
  assert.ok(state, 'the unmodified public station-safe Save is valid before deposit');
  assert.equal(state.mission.stage, 8); assert.equal(state.mission.completed, false);
  const walk = target => {
    for (let frame = 0; Math.hypot(state.player.x - target.x, state.player.y - target.y) > 7 && frame < 2000; frame++) {
      const length = Math.hypot(target.x - state.player.x, target.y - state.player.y);
      Journey.stepCampaign(state, 0.05, { mx: (target.x - state.player.x) / length, my: (target.y - state.player.y) / length });
      assert.equal(state.failure, null);
    }
    assert.ok(Math.hypot(state.player.x - target.x, state.player.y - target.y) <= 7, `return movement reached ${target.x},${target.y}`);
  };
  for (const target of [{ x: 1100, y: 650 }, { x: 1000, y: 780 }, { x: 600, y: 970 }, { x: 375, y: 970 }, { x: 375, y: 1140 }, { x: 350, y: 1140 }]) walk(target);
  for (let frame = 0; !Journey.getCampaignInteractions(state).some(item => item.id === 'deposit-supplies') && frame < 400; frame++) Journey.stepCampaign(state, 0.05);
  assert.ok(Journey.getCampaignInteractions(state).some(item => item.id === 'deposit-supplies'), 'people, bound Pavel and Copper actually reach the kiln');
  Journey.interactCampaign(state, 'deposit-supplies');
  assert.equal(state.mission.completed, true);
  assert.equal(state.campaign.missions[RESCUE].status, 'unstarted');
  const saved = wire(state), restored = Journey.restoreCampaign(saved);
  assert.ok(restored, 'whole Save validates every historical body after completion graph transitions');
  assert.deepEqual(wire(restored), saved);
  const latest = saved.checkpoints[state.campaign.missions[OPENING].checkpointId];
  assert.equal(latest.data.campaign.missions[OPENING].status, 'completed');
  assert.equal(latest.data.campaign.missions[RESCUE].status, 'unstarted');
});
