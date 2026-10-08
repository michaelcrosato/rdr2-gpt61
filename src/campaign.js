import { SNOWBOUND_WORLD, SNOWBOUND_CAST, SNOWBOUND_STAGES, CAMPAIGN_ITEMS } from '../content/campaign/snowbound.js';
export { SNOWBOUND_WORLD, CAMPAIGN_ITEMS };

const ID = 'snowbound-the-last-warm-light', VERSION = 1;
const copy = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const alive = (actor) => actor && actor.hp > 0;
const npc = (s, id) => s.npcs.find((actor) => actor.id === id);
const foe = (s, id) => s.enemies.find((actor) => actor.id === id);
const mare = (s) => s.animals.find((actor) => actor.id === 'copper');
const prop = (id) => SNOWBOUND_WORLD.props.find((value) => value.id === id);
const isInside = (actor, r, radius = 0) => actor.x > r.x - radius && actor.x < r.x + r.w + radius && actor.y > r.y - radius && actor.y < r.y + r.h + radius;
const blocked = (x, y, radius = 9) => x < radius || y < radius || x > SNOWBOUND_WORLD.width - radius || y > SNOWBOUND_WORLD.height - radius || SNOWBOUND_WORLD.obstacles.some((r) => isInside({ x, y }, r, radius));
function log(s, text) { s.log.push({ day: s.day, time: s.time, text }); s.log = s.log.slice(-100); }
function notice(s, text) { s.notices.push({ text, time: 6 }); s.notices = s.notices.slice(-5); }
function talk(s, id, speaker, text, choices) { s.dialog = { id, speaker, text, choices: choices.map(([id, label]) => ({ id, label })) }; }
function objective(s) {
  s.mission.objective = s.mission.completed ? 'The kiln has light. Silas is next. A Voice Under Ice is not available yet.' : s.mission.stage === 2 && s.flags.negotiationPending ? 'Hold your cover while Tomas approaches Voss and Inez checks Copper’s saddle.' : SNOWBOUND_STAGES[s.mission.stage];
}
function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function move(actor, dx, dy, radius = 9) {
  const oldX = actor.x, oldY = actor.y;
  if (!blocked(actor.x + dx, actor.y, radius)) actor.x += dx;
  if (!blocked(actor.x, actor.y + dy, radius)) actor.y += dy;
  return Math.hypot(actor.x - oldX, actor.y - oldY);
}
function obstructed(a, b, radius = 0) {
  const count = Math.max(1, Math.ceil(distance(a, b) / 8));
  for (let i = 1; i < count; i++) if (blocked(a.x + (b.x - a.x) * i / count, a.y + (b.y - a.y) * i / count, radius)) return true;
  return false;
}

// A shared navigation grid routes companions through the authored doors and cover.
// It is built lazily; runtime routes remain serializable actor state.
const navigation = new Map();
function findPath(start, target, radius = 9) {
  const unit = 20, cols = 90, rows = 70;
  if (!navigation.has(radius)) navigation.set(radius, Array.from({ length: cols * rows }, (_, i) => !blocked((i % cols) * unit + 10, Math.floor(i / cols) * unit + 10, radius)));
  const grid = navigation.get(radius);
  const cell = (p) => clamp(Math.floor(p.y / unit), 0, rows - 1) * cols + clamp(Math.floor(p.x / unit), 0, cols - 1);
  const near = (id) => {
    if (grid[id]) return id;
    let best = null, bestDistance = Infinity;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = id % cols + dx, y = Math.floor(id / cols) + dy, n = y * cols + x;
      if (x >= 0 && x < cols && y >= 0 && y < rows && grid[n] && dx * dx + dy * dy < bestDistance) { best = n; bestDistance = dx * dx + dy * dy; }
    }
    return best;
  };
  const from = near(cell(start)), goal = near(cell(target));
  if (from === null || goal === null) return [];
  const previous = new Int32Array(cols * rows).fill(-1), queue = [from]; previous[from] = from;
  for (let cursor = 0; cursor < queue.length && previous[goal] < 0; cursor++) {
    const id = queue[cursor], x = id % cols, y = Math.floor(id / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, next = yy * cols + xx;
      if (xx < 0 || xx >= cols || yy < 0 || yy >= rows || !grid[next] || previous[next] >= 0) continue;
      previous[next] = id; queue.push(next);
    }
  }
  if (previous[goal] < 0) return [];
  const path = []; let id = goal;
  while (id !== from) { path.push({ x: (id % cols) * unit + 10, y: Math.floor(id / cols) * unit + 10 }); id = previous[id]; }
  return path.reverse();
}
function follow(actor, target, speed, dt, stop = 45) {
  if (!alive(actor) || distance(actor, target) <= stop) return;
  const radius = actor.kind === 'horse' || actor.id === 'juniper' || actor.mounted ? 14 : 9;
  if (!obstructed(actor, target, radius)) actor.route = [];
  else if (!actor.route?.length || !actor.routeTarget || distance(actor.routeTarget, target) > 75) { actor.route = findPath(actor, target, radius); actor.routeTarget = { x: target.x, y: target.y }; }
  while (actor.route?.length && distance(actor, actor.route[0]) < 12) actor.route.shift();
  const goal = actor.route?.[0] || target;
  const angle = Math.atan2(goal.y - actor.y, goal.x - actor.x); actor.facing = angle;
  move(actor, Math.cos(angle) * Math.min(speed * dt, distance(actor, goal)), Math.sin(angle) * Math.min(speed * dt, distance(actor, goal)), radius);
}

function snapshot(s) {
  const { checkpoint, replayCanonical, ...clean } = s;
  return copy(clean);
}
function checkpoint(s, label) { s.checkpoint = { label, data: snapshot(s) }; notice(s, `Checkpoint · ${label}`); }
function advance(s, stage, label) { s.mission.stage = stage; objective(s); if (label) checkpoint(s, label); }
function depart(s) {
  if (s.mission.stage !== 0 || !s.flags.briefed || !s.flags.coatTaken || !s.flags.lanternTaken) return;
  s.companions.tomas.following = true; npc(s, 'tomas').mounted = true; log(s, 'Tomas led Mara toward Copperglass for heat, food and Copper. Silas Orr remains missing.'); advance(s, 1, 'Before the station approach');
}
function fail(s, reason) {
  if (s.failure) return;
  s.failure = { reason }; s.stats.deaths++; s.bullets = [];
  talk(s, 'mission-failed', 'The Last Warm Light · Checkpoint', reason, [['retry', 'Retry the latest checkpoint.'], ['restart', 'Restart the opening.'], ...(s.replayCanonical ? [['finish-replay', 'Return to the permanent journey.']] : [])]);
  notice(s, reason); log(s, `Mission failed: ${reason}`);
}

export function createCampaignState() {
  const s = {
    version: VERSION, region: 'snowbound', seed: 302491, elapsed: 0, day: 1, time: 5.7, weather: 'snow',
    player: { id: 'mara', name: 'Mara Vale', x: 350, y: 1110, vx: 0, vy: 0, facing: -Math.PI / 2, hp: 100, stamina: 100, focus: 100, mounted: false, ammo: 6, reserve: 48, money: 0, reloadTimer: 0, shotTimer: 0, invulnerable: 0, crouch: false, coldcoat: false, lantern: false, holstered: true, weaponOwned: true, blockTimer: 0, carrying: null },
    horse: { id: 'juniper', name: 'Juniper', x: 375, y: 1155, hp: 100, stamina: 100, bond: 1, follow: false, owned: true, fear: 0, hitched: false, careUnlocked: true, ridingUnlocked: true, storageUnlocked: false, pack: {} },
    mounts: [{ id: 'tomas-mount', name: 'Moth', x: 315, y: 1195, hp: 100, stamina: 100, owned: true }],
    npcs: copy(SNOWBOUND_CAST),
    enemies: [
      { id: 'gauge-guard', name: 'Pressure guard', kind: 'gauge', x: 1310, y: 475, hp: 70, facing: Math.PI, active: false, fireTimer: 2.6 },
      { id: 'chute-flanker', name: 'Coal-chute flanker', kind: 'flanker', x: 1400, y: 610, hp: 70, facing: Math.PI, active: false, fireTimer: 3.2, routeIndex: 0 },
      { id: 'voss', name: 'Ansel Voss', kind: 'supervisor', x: 1390, y: 455, hp: 100, facing: Math.PI, active: false, fireTimer: 4, fleeing: false, captured: false, escaped: false, routeIndex: 0 },
      { id: 'saboteur', name: 'Fuse guard', kind: 'saboteur', x: 1580, y: 470, hp: 65, facing: Math.PI, active: false, hidden: true, fireTimer: 4 },
    ],
    animals: [{ id: 'copper', kind: 'horse', name: 'Copper', x: 1560, y: 615, hp: 100, stamina: 100, bond: 1, facing: Math.PI, fear: 80, owned: false, leading: false, hitched: false, follow: false }],
    supplies: SNOWBOUND_WORLD.supplies.map((item) => ({ ...item, collected: false, delivered: 0, lost: false })),
    dropped: { weapon: null, token: null }, bullets: [],
    inventory: { tonic: 1, coffee: 1, blankets: 0, oil: 0, oats: 0, bandages: 0, broth: 0, kindling: 0, logbook: 0, token: 1 },
    mission: { id: ID, name: 'The Last Warm Light', stage: 0, stageCount: 9, completed: false, rewardPaid: false, objective: '' },
    flags: {
      coatTaken: false, lanternTaken: false, briefed: false, routeIndex: 0, wireInspected: false, inezJoined: false,
      mountsHitched: false, cover: null, negotiationStarted: false, negotiationPending: false, evictionTagRead: false,
      coalAmbushed: false, blocked: false, shoves: 0, pavelSubdued: false, weaponRecovered: false, tokenRecovered: false, pavelChoice: null, rescueClue: false,
      copperSpoken: false, copperCalmed: false, copperPatted: false, copperLeading: false, copperHitched: false,
      adaIdentified: false, rescuePriority: null, logSecured: false, adaEscorting: false, adaRouteIndex: 0, gideonCarried: false, gideonSafe: false, adaSafe: false, suppliesDeposited: false,
    },
    worldChanges: { boilerDestroyed: false, relayDamaged: false, pressureReleased: false, fireActive: false, relayCircuitOff: false, logRecovered: false, residentsDeparted: false, vossFutureCheckpoint: false, pavelFutureWarning: false, pavelCampGuardDuty: false, neriRemembered: false },
    timers: { cold: 0, companionCall: 0, ambush: 0, shoveCooldown: 0, copperKnockback: 0, crisis: 180, fire: 0, vossEscape: 0 },
    companions: { tomas: { trust: 0, following: false }, inez: { trust: 0, following: false }, ada: { trust: 0, joined: false }, gideon: { careNeeded: false, severity: 0 } },
    camp: { food: 0, medicine: 0, materials: 0, morale: 15, upgrades: {}, blankets: 0, oil: 0, oats: 0, broth: 0, stoveLit: false, pavelGuarded: false },
    sideQuests: { silas: { name: 'A Voice Under Ice', stage: 0, complete: false, unlocked: false } },
    wanted: { heat: 0, bounty: 0, witnessTimer: 0, pursuit: false, spawnTimer: 0 }, honor: 0,
    stats: { shots: 0, hostileHits: 0, kills: 0, hunted: 0, fish: 0, deaths: 0, distance: 0, yardDamage: 0 },
    performance: { noYardInjury: null, allSixSupplies: null, accurate: null, accuracy: 0 },
    failure: null, dialog: null, checkpoint: null, replayCanonical: null, log: [], notices: [], lastSave: null,
  };
  objective(s); log(s, 'Neri Bell died before the stove could be lit. Mara, Tomas and Inez must bring warmth to the lime kiln refuge. Silas Orr has not returned.');
  notice(s, 'Find the coat and lantern beside the kiln. Speak with Tomas Reed.'); checkpoint(s, 'Lime kiln refuge');
  return s;
}

