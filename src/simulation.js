/** Dust & Mercy. Deterministic, serializable frontier simulation. All distances are world units. */
export const WORLD = {
  width: 1600, height: 1200,
  places: [
    { id: 'camp', name: 'Reed Camp', x: 680, y: 720 },
    { id: 'town', name: 'Mercy Crossing', x: 1010, y: 510 },
    { id: 'pump', name: 'Cinder Pump', x: 1160, y: 900 },
    { id: 'river', name: 'Mercy River', x: 350, y: 600 },
    { id: 'woods', name: 'Juniper Woods', x: 180, y: 600 },
  ],
  river: { x: 350, width: 75, crossingY: 605, crossingHeight: 38 },
  obstacles: [
    { x: 605, y: 745, w: 70, h: 45, kind: 'tent' },
    { x: 735, y: 760, w: 60, h: 38, kind: 'tent' },
    { x: 900, y: 385, w: 100, h: 60, kind: 'store' },
    { x: 1030, y: 360, w: 110, h: 55, kind: 'sheriff' },
    { x: 910, y: 570, w: 110, h: 65, kind: 'saloon' },
    { x: 1070, y: 570, w: 90, h: 65, kind: 'stable' },
    { x: 1180, y: 935, w: 100, h: 55, kind: 'shed' },
    { x: 1085, y: 913, w: 56, h: 24, kind: 'crate' },
    { x: 1210, y: 825, w: 35, h: 38, kind: 'crate' },
    { x: 455, y: 975, w: 70, h: 26, kind: 'crate' },
  ],
};

export const riverX = (y) => 350 + Math.sin(y / 145) * 42 + Math.sin(y / 58) * 13;

export const ITEMS = {
  tonic: { name: 'Health tonic', price: 8, sell: 3, description: 'Restores 55 health.' },
  coffee: { name: 'Strong coffee', price: 5, sell: 2, description: 'Restores 65 focus.' },
  oats: { name: 'Oats & apples', price: 3, sell: 1, description: 'Restores horse stamina and improves bonding.' },
  ammo: { name: 'Revolver cartridges · 12', price: 5, sell: 0, description: 'Twelve revolver cartridges.' },
  meat: { name: 'Venison', price: 6, sell: 5, description: 'Food, trade goods, or camp supplies.' },
  pelt: { name: 'Deer pelt', price: 12, sell: 9, description: 'A hide for Nell’s trading post.' },
  trout: { name: 'River trout', price: 5, sell: 4, description: 'Fresh provisions from Mercy River.' },
  herbs: { name: 'Wild sage', price: 3, sell: 1, description: 'Gathered leaves for camp medicine.' },
  berries: { name: 'Juniper berries', price: 2, sell: 1, description: 'Food and a tonic ingredient.' },
  timber: { name: 'Dry timber', price: 4, sell: 1, description: 'Fuel and material for camp improvements.' },
  cookedMeat: { name: 'Camp supper', price: 8, sell: 3, description: 'Restores 30 health and all stamina.' },
};

export const GATHERABLES = [
  { id: 'camp-sage', kind: 'herbs', name: 'Wild sage', x: 535, y: 625, amount: 2 },
  { id: 'camp-berries', kind: 'berries', name: 'Juniper berries', x: 835, y: 825, amount: 2 },
  { id: 'camp-timber', kind: 'timber', name: 'Dry timber', x: 565, y: 850, amount: 2 },
  { id: 'woods-sage', kind: 'herbs', name: 'Wild sage', x: 210, y: 630, amount: 3 },
  { id: 'woods-timber', kind: 'timber', name: 'Dry timber', x: 260, y: 530, amount: 3 },
  { id: 'river-berries', kind: 'berries', name: 'Juniper berries', x: 455, y: 685, amount: 3 },
];

export const RECIPES = {
  'sage-tonic': { name: 'Sage health tonic', ingredients: { herbs: 2, berries: 1 }, result: 'tonic', amount: 1 },
  'camp-supper': { name: 'Camp supper', ingredients: { meat: 1, timber: 1 }, result: 'cookedMeat', amount: 1, upgrade: 'cookpot' },
};

export const CAMP_UPGRADES = {
  cookpot: { name: 'Community cookpot', price: 15, materials: 2, description: 'Unlocks camp supper crafting.' },
  shelter: { name: 'Horse shelter', price: 20, materials: 3, description: 'Rest restores Juniper’s health; galloping uses less stamina.' },
  infirmary: { name: 'Medicine chest', price: 25, materials: 2, medicine: 2, description: 'Recovery restores full focus and reduces medical costs.' },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inRect = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
const alive = (entity) => entity.hp > 0;
const MAX_LOG = 40;
const VERSION = 2;

function notice(s, text) {
  s.notices.push({ text, time: 5 });
  s.notices = s.notices.slice(-5);
}
function journal(s, text) {
  s.log.push({ day: s.day, time: Math.round(s.time * 100) / 100, text });
  s.log = s.log.slice(-MAX_LOG);
}
function dialog(s, id, speaker, text, choices) {
  s.dialog = { id, speaker, text, choices: choices.map(([choiceId, label]) => ({ id: choiceId, label })) };
}
function rng(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function objective(s) {
  const tasks = [
    'Speak with Ada Reed at Reed Camp.',
    'Find Silas Venn at Mercy Crossing and learn what happened to his water.',
    'Inspect the chained valve at Cinder Pump, southeast of town.',
    'Clear the three syndicate guards from Cinder Pump. Use the crates as cover.',
    'Confront Gideon Pike at the pump and decide his fate.',
    'Repair the chained water valve at Cinder Pump.',
    'Return to Ada Reed at camp with the water running.',
    'The Last Water is complete. Explore Mercy Vale and find new work.',
  ];
  s.mission.objective = tasks[s.mission.stage] || tasks[7];
}

function checkpoint(s) {
  const positions = [[710, 700], [710, 700], [1035, 850], [1035, 850], [1070, 870], [1070, 870], [710, 700], [710, 700]];
  const [x, y] = positions[s.mission.stage];
  s.checkpoint = {
    stage: s.mission.stage, x, y,
    guards: s.enemies.filter((e) => e.id.startsWith('pump-')).map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })),
  };
}

function campNearby(s) {
  return distance(s.player, { x: 690, y: 750 }) < 160;
}

function dangerNearby(s) {
  return s.wanted.pursuit || s.enemies.some((e) => e.active && alive(e) && distance(e, s.player) < 300);
}

export function createState() {
  const s = {
    version: VERSION, seed: 134209, elapsed: 0, day: 1, time: 16.4, weather: 'clear',
    player: {
      name: 'Mara Vale', x: 720, y: 680, vx: 0, vy: 0, hp: 100, stamina: 100,
      focus: 100, facing: 0, mounted: false, ammo: 6, reserve: 36, money: 40,
      reloadTimer: 0, shotTimer: 0, invulnerable: 0, crouch: false, holstered: false,
    },
    horse: { x: 755, y: 715, hp: 100, stamina: 100, bond: 1, name: 'Juniper', follow: false },
    npcs: [
      { id: 'ada', name: 'Ada Reed', x: 680, y: 720, role: 'camp leader', hp: 100, faction: 'camp' },
      { id: 'silas', name: 'Silas Venn', x: 995, y: 540, role: 'rancher', hp: 100, faction: 'civilian' },
      { id: 'eliza', name: 'Marshal Eliza Holt', x: 1060, y: 450, role: 'marshal', hp: 100, faction: 'law' },
      { id: 'nell', name: 'Nell Bell', x: 950, y: 475, role: 'merchant', hp: 100, faction: 'civilian' },
      { id: 'gideon', name: 'Gideon Pike', x: 1170, y: 890, role: 'railroad foreman', hp: 100, faction: 'syndicate' },
      { id: 'tomas', name: 'Tomas Ash', x: 600, y: 680, role: 'camp carpenter', hp: 100, faction: 'camp' },
      { id: 'fern', name: 'Fern Bell', x: 835, y: 705, role: 'camp healer', hp: 100, faction: 'camp' },
    ],
    enemies: [
      { id: 'pump-1', x: 1135, y: 868, hp: 70, facing: 0, fireTimer: 2, kind: 'guard', active: false },
      { id: 'pump-2', x: 1225, y: 895, hp: 70, facing: 0, fireTimer: 2.8, kind: 'guard', active: false },
      { id: 'pump-3', x: 1168, y: 810, hp: 70, facing: 0, fireTimer: 3.4, kind: 'guard', active: false },
    ],
    animals: [
      { id: 'deer-1', kind: 'deer', x: 190, y: 550, hp: 45, homeX: 190, homeY: 550, phase: 0 },
      { id: 'deer-2', kind: 'deer', x: 245, y: 710, hp: 45, homeX: 245, homeY: 710, phase: 2 },
      { id: 'deer-3', kind: 'deer', x: 510, y: 320, hp: 45, homeX: 510, homeY: 320, phase: 4 },
      { id: 'stray', kind: 'horse', name: 'Copper', x: 160, y: 390, hp: 100, homeX: 160, homeY: 390, phase: 1 },
    ],
    bullets: [], wanted: { heat: 0, bounty: 0, witnessTimer: 0, pursuit: false, spawnTimer: 0 },
    honor: 0, inventory: { tonic: 2, coffee: 1, oats: 2, meat: 0, pelt: 0, trout: 0, wrench: 0, herbs: 0, berries: 0, timber: 0, cookedMeat: 0 },
    resources: GATHERABLES.map((node) => ({ ...node, availableDay: 1 })),
    camp: { food: 4, medicine: 1, materials: 0, morale: 50, donations: 0, upgrades: { cookpot: false, shelter: false, infirmary: false } },
    companions: {
      tomas: { trust: 0, requestStage: 0 },
      fern: { trust: 0, requestStage: 0 },
    },
    mission: { id: 'the-last-water', name: 'The Last Water', stage: 0, completed: false, choice: null, waterRunning: false, rewardPaid: false },
    sideQuests: {
      horse: { name: 'A Horse Called Copper', stage: 0, complete: false },
      bounty: { name: 'The Juniper Deserter', stage: 0, complete: false, targetAlive: false },
      provisions: { name: 'Enough for Everyone', stage: 0, complete: false },
    },
    fishing: { active: false, timer: 0, bite: false, catches: 0 },
    companion: null, captive: null, checkpoint: null,
    stats: { shots: 0, kills: 0, hunted: 0, fish: 0, deaths: 0, distance: 0, gathered: 0, crafted: 0 },
    log: [], dialog: null, notices: [], lastSave: null,
  };
  objective(s);
  checkpoint(s);
  journal(s, 'Mara Vale arrived in Mercy Vale with Juniper, forty dollars, and a promise to Ada Reed.');
  return s;
}

