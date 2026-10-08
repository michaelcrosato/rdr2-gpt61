import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCampaignState, stepCampaign, getCampaignInteraction, getCampaignInteractions, interactCampaign,
  chooseCampaign, shootCampaign, reloadCampaign, useCampaignItem,
  whistleCampaign, serializeCampaign, restoreCampaign, campaignAction,
  restartCampaign, storeCampaignItem, takeCampaignItem,
} from '../src/campaign.js';
import { SNOWBOUND_WORLD, SNOWBOUND_STAGES } from '../content/campaign/snowbound.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function tick(state, seconds, input = {}) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    stepCampaign(state, Math.min(0.05, seconds - elapsed), input);
  }
}
function place(state, point, offset = 0) {
  state.player.x = point.x;
  state.player.y = point.y + offset;
  state.player.vx = state.player.vy = 0;
}
function prop(id) {
  const item = SNOWBOUND_WORLD.props.find(value => value.id === id);
  assert.ok(item, `authored prop ${id} exists`);
  return item;
}
function actor(state, id) {
  const item = [...state.npcs, ...state.enemies].find(value => value.id === id);
  assert.ok(item, `authored actor ${id} exists`);
  return item;
}
function atProp(state, id) { place(state, prop(id)); }
function choose(state, id) {
  assert.ok(state.dialog?.choices.some(choice => choice.id === id), `dialog offers ${id}`);
  chooseCampaign(state, id);
}
function waitForThreat(state) {
  for (let count = 0; !state.dialog && count < 400; count++) tick(state, 0.05);
  assert.ok(state.dialog?.choices.some(choice => choice.id === 'stand-ground'), 'Tomas and Inez reach the negotiation positions before Voss threatens them');
}
function walkTo(state, target, input = {}) {
  let frames = 0;
  while (distance(state.player, target) > 7 && frames++ < 2400) {
    const length = distance(state.player, target);
    stepCampaign(state, 0.05, { ...input, mx: (target.x - state.player.x) / length, my: (target.y - state.player.y) / length });
    assert.ok(!state.failure, `walk to ${target.x},${target.y} remains recoverable`);
  }
  assert.ok(distance(state.player, target) <= 7, `ordinary movement reached ${target.x},${target.y}`);
}
function pickup(state, id) {
  const item = SNOWBOUND_WORLD.supplies.find(value => value.id === id);
  assert.ok(item, `authored supply ${id} exists`);
  place(state, item);
  interactCampaign(state, `pickup:${id}`);
}
function speak(state, id) {
  place(state, actor(state, id));
  const interaction = getCampaignInteraction(state);
  assert.ok(interaction, `${id} offers an actual nearby interaction`);
  interactCampaign(state, interaction.id);
}
function acceptJourney(state) {
  atProp(state, 'coat'); interactCampaign(state, 'coat');
  atProp(state, 'lantern'); interactCampaign(state, 'lantern');
  speak(state, 'tomas'); choose(state, 'accept-journey');
  assert.equal(state.mission.stage, 1);
}
function followWire(state) {
  place(state, state.horse);
  interactCampaign(state, 'mount');
  assert.equal(state.player.mounted, true, 'the route is actually ridden');
  for (const point of SNOWBOUND_WORLD.trail.slice(0, 3)) walkTo(state, point);
  atProp(state, 'wire'); interactCampaign(state, 'wire');
  assert.equal(state.flags.wireInspected, true);
  if (!state.dialog) speak(state, 'inez');
  choose(state, 'join-inez');
  assert.equal(state.flags.inezJoined, true);
  for (const point of SNOWBOUND_WORLD.trail.slice(3)) walkTo(state, point);
  assert.equal(state.mission.stage, 2);
}
function beginYard(state, cover = 'cover-culvert') {
  acceptJourney(state);
  followWire(state);
  atProp(state, 'hitch'); interactCampaign(state, 'hitch');
  atProp(state, cover); interactCampaign(state, cover);
  if (!state.dialog) speak(state, 'tomas');
  choose(state, 'company-message');
  waitForThreat(state);
  choose(state, 'stand-ground');
  assert.equal(state.mission.stage, 3);
}