function emitBullet(s, origin, angle, faction, target = null, damage = 35, speed = 620) {
  s.bullets.push({ x: origin.x + Math.cos(angle) * 18, y: origin.y + Math.sin(angle) * 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, faction, target, damage, ttl: 1.25 });
}
function hitBullet(s, bullet) {
  if (bullet.faction === 'player' || bullet.faction === 'camp') {
    const target = s.enemies.find((e) => alive(e) && !e.escaped && !e.hidden && !e.captured && distance(e, bullet) < 14);
    if (target) {
      target.hp = Math.max(0, target.hp - bullet.damage);
      if (bullet.faction === 'player') s.stats.hostileHits++;
      if (!alive(target)) { s.stats.kills++; if (target.id === 'voss') log(s, 'Ansel Voss fell before reaching the service tunnel.'); }
      return true;
    }
    if (bullet.faction === 'camp') return false;
    const protectedActor = s.npcs.find((actor) => alive(actor) && !actor.hidden && actor.id !== 'pavel' && distance(actor, bullet) < 13);
    if (protectedActor) { fail(s, `${protectedActor.name} was deliberately attacked. Protect the people relying on Mara.`); return true; }
    const protectedMount = [mare(s), s.horse, ...s.mounts].find((mount) => alive(mount) && distance(mount, bullet) < 17);
    if (protectedMount) { fail(s, `${protectedMount.name} was shot. The community’s essential mounts must survive.`); return true; }
    const pavel = npc(s, 'pavel');
    if (alive(pavel) && !pavel.hidden && distance(pavel, bullet) < 13 && !s.flags.pavelChoice) { notice(s, 'Question Pavel after recovering the community token. His fate must be chosen openly.'); return true; }
  } else {
    const candidates = [s.player, npc(s, 'tomas'), npc(s, 'inez')];
    for (const target of candidates) if (alive(target) && distance(target, bullet) < 13 && !(target.invulnerable > 0)) {
      target.hp = Math.max(0, target.hp - bullet.damage); target.invulnerable = .25;
      if (target === s.player && s.mission.stage === 3) s.stats.yardDamage += bullet.damage;
      return true;
    }
  }
  return false;
}
function bullets(s, dt) {
  for (const bullet of s.bullets) {
    const n = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 5));
    for (let i = 0; i < n && bullet.ttl > 0; i++) {
      bullet.x += bullet.vx * dt / n; bullet.y += bullet.vy * dt / n; bullet.ttl -= dt / n;
      if (blocked(bullet.x, bullet.y, 0) || hitBullet(s, bullet)) bullet.ttl = 0;
    }
  }
  s.bullets = s.bullets.filter((bullet) => bullet.ttl > 0);
}
function combat(s, dt) {
  const flanks = [{ x: 1435, y: 650 }, { x: 1330, y: 650 }, { x: 1245, y: 650 }, { x: 1160, y: 625 }];
  for (const enemy of s.enemies) {
    if (!alive(enemy) || enemy.hidden || enemy.escaped || enemy.captured) continue;
    if (enemy.fleeing) {
      const exits = [{ x: 1260, y: 450 }, { x: 1150, y: 400 }, { x: 1090, y: 360 }];
      const goal = exits[enemy.routeIndex] || exits.at(-1); follow(enemy, goal, 95, dt, 8);
      if (distance(enemy, goal) < 20) enemy.routeIndex++;
      if (enemy.routeIndex >= exits.length) { enemy.escaped = true; s.worldChanges.vossFutureCheckpoint = true; log(s, 'Ansel Voss escaped through the service tunnel. He will recognize Mara at a later freight checkpoint.'); notice(s, 'Voss escaped. Supplies and the people inside still need you.'); }
      continue;
    }
    if (!enemy.active) continue;
    if (enemy.kind === 'flanker') {
      const goal = flanks[enemy.routeIndex % flanks.length]; follow(enemy, goal, 50, dt, 9);
      if (distance(enemy, goal) < 22) enemy.routeIndex++;
    }
    const targets = [s.player, npc(s, 'tomas'), npc(s, 'inez')].filter((actor) => alive(actor) && distance(enemy, actor) < 450 && !obstructed(enemy, actor));
    targets.sort((a, b) => distance(enemy, a) - distance(enemy, b));
    const target = targets[0];
    if (!target) continue;
    enemy.facing = Math.atan2(target.y - enemy.y, target.x - enemy.x); enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0) {
      const spread = (random(s) - .5) * .13;
      emitBullet(s, enemy, enemy.facing + spread, 'company', target.id, enemy.kind === 'supervisor' ? 13 : 9, 460);
      enemy.fireTimer = enemy.kind === 'flanker' ? 2.4 : 2.9;
    }
  }
  if (s.mission.stage === 3) {
    const tomas = npc(s, 'tomas'), inez = npc(s, 'inez');
    const withdrawal = [{ x: 1230, y: 605 }, { x: 1160, y: 610 }];
    follow(tomas, withdrawal[tomas.hp < 70 ? 1 : 0], 67, dt, 15);
    follow(inez, { x: 1465, y: 640 }, 65, dt, 20);
    inez.shotTimer = (inez.shotTimer || 0) - dt;
    const target = s.enemies.find((e) => e.id === 'chute-flanker' && alive(e));
    if (target && inez.shotTimer <= 0 && !obstructed(inez, target)) { emitBullet(s, inez, Math.atan2(target.y - inez.y, target.x - inez.x), 'camp', target.id, 8, 570); inez.shotTimer = 3.5; }
  }
}

