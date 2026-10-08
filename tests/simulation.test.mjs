import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, interact, shoot, reload, choose, buy, sell, useItem, serialize, restore, getInteraction, whistle, craft, donate, upgradeCamp, WORLD, riverX } from '../src/simulation.js';

function tick(s, seconds, input = {}) {
  const count = Math.ceil(seconds / 0.05);
  for (let i = 0; i < count; i++) step(s, Math.min(0.05, seconds - i * 0.05), input);
}
function go(s, x, y) { s.player.x = x; s.player.y = y; }
function walkTo(s, x, y) {
  let frames = 0;
  while (Math.hypot(x - s.player.x, y - s.player.y) > 5 && frames++ < 1800) {
    const d = Math.hypot(x - s.player.x, y - s.player.y);
    step(s, 0.05, { mx: (x - s.player.x) / d, my: (y - s.player.y) / d });
  }
  assert.ok(Math.hypot(x - s.player.x, y - s.player.y) <= 5, `walked to ${x},${y}`);
}
function speak(s, id) {
  const n = s.npcs.find((v) => v.id === id);
  go(s, n.x, n.y + 22); interact(s);
  assert.ok(s.dialog, `dialog opened for ${id}`);
}
function startMission(s) {
  speak(s, 'ada'); choose(s, 'accept-water');
  assert.equal(s.mission.stage, 1);
  speak(s, 'silas'); choose(s, 'silas-debt'); choose(s, 'follow-water');
  assert.equal(s.mission.stage, 2);
  go(s, 1075, 850); interact(s); choose(s, 'break-chain');
  assert.equal(s.mission.stage, 3);
}
function defeatGuards(s) {
  // Exercise aiming, bullet travel, cooldowns, enemy damage and the stage trigger.
  for (const id of ['pump-1', 'pump-2', 'pump-3']) {
    const guard = s.enemies.find((e) => e.id === id);
    let attempts = 0;
    while (guard.hp > 0 && attempts++ < 12) {
      go(s, guard.x - 55, guard.y);
      if (s.player.ammo === 0) { reload(s); tick(s, 1.9); }
      shoot(s, guard.x, guard.y);
      tick(s, 0.4);
    }
    assert.equal(guard.hp, 0, `guard ${id} defeated through bullets`);
  }
  assert.equal(s.mission.stage, 4);
}
function finishMission(s, choice = 'spare-pike') {
  startMission(s); defeatGuards(s);
  speak(s, 'gideon'); choose(s, choice);
  assert.equal(s.mission.stage, 5);
  go(s, 1075, 850); interact(s);
  assert.equal(s.mission.waterRunning, true);
  assert.equal(s.mission.stage, 6);
  speak(s, 'ada'); choose(s, 'finish-water');
  assert.equal(s.mission.completed, true);
}

test('the full opening mission requires investigation, combat, a mercy choice, a repaired valve and return', () => {
  const s = createState();
  choose(s, 'finish-water');
  assert.equal(s.mission.stage, 0, 'unauthorized choices cannot advance mission');
  go(s, 1095, 857); interact(s);
  assert.equal(s.mission.stage, 0, 'visiting final objective before acceptance is not completion');
  finishMission(s);
  assert.equal(s.mission.stage, 7);
  assert.equal(s.mission.choice, 'spare-pike');
  assert.equal(s.player.money, 85);
  assert.equal(s.inventory.wrench, 0);
  assert.equal(s.inventory.tonic, 3);
  assert.equal(s.honor, 25);
  assert.ok(s.log.some((e) => e.text.includes('repaired')));
  const money = s.player.money;
  speak(s, 'ada'); choose(s, 'finish-water');
  assert.equal(s.player.money, money, 'completion cannot be farmed');
});