const essentials = ['blankets', 'oil', 'oats', 'bandages', 'broth', 'kindling'];
function shootGuard(state, id) {
  const enemy = actor(state, id);
  let shots = 0;
  while (enemy.hp > 0 && shots++ < 5) {
    place(state, { x: enemy.x - 42, y: enemy.y });
    shootCampaign(state, enemy.x, enemy.y);
    tick(state, 0.4);
    assert.equal(state.failure, null, 'hostile shooting preserves the protected party');
    if (state.player.ammo === 0) { reloadCampaign(state); tick(state, 1.8); }
  }
  assert.equal(enemy.hp, 0, `${id} was defeated by actual projectiles`);
}
function winYard(state, vossOutcome = 'capture') {
  beginYard(state);
  shootGuard(state, 'gauge-guard');
  shootGuard(state, 'chute-flanker');
  assert.equal(state.mission.stage, 4);
  assert.equal(actor(state, 'voss').fleeing, true);
  if (vossOutcome === 'capture') {
    place(state, actor(state, 'voss'), 25);
    interactCampaign(state, 'capture-voss');
    assert.equal(actor(state, 'voss').captured, true);
  } else {
    tick(state, 15);
    assert.equal(actor(state, 'voss').escaped, true, 'the service-tunnel retreat really ran');
    assert.equal(state.worldChanges.vossFutureCheckpoint, true);
  }
}
function reachAmbush(state, vossOutcome = 'capture') {
  winYard(state, vossOutcome);
  for (const id of essentials) pickup(state, id);
  place(state, { x: 1180, y: 760 });
  interactCampaign(state, 'investigate-coal');
  assert.equal(state.mission.stage, 5);
  assert.equal(state.player.weaponOwned, false);
  assert.equal(state.inventory.token, 0);
}
function settlePavel(state, outcome = 'release') {
  campaignAction(state, 'shove');
  assert.equal(state.flags.shoves, 0, 'blocking is required before the shove tutorial');
  campaignAction(state, 'block');
  const health = state.player.hp;
  tick(state, 1.25);
  assert.equal(state.player.hp, health, 'a timed block stops Pavel’s strike');
  campaignAction(state, 'shove');
  campaignAction(state, 'shove');
  assert.equal(state.flags.shoves, 1, 'the shove cooldown prevents repeated inputs in one frame');
  tick(state, 0.4);
  place(state, actor(state, 'pavel'), 25);
  campaignAction(state, 'shove');
  campaignAction(state, 'restrain');
  assert.equal(state.flags.pavelSubdued, true);
  place(state, state.dropped.weapon); interactCampaign(state, 'pickup:weapon');
  place(state, state.dropped.token); interactCampaign(state, 'pickup:token');
  assert.equal(state.player.weaponOwned, true);
  assert.equal(state.inventory.token, 1);
  place(state, actor(state, 'pavel'), 25);
  interactCampaign(state, 'interrogate-pavel');
  choose(state, `${outcome}-pavel`);
  assert.equal(state.mission.stage, 6);
  assert.equal(state.flags.rescueClue, true, 'every fate preserves Silas’s essential rescue lead');
}
function gainCopper(state) {
  const copper = state.animals.find(value => value.id === 'copper');
  campaignAction(state, 'holster');
  place(state, { x: copper.x - 60, y: copper.y });
  interactCampaign(state, 'speak-copper');
  for (let count = 0; copper.fear > 40 && count < 5; count++) interactCampaign(state, 'calm-copper');
  place(state, { x: copper.x - 30, y: copper.y });
  interactCampaign(state, 'pat-copper');
  interactCampaign(state, 'lead-copper');
  assert.equal(copper.leading, true);
  atProp(state, 'hitch'); interactCampaign(state, 'hitch-copper');
  assert.equal(state.flags.copperHitched, false, 'the player cannot hitch a distant mare');
  place(state, { x: 1530, y: 615 });
  for (const point of [{ x: 1450, y: 615 }, { x: 1450, y: 645 }, { x: 1360, y: 645 }, { x: 1245, y: 675 }, { x: 1150, y: 630 }, prop('hitch')]) walkTo(state, point);
  tick(state, 2);
  assert.ok(distance(copper, prop('hitch')) <= 85, 'Copper actually follows through the pen gate and yard');
  interactCampaign(state, 'hitch-copper');
  choose(state, 'accept-copper');
  assert.equal(state.mission.stage, 7);
  assert.equal(state.horse.id, 'copper');
  assert.equal(state.horse.owned, true);
}
function identifyAda(state, priority) {
  atProp(state, 'speaking-tube'); interactCampaign(state, 'speaking-tube');
  choose(state, priority);
  atProp(state, 'pressure-valve'); interactCampaign(state, 'pressure-valve');
  assert.equal(state.worldChanges.pressureReleased, true);
}
function carryToSafety(state) {
  place(state, actor(state, 'gideon'));
  interactCampaign(state, 'carry-gideon');
  assert.equal(state.player.carrying, 'gideon');
  for (const point of SNOWBOUND_WORLD.rescueRoute) walkTo(state, point);
  assert.equal(state.flags.gideonSafe, true, 'carrying reaches the actual service walkway');
  assert.equal(state.player.carrying, null);
}
function escortToSafety(state) {
  place(state, actor(state, 'ada'));
  interactCampaign(state, 'escort-ada');
  assert.equal(state.flags.adaEscorting, true);
  for (const point of SNOWBOUND_WORLD.rescueRoute) { walkTo(state, point); tick(state, 0.4); }
  let seconds = 0;
  while (!state.flags.adaSafe && seconds++ < 30) tick(state, 1);
  assert.equal(state.flags.adaSafe, true, 'Ada walks every service-route node while Mara stays nearby');
}
function rescue(state, priority = 'preserve-log') {
  identifyAda(state, priority);
  if (priority === 'preserve-log') {
    place(state, actor(state, 'gideon')); interactCampaign(state, 'carry-gideon');
    assert.equal(state.player.carrying, null, 'the message promise requires recovering the actual log first');
    pickup(state, 'logbook');
    escortToSafety(state);
    carryToSafety(state);
  } else {
    place(state, actor(state, 'ada')); interactCampaign(state, 'escort-ada');
    assert.equal(state.flags.adaEscorting, false, 'Gideon-first means Ada waits until he reaches safety');
    carryToSafety(state);
    escortToSafety(state);
  }
  tick(state, 0.1);
  assert.equal(state.mission.stage, 8);
  assert.equal(state.worldChanges.boilerDestroyed, true);
  assert.equal(state.worldChanges.relayDamaged, true);
  assert.equal(state.worldChanges.relayCircuitOff, true);
  assert.equal(state.worldChanges.fireActive, false);
}
function returnToKiln(state) {
  atProp(state, 'stove-store'); interactCampaign(state, 'deposit-supplies');
  assert.equal(state.mission.completed, false, 'a lone player at camp cannot deposit for absent Rusks and Copper');
  place(state, prop('safe-walkway'));
  for (const point of [{ x: 1100, y: 650 }, { x: 950, y: 700 }, { x: 850, y: 800 }, { x: 650, y: 1000 }, prop('stove-store')]) walkTo(state, point);
  tick(state, 3);
  interactCampaign(state, 'deposit-supplies');
  assert.equal(state.mission.completed, true, 'the real group arrives with real supply inventory');
}
function completeOpening(outcome = 'release', priority = 'preserve-log', vossOutcome = 'capture') {
  const state = createCampaignState();
  reachAmbush(state, vossOutcome); settlePavel(state, outcome); gainCopper(state); rescue(state, priority); returnToKiln(state);
  return state;
}