function blocked(x, y, radius = 9, swimming = false) {
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
  if (WORLD.obstacles.some((o) => inRect({ x, y }, o, radius))) return true;
  const river = WORLD.river;
  const center = riverX(y);
  return !swimming && x > center - river.width / 2 && x < center + river.width / 2 && Math.abs(y - river.crossingY) > river.crossingHeight / 2;
}
function move(entity, dx, dy, radius = 9) {
  if (!blocked(entity.x + dx, entity.y, radius)) entity.x = clamp(entity.x + dx, radius, WORLD.width - radius);
  if (!blocked(entity.x, entity.y + dy, radius)) entity.y = clamp(entity.y + dy, radius, WORLD.height - radius);
}
function lineBlocked(a, b) {
  const n = Math.ceil(distance(a, b) / 6);
  for (let i = 1; i < n; i++) {
    const p = { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n };
    if (WORLD.obstacles.some((o) => inRect(p, o))) return true;
  }
  return false;
}
function crime(s, severity, description) {
  s.wanted.heat = clamp(s.wanted.heat + severity, 0, 100);
  const witness = s.npcs.find((n) => alive(n) && n.faction !== 'syndicate' && distance(n, s.player) < 260);
  if (witness) {
    s.wanted.witnessTimer = Math.max(s.wanted.witnessTimer, 7);
    s.wanted.bounty += severity >= 35 ? 20 : 5;
    notice(s, `${witness.name} witnessed ${description}. Leave the area before the law arrives.`);
  } else notice(s, `${description[0].toUpperCase()}${description.slice(1)} raised your heat.`);
  s.honor = clamp(s.honor - Math.ceil(severity / 5), -100, 100);
  journal(s, `${description}; heat ${Math.round(s.wanted.heat)}, bounty $${s.wanted.bounty}.`);
}
function spawnLaw(s) {
  if (s.enemies.filter((e) => e.kind === 'law' && alive(e)).length >= 3) return;
  const angle = rng(s) * Math.PI * 2;
  const law = {
    id: `law-${Math.floor(s.elapsed * 100)}-${s.enemies.length}`, kind: 'law', hp: 90, active: true,
    x: clamp(s.player.x + Math.cos(angle) * 340, 40, 1560),
    y: clamp(s.player.y + Math.sin(angle) * 340, 40, 1160), facing: angle + Math.PI, fireTimer: 2.5,
  };
  if (!blocked(law.x, law.y)) s.enemies.push(law);
}
function updateMission(s) {
  if (s.mission.stage === 3 && s.enemies.filter((e) => e.id.startsWith('pump-')).every((e) => !alive(e))) {
    s.mission.stage = 4;
    checkpoint(s);
    notice(s, 'The guards are down. Gideon Pike has nowhere left to hide.');
    journal(s, 'The Cinder Pump guards fell. Gideon still holds the wrench.');
  }
  objective(s);
}

function hit(s, bullet) {
  if (bullet.faction !== 'player') {
    if (distance(bullet, s.player) < (s.player.mounted ? 17 : 12) && s.player.invulnerable <= 0) {
      s.player.hp = Math.max(0, s.player.hp - bullet.damage);
      s.player.invulnerable = 0.22;
      notice(s, 'Hit! Move behind cover or use a health tonic.');
      return true;
    }
    return false;
  }
  const enemy = s.enemies.find((e) => alive(e) && distance(e, bullet) < 14);
  if (enemy) {
    enemy.hp = Math.max(0, enemy.hp - bullet.damage);
    enemy.active = true;
    if (enemy.id === 'deserter' && enemy.hp > 0 && enemy.hp <= 25) {
      enemy.surrendered = true; enemy.active = false;
      notice(s, 'The deserter lowers his gun. Approach to tie him up.');
    }
    if (!alive(enemy)) {
      s.stats.kills++;
      if (enemy.kind === 'law') crime(s, 40, 'shooting a law officer');
      if (enemy.id === 'deserter') {
        s.sideQuests.bounty.targetAlive = false;
        notice(s, 'The deserter is down. Collect his identity papers.');
      }
    }
    return true;
  }
  const animal = s.animals.find((a) => alive(a) && distance(a, bullet) < 15);
  if (animal) {
    animal.hp = Math.max(0, animal.hp - bullet.damage);
    if (animal.kind === 'horse') crime(s, 30, 'shooting a horse');
    if (!alive(animal)) notice(s, animal.kind === 'deer' ? 'Clean kill. Approach the deer to harvest meat and a pelt.' : 'The horse is down.');
    return true;
  }
  const npc = s.npcs.find((n) => alive(n) && distance(n, bullet) < 12);
  if (npc) {
    // Essential characters retreat instead of being permanently removed from the campaign.
    npc.hp = Math.max(15, npc.hp - bullet.damage);
    npc.fleeTimer = 10;
    crime(s, 45, `assaulting ${npc.name}`);
    return true;
  }
  return false;
}
function bulletStep(s, dt) {
  for (const b of s.bullets) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6));
    for (let i = 0; i < steps && b.ttl > 0; i++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      b.ttl -= dt / steps;
      if (WORLD.obstacles.some((o) => inRect(b, o)) || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height || hit(s, b)) b.ttl = 0;
    }
  }
  s.bullets = s.bullets.filter((b) => b.ttl > 0);
}
function fireBullet(s, origin, angle, faction, damage, speed = 600) {
  s.bullets.push({ x: origin.x + Math.cos(angle) * 18, y: origin.y + Math.sin(angle) * 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, ttl: 1.1, faction, damage });
}
function defeat(s) {
  s.stats.deaths++;
  const loss = Math.min(s.player.money, (s.camp.upgrades.infirmary ? 3 : 8) + Math.round(s.wanted.bounty * 0.1));
  s.player.money -= loss;
  s.player.hp = 100; s.player.stamina = 100; s.player.focus = s.camp.upgrades.infirmary ? 100 : 70;
  const saved = s.checkpoint?.stage === s.mission.stage ? s.checkpoint : null;
  s.player.x = saved?.x ?? 710; s.player.y = saved?.y ?? 700; s.player.mounted = false;
  s.player.reloadTimer = 0; s.player.shotTimer = 0; s.player.focusActive = false;
  s.horse.x = s.player.x + 35; s.horse.y = s.player.y + 15;
  if (saved && s.mission.stage === 3) {
    for (const guard of saved.guards) {
      const enemy = s.enemies.find((e) => e.id === guard.id);
      if (enemy) Object.assign(enemy, guard, { active: true, fireTimer: 2.5 });
    }
  }
  const companion = s.animals.find((a) => a.id === s.companion && alive(a));
  if (companion) { companion.x = s.player.x - 40; companion.y = s.player.y + 20; }
  const captive = s.enemies.find((e) => e.id === s.captive && alive(e));
  if (captive) { captive.x = s.player.x - 40; captive.y = s.player.y + 20; }
  s.bullets = []; s.wanted.heat = 0; s.wanted.pursuit = false; s.wanted.witnessTimer = 0;
  s.enemies = s.enemies.filter((e) => e.kind !== 'law');
  s.dialog = null; s.player.invulnerable = 4;
  s.fishing.active = false; s.fishing.bite = false;
  notice(s, `Recovered at your mission checkpoint. Lost $${loss}; supplies and completed choices are preserved.`);
  journal(s, `Mara was wounded and recovered at checkpoint ${s.mission.stage}, losing $${loss}.`);
}