test('the foreman choice changes persistent honor, character state and consequences', () => {
  const mercy = createState(), revenge = createState(), justice = createState();
  finishMission(mercy, 'spare-pike'); finishMission(revenge, 'revenge-pike'); finishMission(justice, 'arrest-pike');
  assert.ok(mercy.honor > revenge.honor);
  assert.equal(revenge.npcs.find((n) => n.id === 'gideon').hp, 0);
  assert.equal(revenge.wanted.bounty, 15);
  assert.equal(justice.npcs.find((n) => n.id === 'gideon').arrested, true);
  const loaded = restore(serialize(mercy));
  assert.equal(loaded.mission.choice, 'spare-pike');
  assert.equal(loaded.npcs.find((n) => n.id === 'gideon').departed, true);
  assert.equal(loaded.honor, mercy.honor);
});

test('reload conserves cartridges, takes time, and cannot consume twice', () => {
  const s = createState();
  shoot(s, 850, 650); tick(s, 0.4); shoot(s, 850, 650);
  const total = s.player.ammo + s.player.reserve;
  reload(s); reload(s);
  assert.equal(s.player.ammo, 4);
  tick(s, 1);
  assert.equal(s.player.ammo, 4);
  tick(s, 1);
  assert.equal(s.player.ammo, 6);
  assert.equal(s.player.reserve, total - 6);
  reload(s); tick(s, 2);
  assert.equal(s.player.ammo + s.player.reserve, total);
  s.player.ammo = 0; s.player.reserve = 2;
  reload(s); tick(s, 2);
  assert.equal(s.player.ammo, 2);
  assert.equal(s.player.reserve, 0);
});

test('focus slows enemy bullets while consuming a limited resource', () => {
  const a = createState(), b = createState();
  a.bullets.push({ x: 400, y: 100, vx: 100, vy: 0, ttl: 5, faction: 'guard', damage: 12 });
  b.bullets.push({ ...a.bullets[0] });
  tick(a, 1); tick(b, 1, { focus: true });
  assert.ok(a.bullets[0].x > b.bullets[0].x + 60);
  assert.ok(b.player.focus < 81);
  tick(b, 6, { focus: true });
  assert.ok(b.player.focus <= 0.2, 'focus resource cannot stay active indefinitely');
});

test('movement is frame based, diagonal normalized, and blocked by buildings and deep river', () => {
  const a = createState(), b = createState();
  tick(a, 1, { mx: 1 }); tick(b, 1, { mx: 1, my: -1 });
  assert.ok(Math.abs(a.stats.distance - b.stats.distance) < 0.01);
  go(a, 878, 415); tick(a, 1, { mx: 1 });
  assert.ok(a.player.x < 900, 'store footprint blocks movement');
  go(a, riverX(480) - 65, 480); tick(a, 1, { mx: 1 });
  assert.ok(a.player.x <= riverX(480) - WORLD.river.width / 2, 'river only crossed at bridge');
  go(a, 290, 605); tick(a, 2, { mx: 1 });
  assert.ok(a.player.x > 400, 'bridge permits crossing');
});

test('riding, galloping and feeding the horse affect speed, stamina and bond', () => {
  const s = createState(); go(s, s.horse.x, s.horse.y); interact(s);
  assert.equal(s.player.mounted, true);
  const ox = s.player.x; tick(s, 1, { mx: 1, sprint: true });
  assert.ok(s.player.x - ox > 150);
  assert.ok(s.horse.stamina < 100);
  const bond = s.horse.bond; useItem(s, 'oats');
  assert.equal(s.horse.stamina, 100); assert.ok(s.horse.bond > bond);
  interact(s); assert.equal(s.player.mounted, false);
  go(s, 870, 760); whistle(s); tick(s, 2);
  assert.ok(Math.hypot(s.horse.x - s.player.x, s.horse.y - s.player.y) < 100);
});