export function stepCampaign(s, dt, input = {}) {
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1); if (!dt) return s;
  s.notices.forEach((n) => { n.time -= dt; }); s.notices = s.notices.filter((n) => n.time > 0);
  if (s.failure || s.dialog) return s;
  if (s.player.hp <= 0) { fail(s, 'Mara fell in the snow. Retry the checkpoint to restore the party and supplies.'); return s; }
  for (const id of ['tomas', 'inez', 'ada', 'gideon']) if (!alive(npc(s, id))) { fail(s, `${npc(s, id).name} did not survive. Retry with the people and world restored.`); return s; }
  if (!alive(s.horse) || !alive(mare(s)) || s.mounts.some((mount) => !alive(mount))) { fail(s, 'An essential mount was lost. Retry the checkpoint.'); return s; }
  s.elapsed += dt; s.time += dt * .01;
  if (s.time >= 24) { s.time -= 24; s.day++; }
  const player = s.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt); player.shotTimer = Math.max(0, player.shotTimer - dt); player.blockTimer = Math.max(0, player.blockTimer - dt);
  for (const actor of s.npcs) actor.invulnerable = Math.max(0, (actor.invulnerable || 0) - dt);
  for (const id of ['shoveCooldown', 'copperKnockback', 'companionCall']) s.timers[id] = Math.max(0, s.timers[id] - dt);
  if (input.block && !player.mounted && !player.weaponOwned) campaignAction(s, 'block');
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) { const count = Math.min(6 - player.ammo, player.reserve); player.ammo += count; player.reserve -= count; player.reloadTimer = 0; notice(s, 'Revolver loaded.'); }
  }
  player.focusActive = !!input.focus && player.focus > 0 && player.weaponOwned && !player.mounted;
  player.focus = clamp(player.focus + dt * (player.focusActive ? -18 : 2), 0, 100);
  const worldDt = dt * (player.focusActive ? .4 : 1);
  let mx = clamp(Number(input.mx) || 0, -1, 1), my = clamp(Number(input.my) || 0, -1, 1), length = Math.hypot(mx, my);
  if (length > 1) { mx /= length; my /= length; }
  player.crouch = !!input.crouch && !player.mounted;
  const sprint = !!input.sprint && (player.mounted ? s.horse.stamina : player.stamina) > 1 && !player.carrying;
  const speed = player.carrying ? 48 : player.mounted ? sprint ? 195 : 125 : player.crouch ? 38 : sprint ? 115 : 76;
  const ox = player.x, oy = player.y;
  const fireBarrier = { x: 1355, y: 425, w: 70, h: 85 };
  if (s.worldChanges.fireActive && s.mission.stage === 7) {
    const dx = mx * speed * dt, dy = my * speed * dt;
    if (!isInside({ x: player.x + dx, y: player.y }, fireBarrier, 9)) move(player, dx, 0, player.mounted ? 14 : 9);
    if (!isInside({ x: player.x, y: player.y + dy }, fireBarrier, 9)) move(player, 0, dy, player.mounted ? 14 : 9);
  } else move(player, mx * speed * dt, my * speed * dt, player.mounted ? 14 : 9);
  player.vx = (player.x - ox) / dt; player.vy = (player.y - oy) / dt; s.stats.distance += Math.hypot(player.x - ox, player.y - oy);
  if (length > .05) player.facing = Math.atan2(my, mx);
  player.stamina = clamp(player.stamina + dt * (player.carrying ? -2 : sprint && !player.mounted ? -12 : 7), 0, 100);
  if (player.mounted) { s.horse.x = player.x; s.horse.y = player.y; s.horse.stamina = clamp(s.horse.stamina + dt * (sprint ? -10 : 4), 0, 100); }
  else if ((s.horse.follow || s.horse.leading) && !s.horse.hitched) follow(s.horse, player, 140, worldDt, 48);
  if (s.horse.id === 'copper') Object.assign(mare(s), { x: s.horse.x, y: s.horse.y, hp: s.horse.hp, stamina: s.horse.stamina, bond: s.horse.bond, owned: true, hitched: s.horse.hitched });
  if (!player.coldcoat && s.mission.stage > 0) { s.timers.cold += dt; if (s.timers.cold > 12) { player.hp = Math.max(0, player.hp - 3); notice(s, 'The cold bites through Mara’s clothes. Put on the coat at the kiln.'); s.timers.cold = 0; } }
  if (s.mission.stage === 1) {
    follow(npc(s, 'tomas'), player, player.mounted ? 155 : 100, worldDt, 65);
    s.mounts[0].x = npc(s, 'tomas').x; s.mounts[0].y = npc(s, 'tomas').y + 10;
    if (s.flags.inezJoined) follow(npc(s, 'inez'), player, 160, worldDt, 100);
    const point = SNOWBOUND_WORLD.trail[s.flags.routeIndex];
    if (point && player.mounted && distance(player, point) < 65 && distance(npc(s, 'tomas'), player) < 150 && (s.flags.routeIndex !== 2 || s.flags.wireInspected && s.flags.inezJoined)) {
      s.flags.routeIndex++; notice(s, s.flags.routeIndex < SNOWBOUND_WORLD.trail.length ? 'Tomas: Follow the wire. The station’s red lamp is ahead.' : 'Hitch the mounts before Tomas enters rifle range.');
    }
    if (distance(player, npc(s, 'tomas')) > 250 && s.timers.companionCall <= 0) { notice(s, 'Tomas calls from the wire trail. Stay together; the map records our route.'); s.timers.companionCall = 12; }
    if (s.flags.routeIndex >= SNOWBOUND_WORLD.trail.length && s.flags.inezJoined && distance(npc(s, 'inez'), player) < 170) advance(s, 2);
  }
  if (s.mission.stage === 2 && s.flags.mountsHitched) {
    const tomas = npc(s, 'tomas'), inez = npc(s, 'inez');
    follow(tomas, s.flags.cover ? { x: 1250, y: 500 } : { x: 1120, y: 545 }, 67, worldDt, 12);
    follow(inez, s.flags.cover ? { x: 1465, y: 620 } : { x: 1185, y: 620 }, 82, worldDt, 12);
    if (s.flags.cover && !s.flags.evictionTagRead && distance(inez, prop('eviction-tag')) < 65) {
      s.flags.evictionTagRead = true; log(s, 'Inez reached the animal pen and recognized Copper’s saddle under a company eviction tag.');
      notice(s, 'Inez: They marked Copper as repossessed property. That is my old rope halter.');
    }
    if (s.flags.negotiationPending && distance(tomas, foe(s, 'voss')) < 170 && s.flags.evictionTagRead) {
      s.flags.negotiationPending = false; s.flags.negotiationStarted = true;
      talk(s, 'voss-threat', 'Ansel Voss', 'That token is from the eviction camp. A messenger would not carry it. Take Reed alive; strip the mare’s saddle and light the boiler fuse when the work is done.', [['stand-ground', 'Tomas, get back to cover!']]);
      log(s, 'Voss recognized Tomas’s community token during the approach. The guards raised their rifles after his order to seize Tomas.');
    }
  }
  combat(s, worldDt); bullets(s, worldDt);
  if (s.failure) return s;
  if (s.mission.stage === 3 && !alive(foe(s, 'gauge-guard')) && !alive(foe(s, 'chute-flanker'))) {
    const voss = foe(s, 'voss'); if (alive(voss) && !voss.captured) { voss.active = false; voss.fleeing = true; voss.routeIndex = 0; notice(s, 'Voss runs for the side tunnel. Pursue him or secure the station supplies.'); }
    advance(s, 4); log(s, 'Tomas and Inez held the boiler yard. Mara can search the relay room while Voss flees.');
  }
  if (s.mission.stage === 5 && s.flags.coalAmbushed && !s.flags.pavelSubdued) {
    s.timers.ambush -= worldDt;
    const pavel = npc(s, 'pavel'); follow(pavel, player, 62, worldDt, 30);
    if (s.timers.ambush <= 0 && distance(pavel, player) < 55) {
      if (player.blockTimer > 0) { s.flags.blocked = true; notice(s, 'Blocked Pavel’s strike. Shove him back, then restrain him.'); }
      else { player.hp = Math.max(0, player.hp - 12); notice(s, 'Pavel struck Mara. Block before shoving.'); }
      s.timers.ambush = 1.8;
    }
  }
  if (s.mission.stage === 6) {
    const copper = mare(s), d = distance(copper, player);
    if (d < 140 && Math.hypot(player.vx, player.vy) > 95) copper.fear = Math.min(100, copper.fear + dt * 25);
    else if (d < 110 && player.holstered && !player.mounted) copper.fear = Math.max(0, copper.fear - dt * 2);
    if (copper.fear > 65 && d < 35 && s.timers.copperKnockback <= 0) { player.hp = Math.max(1, player.hp - 6); move(player, -Math.cos(player.facing) * 28, -Math.sin(player.facing) * 28); s.timers.copperKnockback = 2.5; notice(s, 'Copper shies. Back away, holster and approach at a walk.'); }
    if (copper.leading && !copper.hitched) follow(copper, player, 125, worldDt, 45);
    if (copper.leading) { follow(npc(s, 'inez'), player, 150, worldDt, 75); follow(npc(s, 'tomas'), prop('hitch'), 85, worldDt, 35); }
  }
  if (s.mission.stage === 7) {
    s.timers.crisis -= worldDt;
    if (s.timers.crisis <= 0) { fail(s, 'The demolition fuse burned through. Retry the rescue checkpoint with both Rusks alive.'); return s; }
    if (s.flags.adaIdentified) {
      if (distance(player, { x: 1330, y: 450 }) > 750) { fail(s, 'Mara abandoned the relay rescue. Retry with Ada and Gideon still alive.'); return s; }
    }
    if (s.worldChanges.fireActive && isInside(player, { x: 1355, y: 425, w: 70, h: 85 }) && !s.worldChanges.pressureReleased) player.hp = Math.max(0, player.hp - dt * 12);
    if (player.carrying === 'gideon') {
      const gideon = npc(s, 'gideon'); gideon.x = player.x; gideon.y = player.y; gideon.carried = true;
      if (distance(player, prop('safe-walkway')) < 55) {
        player.carrying = null; gideon.carried = false; s.flags.gideonSafe = true; gideon.x = 1125; gideon.y = 415;
        notice(s, 'Gideon is on the safe walkway. Bring Ada across before the relay fails.');
      }
      else if (player.stamina <= 0) { fail(s, 'Mara could not keep Gideon lifted. Retry the rescue checkpoint with both Rusks and the service route restored.'); return s; }
    }
    if (s.flags.adaEscorting && !s.flags.adaSafe) {
      const ada = npc(s, 'ada'), point = SNOWBOUND_WORLD.rescueRoute[s.flags.adaRouteIndex];
      if (point && distance(ada, player) < 180) {
        follow(ada, point, 65, worldDt, 7); if (distance(ada, point) < 20) s.flags.adaRouteIndex++;
      }
      if (s.flags.adaRouteIndex >= SNOWBOUND_WORLD.rescueRoute.length) { s.flags.adaSafe = true; ada.x = 1150; ada.y = 430; notice(s, 'Ada crossed the walkway. She can isolate the relay circuit.'); }
    }
    if (s.flags.adaSafe && s.flags.gideonSafe && s.worldChanges.pressureReleased) {
      s.worldChanges.relayCircuitOff = true; s.worldChanges.boilerDestroyed = true; s.worldChanges.relayDamaged = true; s.worldChanges.fireActive = false;
      foe(s, 'saboteur').active = false; foe(s, 'saboteur').escaped = alive(foe(s, 'saboteur'));
      if (s.flags.rescuePriority === 'preserve-log') {
        const gideon = npc(s, 'gideon'); gideon.hp = Math.max(25, gideon.hp - 12);
        if (s.inventory.bandages > 0) { s.inventory.bandages--; log(s, 'A station bandage treated Gideon after the longer rescue for the message log.'); }
        s.companions.gideon.severity = 2; s.companions.ada.trust += 20;
      } else {
        s.companions.gideon.severity = 1; s.companions.ada.trust += 12;
        const book = s.supplies.find((item) => item.id === 'logbook'); if (!book.collected) { book.lost = true; log(s, 'The uncollected message log burned while Mara carried Gideon first. Silas’s essential rescue lead survives.'); }
      }
      s.companions.gideon.careNeeded = true; s.horse.hitched = false; s.horse.follow = true;
      log(s, 'Ada isolated the relay circuit. The boiler wing collapsed; the relay remains damaged but usable. Both Rusks survived.');
      advance(s, 8, 'Rusks safe on the walkway');
    }
  }
  if (s.mission.stage === 8 && !s.mission.completed) {
    const atRefuge = distance(player, prop('stove-store')) < 220;
    for (const id of ['ada', 'gideon', 'tomas', 'inez']) follow(npc(s, id), atRefuge ? SNOWBOUND_WORLD.campHomes[id] : player, id === 'gideon' ? 100 : 145, worldDt, atRefuge ? 8 : id === 'gideon' ? 65 : 95);
  }
  if (s.flags.pavelChoice === 'bind' && !s.mission.completed) follow(npc(s, 'pavel'), npc(s, 'tomas'), 105, worldDt, 60);
  if (s.mission.completed) {
    for (const [id, home] of Object.entries(SNOWBOUND_WORLD.campHomes)) if (id !== 'pavel' || s.flags.pavelChoice === 'bind') follow(npc(s, id), home, id === 'gideon' ? 30 : 70, worldDt, 8);
  }
  if (player.hp <= 0) fail(s, 'Mara fell. Retry restores actors, equipment, pickups, mounts and the current crisis.');
  for (const id of ['tomas', 'inez', 'ada', 'gideon']) if (!alive(npc(s, id))) fail(s, `${npc(s, id).name} fell. Essential companions must survive.`);
  return s;
}