test('Snowbound begins at its own nine-stage opening and cannot jump to a later choice or delivery', () => {
  const state = createCampaignState();
  assert.equal(SNOWBOUND_STAGES.length, 9);
  assert.equal(state.mission.id, 'snowbound-the-last-warm-light');
  assert.equal(state.mission.stage, 0);
  assert.equal(state.mission.completed, false);
  for (const id of ['release-pavel', 'bind-pavel', 'kill-pavel', 'preserve-log', 'carry-gideon-first']) {
    chooseCampaign(state, id);
    assert.equal(state.mission.stage, 0, `${id} cannot bypass its scene`);
  }
  atProp(state, 'stove-store');
  interactCampaign(state, 'deposit-supplies');
  assert.equal(state.mission.completed, false);
  assert.equal(state.mission.stage, 0);
});

test('the departure requires actual nearby coat and lantern pickup as well as Tomas briefing', () => {
  const state = createCampaignState();
  speak(state, 'tomas'); choose(state, 'accept-journey');
  assert.equal(state.mission.stage, 0, 'a conversation cannot replace required preparations');
  place(state, { x: 30, y: 30 });
  interactCampaign(state, 'coat'); interactCampaign(state, 'lantern');
  assert.equal(state.flags.coatTaken, false, 'coat pickup requires proximity');
  assert.equal(state.flags.lanternTaken, false, 'lantern pickup requires proximity');
  atProp(state, 'coat'); interactCampaign(state, 'coat');
  assert.equal(state.flags.coatTaken, true);
  assert.equal(state.mission.stage, 0, 'one preparation still remains');
  atProp(state, 'lantern'); interactCampaign(state, 'lantern');
  assert.equal(state.flags.lanternTaken, true);
  assert.equal(state.mission.stage, 1);
  const inventory = structuredClone(state.inventory);
  interactCampaign(state, 'lantern');
  assert.deepEqual(state.inventory, inventory, 'a removed prop cannot be collected twice');
});

test('the first journey physically rides its route, joins Inez and only then offers station negotiations', () => {
  const state = createCampaignState();
  acceptJourney(state);
  place(state, prop('hitch'));
  interactCampaign(state, 'hitch');
  assert.equal(state.mission.stage, 1, 'visiting the destination does not skip the route or companion');
  followWire(state);
  assert.equal(state.flags.wireInspected, true);
  assert.equal(state.flags.inezJoined, true);
  assert.ok(state.stats.distance > 650, 'movement really traversed the mountain trail');
  assert.ok(distance(state.player, actor(state, 'tomas')) < 160, 'Tomas traveled with Mara');
});