export function step(s, dt, input = {}) {
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  if (!dt) return s;
  s.elapsed += dt;
  s.notices.forEach((n) => { n.time -= dt; });
  s.notices = s.notices.filter((n) => n.time > 0);
  if (s.player.hp <= 0) { defeat(s); return s; }
  if (s.dialog) return s;
  const p = s.player;
  p.shotTimer = Math.max(0, p.shotTimer - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const amount = Math.min(6 - p.ammo, p.reserve);
      p.ammo += amount; p.reserve -= amount; p.reloadTimer = 0;
      notice(s, 'Revolver loaded.');
    }
  }
  p.focusActive = !!input.focus && p.focus > 0.1 && !p.mounted;
  if (p.focusActive) p.focus = Math.max(0, p.focus - dt * 20);
  else p.focus = Math.min(100, p.focus + dt * 2.4);
  const worldDt = dt * (p.focusActive ? 0.3 : 1);
  s.time += worldDt * 0.018;
  if (s.time >= 24) { s.time -= 24; s.day++; }
  s.weather = Math.floor(s.elapsed / 180) % 3 === 1 ? 'rain' : Math.floor(s.elapsed / 180) % 3 === 2 ? 'overcast' : 'clear';
  let mx = clamp(Number(input.mx) || 0, -1, 1), my = clamp(Number(input.my) || 0, -1, 1);
  const magnitude = Math.hypot(mx, my);
  if (magnitude > 1) { mx /= magnitude; my /= magnitude; }
  p.crouch = !!input.crouch && !p.mounted;
  const moving = Math.hypot(mx, my) > 0.01;
  const sprint = !!input.sprint && moving && (p.mounted ? s.horse.stamina : p.stamina) > 1 && !p.crouch;
  const speed = (p.mounted ? sprint ? 215 : 135 : p.crouch ? 43 : sprint ? 123 : 78) * (s.weather === 'rain' ? p.mounted ? 0.9 : 0.94 : 1);
  const ox = p.x, oy = p.y;
  move(p, mx * speed * dt, my * speed * dt, p.mounted ? 15 : 9);
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  s.stats.distance += Math.hypot(p.x - ox, p.y - oy);
  if (moving) p.facing = Math.atan2(my, mx);
  p.stamina = clamp(p.stamina + dt * (sprint && !p.mounted ? -14 : 9), 0, 100);
  if (p.mounted) {
    s.horse.x = p.x; s.horse.y = p.y;
    s.horse.stamina = clamp(s.horse.stamina + dt * (sprint ? s.camp.upgrades.shelter ? -7 : -10 : 5), 0, 100);
    if (moving) s.horse.bond = Math.min(4, s.horse.bond + dt * 0.001);
  } else {
    s.horse.stamina = Math.min(100, s.horse.stamina + dt * 8);
    if (s.horse.follow && distance(s.horse, p) > 65) {
      const a = Math.atan2(p.y - s.horse.y, p.x - s.horse.x);
      move(s.horse, Math.cos(a) * 120 * worldDt, Math.sin(a) * 120 * worldDt, 15);
    }
  }
  for (const a of s.animals) {
    if (!alive(a) || a.returned || (a.id === 'stray' && s.companion === 'stray')) continue;
    const d = distance(a, p);
    const angle = d < 105 && (moving || p.shotTimer > 0) ? Math.atan2(a.y - p.y, a.x - p.x) : a.phase + s.elapsed * 0.07;
    const animalSpeed = d < 105 && a.kind === 'deer' ? 85 : 9;
    move(a, Math.cos(angle) * animalSpeed * worldDt, Math.sin(angle) * animalSpeed * worldDt, 12);
  }
  if (s.companion === 'stray') {
    const stray = s.animals.find((a) => a.id === 'stray');
    if (stray && alive(stray) && distance(stray, p) > 48) {
      const a = Math.atan2(p.y - stray.y, p.x - stray.x);
      move(stray, Math.cos(a) * 155 * worldDt, Math.sin(a) * 155 * worldDt, 15);
    }
  }
  if (s.captive) {
    const captive = s.enemies.find((e) => e.id === s.captive);
    if (!captive || !alive(captive)) {
      s.sideQuests.bounty.targetAlive = false; s.captive = null;
      notice(s, 'The captive died. Only his identity papers can be delivered.');
    } else if (distance(captive, p) > 45) {
      const angle = Math.atan2(p.y - captive.y, p.x - captive.x);
      move(captive, Math.cos(angle) * 105 * worldDt, Math.sin(angle) * 105 * worldDt, 10);
    }
  }
  for (const n of s.npcs) if (n.fleeTimer > 0) n.fleeTimer -= worldDt;
  for (const e of s.enemies) {
    if (!alive(e)) continue;
    if (e.captured || e.surrendered) { e.active = false; continue; }
    const d = distance(e, p);
    if (e.kind === 'guard' && s.mission.stage >= 3 && s.mission.stage <= 4) e.active = true;
    if (!e.active || d > 430) continue;
    e.facing = Math.atan2(p.y - e.y, p.x - e.x);
    e.fireTimer -= worldDt;
    if (d > 175 || lineBlocked(e, p)) {
      const side = e.id.length % 2 ? 1 : -1;
      const a = e.facing + (lineBlocked(e, p) ? side * 0.5 : 0);
      move(e, Math.cos(a) * 38 * worldDt, Math.sin(a) * 38 * worldDt, 10);
    }
    if (e.fireTimer <= 0 && d < 360 && !lineBlocked(e, p)) {
      const spread = (rng(s) - 0.5) * (p.crouch ? 0.21 : moving ? 0.16 : 0.055);
      fireBullet(s, e, e.facing + spread, e.kind, e.kind === 'law' ? 15 : 12, 470);
      e.fireTimer = 1.6 + rng(s) * 1.2;
    }
    if (e.id === 'deserter' && e.hp <= 25) e.surrendered = true;
    if (e.surrendered) e.active = false;
  }
  bulletStep(s, worldDt);
  if (s.wanted.witnessTimer > 0) {
    s.wanted.witnessTimer -= worldDt;
    if (s.wanted.witnessTimer <= 0 && s.wanted.heat > 0) {
      s.wanted.pursuit = true; s.wanted.spawnTimer = 0;
      notice(s, 'The law is searching for you. Escape their sight to lose the pursuit.');
    }
  }
  const lawSees = s.enemies.some((e) => e.kind === 'law' && alive(e) && distance(e, p) < 300 && !lineBlocked(e, p));
  s.wanted.heat = Math.max(0, s.wanted.heat - worldDt * (lawSees ? 0 : s.wanted.pursuit ? 1.2 : 2));
  if (s.wanted.pursuit && s.wanted.heat > 0) {
    s.wanted.spawnTimer -= worldDt;
    if (s.wanted.spawnTimer <= 0) { spawnLaw(s); s.wanted.spawnTimer = 12; }
  } else if (s.wanted.heat <= 0 && s.wanted.pursuit) {
    s.wanted.pursuit = false; s.enemies = s.enemies.filter((e) => e.kind !== 'law');
    notice(s, 'You escaped the search. Your bounty remains until paid.');
  }
  if (s.fishing.active) {
    if (moving || p.shotTimer > 0 || p.mounted) { s.fishing.active = false; notice(s, 'The line came loose.'); }
    else {
      s.fishing.timer -= worldDt;
      if (s.fishing.timer <= 0 && !s.fishing.bite) { s.fishing.bite = true; s.fishing.timer = 3.8; notice(s, 'A trout took the hook! Interact now to reel it in.'); }
      else if (s.fishing.timer <= 0 && s.fishing.bite) { s.fishing.active = false; notice(s, 'The trout slipped the hook. Cast again.'); }
    }
  }
  updateMission(s);
  if (p.hp <= 0) defeat(s);
  return s;
}