export function getCampaignInteractions(s) {
  if (s.dialog || s.failure) return [];
  const offers = [], player = s.player;
  const offer = (id, label, point, max = 55, priority = 3, targetId = id) => {
    if (point && distance(player, point) <= max) offers.push({ id, label, targetId, distance: distance(player, point), priority });
  };
  if (player.mounted) offer('dismount', `Dismount ${s.horse.name}`, player, 1, 1);
  else if (alive(s.horse) && !player.carrying && s.horse.ridingUnlocked) offer('mount', `Ride ${s.horse.name}`, s.horse, 48, 1);
  if (s.mission.stage === 0) {
    if (!s.flags.coatTaken) offer('coat', 'Put on the wool coat', prop('coat'), 45, 7);
    if (!s.flags.lanternTaken) offer('lantern', 'Take the starter lantern', prop('lantern'), 45, 6);
    offer('tomas', 'Speak with Tomas Reed', npc(s, 'tomas'), 62, 4);
  }
  if (s.mission.stage === 1) {
    if (!s.flags.wireInspected) offer('wire', 'Inspect the severed wire', prop('wire'), 55, 6);
    if (s.flags.wireInspected && !s.flags.inezJoined) offer('inez', 'Speak with Inez Pike', npc(s, 'inez'), 70, 5);
  }
  if (s.mission.stage === 2) {
    if (!s.flags.mountsHitched) offer('hitch', 'Hitch the traveling mounts', prop('hitch'), 70, 6);
    else if (!s.flags.cover) {
      offer('cover-culvert', 'Take culvert cover', prop('cover-culvert'), 55, 5);
      offer('cover-winch', 'Take winch cover', prop('cover-winch'), 55, 5);
    } else if (!s.flags.negotiationPending) offer('tomas', 'Signal Tomas to approach Voss', npc(s, 'tomas'), 180, 5);
    if (!s.flags.evictionTagRead) offer('eviction-tag', 'Inspect Copper’s eviction tag', prop('eviction-tag'), 55, 3);
  }
  const voss = foe(s, 'voss');
  if (voss.fleeing && alive(voss) && !voss.escaped && !voss.captured) offer('capture-voss', 'Restrain Ansel Voss before he escapes', voss, 42, 9, 'voss');
  if (s.mission.stage >= 4 && !s.mission.completed) {
    for (const item of s.supplies) if (!item.collected && !item.lost) offer(`pickup:${item.id}`, `Take ${item.name.toLowerCase()}`, item, 35, 8, item.id);
  }
  if (s.mission.stage === 4 && s.supplies.find((item) => item.id === 'blankets').collected && s.supplies.find((item) => item.id === 'kindling').collected && s.supplies.some((item) => ['broth', 'oats'].includes(item.id) && item.collected)) offer('investigate-coal', 'Investigate the coal-store platform', { x: 1180, y: 760 }, 65, 6);
  if (s.mission.stage === 5) {
    if (!s.flags.coalAmbushed) offer('investigate-coal', 'Investigate the coal-store platform', { x: 1180, y: 760 }, 65, 6);
    if (s.flags.coalAmbushed && !s.flags.pavelSubdued) offer(!s.flags.blocked ? 'block' : s.flags.shoves < 2 ? 'shove' : 'restrain', !s.flags.blocked ? 'Block Pavel’s strike' : s.flags.shoves < 2 ? 'Shove Pavel back' : 'Restrain Pavel', npc(s, 'pavel'), 65, 9, 'pavel');
    if (s.flags.pavelSubdued) {
      for (const id of ['weapon', 'token']) if (s.dropped[id] && !s.dropped[id].collected) offer(`pickup:${id}`, id === 'weapon' ? 'Recover the dropped revolver' : 'Recover the community token', s.dropped[id], 38, 10, id);
      if (s.flags.weaponRecovered && s.flags.tokenRecovered && !s.flags.pavelChoice) offer('interrogate-pavel', 'Question Pavel about the fuse and Silas', npc(s, 'pavel'), 65, 7, 'pavel');
    }
  }
  if (s.mission.stage === 6) {
    const copper = mare(s);
    if (!player.holstered) offer('holster', 'Holster the revolver before approaching Copper', player, 1, 4);
    else if (!s.flags.copperSpoken) offer('speak-copper', 'Speak softly to Copper', copper, 100, 5, 'copper');
    else if (!s.flags.copperCalmed || copper.fear > 40) offer('calm-copper', 'Calm Copper', copper, 75, 5, 'copper');
    else if (!s.flags.copperPatted) offer('pat-copper', 'Pat Copper and inspect Inez’s old halter', copper, 40, 5, 'copper');
    else if (!s.flags.copperLeading) offer('lead-copper', 'Lead Copper to the traveling hitch', copper, 50, 5, 'copper');
    else if (!s.flags.copperHitched) offer('hitch-copper', 'Secure Copper at the hitch', prop('hitch'), 70, 6, 'copper');
  }
  if (s.mission.stage === 7) {
    if (!s.flags.adaIdentified) offer('speaking-tube', 'Answer Ada’s alarm through the speaking tube', prop('speaking-tube'), 60, 6);
    if (s.flags.adaIdentified && !s.worldChanges.pressureReleased) offer('pressure-valve', 'Open the pressure relief valve', prop('pressure-valve'), 55, 8);
    if (s.flags.adaIdentified && s.worldChanges.pressureReleased) {
      if (!s.flags.adaEscorting && !s.flags.adaSafe) offer('escort-ada', 'Guide Ada to the service walkway', npc(s, 'ada'), 62, 5, 'ada');
      if (!player.carrying && !s.flags.gideonSafe) offer('carry-gideon', 'Carry Gideon through the service door', npc(s, 'gideon'), 48, 6, 'gideon');
      if (player.carrying) offer('set-down-gideon', 'Set Gideon down safely', player, 1, 1, 'gideon');
    }
  }
  if (s.mission.stage === 8 && !s.mission.completed) offer('deposit-supplies', 'Deposit supplies in the communal stove store', prop('stove-store'), 65, 7);
  if (s.mission.completed) {
    if (s.camp.oats > 0) offer('camp-oats', 'Take camp oats to feed Copper', prop('stove-store'), 65, 5);
    offer('tomas', 'Speak with Tomas about Silas and the choices at Copperglass', npc(s, 'tomas'), 62, distance(player, npc(s, 'tomas')) < 25 ? 6 : 4);
    offer('ada', 'Ask Ada about Gideon and the damaged relay', npc(s, 'ada'), 62, distance(player, npc(s, 'ada')) < 25 ? 6 : 4);
    offer('inez', 'Speak with Inez about Copper and the station choices', npc(s, 'inez'), 62, distance(player, npc(s, 'inez')) < 25 ? 6 : 4);
  }
  offers.sort((a, b) => b.priority - a.priority || a.distance - b.distance); return offers;
}
export function getCampaignInteraction(s) { return getCampaignInteractions(s)[0] || null; }