for (const outcome of ['release', 'bind', 'kill']) {
  for (const priority of ['preserve-log', 'carry-gideon-first']) {
    test(`the complete opening supports Pavel ${outcome} and rescue ${priority}`, () => {
      const state = completeOpening(outcome, priority, outcome === 'release' ? 'escape' : 'capture');
      assert.equal(state.flags.pavelChoice, outcome);
      assert.equal(state.flags.rescuePriority, priority);
      assert.equal(state.flags.rescueClue, true);
      assert.equal(state.sideQuests.silas.unlocked, true);
      assert.equal(state.sideQuests.silas.complete, false, 'unlocking the next mission does not complete it');
      assert.equal(state.worldChanges.neriRemembered, true);
      assert.equal(state.worldChanges.residentsDeparted, true);
      assert.equal(state.companions.ada.joined, true);
      assert.equal(state.companions.gideon.careNeeded, true);
      assert.equal(state.companions.gideon.severity, priority === 'preserve-log' ? 2 : 1);
      assert.equal(state.worldChanges.logRecovered, priority === 'preserve-log');
      assert.equal(state.supplies.find(item => item.id === 'logbook').lost, priority !== 'preserve-log');
      assert.equal(state.worldChanges.pavelFutureWarning, outcome === 'release');
      assert.equal(state.worldChanges.pavelCampGuardDuty, outcome === 'bind');
      assert.equal(state.camp.pavelGuarded, outcome === 'bind');
      assert.equal(actor(state, 'pavel').hp === 0, outcome === 'kill');
      assert.equal(state.honor, { release: 5, bind: 2, kill: -20 }[outcome]);
      assert.equal(state.companions.ada.trust, (priority === 'preserve-log' ? 20 : 12) - (outcome === 'kill' ? 15 : 0));
      assert.equal(state.companions.tomas.trust, outcome === 'kill' ? 0 : 10);
      assert.equal(state.worldChanges.vossFutureCheckpoint, outcome === 'release');
      assert.equal(state.camp.stoveLit, true);
      assert.equal(state.camp.blankets, 1);
      assert.equal(state.camp.oil, 1);
      assert.equal(state.camp.food, 3, 'one recovered food serving actually heats the camp');
      assert.equal(state.camp.materials, 0, 'the recovered kindling is consumed by the stove');
      assert.equal(state.camp.medicine, priority === 'preserve-log' ? 1 : 2);
      assert.equal(state.performance.allSixSupplies, true);
      assert.ok(state.stats.shots > 0 && state.stats.hostileHits > 0);
      assert.equal(state.performance.accuracy, state.stats.hostileHits / state.stats.shots);
      const earned = { camp: structuredClone(state.camp), inventory: structuredClone(state.inventory), horse: structuredClone(state.horse), companions: structuredClone(state.companions) };
      interactCampaign(state, 'deposit-supplies');
      chooseCampaign(state, 'accept-copper');
      for (const id of essentials) pickup(state, id);
      assert.deepEqual({ camp: state.camp, inventory: state.inventory, horse: state.horse, companions: state.companions }, earned, 'completed delivery, pickup and ownership inputs cannot grant rewards twice');
      atProp(state, 'stove-store'); tick(state, 3);
      place(state, actor(state, 'inez'));
      assert.equal(getCampaignInteraction(state)?.id, 'inez', 'Inez’s aftermath is offered through the ordinary nearby interaction');
      interactCampaign(state);
      assert.equal(state.dialog?.id, 'inez-aftermath');
      assert.match(state.dialog.text, /Copper/);
      assert.match(state.dialog.text, { release: /Pavel walk/, bind: /Pavel alive/, kill: /Killing him/ }[outcome], 'Inez reacts to the actual Pavel fate');
      assert.match(state.dialog.text, outcome === 'release' ? /Voss escaped/ : /Voss is restrained/, 'Inez reacts to the actual Voss outcome');
      assert.match(state.dialog.text, /blankets|kindling|bandages/, 'Inez acknowledges real recovered materials');
      const persistentWorld = structuredClone(state.worldChanges);
      const persistentFlags = structuredClone(state.flags);
      assert.ok(restoreCampaign(serializeCampaign(state)), 'the Inez conversation suspends in a valid campaign save');
      choose(state, 'leave');
      assert.deepEqual(state.worldChanges, persistentWorld, 'aftermath dialogue does not replace permanent world changes');
      assert.deepEqual(state.flags, persistentFlags, 'aftermath dialogue does not overwrite chosen branches');
      assert.deepEqual(state.camp, earned.camp, 'aftermath dialogue does not repeat delivery');
      assert.deepEqual(state.inventory, earned.inventory, 'aftermath dialogue does not award extra supplies');
      assert.ok(getCampaignInteractions(state).every(offer => offer.id !== 'deposit-supplies'), 'completed delivery is removed from ordinary offers');
    });
  }
}

test('the authored culvert and winch both stop projectiles and player movement', () => {
  for (const [cover, behind, beyond] of [
    ['cover-culvert', { x: 1230, y: 610 }, { x: 1230, y: 530 }],
    ['cover-winch', { x: 1305, y: 655 }, { x: 1305, y: 575 }],
  ]) {
    const state = createCampaignState(); beginYard(state, cover);
    const guard = actor(state, 'gauge-guard');
    Object.assign(guard, beyond);
    place(state, behind);
    shootCampaign(state, guard.x, guard.y);
    tick(state, 0.4);
    assert.equal(guard.hp, 70, `${cover} blocks a bullet aimed directly at the hostile beyond it`);
    const startY = state.player.y;
    tick(state, 0.5, { my: -1 });
    assert.ok(state.player.y > beyond.y + 30 && state.player.y < startY, `${cover} physically stops Mara at the cover face`);
    assert.equal(state.stats.hostileHits, 0, 'an obstructed shot is recorded as a miss');
  }
});

test('the yard runs hostile fire, flanking, ammunition conservation, focus and consumable effects', () => {
  const state = createCampaignState(); beginYard(state);
  const guard = actor(state, 'gauge-guard'), flanker = actor(state, 'chute-flanker');
  const flankerStart = { x: flanker.x, y: flanker.y };
  place(state, { x: guard.x - 62, y: guard.y });
  const focus = state.player.focus, fireTimer = guard.fireTimer;
  tick(state, 1, { focus: true });
  assert.ok(state.player.focus < focus);
  assert.ok(guard.fireTimer < fireTimer && guard.fireTimer > fireTimer - 0.6, 'focus slows real enemy time');
  tick(state, 3.2);
  assert.ok(state.player.hp < 100, 'an unobstructed guard shot damages Mara');
  assert.ok(state.stats.yardDamage > 0, 'the performance counter records real yard damage');
  assert.ok(distance(flanker, flankerStart) > 30 && flanker.routeIndex > 0, 'the flanker physically follows its separate route');
  const hurt = state.player.hp;
  useCampaignItem(state, 'tonic');
  assert.ok(state.player.hp > hurt);
  assert.equal(state.inventory.tonic, 0);
  useCampaignItem(state, 'tonic');
  assert.equal(state.inventory.tonic, 0, 'an empty item cannot grant another heal');
  useCampaignItem(state, 'coffee');
  assert.equal(state.inventory.coffee, 0);
  place(state, { x: 500, y: 500 });
  for (let shot = 0; shot < 6; shot++) { shootCampaign(state, 550, 500); tick(state, 0.4); }
  assert.equal(state.player.ammo, 0);
  assert.equal(state.stats.shots, 6);
  shootCampaign(state, 550, 500);
  assert.equal(state.stats.shots, 6, 'an empty cylinder cannot fire');
  const reserve = state.player.reserve;
  reloadCampaign(state);
  assert.equal(state.player.ammo, 0, 'reload is timed rather than an instant grant');
  tick(state, 1.8);
  assert.equal(state.player.ammo, 6);
  assert.equal(state.player.reserve, reserve - 6);
});