test('shop transactions conserve money and items and require a merchant interaction', () => {
  const s = createState();
  buy(s, 'tonic'); assert.equal(s.player.money, 40);
  speak(s, 'nell');
  buy(s, 'tonic'); assert.equal(s.inventory.tonic, 3); assert.equal(s.player.money, 32);
  buy(s, 'ammo'); assert.equal(s.player.reserve, 48); assert.equal(s.player.money, 27);
  s.inventory.pelt = 1; sell(s, 'pelt');
  assert.equal(s.inventory.pelt, 0); assert.equal(s.player.money, 36);
  sell(s, 'pelt'); assert.equal(s.player.money, 36);
  s.player.money = 1; buy(s, 'tonic'); assert.equal(s.inventory.tonic, 3);
  choose(s, 'leave'); sell(s, 'tonic'); assert.equal(s.inventory.tonic, 3);
});

test('witnessed assault creates a bounty, pursuit, and a payable record', () => {
  const s = createState();
  go(s, 995, 495); shoot(s, 995, 540); tick(s, 0.5);
  assert.ok(s.wanted.bounty >= 20);
  assert.ok(s.wanted.heat > 35);
  assert.ok(s.honor < 0);
  tick(s, 7.5);
  assert.equal(s.wanted.pursuit, true);
  assert.ok(s.enemies.some((e) => e.kind === 'law'));
  s.player.money = 100;
  speak(s, 'eliza'); const debt = s.wanted.bounty; choose(s, 'pay-bounty');
  assert.equal(s.player.money, 100 - debt);
  assert.equal(s.wanted.bounty, 0); assert.equal(s.wanted.pursuit, false);
  assert.ok(s.enemies.every((e) => e.kind !== 'law'));
});

test('hunting requires a kill and harvesting; fishing requires timing the bite', () => {
  const s = createState(), deer = s.animals.find((a) => a.id === 'deer-1');
  for (let i = 0; i < 3 && deer.hp > 0; i++) { go(s, deer.x - 55, deer.y); shoot(s, deer.x, deer.y); tick(s, 0.4); }
  assert.equal(deer.hp, 0);
  go(s, deer.x, deer.y + 20); interact(s);
  assert.equal(s.inventory.meat, 2); assert.equal(s.inventory.pelt, 1);
  interact(s); assert.equal(s.inventory.meat, 2, 'a carcass can be harvested only once');
  go(s, riverX(720) - 55, 720); interact(s);
  assert.equal(s.fishing.active, true);
  for (let i = 0; i < 60 && !s.fishing.bite; i++) tick(s, 0.1);
  assert.equal(getInteraction(s).id, 'reel'); interact(s);
  assert.equal(s.inventory.trout, 1); assert.equal(s.stats.fish, 1);
  interact(s); tick(s, 10);
  assert.equal(s.inventory.trout, 1, 'missed bites do not award fish');
});