export function shoot(s, targetX, targetY) {
  const p = s.player;
  if (s.dialog || p.hp <= 0 || p.reloadTimer > 0 || p.shotTimer > 0 || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return s;
  if (p.ammo <= 0) { notice(s, 'Empty cylinder. Reload your revolver.'); return s; }
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  p.ammo--; p.shotTimer = 0.32; p.facing = angle; s.stats.shots++;
  s.fishing.active = false;
  fireBullet(s, p, angle, 'player', 35, 720);
  const townspeople = s.npcs.some((n) => alive(n) && n.faction === 'civilian' && distance(n, p) < 120);
  const hostileNearby = s.enemies.some((e) => alive(e) && e.active && distance(e, p) < 380);
  if (townspeople && !hostileNearby) crime(s, 8, 'reckless gunfire in town');
  return s;
}

export function reload(s) {
  if (s.dialog || s.player.reloadTimer > 0 || s.player.ammo >= 6) return s;
  if (s.player.reserve <= 0) { notice(s, 'No spare cartridges. Nell sells ammunition in Mercy Crossing.'); return s; }
  s.player.reloadTimer = 1.8;
  notice(s, 'Reloading…');
  return s;
}

export function getInteraction(s) {
  if (s.dialog) return null;
  const candidates = [];
  const offer = (id, label, point, max = 64, priority = 0) => {
    const d = distance(s.player, point);
    if (d <= max) candidates.push({ id, label, distance: d, priority });
  };
  if (s.fishing.active && s.fishing.bite) return { id: 'reel', label: 'Reel in trout', distance: 0 };
  if (s.player.mounted) offer('dismount', 'Dismount Juniper', s.player, 1, -10);
  else offer('mount', `Ride ${s.horse.name}`, s.horse, 51);
  for (const n of s.npcs) if (alive(n) && !(n.fleeTimer > 0)) {
    if (n.id === 'gideon' && s.mission.stage !== 4) continue;
    offer(n.id, n.id === 'nell' ? 'Trade with Nell Bell' : `Speak with ${n.name}`, n, 62, 4);
  }
  if (s.mission.stage === 2 || s.mission.stage === 5) offer('valve', s.mission.stage === 2 ? 'Inspect chained water valve' : 'Repair the water valve', { x: 1095, y: 857 }, 60, 8);
  for (const a of s.animals) {
    if (!alive(a) && a.kind === 'deer' && !a.harvested) offer(`harvest:${a.id}`, 'Harvest deer', a, 52, 5);
    if (a.id === 'stray' && alive(a) && s.sideQuests.horse.stage === 1) offer('calm-stray', 'Calm Copper', a, 55, 5);
  }
  for (const node of s.resources) if (s.day >= node.availableDay && s.inventory[node.kind] <= 99 - node.amount && !s.player.mounted) offer(`gather:${node.id}`, `Gather ${node.name.toLowerCase()}`, node, 40, 2);
  const deserter = s.enemies.find((e) => e.id === 'deserter');
  if (deserter && s.sideQuests.bounty.stage === 1 && (!alive(deserter) || deserter.surrendered)) {
    offer('collect-bounty', deserter.surrendered ? 'Tie up the surrendering deserter' : 'Collect deserter identity papers', deserter, 54, 7);
  }
  const nearBank = Math.abs(s.player.x - riverX(s.player.y)) > WORLD.river.width / 2 && Math.abs(s.player.x - riverX(s.player.y)) < 75;
  if (nearBank && s.player.y > 340 && s.player.y < 1000 && !s.player.mounted) offer('fish', s.fishing.active ? 'Wait for a bite…' : 'Cast fishing line', s.player, 1, 1);
  offer('campfire', 'Rest at the campfire', { x: 690, y: 785 }, 46, 3);
  candidates.sort((a, b) => b.priority - a.priority || a.distance - b.distance);
  return candidates[0] || null;
}

function npcDialog(s, id) {
  if (id === 'ada') {
    if (s.mission.stage === 0) dialog(s, 'ada-first', 'Ada Reed', 'The railroad chained the ranch water. Silas Venn knows their foreman. Find him in Mercy Crossing, then open Cinder Pump. We cannot let the valley go thirsty.', [['accept-water', 'I’ll find Silas.'], ['ask-ada', 'Why fight the railroad?'], ['leave', 'I need a moment.']]);
    else if (s.mission.stage === 6) dialog(s, 'ada-return', 'Ada Reed', 'I heard the creek before I saw you. The ranches have water again, Mara. Tell me about Pike.', [['finish-water', 'The pump belongs to the valley now.']]);
    else if (s.mission.completed && !s.sideQuests.provisions.complete) dialog(s, 'ada-provisions', 'Ada Reed', s.sideQuests.provisions.stage === 0 ? 'The water is back, but our stores are thin. Bring two cuts of venison and one trout. Every camp family will have supper.' : 'Two venison and one trout will feed everyone. Hunt west of the river and fish from either bank.', [['accept-provisions', s.sideQuests.provisions.stage === 0 ? 'I’ll bring provisions.' : 'Deliver two venison and one trout.'], ['camp-donate', 'Donate $10 to camp.'], ['leave', 'Until later.']]);
    else dialog(s, 'ada-status', 'Ada Reed', `${s.mission.completed ? 'For the first time in weeks, the valley feels like home.' : 'Silas is waiting in Mercy Crossing.'} Our stores hold ${s.camp.food} food, ${s.camp.medicine} medicine and ${s.camp.materials} materials. Tomas and Fern can use your help.`, [['camp-donate', 'Donate $10 to camp.'], ['leave', 'Until later.']]);
  } else if (id === 'silas') {
    if (s.mission.stage === 1) dialog(s, 'silas-water', 'Silas Venn', 'Pike padlocked Cinder Pump, southeast of here. Three men guard it. The chained valve is on the west side. Crates will cover you if they draw. Pike keeps the wrench himself.', [['follow-water', 'I’ll inspect the valve.'], ['silas-debt', 'What does Pike want?'], ['leave', 'I’ll return.']]);
    else if (s.mission.completed && !s.sideQuests.horse.complete) {
      const copper = s.animals.find((a) => a.id === 'stray');
      if (s.sideQuests.horse.stage > 0 && !alive(copper)) dialog(s, 'silas-horse-recovery', 'Silas Venn', 'Copper was badly wounded. I can get the farrier to her if you cover five dollars of care. Give her a day, then look for her again in the woods.', [['horse-retry', 'Pay $5 for Copper’s recovery.'], ['leave', 'I’ll come back.']]);
      else dialog(s, 'silas-horse', 'Silas Venn', s.sideQuests.horse.stage === 0 ? 'Copper bolted toward Juniper Woods, northwest across the river bridge. Bring her back alive. She’ll follow a patient hand. I can pay twenty dollars.' : s.sideQuests.horse.stage === 2 ? 'You found Copper. Lead her right here before handing over her reins.' : 'Look northwest in Juniper Woods. Approach slowly and calm her, then lead her back here.', [['horse-job', s.sideQuests.horse.stage === 0 ? 'I’ll find Copper.' : s.sideQuests.horse.stage === 2 ? 'Hand Copper back to Silas.' : 'I’m still looking.'], ['leave', 'Until later.']]);
    }
    else dialog(s, 'silas-status', 'Silas Venn', s.mission.completed ? 'Water in the troughs. Copper in the paddock. I owe you, Mara.' : 'Ada sent you? The valley has held its breath long enough.', [['leave', 'Take care, Silas.']]);
  } else if (id === 'nell') {
    if (s.wanted.pursuit) { notice(s, 'Nell won’t trade while the law is pursuing you.'); return; }
    dialog(s, 'shop', 'Nell Bell · Trading Post', 'Fair prices, no questions. Cartridges, provisions, and a tonic for the road. Bring me pelts or fish if your purse runs light.', [['leave', 'Close trading post.']]);
    s.dialog.shop = true;
  } else if (id === 'eliza') {
    const q = s.sideQuests.bounty;
    if (s.wanted.bounty > 0) dialog(s, 'marshal-bounty', 'Marshal Eliza Holt', `You owe this county $${s.wanted.bounty}. Pay your bounty and we can speak plainly.`, [['pay-bounty', `Pay $${s.wanted.bounty}.`], ['leave', 'I’ll come back.']]);
    else if (s.mission.completed && !q.complete) dialog(s, 'marshal-job', 'Marshal Eliza Holt', q.stage === 0 ? 'A railroad deserter robbed the Juniper coach. He camps southwest, near the old crates. Bring him alive for $35, or his identity papers for $20. Wound him and he may surrender.' : q.stage === 2 ? 'You’ve returned from Juniper Trail. What did you bring?' : 'The deserter camps southwest at the old crate shelter. If he lowers his gun, approach and tie him.', [['bounty-job', q.stage === 0 ? 'Take the bounty notice.' : q.stage === 2 ? 'Deliver the deserter evidence.' : 'I’ll find him.'], ['leave', 'Until later, Marshal.']]);
    else dialog(s, 'marshal-status', 'Marshal Eliza Holt', 'Mercy Crossing is a small town. Keep your gun holstered here and we will get along.', [['leave', 'Understood.']]);
  } else if (id === 'tomas') {
    const q = s.companions.tomas;
    dialog(s, 'tomas-request', 'Tomas Ash', q.requestStage === 0 ? 'Storms pull our tents apart. Find two bundles of dry timber near camp or in Juniper Woods. We can build a cookpot stand and a shelter for the horses.' : q.requestStage === 1 ? 'Bring two dry timber. I’ll add it to the community stores; then you can choose what we build at the campfire.' : `Those timbers will last. ${s.camp.upgrades.shelter ? 'Juniper has a dry roof because of you.' : 'A horse shelter would keep Juniper out of the rain.'} The camp remembers who lends a hand.`, q.requestStage < 2 ? [['tomas-timber', q.requestStage === 0 ? 'I’ll gather timber.' : 'Give Tomas two timber.'], ['leave', 'Until later.']] : [['leave', 'Take care, Tomas.']]);
  } else if (id === 'fern') {
    const q = s.companions.fern;
    const text = q.requestStage === 0 ? 'I treat everyone here with what the hills give us. Bring two wild sage leaves. Look for the pale bushes west of camp.' : q.requestStage === 1 ? 'Two wild sage will replenish our medicines. You can mix two leaves with a juniper berry into a tonic at the campfire.' : q.requestStage === 2 && !s.mission.completed ? 'Your sage has already helped a fever. Come back once the water runs; I have a journey to prepare for.' : q.requestStage === 2 ? 'The water has reached the outer ranches. I’m taking medicine to their children. Could you make one sage tonic for my bag?' : q.requestStage === 3 ? 'A health tonic for the ranch children. Mix sage and berries at our campfire, or bring a spare from your satchel.' : 'The ranch children are on their feet again. Your help went farther than you could see from camp.';
    const choices = q.requestStage < 2 ? [['fern-sage', q.requestStage === 0 ? 'I’ll gather sage.' : 'Give Fern two sage.']] : q.requestStage < 4 && s.mission.completed ? [['fern-tonic', q.requestStage === 2 ? 'I’ll prepare a tonic for the journey.' : 'Give Fern one health tonic.']] : [];
    dialog(s, 'fern-request', 'Fern Bell', text, [...choices, ['leave', 'Until later, Fern.']]);
  } else if (id === 'gideon') dialog(s, 'gideon-choice', 'Gideon Pike', 'It was a contract. Men with ledgers own this valley now. You can kill me, but another foreman will take my place. Take the wrench. Let me walk.', [['spare-pike', 'Take the wrench. Leave him alive.'], ['arrest-pike', 'March him to Eliza. The valley deserves justice.'], ['revenge-pike', 'Make him pay for what he did.']]);
}

export function interact(s) {
  const action = getInteraction(s);
  if (!action) { notice(s, 'Move closer to a person, your horse, or a marked place.'); return s; }
  const id = action.id;
  if (id === 'mount') { s.player.mounted = true; s.player.x = s.horse.x; s.player.y = s.horse.y; s.fishing.active = false; notice(s, `Mounted ${s.horse.name}.`); }
  else if (id === 'dismount') { s.player.mounted = false; s.horse.x = s.player.x - 23; s.horse.y = s.player.y + 17; notice(s, 'Dismounted. Whistle to call Juniper.'); }
  else if (id === 'valve') {
    if (s.mission.stage === 2) {
      dialog(s, 'valve-evidence', 'Cinder Pump', 'A syndicate chain holds the valve shut. A stamped order reads: “No water until every ranch signs.” Three guards turn at the sound of the lock.', [['break-chain', 'Stand your ground. Free the water.'], ['leave', 'Withdraw and prepare.']]);
    } else if (s.mission.stage === 5 && s.inventory.wrench > 0) {
      s.inventory.wrench = 0; s.mission.waterRunning = true; s.mission.stage = 6;
      s.honor = clamp(s.honor + 10, -100, 100);
      notice(s, 'The chain breaks. Water flows back to Mercy Vale. Return to Ada.');
      journal(s, 'Mara repaired the Cinder Pump valve. Water returned to the ranches.'); objective(s); checkpoint(s);
    }
  } else if (id.startsWith('harvest:')) {
    const a = s.animals.find((v) => v.id === id.slice(8));
    if (a && !alive(a) && !a.harvested) { a.harvested = true; s.inventory.meat += 2; s.inventory.pelt++; s.stats.hunted++; notice(s, 'Harvested: two venison and one deer pelt.'); }
  } else if (id === 'calm-stray') {
    s.companion = 'stray'; s.sideQuests.horse.stage = 2;
    notice(s, 'Copper trusts you. Lead her back across the bridge to Silas.'); journal(s, 'Mara found Copper in Juniper Woods and began leading her home.');
  } else if (id === 'collect-bounty') {
    const e = s.enemies.find((v) => v.id === 'deserter');
    s.sideQuests.bounty.targetAlive = !!e.surrendered && alive(e);
    s.sideQuests.bounty.stage = 2; e.active = false; e.captured = true;
    s.captive = s.sideQuests.bounty.targetAlive ? e.id : null;
    notice(s, s.captive ? 'Deserter tied. Lead him back to Marshal Eliza Holt; he must arrive alive.' : 'Identity papers secured. Return to Marshal Eliza Holt.');
  } else if (id.startsWith('gather:')) {
    const node = s.resources.find((v) => v.id === id.slice(7));
    if (node && s.day >= node.availableDay && s.inventory[node.kind] <= 99 - node.amount) {
      s.inventory[node.kind] += node.amount; node.availableDay = s.day + 1; s.stats.gathered += node.amount;
      notice(s, `Gathered ${node.amount} ${node.name.toLowerCase()}. This patch replenishes tomorrow.`);
      journal(s, `Mara gathered ${node.name.toLowerCase()} at ${node.id.startsWith('woods') ? 'Juniper Woods' : 'Mercy Vale'}.`);
    }
  } else if (id === 'fish') {
    if (!s.fishing.active) { s.fishing = { ...s.fishing, active: true, bite: false, timer: 2.5 + rng(s) * 2.5 }; notice(s, 'Line cast. Stay still; interact when the trout bites.'); }
  } else if (id === 'reel') {
    s.fishing.active = false; s.fishing.bite = false; s.fishing.catches++;
    s.inventory.trout++; s.stats.fish++; notice(s, 'Caught a Mercy River trout.');
  } else if (id === 'campfire') {
    if (dangerNearby(s)) { notice(s, 'You cannot rest with danger nearby.'); return s; }
    dialog(s, 'rest', 'Reed Camp · Campfire', `Camp stores: ${s.camp.food} food · ${s.camp.medicine} medicine · ${s.camp.materials} materials. Share supplies, prepare for the road, or improve the camp.`, [['rest-morning', 'Sleep until morning.'], ['rest-evening', 'Rest until sunset.'], ...Object.entries(RECIPES).map(([key, recipe]) => [`craft:${key}`, `Craft ${recipe.name.toLowerCase()}.`]), ...Object.entries(CAMP_UPGRADES).filter(([key]) => !s.camp.upgrades[key]).map(([key, upgrade]) => [`upgrade:${key}`, `Build ${upgrade.name.toLowerCase()} · $${upgrade.price}.`]), ['leave', 'Keep moving.']]);
  } else npcDialog(s, id);
  return s;
}

export function choose(s, optionId) {
  if (!s.dialog || !s.dialog.choices.some((o) => o.id === optionId)) return s;
  const before = s.dialog;
  const beforeStage = s.mission.stage;
  s.dialog = null;
  if (optionId === 'leave') return s;
  if (optionId === 'ask-ada') { dialog(s, 'ada-reason', 'Ada Reed', 'They buy debts, shut wells, then buy the homes of thirsty families for pennies. We built this camp for people with nowhere left. If the water runs, the valley can hold.', [['accept-water', 'Then I’ll find Silas.'], ['leave', 'Give me a moment.']]); return s; }
  if (optionId === 'accept-water' && s.mission.stage === 0) { s.mission.stage = 1; journal(s, 'Ada asked Mara to restore the valley’s water. Silas Venn knows the route.'); notice(s, 'New objective: find Silas Venn in Mercy Crossing.'); }
  if (optionId === 'silas-debt') { dialog(s, 'silas-debt', 'Silas Venn', 'Every ranch, every deed. He says drought makes the price fair. My daughter drinks from a stock barrel while he measures our land. The west valve proves what he’s done.', [['follow-water', 'I’ll find the proof and open the pump.'], ['leave', 'I’ll return.']]); return s; }
  if (optionId === 'follow-water' && s.mission.stage === 1) { s.mission.stage = 2; journal(s, 'Silas revealed that Gideon Pike deliberately shut Cinder Pump to force the ranches to sell.'); }
  if (optionId === 'break-chain' && s.mission.stage === 2) { s.mission.stage = 3; s.enemies.filter((e) => e.id.startsWith('pump-')).forEach((e) => { e.active = true; }); notice(s, 'The syndicate guards opened fire. Find cover and return fire.'); }
  if (['spare-pike', 'arrest-pike', 'revenge-pike'].includes(optionId) && s.mission.stage === 4) {
    s.mission.choice = optionId; s.mission.stage = 5; s.inventory.wrench = 1;
    const gideon = s.npcs.find((n) => n.id === 'gideon');
    if (optionId === 'spare-pike') { s.honor = clamp(s.honor + 15, -100, 100); gideon.departed = true; notice(s, 'Pike leaves alive. You took his wrench and his authority.'); journal(s, 'Mara spared Gideon Pike. Mercy may cost more than revenge.'); }
    else if (optionId === 'arrest-pike') { s.honor = clamp(s.honor + 20, -100, 100); gideon.arrested = true; gideon.x = 1070; gideon.y = 425; notice(s, 'Pike is handed to Eliza. His wrench is yours.'); journal(s, 'Mara surrendered Gideon Pike to Marshal Holt. The county now has a witness against the syndicate.'); }
    else { s.honor = clamp(s.honor - 25, -100, 100); gideon.hp = 0; s.wanted.bounty += 15; notice(s, 'Pike is dead. The valley has water, but your name carries a new bounty.'); journal(s, 'Mara killed Gideon Pike. The wrench and the consequences remain.'); }
  }
  if (optionId === 'finish-water' && s.mission.stage === 6 && s.mission.waterRunning) {
    s.mission.stage = 7; s.mission.completed = true;
    if (!s.mission.rewardPaid) { s.player.money += 45; s.inventory.tonic++; s.mission.rewardPaid = true; }
    notice(s, 'The Last Water complete · $45 + health tonic. New work is available around the valley.');
    journal(s, 'The Last Water completed. Ada’s camp and the ranches have clean water.');
  }
  if (optionId === 'camp-donate') {
    if (s.player.money >= 10) { s.player.money -= 10; s.camp.food = Math.min(99, s.camp.food + 2); s.camp.morale = Math.min(100, s.camp.morale + 5); s.camp.donations += 10; s.honor = clamp(s.honor + 5, -100, 100); notice(s, 'Donated $10. Two food added to camp stores.'); journal(s, 'Mara gave ten dollars to Reed Camp.'); }
    else notice(s, 'You need $10 to donate.');
  }
  if (optionId === 'accept-provisions' && s.mission.completed && !s.sideQuests.provisions.complete) {
    const q = s.sideQuests.provisions;
    if (q.stage === 0) { q.stage = 1; notice(s, 'New work: bring Ada two venison and one trout.'); journal(s, 'Ada asked for two venison and one trout to feed Reed Camp.'); }
    else if (s.inventory.meat >= 2 && s.inventory.trout >= 1) { s.inventory.meat -= 2; s.inventory.trout--; s.camp.food = Math.min(99, s.camp.food + 6); s.camp.morale = Math.min(100, s.camp.morale + 12); q.stage = 2; q.complete = true; s.player.money += 18; s.honor = clamp(s.honor + 12, -100, 100); notice(s, 'Enough for Everyone complete · $18. Supper is on the fire.'); journal(s, 'Mara brought venison and trout. Reed Camp ate together.'); }
    else notice(s, 'Ada needs two venison and one trout. You can hunt deer and fish along the river.');
  }
  if (optionId === 'horse-job' && s.mission.completed && !s.sideQuests.horse.complete) {
    const q = s.sideQuests.horse;
    if (q.stage === 0) { q.stage = 1; notice(s, 'New work: find Copper northwest in Juniper Woods.'); journal(s, 'Silas offered twenty dollars for the safe return of Copper.'); }
    else if (q.stage === 2) {
      const stray = s.animals.find((a) => a.id === 'stray'), silas = s.npcs.find((n) => n.id === 'silas');
      if (stray && alive(stray) && distance(stray, silas) < 95) { q.stage = 3; q.complete = true; s.companion = null; s.player.money += 20; s.honor = clamp(s.honor + 10, -100, 100); stray.returned = true; notice(s, 'A Horse Called Copper complete · $20. Silas has his horse back.'); journal(s, 'Mara returned Copper alive to Silas Venn.'); }
      else notice(s, 'Lead Copper close to Silas before handing her over.');
    }
  }
  if (optionId === 'horse-retry' && before.id === 'silas-horse-recovery' && !s.sideQuests.horse.complete) {
    if (s.player.money < 5) notice(s, 'Copper’s recovery needs $5. Nell will buy fish and pelts.');
    else {
      const copper = s.animals.find((a) => a.id === 'stray');
      s.player.money -= 5; s.day++; s.companion = null; s.sideQuests.horse.stage = 1;
      Object.assign(copper, { hp: 100, x: copper.homeX, y: copper.homeY, returned: false });
      notice(s, 'A day of care saved Copper. Find her trail again in Juniper Woods.'); journal(s, 'Silas and the farrier saved the wounded Copper. Mara resumed the search.');
    }
  }
  if (optionId === 'bounty-job' && s.mission.completed && !s.sideQuests.bounty.complete) {
    const q = s.sideQuests.bounty;
    if (q.stage === 0) { q.stage = 1; s.enemies.push({ id: 'deserter', kind: 'bandit', x: 500, y: 930, hp: 90, facing: 0, fireTimer: 2, active: true }); notice(s, 'New bounty: the deserter camps southwest at Juniper Trail.'); journal(s, 'Marshal Holt posted a bounty for the Juniper coach robber, alive or dead.'); }
    else if (q.stage === 2) {
      const captive = s.enemies.find((e) => e.id === 'deserter');
      const marshal = s.npcs.find((n) => n.id === 'eliza');
      if (q.targetAlive && (!captive || !alive(captive))) { q.targetAlive = false; s.captive = null; }
      if (q.targetAlive && distance(captive, marshal) >= 95) notice(s, 'Bring the living deserter close to Marshal Holt before collecting payment.');
      else { q.stage = 3; q.complete = true; s.captive = null; if (captive) captive.delivered = true; s.player.money += q.targetAlive ? 35 : 20; s.honor = clamp(s.honor + (q.targetAlive ? 15 : 4), -100, 100); notice(s, `The Juniper Deserter complete · $${q.targetAlive ? 35 : 20}.`); journal(s, `Mara delivered the Juniper deserter ${q.targetAlive ? 'alive' : 'identity papers'} to Marshal Holt.`); }
    }
  }
  if (optionId === 'pay-bounty' && before.id === 'marshal-bounty') {
    if (s.player.money >= s.wanted.bounty) { s.player.money -= s.wanted.bounty; s.wanted.bounty = 0; s.wanted.heat = 0; s.wanted.pursuit = false; s.wanted.witnessTimer = 0; s.enemies = s.enemies.filter((e) => e.kind !== 'law'); notice(s, 'Bounty paid. Your record with Mercy County is clear.'); }
    else notice(s, 'You cannot afford this bounty yet.');
  }
  if (['rest-morning', 'rest-evening'].includes(optionId) && before.id === 'rest') {
    const next = optionId === 'rest-morning' ? 7 : 18.5;
    if (next <= s.time) s.day++;
    const fed = s.camp.food > 0;
    if (fed) s.camp.food--;
    s.time = next; s.player.hp = fed ? 100 : Math.max(s.player.hp, 75); s.player.stamina = 100; s.player.focus = fed ? 100 : Math.max(s.player.focus, 75); s.horse.stamina = 100;
    if (s.camp.upgrades.shelter) s.horse.hp = 100;
    s.camp.morale = clamp(s.camp.morale + (fed ? 2 : -5), 0, 100);
    s.lastSave = { day: s.day, time: s.time }; notice(s, fed ? 'Rested and fed. Health, stamina, focus, and Juniper’s stamina restored.' : 'Rested without supper. Donate food for a full recovery.'); journal(s, 'Mara rested at Reed Camp.');
  }
  if (optionId === 'tomas-timber' && before.id === 'tomas-request') {
    const q = s.companions.tomas;
    if (q.requestStage === 0) { q.requestStage = 1; notice(s, 'Tomas needs two dry timber.'); }
    else if (q.requestStage === 1 && s.inventory.timber >= 2) { s.inventory.timber -= 2; s.camp.materials = Math.min(99, s.camp.materials + 2); q.requestStage = 2; q.trust += 10; s.honor = clamp(s.honor + 3, -100, 100); journal(s, 'Mara helped Tomas strengthen Reed Camp with gathered timber.'); notice(s, 'Tomas added two materials to camp stores. Choose an improvement at the fire.'); }
    else notice(s, 'Tomas needs two dry timber.');
  }
  if (optionId === 'fern-sage' && before.id === 'fern-request') {
    const q = s.companions.fern;
    if (q.requestStage === 0) { q.requestStage = 1; notice(s, 'Fern needs two wild sage.'); }
    else if (q.requestStage === 1 && s.inventory.herbs >= 2) { s.inventory.herbs -= 2; s.camp.medicine = Math.min(99, s.camp.medicine + 2); q.requestStage = 2; q.trust += 10; s.honor = clamp(s.honor + 3, -100, 100); journal(s, 'Mara gathered sage for Fern’s patients. Fern asked her to return when the ranch water runs.'); notice(s, 'Fern replenished the camp medicines. Return after The Last Water.'); }
    else notice(s, 'Fern needs two wild sage.');
  }
  if (optionId === 'fern-tonic' && before.id === 'fern-request' && s.mission.completed) {
    const q = s.companions.fern;
    if (q.requestStage === 2) { q.requestStage = 3; notice(s, 'Prepare one health tonic for Fern’s ranch visit.'); }
    else if (q.requestStage === 3 && s.inventory.tonic > 0) { s.inventory.tonic--; s.camp.medicine = Math.min(99, s.camp.medicine + 2); q.requestStage = 4; q.trust += 20; s.player.money += 12; s.honor = clamp(s.honor + 5, -100, 100); journal(s, 'Fern carried Mara’s tonic to children at the newly watered ranches.'); notice(s, 'Fern’s ranch visit complete · $12. The children recovered.'); }
    else notice(s, 'Bring Fern one health tonic.');
  }
  if (optionId.startsWith('craft:') && before.id === 'rest') craft(s, optionId.slice(6));
  if (optionId.startsWith('upgrade:') && before.id === 'rest') upgradeCamp(s, optionId.slice(8));
  objective(s);
  if (beforeStage !== s.mission.stage) checkpoint(s);
  return s;
}

export function buy(s, itemId) {
  const item = ITEMS[itemId];
  if (!s.dialog?.shop || !item) return s;
  if (s.player.money < item.price) { notice(s, `You need $${item.price} for ${item.name.toLowerCase()}.`); return s; }
  if (itemId === 'ammo') {
    if (s.player.reserve > 228) { notice(s, 'Your cartridge satchel is full.'); return s; }
    s.player.reserve += 12;
  } else {
    if (s.inventory[itemId] >= 99) { notice(s, 'Your satchel is full.'); return s; }
    s.inventory[itemId]++;
  }
  s.player.money -= item.price; notice(s, `Bought ${item.name.toLowerCase()} · $${item.price}.`);
  return s;
}

export function craft(s, recipeId) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return s;
  if (!campNearby(s)) { notice(s, 'Return to Reed Camp to craft.'); return s; }
  if (dangerNearby(s)) { notice(s, 'You cannot craft with danger nearby.'); return s; }
  if (recipe.upgrade && !s.camp.upgrades[recipe.upgrade]) { notice(s, `Build the ${CAMP_UPGRADES[recipe.upgrade].name.toLowerCase()} first.`); return s; }
  if (s.inventory[recipe.result] > 99 - recipe.amount) { notice(s, 'Your satchel is full.'); return s; }
  if (Object.entries(recipe.ingredients).some(([id, amount]) => s.inventory[id] < amount)) {
    notice(s, `Requires ${Object.entries(recipe.ingredients).map(([id, amount]) => `${amount} ${ITEMS[id].name.toLowerCase()}`).join(' and ')}.`);
    return s;
  }
  for (const [id, amount] of Object.entries(recipe.ingredients)) s.inventory[id] -= amount;
  s.inventory[recipe.result] += recipe.amount; s.stats.crafted += recipe.amount;
  notice(s, `Crafted ${recipe.name.toLowerCase()}.`); journal(s, `Mara crafted ${recipe.name.toLowerCase()} at Reed Camp.`);
  return s;
}