test('station supply props require proximity and an explicit once-only pickup', () => {
  const state = createCampaignState(); winYard(state);
  const item = state.supplies.find(value => value.id === 'blankets');
  place(state, item); tick(state, 0.1);
  assert.equal(item.collected, false, 'walking onto a supply is not collecting it');
  assert.equal(state.inventory.blankets, 0);
  place(state, { x: 500, y: 500 }); interactCampaign(state, 'pickup:blankets');
  assert.equal(item.collected, false, 'collection cannot occur remotely');
  pickup(state, 'blankets'); pickup(state, 'blankets');
  assert.equal(item.collected, true);
  assert.equal(state.inventory.blankets, 1);
  place(state, { x: 1180, y: 760 }); interactCampaign(state, 'investigate-coal');
  assert.equal(state.mission.stage, 4, 'the coal scene requires fuel and food as well as blankets');
});

test('consumables reduce actual recovered supplies while preserving the final essential food serving', () => {
  const state = createCampaignState(); winYard(state);
  pickup(state, 'oats'); pickup(state, 'broth');
  place(state, state.horse);
  useCampaignItem(state, 'oats'); useCampaignItem(state, 'oats');
  assert.equal(state.inventory.oats, 0);
  assert.equal(state.inventory.broth, 2);
  tick(state, 0.1, { mx: 1, sprint: true }); useCampaignItem(state, 'broth');
  assert.equal(state.inventory.broth, 1);
  tick(state, 0.1, { mx: 1, sprint: true }); useCampaignItem(state, 'broth');
  assert.equal(state.inventory.broth, 1, 'the last serving remains available for actual stove delivery');
  assert.ok(state.player.stamina < 100, 'the refused serving does not still grant its effect');
  const horse = { x: state.horse.x, y: state.horse.y };
  place(state, { x: horse.x + 180, y: horse.y });
  whistleCampaign(state); tick(state, 1);
  assert.ok(state.horse.follow && !state.horse.hitched);
  assert.ok(distance(state.horse, state.player) < 100, 'a real owned mount moves toward the whistle');
});

test('the coal ambush makes disarm, melee proximity and equipment recovery mandatory', () => {
  const state = createCampaignState(); reachAmbush(state);
  const shots = state.stats.shots;
  shootCampaign(state, actor(state, 'pavel').x, actor(state, 'pavel').y);
  assert.equal(state.stats.shots, shots, 'the disarmed revolver cannot fire');
  interactCampaign(state, 'pickup:weapon'); interactCampaign(state, 'pickup:token');
  assert.equal(state.player.weaponOwned, false, 'loose equipment is gated until Pavel is subdued');
  chooseCampaign(state, 'release-pavel');
  assert.equal(state.flags.pavelChoice, null);
  place(state, { x: 1000, y: 600 });
  campaignAction(state, 'block'); campaignAction(state, 'shove'); campaignAction(state, 'restrain');
  assert.equal(state.flags.blocked, false, 'melee actions require proximity');
  place(state, actor(state, 'pavel'), 25);
  settlePavel(state, 'bind');
  const token = state.inventory.token;
  place(state, state.dropped.token); interactCampaign(state, 'pickup:token');
  assert.equal(state.inventory.token, token, 'the dropped token cannot be duplicated');
});

test('Copper reacts to gunfire and rushing but can still be calmed, led and owned exactly once', () => {
  const state = createCampaignState(); reachAmbush(state); settlePavel(state);
  const copper = state.animals.find(value => value.id === 'copper');
  place(state, { x: copper.x - 60, y: copper.y });
  campaignAction(state, 'draw');
  interactCampaign(state, 'speak-copper');
  assert.equal(state.flags.copperSpoken, false, 'the drawn weapon must be holstered first');
  campaignAction(state, 'holster');
  interactCampaign(state, 'speak-copper');
  for (let count = 0; copper.fear > 40 && count < 5; count++) interactCampaign(state, 'calm-copper');
  assert.ok(copper.fear <= 40, 'the public calming actions settle Copper');
  const fear = copper.fear;
  shootCampaign(state, copper.x - 80, copper.y - 100); tick(state, 0.4);
  assert.ok(copper.fear > fear);
  assert.equal(state.flags.copperCalmed, false, 'gunfire reverses the settled state');
  shootCampaign(state, copper.x - 60, copper.y - 100); tick(state, 0.4);
  campaignAction(state, 'holster');
  place(state, { x: copper.x - 20, y: copper.y });
  const health = state.player.hp;
  tick(state, 0.05, { mx: 1, sprint: true });
  assert.ok(state.player.hp < health, 'rushing a frightened mare causes recoverable knockback');
  assert.equal(state.failure, null);
  gainCopper(state);
  assert.equal(state.horse.ridingUnlocked, false);
  assert.equal(state.horse.careUnlocked, false);
  assert.equal(state.horse.storageUnlocked, false);
  const oats = state.inventory.oats;
  place(state, state.horse); interactCampaign(state, 'mount'); useCampaignItem(state, 'oats');
  assert.equal(state.player.mounted, false, 'Copper riding waits for safe camp return');
  assert.equal(state.inventory.oats, oats, 'Copper care waits for safe camp return');
});

