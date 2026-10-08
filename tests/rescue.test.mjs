import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Journey from '../src/campaign-journey.js';
import { NORTH_CUTTING_WORLD as WORLD, RESCUE_STAGES } from '../content/campaign/north-cutting.js';

const OPENING = 'snowbound-the-last-warm-light';
const RESCUE = 'snowbound-a-voice-under-ice';
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/opening-v1-${name}.json`, import.meta.url), 'utf8'));
const record = state => state.campaign.missions[RESCUE];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function load(name = 'complete') {
  const state = Journey.restoreCampaign(fixture(name));
  assert.ok(state, `actual ${name} public-control opening Save migrates`);
  return state;
}
function place(state, point, offset = 0) {
  // Proximity/elevation fixtures are distinct from ordinary-control browser proof.
  Object.assign(state.player, { x: point.x, y: point.y + offset, z: point.z || 0, vx: 0, vy: 0 });
}
function choose(state, id) {
  assert.ok(state.dialog?.choices.some(choice => choice.id === id), `dialog actually offers ${id}`);
  Journey.chooseCampaign(state, id);
}
function offered(state, id) {
  const item = Journey.getCampaignInteractions(state).find(item => item.id === id);
  assert.ok(item, `${id} is actually offered at current proximity, height and progress: ${JSON.stringify({ player: { x: state.player.x, y: state.player.y, z: state.player.z, carrying: state.player.carrying }, inez: { x: state.entities.inez.x, y: state.entities.inez.y, z: state.entities.inez.z }, stage: state.mission.stage, offers: Journey.getCampaignInteractions(state).map(offer => offer.id), failure: state.failure, notices: state.notices.map(notice => notice.text) })}`);
  return item;
}
function interact(state, id) { offered(state, id); Journey.interactCampaign(state, id); }
function tick(state, seconds, input = {}) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) Journey.stepCampaign(state, Math.min(0.05, seconds - elapsed), input);
}
function walk(state, target, input = {}) {
  let frames = 0;
  while (dist(state.player, target) > 7 && frames++ < 2000) {
    const length = dist(state.player, target);
    Journey.stepCampaign(state, 0.05, { ...input, mx: (target.x - state.player.x) / length, my: (target.y - state.player.y) / length });
    assert.equal(state.failure, null, `movement toward ${target.x},${target.y} remains safe`);
  }
  assert.ok(dist(state.player, target) <= 7, `actual movement reached ${target.x},${target.y}`);
}
function accept(state) {
  place(state, state.entities.elin);
  assert.equal(Journey.getCampaignInteraction(state)?.id, 'rescue:elin', 'Elin is reachable through the ordinary first nearby offer');
  Journey.interactCampaign(state);
  assert.equal(state.dialog?.id, 'rescue-briefing');
  choose(state, 'accept-rescue');
  assert.equal(state.campaign.activeMissionId, RESCUE);
  assert.equal(state.mission.stage, 1);
}

const branches = [
  ['complete', 'bind', 'carry-gideon-first'], ['bind-log', 'bind', 'preserve-log'],
  ['release-carry', 'release', 'carry-gideon-first'], ['release-log', 'release', 'preserve-log'],
  ['kill-carry', 'kill', 'carry-gideon-first'], ['kill-log', 'kill', 'preserve-log'],
];
for (const [name, fate, priority] of branches) {
  test(`rescue briefing/kit is available after actual Pavel ${fate}, ${priority} opening completion`, () => {
    const state = load(name);
    const historicalOpening = clone(state.campaign.missions[OPENING]);
    const stock = clone(state.camp);
    const copper = { pack: clone(state.horse.pack), hp: state.horse.hp, bond: state.horse.bond, owned: state.horse.owned };
    assert.equal(state.flags.pavelChoice, fate);
    assert.equal(state.flags.rescuePriority, priority);
    place(state, state.entities.elin); Journey.interactCampaign(state);
    assert.equal(state.dialog?.id, 'rescue-briefing');
    assert.match(state.dialog.text, priority === 'preserve-log' ? /dispatch time from the station log/ : /memory and the yard testimony/, 'briefing reflects the actual recovered-log branch');
    choose(state, 'accept-rescue');
    assert.equal(state.campaign.activeMissionId, RESCUE);
    assert.equal(state.mission.stage, 1);
    assert.equal(RESCUE_STAGES.length, 10);
    assert.equal(state.mission.completed, false);
    assert.deepEqual(state.campaign.missions[OPENING], historicalOpening, 'starting the rescue cannot rewrite the historical opening record');
    assert.deepEqual(state.camp, stock, 'lawful starting supplies come from an explicit kit, not deleted or invented camp stock');
    assert.deepEqual({ pack: state.horse.pack, hp: state.horse.hp, bond: state.horse.bond, owned: state.horse.owned }, copper);
    assert.equal(state.inventory.warmRation, 1);
    assert.equal(state.inventory.rescueDressing, 1);
    assert.equal(state.inventory.rescueRope, 1);
    assert.equal(state.inventory.signalCartridge, 1);
    assert.equal(record(state).rescue.flask.servings, 1);
    const gun = state.weapons['coach-gun'];
    assert.equal(gun.owner, 'community-rescue-chest');
    assert.equal(gun.loanMissionId, RESCUE);
    assert.equal(gun.ammo, 2); assert.equal(gun.reserve, 8);
    assert.equal(gun.location, 'saddle'); assert.equal(gun.rackMountId, 'copper');
    const earned = { inventory: clone(state.inventory), weapons: clone(state.weapons), transactions: clone(record(state).transactions) };
    Journey.chooseCampaign(state, 'accept-rescue');
    Journey.interactCampaign(state, 'rescue:elin');
    assert.deepEqual({ inventory: state.inventory, weapons: state.weapons, transactions: record(state).transactions }, earned, 'repeated unavailable briefing inputs cannot grant a second kit or gun');
    assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'a prepared mission suspends through the v2 codec');
    for (const id of ['deliver:silas', 'journal:rescue', 'retrieve:coach-gun', 'pickup:dispatch-case', 'return:kiln']) Journey.interactCampaign(state, id);
    assert.equal(state.mission.stage, 1, 'late IDs cannot bypass actual offers or prerequisites');
    assert.equal(state.mission.completed, false);
  });
}

test('an incomplete opening keeps the rescue locked and cannot acquire emergency equipment', () => {
  const state = load('departure');
  place(state, WORLD.camp.chest);
  Journey.interactCampaign(state, 'rescue:elin'); Journey.chooseCampaign(state, 'accept-rescue');
  Journey.interactCampaign(state, 'inspect:coach-case');
  assert.equal(state.campaign.activeMissionId, OPENING);
  assert.equal(record(state).status, 'locked');
  assert.equal(state.weapons['coach-gun'], undefined);
  assert.equal(state.inventory.warmRation || 0, 0);
  assert.equal(state.region, 'snowbound');
});

test('mission restart restores its recorded entry and grants kit once through a fresh accepted briefing', () => {
  const state = load(); accept(state);
  const oldOpening = clone(state.campaign.missions[OPENING]);
  Journey.restartCampaign(state);
  assert.equal(state.campaign.activeMissionId, RESCUE);
  assert.equal(state.mission.stage, 0);
  assert.equal(state.weapons['coach-gun'], undefined);
  assert.equal(state.inventory.warmRation || 0, 0);
  assert.deepEqual(state.campaign.missions[OPENING], oldOpening);
  accept(state);
  assert.equal(state.inventory.warmRation, 1);
  assert.equal(Object.values(state.weapons).filter(weapon => weapon.kind === 'coach-gun').length, 1);
  assert.equal(Object.keys(record(state).transactions).length, 7);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

function depart(state) {
  if (state.campaign.activeMissionId !== RESCUE || state.mission.stage === 0) accept(state);
  assert.equal(state.mission.stage, 1);
  walk(state, state.entities.tomas); interact(state, 'brief:tomas'); choose(state, 'leave');
  walk(state, state.entities.inez); interact(state, 'brief:inez'); choose(state, 'leave');
  assert.equal(state.flags.tomasUrged, true); assert.equal(state.flags.inezVolunteered, true);
  walk(state, state.horse); interact(state, 'inspect:coach-case');
  interact(state, 'mount');
  assert.equal(state.player.mounted, true);
  for (const point of [{ x: 375, y: 970 }, { x: 600, y: 970 }, WORLD.camp.gate]) walk(state, point);
  for (let frames = 0; (!Journey.getCampaignInteractions(state).some(item => item.id === 'depart:north') || dist(state.player, state.entities.inez) > 140) && frames < 240; frames++) tick(state, 0.05);
  interact(state, 'depart:north');
  assert.equal(state.region, 'north-cutting', `offered departure must transition with both riders: ${JSON.stringify({ player: { x: state.player.x, y: state.player.y }, inez: { x: state.entities.inez.x, y: state.entities.inez.y }, thimble: { x: state.entities.thimble.x, y: state.entities.thimble.y, goal: state.entities.thimble.goal }, notice: state.notices.at(-1)?.text })}`);
  assert.equal(state.mission.stage, 2);
  assert.equal(state.entities.inez.regionId, 'north-cutting');
  assert.equal(state.entities.thimble.regionId, 'north-cutting');
  assert.equal(state.entities.elin.regionId, 'snowbound', 'camp residents stay in their own region');
}
function ashCamp(state) {
  depart(state);
  for (const point of WORLD.trail) walk(state, point);
  tick(state, 1);
  assert.equal(state.flags.routeIndex, WORLD.trail.length, 'player and companion physically visit the trail');
  interact(state, 'dismount');
  for (const id of ['ash-embers', 'bootprints', 'paper-wrapper']) {
    const point = WORLD.props.find(point => point.id === id);
    walk(state, point); interact(state, `inspect:${id}`);
  }
  assert.equal(state.mission.stage, 3);
}

test('the two mounts actually depart, follow the northern trail and confirm all three Ash camp clues', () => {
  const state = load();
  const copper = { pack: clone(state.horse.pack), bond: state.horse.bond };
  ashCamp(state);
  assert.deepEqual(state.horse.pack, copper.pack);
  assert.equal(state.horse.bond, copper.bond);
  assert.ok(state.stats.distance > 0);
  assert.ok(dist(state.player, state.entities.inez) < 160);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'the confirmed physical trail checkpoint suspends');
});

function shelf(state, pauseBeforeSignal = false) {
  ashCamp(state);
  walk(state, state.horse); interact(state, 'mount');
  for (const point of WORLD.searchRoute.slice(0, 2)) walk(state, point);
  walk(state, WORLD.props.find(point => point.id === 'ford-scrape'));
  interact(state, 'dismount'); interact(state, 'inspect:ford-scrape');
  Journey.whistleCampaign(state);
  walk(state, WORLD.props.find(point => point.id === 'ford-exit'));
  interact(state, 'inspect:ford-exit');
  assert.equal(state.mission.stage, 4);
  assert.equal(state.flags.evacuationAccount, true);
  tick(state, 1); walk(state, state.horse); interact(state, 'mount');
  for (const point of [...WORLD.searchRoute.slice(4, -1), { x: 1550, y: 730 }]) walk(state, point);
  interact(state, 'dismount'); walk(state, { x: 1550, y: 730 }); interact(state, 'inspect:lark'); choose(state, 'leave');
  if (pauseBeforeSignal) return;
  const ammo = state.weapons['mara-revolver'].ammo, reserve = state.weapons['mara-revolver'].reserve;
  interact(state, 'signal:silas'); tick(state, 2.2);
  assert.equal(state.flags.signalAnswered, true);
  assert.equal(state.weapons['mara-revolver'].ammo + state.weapons['mara-revolver'].reserve, Math.max(0, ammo + reserve - 1), 'normal signal spends one real round; empty weapon uses its reserved emergency cartridge');
  assert.equal(record(state).performance.shots, 0, 'signal cannot distort wolf accuracy');
  Journey.whistleCampaign(state);
  for (const point of [{ x: 1450, y: 730 }, WORLD.hitch]) walk(state, point);
  tick(state, 1); interact(state, 'hitch:mounts');
  for (let elapsed = 0; state.mission.stage === 4 && elapsed < 6; elapsed += 0.05) tick(state, 0.05);
  assert.equal(state.mission.stage, 5, 'both mounts physically finish the shelf parking before the climb unlocks');
  assert.equal(state.horse.hitched, true); assert.equal(state.entities.thimble.hitched, true);
  interact(state, 'retrieve:coach-gun');
  assert.equal(state.player.equippedWeaponId, 'coach-gun');
}
function traverse(state, id, seconds) {
  interact(state, id);
  assert.ok(record(state).traversal.player, `${id} starts timed physical traversal`);
  tick(state, 0.1);
  assert.ok(record(state).traversal.player, `${id} does not finish in a single input`);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), `suspended ${id} traversal round-trips`);
  tick(state, seconds);
  assert.equal(record(state).traversal.player, null, `${id} finishes through time`);
}
function reachSilas(state, provision = 'warm-ration', listen = true) {
  shelf(state);
  walk(state, WORLD.climbs[0].from);
  traverse(state, 'climb:first-ledge', 2.3);
  assert.equal(state.player.z, 36);
  assert.ok(state.player.stamina < 30, 'the authored first climb creates a genuine provision lesson');
  if (provision === 'warm-ration') {
    Journey.useCampaignItem(state, 'warmRation');
    assert.equal(state.inventory.warmRation, 0);
    assert.equal(record(state).choices.provision, 'warm-ration');
  } else if (provision === 'inez-flask') {
    waitNear(state, state.entities.inez, state.player, 75);
    interact(state, 'aid:inez-flask');
    assert.equal(record(state).rescue.flask.servings, 0);
    assert.equal(state.inventory.warmRation, 1);
    assert.equal(record(state).choices.provision, 'inez-flask');
  } else {
    interact(state, 'rest:ledge');
    assert.ok(record(state).timers.rest > 0);
    tick(state, 4.1);
    assert.equal(state.flags.recoveryRest, true);
    assert.equal(state.inventory.warmRation, 1);
    assert.equal(record(state).rescue.flask.servings, 1);
  }
  traverse(state, 'climb:second-ledge', 2.6);
  assert.equal(state.player.z, 72);
  traverse(state, 'brace:ice-lip', 2.5);
  traverse(state, 'crouch:low-arch', 1.9);
  interact(state, 'secure:arch-rope');
  walk(state, WORLD.climbs[2].from, { crouch: true });
  traverse(state, 'climb:recess-ledge', 2.9);
  assert.equal(state.mission.stage, 6);
  assert.equal(state.player.z, 108);
  walk(state, state.entities.silas);
  if (listen) { interact(state, 'listen:silas'); choose(state, 'leave'); }
  interact(state, 'inspect:silas-breathing'); interact(state, 'stabilize:silas');
  assert.equal(state.inventory.rescueDressing, 0);
  assert.equal(record(state).rescue.silas.stabilized, true);
  assert.equal(state.entities.lark.hp, 0);
}
function waitNear(state, actor, point, radius, seconds = 20) {
  for (let time = 0; (dist(actor, point) > radius || Math.abs((actor.z || 0) - (point.z || 0)) > 5) && time < seconds; time += 0.05) tick(state, 0.05);
  assert.ok(dist(actor, point) <= radius && Math.abs((actor.z || 0) - (point.z || 0)) <= 5, `${actor.id} physically arrives at ${point.x},${point.y},${point.z || 0}`);
}
function descend(state, recoverCase = true) {
  reachSilas(state);
  interact(state, 'carry:silas');
  assert.equal(state.player.carrying, 'silas');
  if (recoverCase) {
    walk(state, WORLD.restPad);
    waitNear(state, state.entities.inez, WORLD.restPad, 80);
    interact(state, 'secure:silas-at-rest-pad');
    assert.equal(state.player.carrying, null);
    assert.deepEqual(state.entities.silas.attachment, { type: 'rest', targetId: WORLD.restPad.id, regionId: 'north-cutting' });
    walk(state, WORLD.dispatchCase); interact(state, 'pickup:dispatch-case');
    assert.equal(state.inventory.dispatchCase, 1);
    const trust = record(state).rescue.silas.trust;
    Journey.interactCampaign(state, 'pickup:dispatch-case');
    assert.equal(state.inventory.dispatchCase, 1); assert.equal(record(state).rescue.silas.trust, trust);
    assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'secured-rest attachment and actual case instance suspend');
    interact(state, 'carry:silas'); assert.equal(state.player.carrying, 'silas');
  }
  walk(state, WORLD.descents[0].from);
  for (const edge of WORLD.descents) {
    waitNear(state, state.entities.inez, edge.from, 45);
    interact(state, `handoff:${edge.id}`);
    assert.equal(state.player.carrying, null);
    assert.equal(state.entities.inez.carrying, 'silas');
    assert.equal(state.entities.silas.attachment.targetId, 'inez');
    assert.ok(record(state).traversal.inez);
    tick(state, edge.duration + 0.1);
    assert.equal(record(state).traversal.inez, null);
    traverse(state, `climb:${edge.id}`, edge.duration + 0.1);
    interact(state, 'receive:silas');
    assert.equal(state.player.carrying, 'silas');
    assert.equal(state.entities.inez.carrying, null);
    assert.equal(state.entities.silas.attachment.targetId, 'mara');
  }
  assert.equal(state.flags.descentIndex, 3);
  assert.equal(state.mission.stage, 7);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'three actual handoffs produce a valid loading checkpoint');
}

test('actual ford/signal/climb/brace/crawl, secured case and three timed carrier handoffs reach the loading spur', () => {
  const state = load();
  descend(state);
  assert.equal(state.flags.caseCollected, true);
  assert.equal(record(state).rescue.silas.trust, 3, 'listening and safely recovering the case are distinct exactly-once trust changes');
  assert.equal(state.inventory.rescueRope, 1, 'securing rope does not invent a second consumed/regranted copy');
});

const preparedMutations = {
  'missing loaned gun after its grant': data => { delete data.weapons['coach-gun']; },
  'premature gun ownership reward': data => { data.weapons['coach-gun'].owner = 'mara'; data.weapons['coach-gun'].loanMissionId = null; },
  'duplicated kit inventory without a grant': data => { data.inventory.warmRation = 2; },
  'wrong rescued courier category': data => { data.entities.silas.category = 'enemy'; },
  'wrong wolf category': data => { data.entities['pack-flanker'].category = 'npc'; },
  'unknown clinical transaction': data => { data.campaign.missions[RESCUE].transactions[`${RESCUE}:invented`] = { amount: 1, completed: true }; },
  'wrong grant amount': data => { data.campaign.missions[RESCUE].transactions[`${RESCUE}:grant:rescue-dressing`].amount = 2; },
  'missing clinical injury record': data => { delete data.campaign.missions[RESCUE].rescue.silas.injury; },
  'invalid clinical exposure': data => { data.campaign.missions[RESCUE].rescue.silas.exposure = -1; },
  'carrying Silas before the northern search': data => {
    data.entities.silas.attachment = { type: 'carried', targetId: 'mara' }; data.entities.silas.regionId = null;
    data.entities.mara.carrying = 'silas'; data.regions['north-cutting'].residentIds = data.regions['north-cutting'].residentIds.filter(id => id !== 'silas');
  },
  'impossible camp player height': data => { data.entities.mara.z = 72; },
  'invented rescue dialogue choices': data => { data.dialog = { id: 'rescue-urge', speaker: 'Tomas Reed', text: 'Forged', choices: [{ id: 'accept-rescue', label: 'Skip the search' }] }; },
};
for (const [name, mutate] of Object.entries(preparedMutations)) {
  test(`strict rescue restore rejects ${name}`, () => {
    const state = load(); accept(state);
    const data = JSON.parse(Journey.serializeCampaign(state)); mutate(data);
    assert.ok(!Journey.restoreCampaign(data), `restore must reject ${name}`);
  });
}

test('equipping/slung traversal has one mission-owned wire state and normal prior consumables still work', () => {
  const state = load(); accept(state);
  const hp = state.player.hp, tonics = state.inventory.tonic;
  Journey.useCampaignItem(state, 'tonic');
  assert.equal(state.player.hp, Math.min(100, hp + 55));
  assert.equal(state.inventory.tonic, tonics - 1);
  const preserved = clone(state.inventory);
  Journey.useCampaignItem(state, 'rescueDressing'); Journey.useCampaignItem(state, 'signalCartridge');
  assert.deepEqual(state.inventory, preserved, 'reserved aid/signal supplies cannot be consumed by generic shortcuts');
  const route = load(); shelf(route); walk(route, WORLD.climbs[0].from); interact(route, 'climb:first-ledge'); tick(route, 0.1);
  const data = JSON.parse(Journey.serializeCampaign(route));
  assert.equal(Object.hasOwn(data.entities.mara, 'traversal'), false, 'actor traversal is a derived view, not a second authoritative wire state');
  assert.ok(data.campaign.missions[RESCUE].traversal.player);
  const restored = Journey.restoreCampaign(data);
  assert.ok(restored);
  assert.strictEqual(restored.player.traversal, record(restored).traversal.player);
});

function fightFixture(state, wave) {
  // Controlled enemy positions isolate real projectile/trigger accounting from
  // the AI's optional flanking route. Public control proof uses unaltered actors.
  Journey.campaignAction(state, 'draw');
  for (const ai of record(state).predators.filter(wolf => wolf.wave === wave)) {
    assert.notEqual(ai.phase, 'dormant', `wave ${wave} was activated by actual mission progress`);
    for (let shot = 0; ai.phase !== 'dead' && shot < 5; shot++) {
      if (!state.player.ammo) { Journey.reloadCampaign(state); tick(state, 1.9); }
      const wolf = state.entities[ai.id];
      Object.assign(wolf, { x: state.player.x + 85, y: state.player.y + 75, z: 0 });
      Journey.shootCampaign(state, wolf.x, wolf.y); tick(state, 0.7, { focus: true });
      assert.equal(state.failure, null, 'real wolf projectiles avoid protected actors');
    }
    assert.equal(ai.phase, 'dead', `${ai.id} dies from actual ammunition and projectile damage`);
    assert.equal(state.entities[ai.id].hp, 0);
  }
}
function loadedPassenger(state, recoverCase = true) {
  descend(state, recoverCase);
  waitNear(state, state.entities.inez, WORLD.loadingSpur, 60);
  interact(state, 'handoff:loading');
  assert.equal(state.entities.silas.attachment.targetId, 'inez');
  const early = clone(state.entities.silas.attachment);
  Journey.interactCampaign(state, 'load:silas');
  assert.deepEqual(state.entities.silas.attachment, early, 'absent loading offer cannot bypass Inez’s physical carry');
  for (const point of [{ x: 1400, y: 650 }, { x: 1400, y: 745 }, WORLD.diversion]) walk(state, point);
  interact(state, 'divert:wolves');
  walk(state, { x: 1400, y: 745 }); fightFixture(state, 0);
  for (let frame = 0; state.flags.loadingIndex < WORLD.loadingRoute.length && frame < 400; frame++) tick(state, 0.05);
  assert.ok(record(state).rescue.loadingDistance >= 100, 'Inez covers the authored hundred-unit loaded route');
  walk(state, state.entities.thimble); interact(state, 'load:silas');
  assert.deepEqual(state.entities.silas.attachment, { type: 'passenger', targetId: 'thimble', strap: false });
  assert.equal(state.entities.inez.carrying, null);
  const unstrapped = Journey.restoreCampaign(Journey.serializeCampaign(state));
  assert.ok(unstrapped, 'suspended unstrapped saddle lift is a distinct valid state');
  interact(state, 'strap:silas');
  assert.equal(state.entities.silas.attachment.strap, true);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'strapped passenger suspends without a second body');
  walk(state, state.horse); interact(state, 'mount');
  for (let frame = 0; state.mission.stage === 7 && frame < 80; frame++) tick(state, 0.05);
  assert.equal(state.mission.stage, 8, JSON.stringify({ mounted: state.player.mounted, player: { x: state.player.x, y: state.player.y, z: state.player.z }, horse: { x: state.horse.x, y: state.horse.y, z: state.horse.z }, flags: state.flags, offers: Journey.getCampaignInteractions(state).map(offer => offer.id), notices: state.notices.map(notice => notice.text) }));
}
function returnWithSilas(state, misses = 0, pauseAtGate = false) {
  walk(state, WORLD.retreatRoute[0]); fightFixture(state, 1);
  walk(state, WORLD.retreatRoute[1]); fightFixture(state, 2);
  for (let miss = 0; miss < misses; miss++) {
    if (!state.player.ammo) { Journey.reloadCampaign(state); tick(state, 1.9); }
    Journey.shootCampaign(state, state.player.x + 300, state.player.y + 300); tick(state, 0.7);
    assert.equal(state.failure, null, 'deliberate empty-terrain shot misses protected actors as well as wolves');
  }
  walk(state, WORLD.retreatRoute[2]);
  for (const point of WORLD.creekRoute) { walk(state, point); tick(state, 1); }
  assert.equal(state.flags.creekConcealed, true, `both actual riders cover the creek: ${JSON.stringify(record(state).tracks.creek)}`);
  assert.ok(record(state).tracks.creek.copper >= 180 && record(state).tracks.creek.thimble >= 180);
  assert.equal(record(state).tracks.creek.nodeIndex, WORLD.creekRoute.length);
  assert.deepEqual(record(state).tracks.scentTrail, []);
  assert.equal(state.worldChanges.upperIceClosed, true);
  walk(state, WORLD.creekExit); interact(state, 'exit:left-bank');
  for (const point of WORLD.retreatRoute.slice(-2)) walk(state, point);
  waitNear(state, state.entities.thimble, state.player, 120);
  interact(state, 'return:kiln');
  assert.equal(state.region, 'snowbound'); assert.equal(state.mission.stage, 9);
  assert.equal(Journey.entityRegion(state, state.entities.silas), 'snowbound');
  if (pauseAtGate) return;
  for (const point of [{ x: 600, y: 970 }, { x: 375, y: 970 }, WORLD.camp.arrival]) walk(state, point);
  interact(state, 'dismount');
  waitNear(state, state.entities.thimble, WORLD.camp.arrival, 100);
  walk(state, state.entities.thimble); interact(state, 'unload:silas');
  assert.equal(state.entities.silas.attachment.targetId, 'mara');
  walk(state, WORLD.camp.arrival);
  waitNear(state, state.entities.moss, WORLD.camp.arrival, 55); waitNear(state, state.entities.vera, WORLD.camp.arrival, 55);
  interact(state, 'deliver:silas');
  assert.equal(state.entities.silas.attachment.targetId, 'moss');
  assert.equal(state.flags.delivered, false, 'handoff is followed by actual helper travel to the bed');
  for (const point of WORLD.camp.deliveryRoute) walk(state, point);
  for (let frame = 0; !state.flags.delivered && frame < 400; frame++) tick(state, 0.05);
  assert.equal(state.flags.delivered, true);
  assert.ok(record(state).rescue.helperDistance > 100);
  assert.deepEqual(state.entities.silas.attachment, { type: 'rest', targetId: 'silas-bed', regionId: 'snowbound' });
  interact(state, 'reunite:elin-fin'); choose(state, 'leave');
  for (const point of [{ x: 380, y: 1235 }, WORLD.camp.doorway, { x: 380, y: 1180 }]) walk(state, point);
  walk(state, state.entities.tomas); interact(state, 'rescue:tomas'); choose(state, 'leave');
  walk(state, state.entities.della); interact(state, 'rescue:della'); choose(state, 'leave');
  interact(state, 'journal:rescue'); assert.equal(state.mission.completed, true);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'entire completed graph and every checkpoint restore');
}

for (const recoverCase of [true, false]) {
  test(`all ten rescue stages use actual movement/carriers/passenger/wolves/creek/helpers with case ${recoverCase ? 'recovered' : 'omitted'}`, () => {
    const state = load();
    const history = clone(state.campaign.missions[OPENING]), initialStats = clone(state.stats), camp = clone(state.camp);
    loadedPassenger(state, recoverCase); returnWithSilas(state);
    assert.deepEqual(state.campaign.missions[OPENING], history, 'rescue does not overwrite opening choices or performance');
    assert.deepEqual(state.camp, camp, 'completion returns borrowed kit without charging unrelated camp stock');
    assert.equal(state.flags.caseCollected, recoverCase);
    assert.equal(state.flags.caseLost, !recoverCase);
    assert.equal(state.inventory.dispatchCase || 0, Number(recoverCase));
    assert.equal(record(state).performance.wolvesKilled, 7);
    assert.equal(state.stats.kills - initialStats.kills, 7);
    assert.equal(state.stats.shots - initialStats.shots, record(state).performance.shots);
    assert.equal(state.stats.hostileHits - initialStats.hostileHits, record(state).performance.hits, 'coach pellets count a trigger hit once');
    assert.equal(state.weapons['coach-gun'].owner, 'mara'); assert.equal(state.weapons['coach-gun'].loanMissionId, null);
    assert.equal(state.inventory.rescueRope, 0); assert.equal(state.inventory.signalCartridge, 0);
    assert.equal(record(state).rescue.flask.servings, 0);
    assert.equal(state.entities.silas.scars, true); assert.equal(state.entities.silas.injured, true);
    const earned = { inventory: clone(state.inventory), weapons: clone(state.weapons), camp: clone(state.camp), transactions: clone(record(state).transactions) };
    Journey.interactCampaign(state, 'journal:rescue'); Journey.interactCampaign(state, 'deliver:silas');
    assert.deepEqual({ inventory: state.inventory, weapons: state.weapons, camp: state.camp, transactions: record(state).transactions }, earned, 'delivery, ownership and returns cannot be duplicated');
  });
}

test('unused-kit postponement returns only borrowed equipment and preserves unrelated consumption, pack and elapsed time', () => {
  const state = load(); accept(state);
  place(state, state.horse); Journey.storeCampaignItem(state, 'rescueRope'); Journey.storeCampaignItem(state, 'tonic');
  assert.equal(state.horse.pack.rescueRope, 1); assert.equal(state.horse.pack.tonic, 1);
  tick(state, 0.7); Journey.useCampaignItem(state, 'broth');
  const inventory = clone(state.inventory), camp = clone(state.camp), time = state.time, elapsed = state.elapsed;
  place(state, state.entities.elin); interact(state, 'postpone:rescue');
  assert.deepEqual(state.dialog.choices.map(item => item.id), ['postpone-rescue', 'leave']);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'postponement conversation suspends');
  choose(state, 'postpone-rescue');
  assert.equal(state.campaign.activeMissionId, OPENING); assert.equal(record(state).status, 'unstarted');
  assert.equal(state.weapons['coach-gun'], undefined); assert.equal(state.horse.pack.rescueRope || 0, 0);
  assert.equal(state.horse.pack.tonic, 1); assert.deepEqual(state.camp, camp);
  assert.equal(state.inventory.broth, inventory.broth); assert.equal(state.inventory.tonic, inventory.tonic);
  assert.equal(state.time, time); assert.equal(state.elapsed, elapsed);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
  accept(state); assert.equal(state.inventory.rescueRope, 1); assert.equal(state.horse.pack.tonic, 1);
  assert.equal(state.inventory.warmRation, 1); assert.equal(Object.keys(record(state).transactions).length, 7);
});

for (const provision of ['inez-flask', 'sheltered-rest']) {
  test(`real climbing supports the distinct ${provision} recovery branch without spending the warm ration`, () => {
    const state = load(); reachSilas(state, provision);
    assert.equal(state.mission.stage, 6); assert.equal(state.inventory.warmRation, 1);
    assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
    if (provision === 'inez-flask') {
      const servings = record(state).rescue.flask.servings;
      Journey.interactCampaign(state, 'aid:inez-flask');
      assert.equal(record(state).rescue.flask.servings, servings, 'the one serving cannot repeat outside the genuine aid offer');
    }
  });
}

test('an actual unsafe drop failure suspends and retry restores the complete clinical/actor/weapon/region checkpoint', () => {
  const state = load(); reachSilas(state);
  const checkpoint = clone(state.checkpoint.data);
  interact(state, 'carry:silas'); Journey.campaignAction(state, 'drop:silas');
  assert.match(state.failure.reason, /dropped over unsafe ice/);
  assert.ok(state.dialog.choices.some(choice => choice.id === 'retry'));
  const failed = Journey.restoreCampaign(Journey.serializeCampaign(state));
  assert.ok(failed, 'suspended failed carrying state keeps legal failure choices and attachments');
  choose(failed, 'retry');
  assert.equal(failed.failure, null); assert.equal(record(failed).retryCount, 1);
  for (const key of ['entities', 'weapons', 'inventory', 'regions', 'party', 'camp', 'companions', 'sideQuests']) assert.deepEqual(JSON.parse(Journey.serializeCampaign(failed))[key], checkpoint[key], `retry restores entire ${key} body`);
  assert.deepEqual(record(failed).rescue, checkpoint.campaign.missions[RESCUE].rescue);
  assert.deepEqual(record(failed).flags, checkpoint.campaign.missions[RESCUE].flags);
  assert.equal(record(failed).performance.eligibleNoBites, true, 'next simulation step reevaluates optional eligibility');
  tick(failed, 0.1);
  assert.equal(record(failed).performance.eligibleNoBites, false, 'retry invalidates optional performance without blocking completion');
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(failed)));
});

test('a real protected riding-mount shot fails the rescue instead of harming a shared body or granting a kill', () => {
  const state = load(); shelf(state);
  place(state, { x: 1450, y: 730 });
  Journey.campaignAction(state, 'draw');
  const kills = state.stats.kills, hp = state.horse.hp;
  Journey.shootCampaign(state, state.horse.x, state.horse.y); tick(state, 0.4);
  assert.ok(state.failure, 'actual projectile hits protected Copper');
  assert.match(state.failure.reason, /Protected people and riding mounts/);
  assert.equal(state.stats.kills, kills); assert.equal(state.horse.hp, hp);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('a separated companion-and-mount location fixture triggers the shouting-distance failure and checkpoint recovery', () => {
  const state = load(); depart(state);
  // Companion location fixture isolates the actual distance/time failure gate.
  Object.assign(state.entities.inez, { x: 2200, y: 1600 });
  Object.assign(state.entities.thimble, { x: 2200, y: 1600 });
  const checkpointRegion = state.checkpoint.data.region;
  tick(state, 6.2);
  assert.match(state.failure?.reason || '', /left behind beyond shouting distance/, JSON.stringify({ player: [state.player.x,state.player.y], inez: [state.entities.inez.x,state.entities.inez.y], thimble: [state.entities.thimble.x,state.entities.thimble.y], timers: state.timers, mounted: state.entities.inez.mounted, stage: state.mission.stage }));
  choose(state, 'retry');
  assert.equal(state.failure, null);
  assert.equal(Journey.entityRegion(state, state.horse), checkpointRegion);
  assert.equal(Journey.entityRegion(state, state.entities.thimble), checkpointRegion);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

let completedFixture;
function completedState() {
  if (!completedFixture) { const state = load(); loadedPassenger(state); returnWithSilas(state); completedFixture = Journey.serializeCampaign(state); }
  const restored = Journey.restoreCampaign(completedFixture); assert.ok(restored); return restored;
}
test('completed rescue replay uses its entry snapshot and preserves canonical care, pack, ownership and both mission histories', () => {
  const state = completedState();
  place(state, state.horse); Journey.storeCampaignItem(state, 'tonic');
  const permanent = JSON.parse(Journey.serializeCampaign(state));
  Journey.beginCampaignReplay(state, RESCUE);
  assert.equal(state.mission.stage, 0); assert.equal(state.mission.completed, false);
  assert.equal(state.weapons['coach-gun'], undefined, 'rescue replay starts before the borrowed gun grant');
  assert.equal(state.entities.silas.attachment, null, 'recorded entry has the original missing Silas body');
  assert.ok(state.replayCanonical);
  accept(state);
  // Zero-health fault fixture exercises the suspended replay codec branch.
  state.player.hp = 0; tick(state, 0.05);
  assert.ok(state.failure); assert.ok(state.dialog.choices.some(choice => choice.id === 'finish-replay'));
  const restored = Journey.restoreCampaign(Journey.serializeCampaign(state)); assert.ok(restored);
  choose(restored, 'finish-replay');
  const returned = JSON.parse(Journey.serializeCampaign(restored));
  for (const key of ['campaign', 'entities', 'weapons', 'regions', 'party', 'inventory', 'camp', 'companions', 'sideQuests', 'wanted', 'honor', 'stats', 'checkpoints', 'missionEntries']) assert.deepEqual(returned[key], permanent[key], `replay exit restores canonical ${key}`);
  assert.equal(returned.replayCanonical, null);
});

test('replaying the older opening after the rescue suspends local and cared canonical graphs independently and restores all later world state', () => {
  const state = completedState();
  place(state, { ...state.entities.silas, z: 0 }); interact(state, 'care:silas');
  assert.equal(record(state).rescue.silas.healingHours, 34);
  place(state, state.horse); Journey.storeCampaignItem(state, 'tonic');
  assert.equal(state.horse.pack.tonic, 1);
  const permanent = JSON.parse(Journey.serializeCampaign(state));
  Journey.beginCampaignReplay(state, OPENING);
  assert.equal(state.campaign.activeMissionId, OPENING); assert.equal(state.mission.stage, 0);
  assert.equal(state.mission.completed, false); assert.equal(state.horse.id, 'juniper');
  assert.equal(state.weapons['coach-gun'], undefined, 'earlier opening entry cannot borrow the later earned gun from canonical rescue');
  const suspended = Journey.restoreCampaign(Journey.serializeCampaign(state)); assert.ok(suspended);
  assert.equal(suspended.campaign.activeMissionId, OPENING);
  assert.equal(suspended.replayCanonical.campaign.activeMissionId, RESCUE);
  assert.equal(suspended.replayCanonical.entities.silas.attachment.targetId, 'silas-bed');
  assert.equal(suspended.replayCanonical.campaign.missions[RESCUE].rescue.silas.healingHours, 34);
  assert.equal(suspended.replayCanonical.entities.copper.pack.tonic, 1);
  assert.equal(suspended.replayCanonical.weapons['coach-gun'].owner, 'mara');
  suspended.player.hp = 0; tick(suspended, 0.05);
  assert.ok(suspended.failure); assert.ok(suspended.dialog.choices.some(choice => choice.id === 'finish-replay'));
  const failed = Journey.restoreCampaign(Journey.serializeCampaign(suspended)); assert.ok(failed, 'both independent histories survive a suspended earlier-mission failure');
  choose(failed, 'finish-replay');
  const returned = JSON.parse(Journey.serializeCampaign(failed));
  for (const key of ['campaign','entities','weapons','regions','party','inventory','camp','companions','sideQuests','wanted','honor','stats','checkpoints','missionEntries']) assert.deepEqual(returned[key], permanent[key], `earlier replay exit preserves later canonical ${key}`);
  assert.equal(returned.replayCanonical, null);
  assert.ok(Journey.restoreCampaign(returned));
});

test('scheduled care spends one bandage, respects its six-hour wait and preserves scars; coat repair spends one material once', () => {
  const state = completedState();
  place(state, { ...state.entities.silas, z: 0 });
  const bandages = state.inventory.bandages, medicine = state.camp.medicine, healing = record(state).rescue.silas.healingHours;
  interact(state, 'care:silas');
  assert.equal((bandages - state.inventory.bandages) + (medicine - state.camp.medicine), 1);
  assert.equal(record(state).rescue.silas.healingHours, healing - 2);
  assert.equal(record(state).timers.helper, 480);
  assert.ok(!Journey.getCampaignInteractions(state).some(item => item.id === 'care:silas'), 'the public prompt enforces care cooldown');
  const stock = clone(state.inventory), camp = clone(state.camp);
  Journey.interactCampaign(state, 'care:silas');
  assert.deepEqual(state.inventory, stock); assert.deepEqual(state.camp, camp);
  // A camp-cloth stock fixture isolates the paid repair transaction; obtaining
  // cloth in the future economy is not claimed by this original mission test.
  if (state.camp.materials === 0) {
    place(state, state.entities.elin);
    assert.ok(!Journey.getCampaignInteractions(state).some(item => item.id === 'repair:silas-coat'));
    state.camp.materials = 1; camp.materials = 1;
  }
  place(state, state.entities.elin); interact(state, 'repair:silas-coat');
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)), 'the legal coat-repair decision suspends');
  choose(state, 'repair-coat');
  assert.equal(state.camp.materials, camp.materials - 1); assert.equal(state.entities.silas.coatRepaired, true);
  assert.equal(state.entities.silas.scars, true);
  Journey.interactCampaign(state, 'repair:silas-coat'); Journey.chooseCampaign(state, 'repair-coat');
  assert.equal(state.camp.materials, camp.materials - 1);
  tick(state, 481);
  assert.equal(record(state).timers.helper, 0);
  assert.ok(record(state).rescue.silas.healingHours < healing - 8);
  assert.equal(state.entities.silas.scars, true);
  assert.ok(Object.keys(record(state).transactions).some(id => id.includes('care:watch-')), 'Elin performs a recorded bedside watch as world hours pass');
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

const completedMutations = {
  'missing clinical bed attachment': data => { data.entities.silas.attachment = null; data.entities.silas.regionId = 'snowbound'; data.regions.snowbound.residentIds.push('silas'); },
  'wrong patient rest anchor': data => { data.entities.silas.attachment = { type: 'rest', targetId: 'silas-rest-pad', regionId: 'north-cutting' }; },
  'missing completed care schedule': data => { data.campaign.missions[RESCUE].rescue.silas.careScheduled = false; },
  'revoked earned coach gun ownership': data => { data.weapons['coach-gun'].owner = 'community-rescue-chest'; data.weapons['coach-gun'].loanMissionId = RESCUE; },
  'duplicated returned rope in Copper pack': data => { data.entities.copper.pack.rescueRope = 1; },
  'unrecorded second dispatch case': data => { data.inventory.dispatchCase = 2; },
  'fabricated dialogue from a previous clinical stage': data => { data.dialog = { id: 'rescue-lark', speaker: 'Inez Pike', text: 'Fake earlier scene', choices: [{ id: 'leave', label: 'Leave' }] }; },
};
for (const [name, mutate] of Object.entries(completedMutations)) {
  test(`strict completed rescue restore rejects ${name}`, () => {
    const data = JSON.parse(Journey.serializeCampaign(completedState())); mutate(data);
    assert.ok(!Journey.restoreCampaign(data));
  });
}

test('ordinary first nearby offers support mounting, recovery and optional secured-case pickup without named-ID shortcuts', () => {
  const state = load(); accept(state);
  place(state, state.entities.tomas); interact(state, 'brief:tomas'); choose(state, 'leave');
  place(state, state.entities.inez); interact(state, 'brief:inez'); choose(state, 'leave');
  place(state, state.horse); interact(state, 'inspect:coach-case');
  assert.equal(Journey.getCampaignInteraction(state)?.id, 'mount', 'nearby Elin postponement cannot mask mounting Copper');
  Journey.interactCampaign(state); assert.equal(state.player.mounted, true);
  const route = load(); shelf(route); walk(route, WORLD.climbs[0].from); traverse(route, 'climb:first-ledge', 2.3);
  assert.ok(['rest:ledge', 'aid:inez-flask'].includes(Journey.getCampaignInteraction(route)?.id), 'low stamina exposes an actual recovery prompt before an unavailable climb');
  const carry = load(); reachSilas(carry, 'warm-ration', false); interact(carry, 'carry:silas');
  walk(carry, WORLD.restPad); waitNear(carry, carry.entities.inez, WORLD.restPad, 80); interact(carry, 'secure:silas-at-rest-pad');
  walk(carry, WORLD.dispatchCase);
  assert.equal(carry.flags.listenedToSilas, false);
  assert.equal(Journey.getCampaignInteraction(carry)?.id, 'pickup:dispatch-case', 'attended case pickup stays available without forcing optional listening or lifting');
  Journey.interactCampaign(carry); assert.equal(carry.inventory.dispatchCase, 1);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(carry)));
});

for (const name of ['wrong first-climb kind', 'coherent future recess-climb traversal']) {
  test(`strict suspended traversal restore rejects ${name}`, () => {
    const state = load(); shelf(state); walk(state, WORLD.climbs[0].from); interact(state, 'climb:first-ledge'); tick(state, 0.1);
    const data = JSON.parse(Journey.serializeCampaign(state)), traversal = data.campaign.missions[RESCUE].traversal.player;
    if (name === 'wrong first-climb kind') traversal.kind = 'crouch';
    else {
      const edge = WORLD.climbs[2];
      Object.assign(traversal, { edgeId: edge.id, kind: 'climb', from: clone(edge.from), to: clone(edge.to), duration: edge.duration, age: 0.1, progress: 0.1/edge.duration });
      const u = traversal.progress ** 2 * (3 - 2 * traversal.progress);
      for (const key of ['x','y','z']) data.entities.mara[key] = traversal.from[key] + (traversal.to[key] - traversal.from[key]) * u;
    }
    assert.ok(!Journey.restoreCampaign(data), 'wire interpolation alone cannot legitimize the wrong authored action or future ledge');
  });
}

test('an empty-ammunition fixture uses exactly one emergency signal cartridge atomically and cannot fire it twice', () => {
  const state = load();
  // Weapon-depletion fixture targets the reservation boundary; ordinary signal
  // ammunition consumption is separately exercised by the full movement route.
  state.weapons['mara-revolver'].ammo = 0; state.weapons['mara-revolver'].reserve = 0;
  shelf(state);
  assert.equal(state.flags.signalFired, true); assert.equal(state.flags.signalAnswered, true);
  assert.equal(state.inventory.signalCartridge, 0);
  assert.equal(state.weapons['mara-revolver'].ammo + state.weapons['mara-revolver'].reserve, 0);
  assert.deepEqual(record(state).transactions[`${RESCUE}:use:signal-cartridge`], { amount: 1, completed: true });
  Journey.interactCampaign(state, 'signal:silas');
  assert.equal(state.inventory.signalCartridge, 0);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('a packed emergency cartridge cannot create a signal transaction before the actual nearby pack withdrawal', () => {
  const state = load(); state.weapons['mara-revolver'].ammo = 0; state.weapons['mara-revolver'].reserve = 0;
  accept(state); place(state, state.horse); Journey.storeCampaignItem(state, 'signalCartridge');
  assert.equal(state.inventory.signalCartridge, 0); assert.equal(state.horse.pack.signalCartridge, 1);
  shelf(state, true);
  interact(state, 'signal:silas'); tick(state, 2.2);
  assert.equal(state.flags.signalFired, false); assert.equal(state.flags.signalAnswered, false);
  assert.equal(record(state).transactions[`${RESCUE}:use:signal-cartridge`], undefined, 'failed consumption cannot record a completed transaction');
  assert.equal(state.horse.pack.signalCartridge, 1);
  walk(state, state.horse); Journey.takeCampaignItem(state, 'signalCartridge');
  assert.equal(state.inventory.signalCartridge, 1); assert.equal(state.horse.pack.signalCartridge, 0);
  walk(state, { x: 1550, y: 730 }); interact(state, 'signal:silas'); tick(state, 2.2);
  assert.equal(state.flags.signalAnswered, true); assert.equal(state.inventory.signalCartridge, 0);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('completed rescue returns borrowed rope and cartridge from Copper’s pack while preserving its unrelated tonic', () => {
  const state = load(); loadedPassenger(state);
  Journey.storeCampaignItem(state, 'rescueRope'); Journey.storeCampaignItem(state, 'signalCartridge'); Journey.storeCampaignItem(state, 'tonic');
  assert.equal(state.horse.pack.rescueRope, 1); assert.equal(state.horse.pack.signalCartridge, 1); assert.equal(state.horse.pack.tonic, 1);
  returnWithSilas(state);
  assert.equal(state.horse.pack.rescueRope || 0, 0); assert.equal(state.horse.pack.signalCartridge || 0, 0); assert.equal(state.horse.pack.tonic, 1);
  for (const suffix of ['rescue-rope','signal-cartridge']) assert.deepEqual(record(state).transactions[`${RESCUE}:return:${suffix}`], { amount: 1, completed: true });
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('leaving running water before concealment resets both real distance counters and prevents a premature left-bank exit', () => {
  const state = load(); loadedPassenger(state);
  walk(state, WORLD.retreatRoute[0]); fightFixture(state, 1);
  walk(state, WORLD.retreatRoute[1]); fightFixture(state, 2);
  walk(state, WORLD.retreatRoute[2]); walk(state, WORLD.creekRoute[0]); tick(state, 1);
  walk(state, { x: 1000, y: 1146 });
  assert.ok(record(state).tracks.creek.copper > 20);
  assert.equal(state.flags.creekConcealed, false);
  Journey.interactCampaign(state, 'exit:left-bank'); assert.equal(state.flags.leftBankExited, false);
  walk(state, { x: 1000, y: 1050 });
  assert.equal(record(state).tracks.creek.copper, 0); assert.equal(record(state).tracks.creek.thimble, 0);
  assert.equal(record(state).tracks.creek.nodeIndex, 0); assert.ok(record(state).tracks.creek.prematureExits > 0);
  for (const point of WORLD.creekRoute) { walk(state, point); tick(state, 1); }
  assert.equal(state.flags.creekConcealed, true);
  assert.ok(record(state).tracks.creek.copper >= 180 && record(state).tracks.creek.thimble >= 180);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('one coach volley stops in its newly killed wolf body; a separate direct protected-mount shot still fails', () => {
  const state = load(); descend(state, false);
  waitNear(state, state.entities.inez, WORLD.loadingSpur, 60); interact(state, 'handoff:loading');
  // Collinear actor-position fixture checks real spread, damage and protection,
  // rather than the optional wolves' unaltered tactical movements.
  place(state, { x: 1400, y: 780 });
  Object.assign(state.horse, { x: 1400, y: 620 });
  Object.assign(state.entities['pack-flanker'], { x: 1400, y: 700 });
  Journey.campaignAction(state, 'draw');
  const hp = state.horse.hp, kills = state.stats.kills;
  Journey.shootCampaign(state, 1400, 700); tick(state, 0.7);
  assert.equal(state.entities['pack-flanker'].hp, 0);
  assert.equal(state.failure, null, 'later pellets cannot pass through their own newly killed wolf into Copper');
  assert.equal(state.horse.hp, hp); assert.equal(state.stats.kills, kills + 1);
  assert.equal(record(state).performance.shots, 1); assert.equal(record(state).performance.hits, 1);
  Journey.shootCampaign(state, state.horse.x, state.horse.y); tick(state, 0.5);
  assert.ok(state.failure); assert.match(state.failure.reason, /Protected people and riding mounts/);
});

test('three real predator roles wait through their warning and an actual diversion redirects the flanker target', () => {
  const state = load(); descend(state, false); waitNear(state, state.entities.inez, WORLD.loadingSpur, 60); interact(state, 'handoff:loading');
  const pack = record(state).predators.filter(wolf => wolf.wave === 0);
  assert.deepEqual(pack.map(wolf => wolf.role), ['flanker','tester','hesitant']);
  assert.equal(pack[0].targetId, 'inez'); assert.equal(pack[1].targetId, 'mara');
  tick(state, 2.8);
  assert.ok(pack.every(wolf => wolf.phase === 'assess')); assert.equal(record(state).performance.wolfBiteDamage, 0);
  place(state, WORLD.diversion); interact(state, 'divert:wolves');
  assert.ok(pack.every(wolf => wolf.targetId === 'mara' && wolf.noise === 12));
  assert.equal(state.flags.diversion, true);
});

test('a physically distant coach spread wounds a living wolf into its authored flee outcome without a false kill', () => {
  const state = load(); descend(state, false); waitNear(state, state.entities.inez, WORLD.loadingSpur, 60); interact(state, 'handoff:loading');
  place(state, { x: 1640, y: 790 }); Object.assign(state.entities['pack-tester'], { x: 1275, y: 790 });
  Journey.campaignAction(state, 'draw'); Journey.shootCampaign(state, 1275, 790); tick(state, 0.7);
  const wolf = state.entities['pack-tester'], ai = record(state).predators.find(item => item.id === wolf.id);
  assert.ok(wolf.hp > 0 && wolf.hp < 25, `real spread leaves a wounded living wolf (${wolf.hp}HP)`);
  assert.equal(ai.wounded, true);
  for (let time = 0; ai.phase !== 'fled' && time < 10; time += 0.05) tick(state, 0.05);
  assert.equal(ai.phase, 'fled'); assert.equal(wolf.hidden, true); assert.equal(ai.killed, false);
  assert.equal(record(state).performance.wolvesKilled, 0);
  assert.equal(record(state).performance.allWolvesNoBites, false);
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

test('the refuge rock blocks a real coach shot while consuming its shell and preserving the protected loading operation', () => {
  const state = load(); descend(state, false); waitNear(state, state.entities.inez, WORLD.loadingSpur, 60); interact(state, 'handoff:loading');
  place(state, { x: 1320, y: 780 }); Object.assign(state.entities['pack-tester'], { x: 1320, y: 670 });
  Journey.campaignAction(state, 'draw'); const ammo = state.player.ammo;
  Journey.shootCampaign(state, 1320, 670); tick(state, 0.7);
  assert.equal(state.player.ammo, ammo - 1); assert.equal(state.entities['pack-tester'].hp, 70);
  assert.equal(record(state).performance.shots, 1); assert.equal(record(state).performance.hits, 0);
  assert.equal(state.failure, null);
});

test('two real missed shots put the completed seven-wolf attempt below the independent 80-percent accuracy condition', () => {
  const state = load(); loadedPassenger(state); returnWithSilas(state, 2);
  assert.equal(record(state).performance.wolvesKilled, 7);
  assert.equal(record(state).performance.hits, 7); assert.equal(record(state).performance.shots, 9);
  assert.equal(record(state).performance.accuracy80, false);
  assert.equal(state.mission.completed, true, 'optional accuracy cannot block the actual rescue');
  assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(state)));
});

const checkpointBuilders = {
  'prepared kiln': state => accept(state),
  'confirmed Ash trail': state => ashCamp(state),
  'live shelf mounts': state => shelf(state),
  'stabilized Silas': state => reachSilas(state),
  'loading spur': state => descend(state),
  'mounted retreat': state => loadedPassenger(state),
  'refuge gate': state => { loadedPassenger(state); returnWithSilas(state, 0, true); },
};
for (const [name, build] of Object.entries(checkpointBuilders)) {
  test(`suspended fatal-health fixture at the actual ${name} checkpoint restores its whole graph and actual resume gates`, () => {
    const state = load(); build(state);
    const checkpoint = clone(state.checkpoint.data);
    Journey.useCampaignItem(state, 'tonic');
    // Death fixture is used only for exhaustive checkpoint/codec coverage. The
    // browser routes use normal damage; direct protected shots have their own
    // real-projectile failure test above.
    state.player.hp = 0; tick(state, 0.05);
    assert.ok(state.failure);
    const suspended = Journey.restoreCampaign(Journey.serializeCampaign(state)); assert.ok(suspended, `${name} failure suspends`);
    choose(suspended, 'retry');
    const after = JSON.parse(Journey.serializeCampaign(suspended));
    for (const key of ['entities','weapons','regions','party','inventory','camp','companions','sideQuests','wanted','honor']) assert.deepEqual(after[key], checkpoint[key], `${name} retry restores all ${key}`);
    assert.equal(record(suspended).retryCount, 1); assert.equal(suspended.failure, null);
    tick(suspended, 0.15);
    assert.equal(record(suspended).performance.eligibleNoBites, false);
    if (name === 'mounted retreat') {
      assert.equal(suspended.flags.waveOne, true, 'restored mounted checkpoint really activates the first chase pair');
      assert.ok(record(suspended).predators.filter(wolf => wolf.wave === 1).every(wolf => wolf.phase !== 'dormant'));
    }
    if (name === 'refuge gate') assert.ok(suspended.entities.moss.goal && suspended.entities.vera.goal, 'retry actually dispatches both helpers from their preserved camp positions');
    assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(suspended)), `${name} resumed state remains valid`);
  });
}