test('three side jobs are completed by returning real goods, the living horse and a captured bounty', () => {
  const s = createState(); finishMission(s);
  speak(s, 'ada'); choose(s, 'accept-provisions');
  speak(s, 'ada'); choose(s, 'accept-provisions'); assert.equal(s.sideQuests.provisions.complete, false);
  const deer = s.animals.find((a) => a.id === 'deer-1');
  for (let i = 0; i < 3 && deer.hp > 0; i++) { go(s, deer.x - 55, deer.y); if (!s.player.ammo) { reload(s); tick(s, 2); } shoot(s, deer.x, deer.y); tick(s, 0.4); }
  go(s, deer.x, deer.y + 20); interact(s);
  go(s, riverX(720) - 55, 720); interact(s); for (let i = 0; i < 60 && !s.fishing.bite; i++) tick(s, 0.1); interact(s);
  speak(s, 'ada'); choose(s, 'accept-provisions');
  assert.equal(s.sideQuests.provisions.complete, true); assert.equal(s.inventory.meat, 0); assert.equal(s.inventory.trout, 0);
  speak(s, 'silas'); choose(s, 'horse-job');
  const copper = s.animals.find((a) => a.id === 'stray'); go(s, copper.x, copper.y + 20); interact(s);
  assert.equal(s.companion, 'stray');
  speak(s, 'silas'); choose(s, 'horse-job'); assert.equal(s.sideQuests.horse.complete, false, 'Copper must physically return');
  // Walk the actual bridge route; the companion must follow across the same collision map.
  go(s, copper.x, copper.y + 20);
  walkTo(s, 260, 605); walkTo(s, 430, 605); walkTo(s, 870, 520); walkTo(s, 995, 540);
  speak(s, 'silas'); choose(s, 'horse-job');
  assert.equal(s.sideQuests.horse.complete, true); assert.equal(copper.returned, true);
  speak(s, 'eliza'); choose(s, 'bounty-job');
  const deserter = s.enemies.find((e) => e.id === 'deserter');
  for (let i = 0; i < 2; i++) { go(s, deserter.x - 50, deserter.y); if (!s.player.ammo) { reload(s); tick(s, 2); } shoot(s, deserter.x, deserter.y); tick(s, 0.4); }
  tick(s, 0.1); assert.equal(deserter.surrendered, true);
  go(s, deserter.x, deserter.y + 20); interact(s);
  assert.equal(s.sideQuests.bounty.targetAlive, true);
  speak(s, 'eliza'); const money = s.player.money; choose(s, 'bounty-job');
  assert.equal(s.sideQuests.bounty.complete, false, 'capturing is not physical delivery');
  assert.equal(s.player.money, money, 'a remote captive cannot earn a live bounty');
  go(s, deserter.x, deserter.y + 20);
  walkTo(s, 850, 850); walkTo(s, 850, 500); walkTo(s, 1060, 450);
  speak(s, 'eliza'); choose(s, 'bounty-job');
  assert.equal(s.sideQuests.bounty.complete, true); assert.equal(s.player.money, money + 35);
  assert.equal(s.captive, null); assert.equal(deserter.delivered, true);
});

test('rest restores all cores and advances time, and recovery preserves quest progress', () => {
  const s = createState(); startMission(s);
  s.player.hp = 25; s.player.stamina = 15; s.player.focus = 10; s.horse.stamina = 8;
  go(s, 690, 795); interact(s); choose(s, 'rest-morning');
  assert.equal(s.time, 7); assert.equal(s.day, 2); assert.equal(s.player.hp, 100); assert.equal(s.horse.stamina, 100);
  s.player.hp = 0; const money = s.player.money; step(s, 0.05);
  assert.equal(s.player.hp, 100); assert.equal(s.stats.deaths, 1); assert.ok(s.player.money < money); assert.equal(s.mission.stage, 3);
});

test('saved journeys round trip mission, inventory, horse, side work and partial reload', () => {
  const s = createState(); finishMission(s); speak(s, 'silas'); choose(s, 'horse-job');
  s.inventory.trout = 3; s.player.ammo = 2; reload(s); tick(s, 0.6); s.horse.bond = 2.4;
  const loaded = restore(serialize(s));
  assert.ok(loaded); assert.equal(loaded.inventory.trout, 3); assert.equal(loaded.mission.completed, true);
  assert.equal(loaded.sideQuests.horse.stage, 1); assert.equal(loaded.horse.bond, 2.4);
  const total = loaded.player.ammo + loaded.player.reserve;
  tick(loaded, 1.3);
  assert.equal(loaded.player.ammo, 6); assert.equal(loaded.player.ammo + loaded.player.reserve, total);
  assert.equal(loaded.dialog, null); assert.equal(loaded.bullets.length, 0);
});

test('restore rejects malformed saves and clamps bounded gameplay values', () => {
  for (const malformed of ['no json', null, [], {}, '{"version":99}', { ...createState(), enemies: [] }, { ...createState(), player: { x: NaN } }]) assert.equal(restore(malformed), null);
  const data = createState(); data.player.hp = 800; data.player.money = -5; data.player.ammo = 123; data.inventory.tonic = -2; data.horse.bond = 900;
  const loaded = restore(data);
  assert.equal(loaded.player.hp, 100); assert.equal(loaded.player.money, 0); assert.equal(loaded.player.ammo, 6); assert.equal(loaded.inventory.tonic, 0); assert.equal(loaded.horse.bond, 4);
  data.mission.stage = 7; data.mission.waterRunning = true;
  assert.equal(restore(data), null, 'invented progress cannot bypass undefeated mission actors');
});