function assertSnapshotRestored(state, expected, deaths) {
  for (const key of Object.keys(expected)) {
    if (['notices', 'dialog', 'failure', 'stats'].includes(key)) continue;
    assert.deepEqual(state[key], expected[key], `checkpoint restores ${key}`);
  }
  assert.deepEqual({ ...state.stats, deaths: expected.stats.deaths }, expected.stats);
  assert.equal(state.stats.deaths, deaths);
  assert.equal(state.failure, null);
  assert.equal(state.dialog, null);
}

test('every reached checkpoint restores the complete actor, inventory, world and timer snapshot after a fall', () => {
  const state = createCampaignState();
  const check = () => {
    const expected = structuredClone(state.checkpoint.data), label = state.checkpoint.label;
    // Inject a lethal health event to exercise recovery at safe scenes that have no enemies.
    state.player.hp = 0; stepCampaign(state, 0.05);
    assert.ok(state.failure, `the failure is readable at ${label}`);
    const deaths = state.stats.deaths;
    choose(state, 'retry');
    assertSnapshotRestored(state, expected, deaths);
  };
  check();
  acceptJourney(state); check();
  followWire(state);
  atProp(state, 'hitch'); interactCampaign(state, 'hitch');
  atProp(state, 'cover-culvert'); interactCampaign(state, 'cover-culvert');
  speak(state, 'tomas'); choose(state, 'company-message'); waitForThreat(state); choose(state, 'stand-ground'); check();
  shootGuard(state, 'gauge-guard'); shootGuard(state, 'chute-flanker');
  place(state, actor(state, 'voss'), 25); interactCampaign(state, 'capture-voss');
  for (const id of essentials) pickup(state, id);
  place(state, { x: 1180, y: 760 }); interactCampaign(state, 'investigate-coal'); check();
  assert.equal(state.flags.coalAmbushed, false, 'the coal checkpoint predates disarm');
  interactCampaign(state, 'investigate-coal'); settlePavel(state, 'kill'); check();
  gainCopper(state); check();
  rescue(state, 'preserve-log'); check();
  returnToKiln(state); check();
  assert.equal(state.mission.completed, true, 'a retry of the completed checkpoint preserves the permanent result');
});

test('the relay fuse, pressure/fire injury and abandonment are real fail-and-retry paths', () => {
  const state = createCampaignState(); reachAmbush(state); settlePavel(state); gainCopper(state);
  const checkpoint = structuredClone(state.checkpoint.data);
  tick(state, 185);
  assert.match(state.failure?.reason ?? '', /fuse/);
  campaignAction(state, 'retry');
  assertSnapshotRestored(state, checkpoint, 1);
  atProp(state, 'speaking-tube'); interactCampaign(state, 'speaking-tube'); choose(state, 'carry-gideon-first');
  place(state, { x: 1380, y: 440 });
  const hp = state.player.hp;
  tick(state, 0.8);
  assert.ok(state.player.hp < hp, 'the active steam fire injures Mara');
  place(state, prop('stove-store')); tick(state, 0.05);
  assert.match(state.failure?.reason ?? '', /abandoned/);
  campaignAction(state, 'retry');
  assertSnapshotRestored(state, checkpoint, 2);
  assert.equal(actor(state, 'ada').hp, 100);
  assert.equal(actor(state, 'gideon').hp, 60);
  assert.equal(state.flags.adaIdentified, false);
  identifyAda(state, 'carry-gideon-first');
  place(state, actor(state, 'gideon')); interactCampaign(state, 'carry-gideon');
  tick(state, 51);
  assert.ok(state.failure, 'a real exhausted carry fails before the fuse limit');
  assert.equal(state.player.stamina, 0);
  assert.match(state.failure.reason, /Gideon/, 'the failure identifies the person being carried');
  campaignAction(state, 'retry');
  assertSnapshotRestored(state, checkpoint, 3);
});

test('deliberate projectile attacks on protected people and all essential mounts cause readable failures', () => {
  for (const id of ['tomas', 'inez', 'ada', 'gideon', 'copper', 'juniper', 'tomas-mount']) {
    const state = createCampaignState(); beginYard(state);
    const target = [...state.npcs, ...state.animals, state.horse, ...state.mounts].find(value => value.id === id);
    Object.assign(target, { x: 500, y: 500 });
    place(state, { x: 455, y: 500 });
    shootCampaign(state, target.x, target.y); tick(state, 0.1);
    assert.ok(state.failure, `${id} is protected from deliberate player fire`);
    assert.match(state.failure.reason, /attacked|shot/);
    campaignAction(state, 'retry');
    assert.equal(state.failure, null);
    assert.ok([...state.npcs, ...state.animals, state.horse, ...state.mounts].find(value => value.id === id).hp > 0);
  }
});

test('the essential riding mounts cannot die without a protected mission failure', () => {
  for (const id of ['juniper', 'tomas-mount', 'copper']) {
    const state = createCampaignState(); acceptJourney(state);
    const mount = id === 'juniper' ? state.horse : id === 'copper' ? state.animals.find(value => value.id === id) : state.mounts.find(value => value.id === id);
    mount.hp = 0; stepCampaign(state, 0.05);
    assert.ok(state.failure, `essential mount ${id} death cannot leave the mission running`);
    campaignAction(state, 'retry');
    const restored = id === 'juniper' ? state.horse : id === 'copper' ? state.animals.find(value => value.id === id) : state.mounts.find(value => value.id === id);
    assert.equal(restored.hp, 100);
  }
});