export function interactCampaign(s, requestedId = null) {
  const offered = requestedId ? getCampaignInteractions(s).find((offer) => offer.id === requestedId) : getCampaignInteraction(s);
  if (!offered) { notice(s, 'Move closer to the marked person or object.'); return s; }
  const id = offered.id, player = s.player;
  if (['holster', 'block', 'shove', 'restrain'].includes(id)) return campaignAction(s, id);
  if (id === 'mount') {
    let saddle = { x: s.horse.x, y: s.horse.y };
    if (blocked(saddle.x, saddle.y, 14)) {
      let safe = null;
      for (const radius of [12, 24, 36]) for (let i = 0; i < 8 && !safe; i++) {
        const point = { x: s.horse.x + Math.cos(i * Math.PI / 4) * radius, y: s.horse.y + Math.sin(i * Math.PI / 4) * radius };
        if (!blocked(point.x, point.y, 14)) safe = point;
      }
      if (!safe) { notice(s, 'Lead the horse away from the wall before mounting.'); return s; }
      saddle = safe;
    }
    player.mounted = true; player.x = s.horse.x = saddle.x; player.y = s.horse.y = saddle.y; s.horse.hitched = false; notice(s, `Mounted ${s.horse.name}.`);
  }
  else if (id === 'dismount') { player.mounted = false; notice(s, 'Dismounted. The wire trail and station lamp show the way.'); }
  else if (id === 'coat') { s.flags.coatTaken = true; player.coldcoat = true; notice(s, 'Wool coat on. The cold is held at bay.'); depart(s); }
  else if (id === 'lantern') { s.flags.lanternTaken = true; player.lantern = true; notice(s, 'Lantern taken. Keep its light with the party.'); depart(s); }
  else if (id === 'tomas' && s.mission.stage === 0) talk(s, 'kiln-briefing', 'Tomas Reed', 'Neri should have lived to see another morning. Copperglass still has a smoking chimney. Bring blankets, food and fuel; Inez will find our pack mare. Silas Orr vanished with the last message. Keep your coat and lantern close.', [['accept-journey', 'I have the coat and light. Lead the way.'], ['leave', 'I need to prepare.']]);
  else if (id === 'wire') { s.flags.wireInspected = true; notice(s, 'The telegraph cable was cut, not torn by weather. Inez waits beside it.'); log(s, 'Mara found a deliberately severed signal wire.'); }
  else if (id === 'inez' && s.mission.stage === 1) talk(s, 'wire-inez', 'Inez Pike', 'Company cutters. They took Copper, too. She knows my rope halter. I’ll watch the animal pen while Tomas talks; keep us together on the last climb.', [['join-inez', 'Ride with us. We’ll bring Copper home.'], ['leave', 'Give me a moment.']]);
  else if (id === 'hitch') { player.mounted = false; npc(s, 'tomas').mounted = false; s.flags.mountsHitched = true; s.horse.hitched = true; s.horse.x = 1100; s.horse.y = 585; s.mounts[0].x = 1070; s.mounts[0].y = 590; notice(s, 'Mounts hitched outside rifle range. Choose culvert or timber-winch cover while Tomas and Inez move into position.'); }
  else if (id.startsWith('cover-')) { s.flags.cover = id.slice(6); notice(s, 'Tomas approaches the relay gate. Inez moves toward the animal pen. Signal when you are ready to protect them.'); }
  else if (id === 'eviction-tag') { s.flags.evictionTagRead = true; notice(s, 'The saddle tag lists Copper as seized property. Inez recognizes her old halter.'); }
  else if (id === 'tomas' && s.mission.stage === 2) talk(s, 'company-signature', 'Tomas Reed', 'Stay behind that cover. I’ll ask to inspect the boiler as a company messenger. If Voss sees the token, we need a way back to the horses.', [['company-message', 'Stay ready. I’ll protect you.'], ['leave', 'Wait. Let me reposition.']]);
  else if (id === 'capture-voss') { const voss = foe(s, 'voss'); voss.captured = true; voss.active = false; voss.fleeing = false; s.worldChanges.vossFutureCheckpoint = false; notice(s, 'Voss restrained before the tunnel. The community will have a witness.'); log(s, 'Mara captured Ansel Voss at the service exit. He cannot patrol the later freight checkpoint.'); }
  else if (id.startsWith('pickup:')) {
    const itemId = id.slice(7), dropped = s.dropped[itemId];
    if (dropped) { dropped.collected = true; if (itemId === 'weapon') { player.weaponOwned = true; s.flags.weaponRecovered = true; notice(s, 'Revolver recovered.'); } else { s.inventory.token = 1; s.flags.tokenRecovered = true; notice(s, 'Community token recovered. Pavel can now be questioned.'); } }
    else {
      const item = s.supplies.find((item) => item.id === itemId); item.collected = true; s.inventory[itemId] += item.amount;
      if (itemId === 'logbook') { s.worldChanges.logRecovered = true; s.flags.logSecured = true; log(s, 'The Copperglass message log schedules Silas Orr’s interception at the ice viaduct. This record may support a later railroad hearing.'); }
      notice(s, `Collected ${item.name.toLowerCase()} × ${item.amount}.`); log(s, `Mara collected the station’s ${item.name.toLowerCase()}.`);
    }
  } else if (id === 'investigate-coal') {
    if (s.mission.stage === 4) advance(s, 5, 'Coal-store threshold');
    s.flags.coalAmbushed = true; player.weaponOwned = false; player.holstered = true; s.inventory.token = 0;
    s.dropped.weapon = { x: player.x - 24, y: player.y - 15, collected: false }; s.dropped.token = { x: player.x + 24, y: player.y + 15, collected: false };
    const pavel = npc(s, 'pavel'); pavel.hidden = false; pavel.x = player.x + 30; pavel.y = player.y; pavel.hp = 80;
    s.timers.ambush = 1.2; notice(s, 'Pavel drops from the platform and disarms Mara. Block, shove twice, then restrain him.'); log(s, 'Pavel Dune ambushed Mara in the coal store. Her revolver and community token fell to the floor.');
  } else if (id === 'interrogate-pavel') talk(s, 'pavel-interrogation', 'Pavel Dune', 'Voss set a pressure fuse below the relay. Open the west relief valve before moving the Rusks. The keeper hid Silas’s route: the ice viaduct, beyond the north cutting. I was paid to strip wire, not burn people.', [['release-pavel', 'Release him. Bring a warning if the company returns.'], ['bind-pavel', 'Bind him for the community’s later judgment.'], ['kill-pavel', 'Kill him for the ambush.']]);
  else if (id === 'speak-copper') {
    if (!player.holstered || player.mounted) { notice(s, 'Holster and dismount before approaching Copper.'); return s; }
    s.flags.copperSpoken = true; mare(s).fear = Math.max(0, mare(s).fear - 15); notice(s, 'Copper turns an ear toward the name she knows.');
  } else if (id === 'calm-copper') {
    if (!player.holstered || Math.hypot(player.vx, player.vy) > 90) { notice(s, 'Stand quietly with the weapon holstered.'); return s; }
    s.flags.copperCalmed = true; mare(s).fear = Math.max(0, mare(s).fear - 30); notice(s, 'Copper’s breathing slows. Stay gentle; then pat her.');
  } else if (id === 'pat-copper') { s.flags.copperPatted = true; mare(s).fear = Math.max(0, mare(s).fear - 20); log(s, 'Inez’s old rope halter identifies Copper as the community’s seized pack mare.'); notice(s, 'Copper accepts Mara’s hand. Inez recognizes the old rope halter.'); }
  else if (id === 'lead-copper') { s.flags.copperLeading = true; mare(s).leading = true; notice(s, 'Copper follows the halter. Walk her to the traveling hitch.'); }
  else if (id === 'hitch-copper') {
    if (distance(mare(s), prop('hitch')) > 85 || mare(s).fear > 40) { notice(s, 'Lead Copper close to the hitch and let her settle first.'); return s; }
    mare(s).hitched = true; mare(s).leading = false; s.flags.copperHitched = true;
    talk(s, 'copper-ownership', 'Inez Pike', 'That halter was mine before the eviction. Copper belongs with the people, and you brought her back. Take her for the supply journeys, Mara. Feed her, and she’ll carry more than any of us.', [['accept-copper', 'I’ll care for Copper and carry the camp supplies.']]);
  } else if (id === 'speaking-tube') talk(s, 'ada-alarm', 'Ada Rusk · Speaking Tube', 'Someone lit the demolition fuse. My father is hurt in the relay room. Tell me who you are before I open the service door. The message log names the courier they took.', [['preserve-log', 'Mara Vale. I’ll preserve your message log, then carry your father.'], ['carry-gideon-first', 'Mara Vale. Your father comes first; I’ll bring you both out.']]);
  else if (id === 'pressure-valve') { s.worldChanges.pressureReleased = true; s.timers.crisis += 90; notice(s, 'Pressure released. The west service door is safe; the main entrance still burns.'); log(s, 'Mara opened the west pressure relief valve before moving the Rusks.'); }
  else if (id === 'escort-ada') {
    if (s.flags.rescuePriority === 'carry-gideon-first' && !s.flags.gideonSafe) { notice(s, 'You promised to carry Gideon first. Bring him to the safe walkway, then guide Ada.'); return s; }
    if (s.flags.rescuePriority === 'preserve-log' && !s.flags.logSecured) { notice(s, 'Ada waits for the message log you promised to preserve. Pick it up in the relay room.'); return s; }
    s.flags.adaEscorting = true; notice(s, 'Ada follows the stone service route while Mara stays close.');
  } else if (id === 'carry-gideon') {
    if (s.flags.rescuePriority === 'preserve-log' && !s.flags.logSecured) { notice(s, 'Recover the promised message log first.'); return s; }
    if (player.mounted) { notice(s, 'Dismount to lift Gideon.'); return s; }
    player.carrying = 'gideon'; s.flags.gideonCarried = true; npc(s, 'gideon').carried = true;
    notice(s, 'Gideon is carried. Walk through the west service door to the safe walkway.');
  } else if (id === 'set-down-gideon') { player.carrying = null; npc(s, 'gideon').carried = false; notice(s, 'Gideon is set down. Lift him again to finish the rescue.'); }
  else if (id === 'deposit-supplies') completeReturn(s);
  else if (id === 'camp-oats' && s.mission.completed && s.camp.oats > 0) { s.camp.oats--; s.camp.food--; s.inventory.oats++; notice(s, 'One serving of camp oats taken. Feed Copper beside the hitch.'); }
  else if (id === 'tomas' && s.mission.completed) talk(s, 'tomas-aftermath', 'Tomas Reed', `${s.flags.pavelChoice === 'kill' ? 'Pavel’s death will stay with us.' : s.flags.pavelChoice === 'bind' ? 'We must guard Pavel and judge him together.' : 'Pavel may warn us when the company returns.'} ${s.worldChanges.vossFutureCheckpoint ? 'Voss escaped. He will know us on the freight road.' : 'Voss will no longer control the freight road.'} Neri’s place is empty, but there is light for the living. Silas is next.`, [['leave', 'We’ll find Silas.']]);
  else if (id === 'ada' && s.mission.completed) talk(s, 'ada-aftermath', 'Ada Rusk', `${s.flags.rescuePriority === 'preserve-log' ? 'You kept the messages and brought Father back.' : 'You carried Father before anything else.'} ${s.worldChanges.logRecovered ? 'The hearing will have a written record.' : 'We lost the log, but I remember Silas’s route.'} The boiler wing is gone. The relay can still serve the mountain.`, [['leave', 'The camp will help Gideon recover.']]);
  else if (id === 'inez' && s.mission.completed) {
    const pavelReaction = { release: 'You let Pavel walk. If he keeps his word, we will hear the company coming.', bind: 'You brought Pavel alive. Tomas and I will take turns guarding him until the community can judge.', kill: 'Pavel was cornered. Killing him will sit between us for a while, even with Copper home.' }[s.flags.pavelChoice];
    const voss = foe(s, 'voss');
    const vossReaction = voss.escaped ? 'Voss escaped through the tunnel. I will watch for him on the freight road.' : voss.captured ? 'Voss is restrained. His account of those eviction tags can become evidence.' : 'Voss died in the yard. No one will hear his explanation for those eviction tags.';
    const suppliesReaction = `${s.camp.blankets > 0 ? 'The recovered blankets are around the people who needed them.' : 'We still owe the people warmer blankets.'} ${s.supplies.find((item) => item.id === 'kindling').delivered > 0 ? 'Your dry kindling lit the stove.' : 'The fuel box still needs help.'} ${s.supplies.find((item) => item.id === 'bandages').delivered > 0 ? 'Gideon has the bandages that made it home.' : 'Gideon will need more dressings after the journey.'}`;
    talk(s, 'inez-aftermath', 'Inez Pike', `Copper is home, wearing the old halter. She is yours to care for, for all of us. ${pavelReaction} ${vossReaction} ${suppliesReaction}`, [['leave', 'I’ll care for Copper and keep the camp supplied.']]);
  }
  return s;
}