test('gathered ingredients replenish on a new day and camp crafting consumes them atomically', () => {
  const s = createState();
  const sage = s.resources.find((node) => node.id === 'camp-sage');
  const berries = s.resources.find((node) => node.id === 'camp-berries');
  go(s, sage.x, sage.y); assert.equal(getInteraction(s).id, 'gather:camp-sage'); interact(s);
  assert.equal(s.inventory.herbs, 2); assert.equal(s.stats.gathered, 2);
  interact(s); assert.equal(s.inventory.herbs, 2, 'the same patch cannot be gathered twice today');
  go(s, berries.x, berries.y); interact(s); assert.equal(s.inventory.berries, 2);
  const inventory = { ...s.inventory }; craft(s, 'sage-tonic');
  assert.deepEqual(s.inventory, inventory, 'crafting requires the community camp');
  go(s, 690, 795); craft(s, 'sage-tonic');
  assert.equal(s.inventory.tonic, 3); assert.equal(s.inventory.herbs, 0); assert.equal(s.inventory.berries, 1); assert.equal(s.stats.crafted, 1);
  const before = { ...s.inventory }; craft(s, 'sage-tonic');
  assert.deepEqual(s.inventory, before, 'missing ingredients do not consume remaining ingredients');
  s.inventory.herbs = 2; s.inventory.tonic = 99; craft(s, 'sage-tonic');
  assert.equal(s.inventory.herbs, 2, 'a full result stack does not consume ingredients');
  s.inventory.tonic = 3; interact(s); choose(s, 'rest-morning');
  go(s, sage.x, sage.y); interact(s); assert.equal(s.inventory.herbs, 4, 'rest advances the real gathering availability');
  const loaded = restore(serialize(s));
  go(loaded, sage.x, sage.y); interact(loaded);
  assert.equal(loaded.inventory.herbs, 4, 'a save cannot reset exhausted patches');
  assert.equal(loaded.stats.crafted, 1);
});

test('camp donations, upgrades, cooking and food shortage change community and survival behavior', () => {
  const s = createState();
  s.inventory.timber = 5; s.inventory.meat = 2;
  go(s, 1000, 750); donate(s, 'timber', 2);
  assert.equal(s.camp.materials, 0, 'camp supplies require returning to camp');
  go(s, 690, 795); donate(s, 'timber', 4);
  assert.equal(s.inventory.timber, 1); assert.equal(s.camp.materials, 4);
  donate(s, 'timber', 2); assert.equal(s.camp.materials, 4, 'donations cannot invent stock');
  craft(s, 'camp-supper'); assert.equal(s.inventory.meat, 2, 'cookpot is required');
  const money = s.player.money; upgradeCamp(s, 'cookpot');
  assert.equal(s.camp.upgrades.cookpot, true); assert.equal(s.camp.materials, 2); assert.equal(s.player.money, money - 15);
  upgradeCamp(s, 'cookpot'); assert.equal(s.player.money, money - 15, 'one camp improvement cannot be purchased twice');
  craft(s, 'camp-supper'); assert.equal(s.inventory.cookedMeat, 1); assert.equal(s.inventory.timber, 0); assert.equal(s.inventory.meat, 1);
  s.player.hp = 40; s.player.stamina = 3; useItem(s, 'cookedMeat');
  assert.equal(s.player.hp, 70); assert.equal(s.player.stamina, 100);
  s.camp.food = 0; s.player.hp = 30; s.player.focus = 20;
  interact(s); choose(s, 'rest-morning');
  assert.equal(s.player.hp, 75); assert.equal(s.player.focus, 75, 'an empty camp pantry affects recovery');
  donate(s, 'meat'); interact(s); choose(s, 'rest-evening');
  assert.equal(s.player.hp, 100); assert.equal(s.player.focus, 100); assert.equal(s.camp.food, 0);
  const loaded = restore(serialize(s));
  assert.equal(loaded.camp.upgrades.cookpot, true); assert.equal(loaded.camp.materials, 2); assert.equal(loaded.inventory.cookedMeat, 0);
});