test('safe saves restore each real stage and reject corrupted actors, supplies, choices and inventory', () => {
  const state = createCampaignState();
  const check = () => {
    const restored = restoreCampaign(serializeCampaign(state));
    assert.ok(restored, `stage ${state.mission.stage} has a valid save`);
    for (const key of ['mission', 'player', 'horse', 'npcs', 'enemies', 'animals', 'inventory', 'supplies', 'dropped', 'flags', 'worldChanges', 'timers', 'camp', 'companions', 'checkpoint']) assert.deepEqual(restored[key], state[key], `save restores ${key}`);
  };
  check(); acceptJourney(state); check(); followWire(state); check();
  atProp(state, 'hitch'); interactCampaign(state, 'hitch'); atProp(state, 'cover-winch'); interactCampaign(state, 'cover-winch');
  speak(state, 'tomas'); choose(state, 'company-message'); check(); waitForThreat(state); choose(state, 'stand-ground'); check();
  shootGuard(state, 'gauge-guard'); shootGuard(state, 'chute-flanker'); check();
  for (const id of essentials) pickup(state, id);
  place(state, { x: 1180, y: 760 }); interactCampaign(state, 'investigate-coal'); check();
  settlePavel(state, 'bind'); check(); gainCopper(state); check(); rescue(state, 'preserve-log'); check(); returnToKiln(state); check();
  for (const [index, corrupt] of [
    s => { s.player.x = NaN; }, s => { s.npcs[0].hp = -5; },
    s => { s.inventory.blankets = -1; }, s => { s.inventory.oats = 1.5; },
    s => { s.supplies[0].delivered = 1000; }, s => { s.enemies.push({ ...s.enemies[0] }); },
    s => { s.npcs = s.npcs.filter(value => value.id !== 'ada'); },
    s => { s.flags.pavelChoice = 'invented'; }, s => { s.worldChanges.pressureReleased = false; },
    s => { s.dialog = { text: 'corrupt', speaker: 'unknown', choices: [{ id: 'invented', label: 'skip' }] }; },
    s => { delete s.mounts; }, s => { s.mounts = []; },
    s => { delete s.companions.ada; }, s => { delete s.companions.gideon; },
    s => { delete s.flags.adaRouteIndex; }, s => { delete s.timers.crisis; },
    s => { s.horse.pack = { coffee: -1 }; }, s => { s.horse.pack = { invented: 1 }; },
  ].entries()) {
    const broken = structuredClone(state); corrupt(broken);
    assert.equal(restoreCampaign(broken) === null, true, `malformed campaign save case ${index} is rejected without patching progression`);
  }
});

test('post-return Copper care and pack storage transfer actual counts and respect proximity', () => {
  const state = completeOpening('bind', 'preserve-log');
  assert.equal(state.horse.ridingUnlocked, true);
  assert.equal(state.horse.careUnlocked, true);
  assert.equal(state.horse.storageUnlocked, true);
  const coffee = state.inventory.coffee;
  place(state, { x: 500, y: 500 }); storeCampaignItem(state, 'coffee');
  assert.equal(state.inventory.coffee, coffee, 'storage cannot occur from afar');
  place(state, state.horse); storeCampaignItem(state, 'coffee');
  assert.equal(state.inventory.coffee, coffee - 1);
  assert.equal(state.horse.pack.coffee, 1);
  storeCampaignItem(state, 'coffee');
  assert.equal(state.horse.pack.coffee, 1, 'an empty satchel cannot duplicate a packed item');
  takeCampaignItem(state, 'coffee'); takeCampaignItem(state, 'coffee');
  assert.equal(state.inventory.coffee, coffee);
  assert.equal(state.horse.pack.coffee, 0);
  const food = state.camp.food;
  atProp(state, 'stove-store');
  assert.equal(getCampaignInteraction(state)?.id, 'camp-oats', 'the real food offer is not masked by completed mission delivery');
  interactCampaign(state);
  assert.equal(state.camp.food, food - 1);
  assert.equal(state.inventory.oats, 1);
  place(state, state.horse); useCampaignItem(state, 'oats');
  assert.equal(state.inventory.oats, 0);
  assert.ok(state.horse.bond > 1);
  interactCampaign(state, 'mount');
  assert.equal(state.player.mounted, true);
  assert.ok(restoreCampaign(serializeCampaign(state)), 'care and pack state remains serializable');
});

test('a save during the actual Gideon carry preserves the linked person, equipment, fire and fuse', () => {
  const state = createCampaignState(); reachAmbush(state); settlePavel(state, 'bind'); gainCopper(state);
  identifyAda(state, 'carry-gideon-first');
  place(state, actor(state, 'gideon')); interactCampaign(state, 'carry-gideon');
  walkTo(state, { x: 1360, y: 345 });
  const restored = restoreCampaign(serializeCampaign(state));
  assert.ok(restored);
  assert.equal(restored.player.carrying, 'gideon');
  assert.equal(actor(restored, 'gideon').carried, true);
  for (const key of ['player', 'npcs', 'enemies', 'horse', 'inventory', 'worldChanges', 'timers', 'flags', 'checkpoint']) assert.deepEqual(restored[key], state[key], `mid-carry save preserves ${key}`);
  interactCampaign(restored, 'set-down-gideon');
  assert.equal(restored.player.carrying, null);
  assert.equal(actor(restored, 'gideon').carried, false);
  interactCampaign(restored, 'carry-gideon');
  for (const point of SNOWBOUND_WORLD.rescueRoute.slice(1)) walkTo(restored, point);
  assert.equal(restored.flags.gideonSafe, true, 'the restored carry can finish through ordinary movement');
  escortToSafety(restored); tick(restored, 0.1);
  assert.equal(restored.mission.stage, 8);
});