function completeReturn(s) {
  const store = prop('stove-store');
  if (['ada', 'gideon'].some((id) => distance(npc(s, id), store) > 165) || distance(s.horse, store) > 165 || !s.horse.owned || s.horse.id !== 'copper') { notice(s, 'Bring Ada, Gideon and Copper back to the kiln before unloading.'); return; }
  if (s.flags.pavelChoice === 'bind' && distance(npc(s, 'pavel'), store) > 165) { notice(s, 'Tomas is escorting Pavel. Keep the group together so the guarded prisoner reaches camp.'); return; }
  if (s.inventory.blankets < 1 || s.inventory.kindling < 1 || s.inventory.broth + s.inventory.oats < 1) { notice(s, 'The stove needs real blankets, kindling and food. Recover remaining station supplies before returning.'); return; }
  if (s.flags.suppliesDeposited || s.mission.rewardPaid) return;
  for (const item of s.supplies.filter((item) => item.essential)) {
    const count = s.inventory[item.id]; item.delivered = count; s.inventory[item.id] = 0;
    if (item.id === 'blankets') s.camp.blankets += count;
    else if (item.id === 'oil') s.camp.oil += count;
    else if (item.id === 'bandages') s.camp.medicine += count;
    else if (item.id === 'kindling') s.camp.materials += count;
    else { s.camp.food += count; s.camp[item.id] += count; }
  }
  s.camp.materials--; s.camp.food--; if (s.camp.broth > 0) s.camp.broth--; else s.camp.oats--; s.camp.stoveLit = true; s.camp.morale = 60;
  s.camp.pavelGuarded = s.flags.pavelChoice === 'bind'; s.flags.suppliesDeposited = true; s.mission.rewardPaid = true; s.mission.completed = true;
  s.companions.ada.joined = true; s.companions.tomas.trust += 10; s.companions.inez.trust += 15;
  s.horse.careUnlocked = true; s.horse.ridingUnlocked = true; s.horse.storageUnlocked = true;
  s.worldChanges.residentsDeparted = true; s.worldChanges.neriRemembered = true; s.sideQuests.silas.unlocked = true; s.sideQuests.silas.stage = 1;
  s.performance.noYardInjury = s.stats.yardDamage === 0;
  s.performance.allSixSupplies = s.supplies.filter((item) => item.essential).every((item) => item.collected);
  s.performance.accuracy = s.stats.shots > 0 ? s.stats.hostileHits / s.stats.shots : 0;
  s.performance.accurate = s.stats.shots > 0 && s.performance.accuracy >= .8;
  if (s.flags.pavelChoice === 'bind') npc(s, 'pavel').hidden = false;
  objective(s); notice(s, 'The Last Warm Light complete. Copper is yours to care for. A Voice Under Ice is unlocked; Silas’s separate rescue is still to come.');
  log(s, 'The recovered broth and kindling warmed the kiln. Ada joined the community; Gideon needs care. Neri’s empty place was remembered. Silas Orr’s rescue is the next obligation.');
  checkpoint(s, 'A light at the kiln');
}

export function chooseCampaign(s, optionId) {
  if (!s.dialog || !s.dialog.choices.some((choice) => choice.id === optionId)) return s;
  const before = s.dialog; s.dialog = null;
  if (optionId === 'leave') return s;
  if (['retry', 'restart', 'finish-replay'].includes(optionId)) return campaignAction(s, optionId);
  if (optionId === 'accept-journey' && before.id === 'kiln-briefing' && s.mission.stage === 0) {
    s.flags.briefed = true;
    if (!s.flags.coatTaken || !s.flags.lanternTaken) { notice(s, 'Put on the provided coat and take the lantern before leaving the kiln.'); return s; }
    depart(s);
  }
  if (optionId === 'join-inez' && before.id === 'wire-inez' && s.mission.stage === 1 && s.flags.wireInspected) { s.flags.inezJoined = true; s.companions.inez.following = true; notice(s, 'Inez joined the party. Match the others’ pace through the last switchback.'); }
  if (optionId === 'company-message' && before.id === 'company-signature' && s.flags.mountsHitched && s.flags.cover) {
    s.flags.negotiationPending = true; objective(s); notice(s, 'Hold your cover. Tomas walks toward Voss while Inez checks the seized mare.');
  }
  if (optionId === 'stand-ground' && before.id === 'voss-threat' && s.mission.stage === 2 && s.flags.negotiationStarted && s.flags.cover && s.flags.mountsHitched) { s.enemies.filter((enemy) => ['gauge-guard', 'chute-flanker', 'voss'].includes(enemy.id)).forEach((enemy) => { enemy.active = true; }); advance(s, 3, 'Boiler yard cover'); notice(s, 'The gauge guard holds the yard; the flanker moves along the coal chute. Keep Tomas and Inez alive.'); }
  if (['release-pavel', 'bind-pavel', 'kill-pavel'].includes(optionId) && before.id === 'pavel-interrogation' && s.flags.weaponRecovered && s.flags.tokenRecovered && !s.flags.pavelChoice) {
    const pavel = npc(s, 'pavel'); s.flags.pavelChoice = optionId.split('-')[0]; s.flags.rescueClue = true;
    if (s.flags.pavelChoice === 'release') { pavel.released = true; pavel.hidden = true; s.worldChanges.pavelFutureWarning = true; s.honor += 5; }
    if (s.flags.pavelChoice === 'bind') { pavel.bound = true; s.worldChanges.pavelCampGuardDuty = true; s.camp.pavelGuarded = true; s.honor += 2; }
    if (s.flags.pavelChoice === 'kill') { pavel.hp = 0; s.honor -= 20; s.companions.ada.trust -= 15; s.companions.tomas.trust -= 10; }
    log(s, `Mara chose to ${s.flags.pavelChoice} Pavel. His pressure-fuse warning and Silas’s ice-viaduct route were recorded regardless of his fate.`);
    advance(s, 6, 'Pavel’s bargain settled'); notice(s, 'Copper waits in the pen. Holster before approaching her.');
  }
  if (optionId === 'accept-copper' && before.id === 'copper-ownership' && s.mission.stage === 6 && s.flags.copperHitched) {
    mare(s).owned = true; s.horse = { ...copy(mare(s)), owned: true, leading: false, follow: false, hitched: true, careUnlocked: false, ridingUnlocked: false, storageUnlocked: false, pack: {} }; s.horse.name = 'Copper';
    log(s, 'Inez assigned Copper to Mara for community supply work. Riding, feeding and pack storage will unlock when the mare returns safely to the kiln.');
    s.worldChanges.fireActive = true; foe(s, 'saboteur').hidden = false; foe(s, 'saboteur').active = true;
    s.timers.crisis = 180; advance(s, 7, 'Relay rescue before the pressure fuse'); notice(s, 'A guard lights the demolition fuse. Ada sounds an alarm from the relay room. Answer through the west speaking tube.');
  }
  if (['preserve-log', 'carry-gideon-first'].includes(optionId) && before.id === 'ada-alarm' && s.mission.stage === 7) {
    s.flags.adaIdentified = true; s.flags.rescuePriority = optionId;
    s.flags.logSecured = s.inventory.logbook > 0;
    notice(s, 'Ada trusts your name. Open the west relief valve before moving anyone.'); log(s, `Mara promised Ada to ${optionId === 'preserve-log' ? 'preserve the message log before moving Gideon' : 'carry Gideon first'}.`);
  }
  objective(s); return s;
}