test('two distinct camp relationships connect gathering, supplies and a later medicine visit', () => {
  const s = createState();
  speak(s, 'tomas'); choose(s, 'tomas-timber'); assert.equal(s.companions.tomas.requestStage, 1);
  speak(s, 'tomas'); choose(s, 'tomas-timber'); assert.equal(s.companions.tomas.requestStage, 1, 'request needs real timber');
  const timber = s.resources.find((node) => node.id === 'camp-timber'); go(s, timber.x, timber.y); interact(s);
  speak(s, 'tomas'); choose(s, 'tomas-timber');
  assert.equal(s.companions.tomas.requestStage, 2); assert.equal(s.companions.tomas.trust, 10); assert.equal(s.camp.materials, 2);
  speak(s, 'fern'); choose(s, 'fern-sage');
  const sage = s.resources.find((node) => node.id === 'camp-sage'); go(s, sage.x, sage.y); interact(s);
  speak(s, 'fern'); choose(s, 'fern-sage');
  assert.equal(s.companions.fern.requestStage, 2); assert.equal(s.camp.medicine, 3);
  speak(s, 'fern'); choose(s, 'fern-tonic'); assert.equal(s.companions.fern.requestStage, 2, 'later visit waits for changed ranch conditions'); choose(s, 'leave');
  finishMission(s);
  speak(s, 'fern'); choose(s, 'fern-tonic'); assert.equal(s.companions.fern.requestStage, 3);
  const money = s.player.money;
  speak(s, 'fern'); choose(s, 'fern-tonic');
  assert.equal(s.companions.fern.requestStage, 4); assert.equal(s.companions.fern.trust, 30); assert.equal(s.player.money, money + 12);
  speak(s, 'fern'); choose(s, 'fern-tonic'); choose(s, 'leave'); assert.equal(s.player.money, money + 12, 'relationship completion cannot be farmed');
  const loaded = restore(serialize(s)); assert.deepEqual(loaded.companions, s.companions);
});

test('combat checkpoints recover failed encounters, survive saves and preserve completed moral choices', () => {
  const s = createState(); startMission(s);
  const guard = s.enemies.find((e) => e.id === 'pump-1');
  go(s, guard.x - 55, guard.y); shoot(s, guard.x, guard.y); tick(s, 0.4);
  assert.equal(guard.hp, 35);
  let loaded = restore(serialize(s)); const ammo = loaded.player.ammo;
  loaded.player.hp = 0; loaded.player.reloadTimer = 1; loaded.fishing.active = true; step(loaded, 0.05);
  assert.equal(loaded.mission.stage, 3); assert.equal(loaded.enemies.find((e) => e.id === 'pump-1').hp, 70);
  assert.equal(loaded.player.x, 1035); assert.equal(loaded.player.reloadTimer, 0); assert.equal(loaded.player.ammo, ammo, 'recovery does not manufacture ammunition');
  assert.equal(loaded.fishing.active, false);
  defeatGuards(loaded); speak(loaded, 'gideon'); choose(loaded, 'spare-pike');
  loaded = restore(serialize(loaded)); loaded.player.hp = 0; step(loaded, 0.05);
  assert.equal(loaded.mission.stage, 5); assert.equal(loaded.mission.choice, 'spare-pike'); assert.equal(loaded.inventory.wrench, 1);
  assert.ok(loaded.enemies.filter((e) => e.id.startsWith('pump-')).every((e) => e.hp === 0), 'completed encounter remains complete');
  speak(loaded, 'tomas'); loaded.player.hp = 0; step(loaded, 0.05);
  assert.equal(loaded.dialog, null); assert.equal(loaded.player.hp, 100, 'dialogue cannot freeze defeat recovery');
});