test('returning to the damaged station in free roam preserves destruction and its completed reward record', () => {
  const state = completeOpening('kill', 'preserve-log', 'capture');
  const permanent = { camp: structuredClone(state.camp), inventory: structuredClone(state.inventory), flags: structuredClone(state.flags), world: structuredClone(state.worldChanges) };
  place(state, state.horse); interactCampaign(state, 'mount');
  for (const point of [{ x: 350, y: 1200 }, { x: 350, y: 970 }, { x: 600, y: 970 }, { x: 1000, y: 780 }, { x: 1100, y: 650 }, prop('safe-walkway')]) walkTo(state, point);
  assert.equal(state.worldChanges.boilerDestroyed, true);
  assert.equal(state.worldChanges.fireActive, false);
  assert.equal(state.mission.completed, true);
  assert.deepEqual({ camp: state.camp, inventory: state.inventory, flags: state.flags, world: state.worldChanges }, permanent, 'visiting the aftermath does not reset the world or award supplies again');
});

test('a complete replay and replay save never replace the canonical world, choices or supplies', () => {
  const state = completeOpening('release', 'preserve-log', 'capture');
  const canonical = structuredClone(state);
  campaignAction(state, 'replay');
  assert.equal(state.mission.stage, 0);
  assert.ok(state.replayCanonical?.mission.completed);
  reachAmbush(state, 'escape'); settlePavel(state, 'kill'); gainCopper(state); rescue(state, 'carry-gideon-first'); returnToKiln(state);
  assert.equal(state.flags.pavelChoice, 'kill');
  assert.equal(state.worldChanges.vossFutureCheckpoint, true);
  const suspended = restoreCampaign(serializeCampaign(state));
  assert.ok(suspended?.replayCanonical, 'saving replay preserves the separate permanent snapshot');
  campaignAction(suspended, 'finish-replay');
  assert.equal(suspended.replayCanonical, null);
  for (const key of Object.keys(canonical)) {
    if (['checkpoint', 'notices', 'replayCanonical'].includes(key)) continue;
    assert.deepEqual(suspended[key], canonical[key], `replay cannot replace canonical ${key}`);
  }
  const newStory = createCampaignState(); campaignAction(newStory, 'replay');
  assert.equal(newStory.replayCanonical, null, 'replay is unavailable before first completion');
  campaignAction(suspended, 'replay'); restartCampaign(suspended);
  assert.ok(suspended.replayCanonical, 'restart inside replay keeps its permanent journey');
  campaignAction(suspended, 'finish-replay');
  assert.equal(suspended.flags.pavelChoice, 'release');
  assert.equal(suspended.worldChanges.boilerDestroyed, true);
  campaignAction(suspended, 'replay'); beginYard(suspended);
  const tomas = actor(suspended, 'tomas'); Object.assign(tomas, { x: 500, y: 500 });
  place(suspended, { x: 455, y: 500 }); shootCampaign(suspended, tomas.x, tomas.y); tick(suspended, 0.1);
  assert.ok(suspended.failure, 'a real protected-actor attack can fail a replay');
  const failedReplay = restoreCampaign(serializeCampaign(suspended));
  assert.ok(failedReplay, 'the authored finish-replay choice is accepted by both dialog validators when reloading a failure');
  assert.ok(failedReplay.dialog.choices.some(choice => choice.id === 'finish-replay'));
  choose(failedReplay, 'finish-replay');
  assert.equal(failedReplay.mission.completed, true);
  assert.deepEqual(failedReplay.camp, canonical.camp);
  assert.deepEqual(failedReplay.inventory, canonical.inventory);
  const oldVersionOne = JSON.parse(serializeCampaign(suspended));
  oldVersionOne.dialog.choices = oldVersionOne.dialog.choices.filter(choice => choice.id !== 'finish-replay');
  assert.equal(oldVersionOne.version, 1);
  assert.equal(oldVersionOne.dialog.choices.length, 2, 'the fixture models the previously valid version-1 retry/restart replay failure');
  const upgradedFailure = restoreCampaign(oldVersionOne);
  assert.ok(upgradedFailure, 'an older version-1 suspended replay remains loadable');
  assert.ok(upgradedFailure.dialog.choices.some(choice => choice.id === 'finish-replay'), 'the restored older failure gains the safe permanent-world exit');
  choose(upgradedFailure, 'finish-replay');
  assert.equal(upgradedFailure.failure, null);
  assert.equal(upgradedFailure.flags.pavelChoice, canonical.flags.pavelChoice);
  assert.deepEqual(upgradedFailure.worldChanges, canonical.worldChanges);
  assert.deepEqual(upgradedFailure.camp, canonical.camp);
  const badLegacy = structuredClone(oldVersionOne);
  badLegacy.dialog.choices[1].id = 'invented';
  assert.equal(restoreCampaign(badLegacy), null, 'legacy migration does not make arbitrary dialogue actions valid');
  choose(suspended, 'finish-replay');
  assert.equal(suspended.failure, null);
  assert.equal(suspended.mission.completed, true);
  assert.equal(suspended.flags.pavelChoice, 'release');
  assert.deepEqual(suspended.camp, canonical.camp, 'exiting a failed replay retains the permanent camp');
  assert.deepEqual(suspended.inventory, canonical.inventory, 'exiting a failed replay retains permanent inventory');
});