export function donate(s, itemId, amount = 1) {
  const store = { meat: 'food', trout: 'food', berries: 'food', cookedMeat: 'food', herbs: 'medicine', tonic: 'medicine', timber: 'materials' }[itemId];
  amount = Math.floor(amount);
  if (!store || !Number.isFinite(amount) || amount < 1) return s;
  if (!campNearby(s)) { notice(s, 'Return to Reed Camp to share supplies.'); return s; }
  if (s.inventory[itemId] < amount) { notice(s, 'You do not have enough supplies to donate.'); return s; }
  if (s.camp[store] > 99 - amount) { notice(s, 'The camp store is full.'); return s; }
  s.inventory[itemId] -= amount; s.camp[store] += amount; s.camp.morale = Math.min(100, s.camp.morale + amount);
  s.honor = clamp(s.honor + Math.min(3, amount), -100, 100);
  notice(s, `Shared ${amount} ${ITEMS[itemId].name.toLowerCase()} with camp.`); journal(s, `Mara added ${amount} ${store} to Reed Camp.`);
  return s;
}

export function upgradeCamp(s, upgradeId) {
  const upgrade = CAMP_UPGRADES[upgradeId];
  if (!upgrade || s.camp.upgrades[upgradeId]) return s;
  if (!campNearby(s)) { notice(s, 'Return to Reed Camp to build improvements.'); return s; }
  if (dangerNearby(s)) { notice(s, 'You cannot build with danger nearby.'); return s; }
  if (s.player.money < upgrade.price || s.camp.materials < upgrade.materials || s.camp.medicine < (upgrade.medicine || 0)) {
    notice(s, `Requires $${upgrade.price}, ${upgrade.materials} camp materials${upgrade.medicine ? ` and ${upgrade.medicine} camp medicine` : ''}.`); return s;
  }
  s.player.money -= upgrade.price; s.camp.materials -= upgrade.materials; s.camp.medicine -= upgrade.medicine || 0;
  s.camp.upgrades[upgradeId] = true; s.camp.morale = Math.min(100, s.camp.morale + 10);
  notice(s, `Built ${upgrade.name.toLowerCase()}. ${upgrade.description}`); journal(s, `Reed Camp built a ${upgrade.name.toLowerCase()}.`);
  return s;
}
export function sell(s, itemId) {
  const item = ITEMS[itemId];
  if (!s.dialog?.shop || !item || !item.sell || !(s.inventory[itemId] > 0)) return s;
  s.inventory[itemId]--; s.player.money += item.sell;
  notice(s, `Sold ${item.name.toLowerCase()} · $${item.sell}.`);
  return s;
}
export function useItem(s, itemId) {
  if (!(s.inventory[itemId] > 0)) { notice(s, `No ${ITEMS[itemId]?.name.toLowerCase() || itemId} in your satchel.`); return s; }
  if (itemId === 'tonic' && s.player.hp < 100) { s.player.hp = Math.min(100, s.player.hp + 55); s.inventory.tonic--; notice(s, 'Health tonic restored 55 health.'); }
  else if (itemId === 'coffee' && s.player.focus < 100) { s.player.focus = Math.min(100, s.player.focus + 65); s.inventory.coffee--; notice(s, 'Strong coffee restored your focus.'); }
  else if (itemId === 'meat' && s.player.stamina < 100) { s.player.stamina = Math.min(100, s.player.stamina + 60); s.player.hp = Math.min(100, s.player.hp + 10); s.inventory.meat--; notice(s, 'Venison restored stamina and a little health.'); }
  else if (itemId === 'cookedMeat' && (s.player.stamina < 100 || s.player.hp < 100)) { s.player.stamina = 100; s.player.hp = Math.min(100, s.player.hp + 30); s.inventory.cookedMeat--; notice(s, 'Camp supper restored stamina and 30 health.'); }
  else if (itemId === 'berries' && s.player.stamina < 100) { s.player.stamina = Math.min(100, s.player.stamina + 15); s.inventory.berries--; notice(s, 'Juniper berries restored a little stamina.'); }
  else if (itemId === 'oats' && (s.player.mounted || distance(s.player, s.horse) < 75)) { s.horse.stamina = 100; s.horse.bond = Math.min(4, s.horse.bond + 0.2); s.inventory.oats--; notice(s, `${s.horse.name} is fed. Your bond improved.`); }
  return s;
}