test('version-one journeys migrate new systems and malformed bounty actors are rejected', () => {
  const legacy = createState(); legacy.version = 1;
  delete legacy.camp; delete legacy.resources; delete legacy.companions; delete legacy.checkpoint; delete legacy.captive;
  for (const key of ['herbs', 'berries', 'timber', 'cookedMeat']) delete legacy.inventory[key];
  const loaded = restore(legacy);
  assert.equal(loaded.version, 2); assert.equal(loaded.camp.food, 4); assert.equal(loaded.inventory.herbs, 0); assert.equal(loaded.resources.length, 6);
  const malformed = createState(); malformed.sideQuests.bounty.stage = 2; malformed.sideQuests.bounty.targetAlive = true;
  assert.equal(restore(malformed), null, 'live-delivery progress requires its real captured actor');
  const duplicate = createState(); duplicate.enemies.push({ ...duplicate.enemies[0] });
  assert.equal(restore(duplicate), null, 'duplicate mission actors cannot change mission predicates');
});

test('horse shelter improves care and rain has a measurable travel consequence', () => {
  const a = createState(), b = createState();
  go(a, a.horse.x, a.horse.y); interact(a); go(b, b.horse.x, b.horse.y); interact(b);
  b.camp.upgrades.shelter = true; a.horse.hp = 40; b.horse.hp = 40;
  tick(a, 1, { mx: 1, sprint: true }); tick(b, 1, { mx: 1, sprint: true });
  assert.ok(b.horse.stamina > a.horse.stamina, 'dry care improves the horse’s reserve');
  interact(b); go(b, 690, 795); interact(b); choose(b, 'rest-morning'); assert.equal(b.horse.hp, 100);
  const clear = createState(), rain = createState(); rain.elapsed = 190;
  const start = clear.player.x; tick(clear, 1, { mx: 1 }); tick(rain, 1, { mx: 1 });
  assert.equal(rain.weather, 'rain'); assert.ok(rain.player.x - start < clear.player.x - start);
});

test('surrender stops gunfire immediately and a wounded quest horse has an explicit recovery path', () => {
  const s = createState(); finishMission(s);
  speak(s, 'eliza'); choose(s, 'bounty-job');
  const deserter = s.enemies.find((e) => e.id === 'deserter');
  go(s, deserter.x - 50, deserter.y);
  for (let i = 0; i < 2; i++) { if (!s.player.ammo) { reload(s); tick(s, 2); } shoot(s, deserter.x, deserter.y); tick(s, 0.4); }
  assert.equal(deserter.surrendered, true); assert.equal(deserter.active, false);
  s.bullets = []; deserter.fireTimer = 0; tick(s, 1);
  assert.equal(s.bullets.length, 0, 'a surrendered actor never fires again');
  speak(s, 'silas'); choose(s, 'horse-job');
  const copper = s.animals.find((a) => a.id === 'stray'); go(s, copper.x, copper.y + 20); interact(s);
  copper.hp = 0;
  const loaded = restore(serialize(s)); assert.equal(loaded.companion, null);
  speak(loaded, 'silas'); assert.equal(loaded.dialog.id, 'silas-horse-recovery');
  const money = loaded.player.money, day = loaded.day; choose(loaded, 'horse-retry');
  assert.equal(loaded.player.money, money - 5); assert.equal(loaded.day, day + 1); assert.equal(loaded.sideQuests.horse.stage, 1);
  const recovered = loaded.animals.find((a) => a.id === 'stray');
  assert.equal(recovered.hp, 100); go(loaded, recovered.x, recovered.y + 20); interact(loaded);
  assert.equal(loaded.companion, 'stray', 'the failed escort can actually be resumed');
});