export function campaignAction(s, action) {
  if (action === 'retry') {
    if (!s.checkpoint?.data) return s;
    const keepCheckpoint = copy(s.checkpoint), canonical = s.replayCanonical ? copy(s.replayCanonical) : null, deaths = s.stats.deaths;
    const restored = copy(s.checkpoint.data); for (const key of Object.keys(s)) delete s[key]; Object.assign(s, restored);
    s.checkpoint = keepCheckpoint; s.replayCanonical = canonical; s.failure = null; s.dialog = null; s.stats.deaths = deaths;
    notice(s, `Retry · ${s.checkpoint.label}. Actors, supplies, equipment, mounts and crisis timers restored.`); return s;
  }
  if (action === 'restart') return restartCampaign(s);
  if (action === 'replay') {
    if (!s.mission.completed || s.replayCanonical) { notice(s, 'Complete this opening before replaying it.'); return s; }
    const canonical = snapshot(s), fresh = createCampaignState(); for (const key of Object.keys(s)) delete s[key]; Object.assign(s, fresh); s.replayCanonical = canonical;
    notice(s, 'Mission replay. The permanent journey is preserved in a separate snapshot.'); return s;
  }
  if (action === 'finish-replay') {
    if (!s.replayCanonical) return s;
    const canonical = copy(s.replayCanonical); for (const key of Object.keys(s)) delete s[key]; Object.assign(s, canonical); s.replayCanonical = null; checkpoint(s, 'Permanent journey after replay'); notice(s, 'Permanent journey restored. Replay supplies and choices did not transfer.'); return s;
  }
  if (s.dialog || s.failure) return s;
  if (typeof action === 'string' && action.startsWith('store:')) return storeCampaignItem(s, action.slice(6));
  if (typeof action === 'string' && action.startsWith('withdraw:')) return takeCampaignItem(s, action.slice(9));
  if (action === 'holster') { if (s.player.weaponOwned) s.player.holstered = true; notice(s, 'Weapon holstered.'); return s; }
  if (action === 'draw') { if (s.player.weaponOwned) s.player.holstered = false; return s; }
  const pavel = npc(s, 'pavel');
  if (s.mission.stage === 5 && s.flags.coalAmbushed && !s.flags.pavelSubdued && distance(s.player, pavel) <= 65 && !s.player.mounted) {
    if (action === 'block') { s.player.blockTimer = 1.5; s.flags.blocked = true; return s; }
    if (action === 'shove' && s.flags.blocked && s.timers.shoveCooldown <= 0 && s.player.stamina >= 10) {
      s.flags.shoves++; pavel.hp = Math.max(25, pavel.hp - 25); s.player.stamina -= 10; s.timers.shoveCooldown = .35; s.timers.ambush = 1.2;
      s.player.facing = Math.atan2(pavel.y - s.player.y, pavel.x - s.player.x);
      move(pavel, Math.cos(s.player.facing) * 12, Math.sin(s.player.facing) * 12); notice(s, s.flags.shoves >= 2 ? 'Pavel is off balance. Restrain him.' : 'Pavel staggered. Block and shove again.'); return s;
    }
    if (action === 'restrain' && s.flags.shoves >= 2) { s.flags.pavelSubdued = true; pavel.restrained = true; s.player.blockTimer = 0; notice(s, 'Pavel restrained. Recover the dropped revolver and community token.'); return s; }
  }
  if (action === 'restrain' && foe(s, 'voss').fleeing && distance(s.player, foe(s, 'voss')) <= 42) return interactCampaign(s, 'capture-voss');
  const aliases = { carry: 'carry-gideon', release: 'set-down-gideon', calm: 'calm-copper', pat: 'pat-copper', lead: 'lead-copper' };
  if (aliases[action]) return interactCampaign(s, aliases[action]);
  notice(s, 'That action needs the correct person, distance and mission conditions.'); return s;
}
export function restartCampaign(s) {
  const canonical = s.replayCanonical ? copy(s.replayCanonical) : null; const fresh = createCampaignState();
  for (const key of Object.keys(s)) delete s[key]; Object.assign(s, fresh); s.replayCanonical = canonical; return s;
}
export function shootCampaign(s, targetX, targetY) {
  const player = s.player;
  if (s.dialog || s.failure || !player.weaponOwned || player.reloadTimer > 0 || player.shotTimer > 0 || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return s;
  if (s.mission.stage < 3) { notice(s, 'Tomas needs a chance to speak. Keep the revolver holstered during the approach.'); return s; }
  if (player.ammo <= 0) { notice(s, 'Empty cylinder. Reload the revolver.'); return s; }
  player.ammo--; player.shotTimer = .36; player.holstered = false; player.facing = Math.atan2(targetY - player.y, targetX - player.x); s.stats.shots++;
  emitBullet(s, player, player.facing, 'player');
  if (distance(player, mare(s)) < 260 && !s.flags.copperHitched) { mare(s).fear = Math.min(100, mare(s).fear + 35); s.flags.copperCalmed = false; notice(s, 'Gunfire frightens Copper. Holster and rebuild her trust.'); }
  return s;
}
export function reloadCampaign(s) {
  const player = s.player;
  if (s.dialog || s.failure || !player.weaponOwned || player.reloadTimer > 0 || player.ammo >= 6 || player.reserve <= 0) return s;
  player.reloadTimer = 1.7; notice(s, 'Reloading…'); return s;
}
export function useCampaignItem(s, itemId) {
  if (s.failure || !(s.inventory[itemId] > 0)) return s;
  const player = s.player;
  if (['broth', 'oats'].includes(itemId) && !s.mission.completed && s.inventory.broth + s.inventory.oats <= 1) { notice(s, 'Keep the last serving for the kiln community. The stove store needs real food.'); return s; }
  if (itemId === 'tonic' && player.hp < 100) { player.hp = Math.min(100, player.hp + 55); s.inventory.tonic--; notice(s, 'Health tonic used.'); }
  else if (itemId === 'bandages' && player.hp < 100) { player.hp = Math.min(100, player.hp + 35); s.inventory.bandages--; notice(s, 'Bandages used. The remaining dressings can reach Gideon.'); }
  else if (itemId === 'coffee' && player.focus < 100) { player.focus = Math.min(100, player.focus + 50); s.inventory.coffee--; notice(s, 'Coffee restored focus.'); }
  else if (itemId === 'broth' && (player.stamina < 100 || player.hp < 100)) { player.stamina = 100; player.hp = Math.min(100, player.hp + 15); s.inventory.broth--; notice(s, 'Broth used. Keep food for the kiln’s stove store.'); }
  else if (itemId === 'oats' && distance(player, s.horse) < 80) {
    if (!s.horse.careUnlocked) { notice(s, 'Bring Copper safely back to the kiln before unlocking her feeding and riding routines.'); return s; }
    s.horse.stamina = 100; s.horse.bond = Math.min(4, s.horse.bond + .2); s.inventory.oats--; notice(s, `${s.horse.name} fed. The remaining oats can feed camp.`);
  }
  return s;
}
export function whistleCampaign(s) {
  if (!s.player.mounted && s.horse.owned && !s.failure) { s.horse.follow = true; s.horse.hitched = false; notice(s, `${s.horse.name} heard Mara’s call.`); } return s;
}

export function storeCampaignItem(s, itemId, amount = 1) {
  amount = Math.floor(amount);
  if (!CAMPAIGN_ITEMS[itemId] || !Number.isFinite(amount) || amount < 1 || s.inventory[itemId] < amount || s.failure) return s;
  if (!s.horse.storageUnlocked || distance(s.player, s.horse) >= 80) { notice(s, 'Copper’s pack unlocks after returning to the kiln. Stand beside her to store supplies.'); return s; }
  const carried = Object.values(s.horse.pack).reduce((sum, count) => sum + count, 0);
  if (carried + amount > 12) { notice(s, 'Copper’s pack holds twelve units.'); return s; }
  s.inventory[itemId] -= amount; s.horse.pack[itemId] = (s.horse.pack[itemId] || 0) + amount; notice(s, `Stored ${amount} ${CAMPAIGN_ITEMS[itemId].name.toLowerCase()} in Copper’s pack.`); return s;
}
export function takeCampaignItem(s, itemId, amount = 1) {
  amount = Math.floor(amount);
  if (!CAMPAIGN_ITEMS[itemId] || !Number.isFinite(amount) || amount < 1 || !(s.horse.pack?.[itemId] >= amount) || s.failure) return s;
  if (!s.horse.storageUnlocked || distance(s.player, s.horse) >= 80 || s.inventory[itemId] + amount > 99) { notice(s, 'Stand beside Copper with space in your satchel to take supplies.'); return s; }
  s.horse.pack[itemId] -= amount; s.inventory[itemId] += amount; notice(s, `Took ${amount} ${CAMPAIGN_ITEMS[itemId].name.toLowerCase()} from Copper’s pack.`); return s;
}

export function serializeCampaign(s) { return JSON.stringify({ ...s, notices: [], bullets: [] }); }
const SAVE_SHAPE = createCampaignState();
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const validPoint = (point) => record(point) && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= SNOWBOUND_WORLD.width && point.y >= 0 && point.y <= SNOWBOUND_WORLD.height;
function validActor(actor) {
  return record(actor) && typeof actor.id === 'string' && actor.id.length < 80 && validPoint(actor) && Number.isFinite(actor.hp) && actor.hp >= 0 && actor.hp <= 100
    && ['vx', 'vy', 'facing', 'fireTimer', 'shotTimer', 'invulnerable'].every((id) => actor[id] === undefined || Number.isFinite(actor[id]))
    && (actor.route === undefined || Array.isArray(actor.route) && actor.route.length < 10000 && actor.route.every(validPoint))
    && (actor.routeTarget === undefined || validPoint(actor.routeTarget));
}
function typedFields(data, shape) {
  return record(data) && Object.entries(shape).every(([id, value]) => value === null || typeof value === 'object' || typeof data[id] === typeof value && (typeof value !== 'number' || Number.isFinite(data[id])));
}
function validDialog(data) {
  if (data.dialog === null || data.dialog === undefined) return true;
  const d = data.dialog;
  if (!record(d) || !Array.isArray(d.choices) || typeof d.text !== 'string' || typeof d.speaker !== 'string' || d.text.length > 10000 || d.speaker.length > 200) return false;
  const scenes = {
    'kiln-briefing': { stage: 0, choices: ['accept-journey', 'leave'] },
    'wire-inez': { stage: 1, choices: ['join-inez', 'leave'] },
    'company-signature': { stage: 2, choices: ['company-message', 'leave'] },
    'voss-threat': { stage: 2, choices: ['stand-ground'] },
    'pavel-interrogation': { stage: 5, choices: ['release-pavel', 'bind-pavel', 'kill-pavel'] },
    'copper-ownership': { stage: 6, choices: ['accept-copper'] },
    'ada-alarm': { stage: 7, choices: ['preserve-log', 'carry-gideon-first'] },
    'tomas-aftermath': { stage: 8, choices: ['leave'] },
    'ada-aftermath': { stage: 8, choices: ['leave'] },
    'inez-aftermath': { stage: 8, choices: ['leave'] },
    'mission-failed': { stage: data.mission.stage, choices: ['retry', 'restart', ...(data.replayCanonical ? ['finish-replay'] : [])] },
  };
  const scene = scenes[d.id];
  return !!scene && scene.stage === data.mission.stage && d.choices.length === scene.choices.length
    && d.choices.every((choice) => record(choice) && scene.choices.includes(choice.id) && typeof choice.label === 'string' && choice.label.length < 1000)
    && new Set(d.choices.map((choice) => choice.id)).size === d.choices.length
    && (d.id !== 'mission-failed' || record(data.failure) && typeof data.failure.reason === 'string');
}
function validSave(data, nested = false) {
  if (!record(data) || data.version !== VERSION || data.region !== 'snowbound' || data.mission?.id !== ID || !Number.isInteger(data.mission.stage) || data.mission.stage < 0 || data.mission.stage > 8 || data.mission.stageCount !== 9 || typeof data.mission.completed !== 'boolean' || typeof data.mission.rewardPaid !== 'boolean') return false;
  if (!validActor(data.player) || !validActor(data.horse) || !['hp', 'stamina', 'focus', 'ammo', 'reserve', 'money', 'reloadTimer', 'shotTimer'].every((key) => Number.isFinite(data.player[key]))) return false;
  if (!typedFields(data.player, SAVE_SHAPE.player) || !typedFields(data.horse, SAVE_SHAPE.horse) || !record(data.horse.pack)) return false;
  if (!Object.entries(data.horse.pack).every(([id, count]) => Object.hasOwn(CAMPAIGN_ITEMS, id) && Number.isInteger(count) && count >= 0 && count <= 12) || Object.values(data.horse.pack).reduce((sum, count) => sum + count, 0) > 12) return false;
  if (!['stamina', 'focus'].every((id) => data.player[id] >= 0 && data.player[id] <= 100) || !Number.isInteger(data.player.ammo) || data.player.ammo < 0 || data.player.ammo > 6 || !Number.isInteger(data.player.reserve) || data.player.reserve < 0 || data.player.reserve > 999 || data.player.reloadTimer < 0 || data.player.reloadTimer > 1.7 || data.player.shotTimer < 0 || data.player.shotTimer > .36 || data.player.blockTimer < 0 || data.player.blockTimer > 1.5) return false;
  if (data.horse.stamina < 0 || data.horse.stamina > 100 || data.horse.bond < 1 || data.horse.bond > 4 || data.horse.fear < 0 || data.horse.fear > 100 || !['juniper', 'copper'].includes(data.horse.id)) return false;
  if (!Array.isArray(data.mounts) || data.mounts.length !== 1 || !validActor(data.mounts[0]) || data.mounts[0].id !== 'tomas-mount') return false;
  if (!Array.isArray(data.npcs) || !Array.isArray(data.enemies) || !Array.isArray(data.animals) || !Array.isArray(data.supplies)) return false;
  if (data.npcs.length !== SNOWBOUND_CAST.length || data.enemies.length !== 4 || data.animals.length !== 1 || data.supplies.length !== SNOWBOUND_WORLD.supplies.length) return false;
  if (![...data.npcs, ...data.enemies, ...data.animals].every(validActor)) return false;
  if (!data.supplies.every((item) => record(item) && typeof item.id === 'string')) return false;
  if (!typedFields(data.animals[0], SAVE_SHAPE.animals[0]) || data.animals[0].fear < 0 || data.animals[0].fear > 100 || data.animals[0].bond < 1 || data.animals[0].bond > 4) return false;
  if (!data.enemies.every((actor) => { const authored = SAVE_SHAPE.enemies.find((original) => original.id === actor.id); return authored && typedFields(actor, authored); })) return false;
  if (!SNOWBOUND_CAST.every((actor) => data.npcs.some((saved) => saved.id === actor.id))) return false;
  if (!['gauge-guard', 'chute-flanker', 'voss', 'saboteur'].every((id) => data.enemies.some((actor) => actor.id === id)) || !data.animals.some((actor) => actor.id === 'copper')) return false;
  for (const collection of [data.npcs, data.enemies, data.animals, data.supplies]) if (new Set(collection.map((item) => item.id)).size !== collection.length) return false;
  if (!SNOWBOUND_WORLD.supplies.every((item) => data.supplies.some((saved) => saved.id === item.id && typeof saved.collected === 'boolean' && typeof saved.lost === 'boolean' && Number.isInteger(saved.delivered) && saved.delivered >= 0 && saved.delivered <= item.amount))) return false;
  if (!data.inventory || Object.keys(CAMPAIGN_ITEMS).some((id) => !Number.isInteger(data.inventory[id]) || data.inventory[id] < 0 || data.inventory[id] > 99)) return false;
  if (!typedFields(data.flags, SAVE_SHAPE.flags) || !typedFields(data.worldChanges, SAVE_SHAPE.worldChanges) || !typedFields(data.timers, SAVE_SHAPE.timers) || !typedFields(data.camp, SAVE_SHAPE.camp) || !record(data.companions) || !record(data.sideQuests) || !typedFields(data.stats, SAVE_SHAPE.stats) || !typedFields(data.wanted, SAVE_SHAPE.wanted)) return false;
  if (!record(data.camp.upgrades) || ![null, 'gideon'].includes(data.player.carrying)) return false;
  if (data.flags.coatTaken !== data.player.coldcoat || data.flags.lanternTaken !== data.player.lantern || !data.flags.coalAmbushed && !data.player.weaponOwned) return false;
  if (!Object.entries(SAVE_SHAPE.companions).every(([id, shape]) => typedFields(data.companions[id], shape))) return false;
  if (!typedFields(data.sideQuests.silas, SAVE_SHAPE.sideQuests.silas) || !Number.isInteger(data.sideQuests.silas.stage) || data.sideQuests.silas.stage < 0 || data.sideQuests.silas.stage > 1) return false;
  if (!Number.isInteger(data.flags.routeIndex) || data.flags.routeIndex < 0 || data.flags.routeIndex > SNOWBOUND_WORLD.trail.length || !Number.isInteger(data.flags.adaRouteIndex) || data.flags.adaRouteIndex < 0 || data.flags.adaRouteIndex > SNOWBOUND_WORLD.rescueRoute.length || !Number.isInteger(data.flags.shoves) || data.flags.shoves < 0 || data.flags.shoves > 100) return false;
  if (![null, 'culvert', 'winch'].includes(data.flags.cover) || ![null, 'release', 'bind', 'kill'].includes(data.flags.pavelChoice) || ![null, 'preserve-log', 'carry-gideon-first'].includes(data.flags.rescuePriority)) return false;
  if (!record(data.dropped) || !['weapon', 'token'].every((id) => data.dropped[id] === null || validPoint(data.dropped[id]) && typeof data.dropped[id].collected === 'boolean')) return false;
  if (data.flags.coalAmbushed && (!data.dropped.weapon || !data.dropped.token)) return false;
  if (data.flags.coalAmbushed && data.player.weaponOwned !== data.flags.weaponRecovered || data.flags.weaponRecovered && !data.dropped.weapon?.collected || data.flags.tokenRecovered && !data.dropped.token?.collected) return false;
  if (Object.values(data.stats).some((value) => !Number.isFinite(value) || value < 0)) return false;
  if (!record(data.performance) || !Number.isFinite(data.performance.accuracy) || data.performance.accuracy < 0 || data.performance.accuracy > 1 || !['noYardInjury', 'allSixSupplies', 'accurate'].every((id) => data.performance[id] === null || typeof data.performance[id] === 'boolean')) return false;
  if (!Array.isArray(data.log) || data.log.length > 100 || data.log.some((entry) => !record(entry) || typeof entry.text !== 'string' || !Number.isFinite(entry.day) || !Number.isFinite(entry.time))) return false;
  if (!validDialog(data) || !(data.failure === null || record(data.failure) && typeof data.failure.reason === 'string')) return false;
  if (!Object.values(data.timers).every(Number.isFinite) || !['food', 'medicine', 'materials', 'morale'].every((id) => Number.isFinite(data.camp[id]) && data.camp[id] >= 0)) return false;
  if (!Number.isFinite(data.elapsed) || data.elapsed < 0 || !Number.isInteger(data.day) || data.day < 1 || !Number.isFinite(data.time) || data.time < 0 || data.time >= 24 || !Number.isInteger(data.seed) || data.seed < 0) return false;
  if (data.mission.stage >= 1 && (!data.flags.coatTaken || !data.flags.lanternTaken || !data.flags.briefed)) return false;
  if (data.mission.stage >= 3 && (!data.flags.mountsHitched || !data.flags.cover || !data.flags.negotiationStarted || !data.flags.inezJoined)) return false;
  if (data.mission.stage >= 4 && data.enemies.some((actor) => ['gauge-guard', 'chute-flanker'].includes(actor.id) && alive(actor))) return false;
  if (data.mission.stage >= 6 && (!['release', 'bind', 'kill'].includes(data.flags.pavelChoice) || !data.flags.rescueClue || !data.flags.weaponRecovered || !data.flags.tokenRecovered)) return false;
  if (data.mission.stage >= 7 && (!data.flags.copperHitched || !data.horse.owned || data.horse.id !== 'copper')) return false;
  if (data.mission.stage >= 8 && (!data.flags.adaSafe || !data.flags.gideonSafe || !data.worldChanges.boilerDestroyed || !data.worldChanges.pressureReleased || !data.worldChanges.relayCircuitOff)) return false;
  if (data.mission.completed && (!data.flags.suppliesDeposited || !data.mission.rewardPaid || data.mission.stage !== 8)) return false;
  if (!data.mission.completed && (data.flags.suppliesDeposited || data.mission.rewardPaid || data.horse.id === 'copper' && (data.horse.storageUnlocked || data.horse.careUnlocked || data.horse.ridingUnlocked))) return false;
  if (data.player.carrying && (data.player.carrying !== 'gideon' || data.mission.stage !== 7 || data.flags.gideonSafe)) return false;
  if (data.checkpoint && (nested || typeof data.checkpoint.label !== 'string' || data.checkpoint.label.length > 200 || !data.checkpoint.data || !validSave(data.checkpoint.data, true) || data.checkpoint.data.mission.stage > data.mission.stage || data.mission.completed && !data.checkpoint.data.mission.completed)) return false;
  if (!nested && !data.checkpoint) return false;
  if (data.replayCanonical && (nested || !data.replayCanonical.mission?.completed || !validSave(data.replayCanonical, true))) return false;
  return true;
}
export function restoreCampaign(raw) {
  let data; try { data = typeof raw === 'string' ? JSON.parse(raw) : copy(raw); } catch { return null; }
  // Earlier version-1 replay failures offered only retry/restart. Preserve that
  // valid suspended replay and add the newly authored direct permanent-world exit.
  if (data?.replayCanonical && data.dialog?.id === 'mission-failed' && Array.isArray(data.dialog.choices) && data.dialog.choices.length === 2 && ['retry', 'restart'].every((id) => data.dialog.choices.some((choice) => choice?.id === id))) {
    data.dialog.choices.push({ id: 'finish-replay', label: 'Return to the permanent journey.' });
  }
  if (!validSave(data)) return null;
  // Restore trusted authoring identities and static supply positions; saves own only runtime state.
  const s = copy(data);
  const reconcile = (saved) => {
    saved.supplies = SNOWBOUND_WORLD.supplies.map((item) => ({ ...saved.supplies.find((supply) => supply.id === item.id), ...item }));
    for (const actor of saved.npcs) { const authored = SNOWBOUND_CAST.find((original) => original.id === actor.id); actor.name = authored.name; actor.role = authored.role; actor.faction = authored.faction; }
    for (const actor of saved.enemies) { const authored = SAVE_SHAPE.enemies.find((original) => original.id === actor.id); actor.name = authored.name; actor.kind = authored.kind; }
    saved.mission.name = 'The Last Warm Light'; saved.mission.stageCount = 9;
    if (saved.checkpoint?.data) reconcile(saved.checkpoint.data);
    if (saved.replayCanonical) reconcile(saved.replayCanonical);
  };
  reconcile(s);
  s.mission.name = 'The Last Warm Light'; s.mission.stageCount = 9; s.notices = []; s.bullets = [];
  const legal = new Set(['leave', 'accept-journey', 'join-inez', 'company-message', 'stand-ground', 'release-pavel', 'bind-pavel', 'kill-pavel', 'accept-copper', 'preserve-log', 'carry-gideon-first', 'retry', 'restart', 'finish-replay']);
  if (s.dialog && (!Array.isArray(s.dialog.choices) || s.dialog.choices.some((choice) => !legal.has(choice.id)) || typeof s.dialog.text !== 'string' || typeof s.dialog.speaker !== 'string')) return null;
  if (!s.checkpoint) checkpoint(s, 'Restored journey');
  objective(s); notice(s, 'Snowbound journey restored.'); return s;
}