export function whistle(s) {
  if (s.player.mounted) return s;
  s.horse.follow = true; notice(s, 'Juniper heard your whistle and is coming.');
  return s;
}

export function serialize(s) {
  // Dialogs and flying bullets are transient; reload timers persist to preserve ammunition.
  const clean = { ...s, dialog: null, bullets: [], notices: [] };
  return JSON.stringify(clean);
}

export function restore(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data) || ![1, VERSION].includes(data.version) || !data.player || !data.mission || data.mission.id !== 'the-last-water') return null;
  const numeric = ['x', 'y', 'hp', 'stamina', 'focus', 'ammo', 'reserve', 'money'];
  if (numeric.some((k) => !Number.isFinite(data.player[k])) || !Number.isInteger(data.mission.stage) || data.mission.stage < 0 || data.mission.stage > 7) return null;
  if (!data.inventory || typeof data.inventory !== 'object' || !Array.isArray(data.enemies) || !Array.isArray(data.animals) || !Array.isArray(data.npcs)) return null;
  const s = createState();
  const firstCheckpoint = s.checkpoint;
  for (const key of ['seed', 'elapsed', 'day', 'time', 'honor']) if (Number.isFinite(data[key])) s[key] = data[key];
  s.seed = s.seed >>> 0; s.elapsed = Math.max(0, s.elapsed); s.day = Math.max(1, Math.floor(s.day)); s.time = clamp(s.time, 0, 23.999); s.honor = clamp(s.honor, -100, 100);
  s.weather = ['clear', 'rain', 'overcast'].includes(data.weather) ? data.weather : 'clear';
  for (const key of Object.keys(s.player)) {
    if (typeof s.player[key] === 'number' && Number.isFinite(data.player[key])) s.player[key] = data.player[key];
    else if (typeof s.player[key] === 'boolean') s.player[key] = !!data.player[key];
  }
  s.player.x = clamp(s.player.x, 15, WORLD.width - 15); s.player.y = clamp(s.player.y, 15, WORLD.height - 15);
  for (const key of ['hp', 'stamina', 'focus']) s.player[key] = clamp(s.player[key], 0, 100);
  s.player.ammo = clamp(Math.floor(s.player.ammo), 0, 6); s.player.reserve = clamp(Math.floor(s.player.reserve), 0, 240); s.player.money = clamp(Math.floor(s.player.money), 0, 999999);
  s.player.reloadTimer = clamp(s.player.reloadTimer, 0, 1.8); s.player.shotTimer = 0; s.player.invulnerable = 2;
  for (const key of Object.keys(s.inventory)) if (Number.isFinite(data.inventory[key])) s.inventory[key] = clamp(Math.floor(data.inventory[key]), 0, key === 'wrench' ? 1 : 99);
  for (const node of s.resources) {
    const saved = Array.isArray(data.resources) && data.resources.find((v) => v?.id === node.id);
    if (saved && Number.isInteger(saved.availableDay)) node.availableDay = clamp(saved.availableDay, 1, s.day + 1);
  }
  for (const key of ['food', 'medicine', 'materials', 'morale', 'donations']) if (Number.isFinite(data.camp?.[key])) s.camp[key] = clamp(Math.floor(data.camp[key]), 0, key === 'donations' ? 999999 : key === 'morale' ? 100 : 99);
  for (const key of Object.keys(s.camp.upgrades)) s.camp.upgrades[key] = data.camp?.upgrades?.[key] === true;
  for (const [id, companion] of Object.entries(s.companions)) {
    if (Number.isFinite(data.companions?.[id]?.trust)) companion.trust = clamp(Math.floor(data.companions[id].trust), 0, 100);
    if (Number.isInteger(data.companions?.[id]?.requestStage)) companion.requestStage = clamp(data.companions[id].requestStage, 0, id === 'fern' ? 4 : 2);
  }
  if (data.horse && typeof data.horse === 'object') for (const key of ['x', 'y', 'hp', 'stamina', 'bond']) if (Number.isFinite(data.horse[key])) s.horse[key] = data.horse[key];
  s.horse.x = clamp(s.horse.x, 15, WORLD.width - 15); s.horse.y = clamp(s.horse.y, 15, WORLD.height - 15); s.horse.hp = clamp(s.horse.hp, 1, 100); s.horse.stamina = clamp(s.horse.stamina, 0, 100); s.horse.bond = clamp(s.horse.bond, 1, 4); s.horse.follow = !!data.horse?.follow;
  if (s.player.mounted) { s.horse.x = s.player.x; s.horse.y = s.player.y; }
  const entity = (e) => e && typeof e === 'object' && typeof e.id === 'string' && e.id.length < 80 && Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp);
  s.npcs = s.npcs.map((n) => {
    const saved = data.npcs.find((e) => entity(e) && e.id === n.id);
    return saved ? { ...n, x: clamp(saved.x, 15, 1585), y: clamp(saved.y, 15, 1185), hp: clamp(saved.hp, 0, 100), departed: !!saved.departed, arrested: !!saved.arrested } : n;
  });
  s.enemies = data.enemies.filter((e) => entity(e) && ['guard', 'bandit', 'law'].includes(e.kind)).slice(0, 30).map((e) => ({ id: e.id, x: clamp(e.x, 15, 1585), y: clamp(e.y, 15, 1185), hp: clamp(e.hp, 0, 100), kind: e.kind, active: !!e.active && !e.surrendered && !e.captured, facing: Number.isFinite(e.facing) ? e.facing : 0, fireTimer: Number.isFinite(e.fireTimer) ? clamp(e.fireTimer, 0, 5) : 2, surrendered: !!e.surrendered, captured: !!e.captured, delivered: !!e.delivered }));
  if (new Set(s.enemies.map((e) => e.id)).size !== s.enemies.length) return null;
  // Reject deleted mission actors; malformed data cannot turn an empty list into a victory.
  if (!['pump-1', 'pump-2', 'pump-3'].every((id) => s.enemies.some((e) => e.id === id))) return null;
  s.animals = s.animals.map((a) => {
    const saved = data.animals.find((e) => entity(e) && e.id === a.id);
    return saved ? { ...a, x: clamp(saved.x, 15, 1585), y: clamp(saved.y, 15, 1185), hp: clamp(saved.hp, 0, 100), harvested: !!saved.harvested, returned: !!saved.returned } : a;
  });
  s.mission.stage = data.mission.stage;
  s.mission.completed = s.mission.stage === 7;
  s.mission.waterRunning = s.mission.stage >= 6;
  s.mission.rewardPaid = !!data.mission.rewardPaid || s.mission.completed;
  s.mission.choice = ['spare-pike', 'arrest-pike', 'revenge-pike'].includes(data.mission.choice) ? data.mission.choice : null;
  if (s.mission.stage >= 4 && s.enemies.some((e) => e.id.startsWith('pump-') && alive(e))) return null;
  if (s.mission.stage >= 5 && !s.mission.choice) return null;
  if (s.mission.stage >= 6 && data.mission.waterRunning !== true) return null;
  if (s.mission.stage === 5) s.inventory.wrench = 1;
  if (data.wanted && typeof data.wanted === 'object') {
    s.wanted.heat = Number.isFinite(data.wanted.heat) ? clamp(data.wanted.heat, 0, 100) : 0;
    s.wanted.bounty = Number.isFinite(data.wanted.bounty) ? clamp(Math.floor(data.wanted.bounty), 0, 9999) : 0;
    s.wanted.pursuit = !!data.wanted.pursuit && s.wanted.heat > 0;
    s.wanted.witnessTimer = Number.isFinite(data.wanted.witnessTimer) ? clamp(data.wanted.witnessTimer, 0, 7) : 0;
  }
  for (const [id, q] of Object.entries(s.sideQuests)) {
    const saved = data.sideQuests?.[id];
    if (saved && Number.isInteger(saved.stage)) { q.stage = clamp(saved.stage, 0, id === 'provisions' ? 2 : 3); q.complete = q.stage === (id === 'provisions' ? 2 : 3); if (id === 'bounty') q.targetAlive = !!saved.targetAlive; }
  }
  s.companion = data.companion === 'stray' && s.sideQuests.horse.stage === 2 ? 'stray' : null;
  if (s.companion && !alive(s.animals.find((a) => a.id === 'stray'))) s.companion = null;
  if (s.sideQuests.bounty.stage > 0 && !s.enemies.some((e) => e.id === 'deserter')) return null;
  if (s.sideQuests.bounty.stage === 2 && s.sideQuests.bounty.targetAlive) {
    const captive = s.enemies.find((e) => e.id === 'deserter');
    if (!captive.captured || !captive.surrendered || !alive(captive)) return null;
    s.captive = captive.id;
  }
  for (const key of Object.keys(s.stats)) if (Number.isFinite(data.stats?.[key])) s.stats[key] = Math.max(0, data.stats[key]);
  s.log = Array.isArray(data.log) ? data.log.filter((e) => e && typeof e.text === 'string').slice(-MAX_LOG).map((e) => ({ day: Number.isFinite(e.day) ? e.day : 1, time: Number.isFinite(e.time) ? e.time : 0, text: e.text.slice(0, 500) })) : s.log;
  s.lastSave = data.lastSave && Number.isFinite(data.lastSave.day) && Number.isFinite(data.lastSave.time) ? { day: data.lastSave.day, time: data.lastSave.time } : null;
  checkpoint(s);
  if (s.mission.stage === 3) {
    const savedGuards = data.checkpoint?.stage === 3 && Array.isArray(data.checkpoint.guards) ? data.checkpoint.guards : firstCheckpoint.guards;
    const guards = firstCheckpoint.guards.map((guard) => savedGuards.find((e) => entity(e) && e.id === guard.id) || guard);
    s.checkpoint.guards = guards.map((guard) => ({ id: guard.id, x: clamp(guard.x, 15, 1585), y: clamp(guard.y, 15, 1185), hp: clamp(guard.hp, 0, 70) }));
  }
  if (blocked(s.player.x, s.player.y, s.player.mounted ? 15 : 9)) { s.player.x = 720; s.player.y = 680; if (s.player.mounted) { s.horse.x = 720; s.horse.y = 680; } }
  notice(s, 'Journey restored.'); objective(s);
  return s;
}
