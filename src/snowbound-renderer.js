import { SNOWBOUND_WORLD } from '../content/campaign/snowbound.js';
import { getCampaignPresentation } from './campaign.js';
import { createWesternAnimator, contactHand, jointScreen, savePose, smooth, solveLimb } from './western-animation.js';
import { createExpeditionActors, isRescuePresentation } from './expedition-actors.js';
import { createExpeditionHuman, drawExpeditionOutfit, EXPEDITION_CAST_IDS } from './expedition-cast.js';
import { drawExpeditionCamp } from './expedition-camp.js';
import { createWillowCampPresentation } from './willow-run-renderer.js';
import { ownsWillowActor, isHuntPresentation } from './willow-run-actors.js';

const E = globalThis.My3D2dge;
const P = E.px;
const TAU = Math.PI * 2;
const C = {
  snow: '#bdc9c3', light: '#e2e7d5', shade: '#8eaaa9', deep: '#546d72',
  stone: '#6c7c7a', stoneLight: '#99a7a0', wood: '#756953', plank: '#9c8b6d',
  ink: '#303e40', amber: '#deb27a', fire: '#e5a35c', red: '#b55e48',
};
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const idSeed = (id) => [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
const inside = (p, b, margin = 0) => p && p.x > b.x - margin && p.x < b.x + b.w + margin && p.y > b.y - margin && p.y < b.y + b.h + margin;
const poly = (r, g, points, color) => P.poly(g, points.map(p => r.w(p[0], p[1], p[2] || 0)), color);
const rows = (value) => Array.isArray(value) ? value : Object.values(value || {});
const buildings = () => rows(SNOWBOUND_WORLD.buildings || SNOWBOUND_WORLD.interiors);
const obstacles = () => rows(SNOWBOUND_WORLD.obstacles);
const route = () => rows(SNOWBOUND_WORLD.trail || SNOWBOUND_WORLD.route).map(p => Array.isArray(p) ? p : [p.x, p.y]);

function makeSnow() {
  const cv = document.createElement('canvas');
  cv.width = SNOWBOUND_WORLD.width + 2; cv.height = SNOWBOUND_WORLD.height + 2;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  P.rect(g, 0, 0, cv.width, cv.height, C.snow);
  for (let y = 0; y < cv.height; y += 18) for (let x = 0; x < cv.width; x += 18) {
    const band = Math.sin(x / 161 + y / 143) + Math.sin(y / 81) * .4;
    const shade = band > .5 ? '#c9d3c9' : band < -.5 ? '#b4c4bf' : '#bfccc6';
    P.rect(g, x, y, 19, 19, shade);
  }
  for (let i = 0; i < 100; i++) {
    const x = hash(i + 64) * cv.width, y = hash(i + 958) * cv.height;
    P.ell(g, x, y, 18 + hash(i + 316) * 95, 7 + hash(i + 721) * 38, i % 3 ? '#d0d9cd' : '#aebfbb');
  }
  const path = [[320, 1100], ...route(), [1330, 470]];
  for (let i = 1; i < path.length; i++) {
    P.line(g, ...path[i - 1], ...path[i], '#b0bcb1', 45);
    P.line(g, ...path[i - 1], ...path[i], '#a6aea1', 29);
    P.line(g, ...path[i - 1], ...path[i], '#babeb0', 17);
  }
  for (const place of rows(SNOWBOUND_WORLD.places)) {
    if (/yard|station|refuge|pen|kiln/.test(place.id || '')) P.ell(g, place.x, place.y, place.id === 'yard' ? 125 : 80, place.id === 'yard' ? 100 : 60, '#b1bbae');
  }
  for (let i = 0; i < 9000; i++) {
    const x = hash(i + 94) * cv.width, y = hash(i + 709) * cv.height;
    P.line(g, x, y, x + 2 + hash(i + 46) * 5, y, i % 4 ? '#d8dfd1' : '#aabdb9', 1);
    if (i % 29 === 0) P.dot(g, x + 2, y + 2, '#93aaa7');
  }
  return cv;
}

function drawMountainSky(r, clock, state) {
  const g = r.ctx, horizon = Math.round(Math.min(105, r.H * .17)), w = r.bw;
  const night = (state.time ?? 7) < 6 || (state.time ?? 7) > 20;
  r.sky(night ? ['#243640', '#51646b', '#95a9a4'] : ['#7d9193', '#a4b4af', '#c2cdc2'], { bands: 20 });
  const drift = r.game.cam.x * .027;
  for (let layer = 0; layer < 3; layer++) {
    const points = [[-60, horizon]], snowcaps = [];
    let x = -120 - drift * (layer + 1) % 170, peak = 0;
    while (x < w + 160) {
      const seed = peak++ + layer * 71 + 83, span = 90 + hash(seed + 427) * 110;
      const summit = x + span * (.31 + hash(seed + 529) * .33);
      const top = horizon * (.35 + layer * .18) - hash(seed) * horizon * .23;
      const low = horizon * (.82 + layer * .045) - hash(seed + 628) * horizon * .08;
      points.push([x, low], [summit - span * .09, top + horizon * .11], [summit, top], [summit + span * .23, top + horizon * .24], [x + span, low]);
      snowcaps.push([[summit, top], [summit - span * .21, top + horizon * .22], [summit - span * .055, top + horizon * .12], [summit + span * .055, top + horizon * .17], [summit + span * .18, top + horizon * .2]]);
      x += span;
    }
    points.push([w + 120, horizon]);
    P.poly(g, points, ['#819693', '#677f7f', '#526f70'][layer]);
    for (const cap of snowcaps) P.poly(g, cap, ['#bdc9bd', '#a9bdb5', '#95b0aa'][layer]);
  }
  for (let x = 0; x < w + 15; x += 12) {
    const h = 4 + hash(Math.floor(x / 12) + 438) * 12;
    P.poly(g, [[x, horizon], [x + 4, horizon - h], [x + 9, horizon]], '#486567');
  }
  for (let i = 0; i < 7; i++) {
    const x = (i * 178 + clock * 7) % (w + 120) - 60, y = horizon * (.14 + i % 3 * .13);
    P.line(g, x, y, x + 70, y, '#bac9c0', 1);
  }
  return horizon;
}

function treeScenery() {
  const props = [], trail = route();
  const nearTrail = (x, y) => trail.some(p => Math.hypot(p[0] - x, p[1] - y) < 125);
  for (let i = 0; i < 165; i++) {
    const x = 35 + hash(i + 963) * (SNOWBOUND_WORLD.width - 70), y = 30 + hash(i + 357) * (SNOWBOUND_WORLD.height - 60);
    if (nearTrail(x, y) || buildings().some(b => inside({ x, y }, b, 115)) || rows(SNOWBOUND_WORLD.places).some(p => Math.hypot(p.x - x, p.y - y) < 155)) continue;
    props.push({ x, y, size: .65 + hash(i + 765) * .7, seed: i, kind: i % 7 === 0 ? 'rock' : 'pine' });
  }
  return props;
}

function drawTree(r, p, clock, player) {
  if (!r.visible(p.x, p.y, 0, 65, 165, 65)) return;
  r.shadow(p.x, p.y, 18 * p.size, .18, '#526f71');
  r.queue(p.x, p.y, 0, g => {
    const [x, y] = r.w(p.x, p.y, 0), s = p.size, sway = Math.sin(clock * .6 + p.seed) * s;
    const target = player ? r.w(player.x, player.y, 0) : null;
    const fade = target && y > target[1] && y - 130 * s < target[1] && Math.abs(x - target[0]) < 40 * s;
    if (fade) { g.save(); g.globalAlpha *= .3; }
    if (p.kind === 'rock') {
      P.poly(g, [[x - 20 * s, y], [x - 13 * s, y - 23 * s], [x + 6 * s, y - 30 * s], [x + 24 * s, y - 4 * s]], '#7a9190');
      P.poly(g, [[x - 13 * s, y - 23 * s], [x + 6 * s, y - 30 * s], [x + 17 * s, y - 17 * s], [x + 2 * s, y - 16 * s]], '#d6dfd0');
    } else {
      P.line(g, x, y, x, y - 90 * s, '#6b6958', 5 * s);
      for (let i = 0; i < 6; i++) {
        const top = y - 126 * s + i * 16 * s, width = (11 + i * 5) * s;
        P.poly(g, [[x + sway, top], [x + width + sway, top + 31 * s], [x + 4 * s, top + 28 * s], [x - width + sway, top + 32 * s]], i % 2 ? '#466967' : '#557975');
        P.poly(g, [[x + sway, top], [x + width * .62, top + 20 * s], [x + 2 * s, top + 17 * s], [x - width * .78, top + 26 * s]], i % 2 ? '#c3d5c9' : '#b2c7bd');
        P.line(g, x - width * .7, top + 27 * s, x - width * .22, top + 25 * s, '#dfdfc9', 2);
      }
    }
    P.ell(g, x, y + 2, 16 * s, 4 * s, '#d0ded0');
    if (fade) { g.restore(); g._c = null; }
  });
}

function drawFloor(r, b) {
  const g = r.ctx;
  poly(r, g, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], /boiler|kiln/.test(b.id) ? '#87938a' : '#938d77');
  for (let x = b.x + 5; x < b.x + b.w; x += 9) P.line(g, ...r.w(x, b.y, 0), ...r.w(x, b.y + b.h, 0), /boiler|kiln/.test(b.id) ? '#73867f' : '#786e58', 1);
  for (let i = 0; i < Math.floor(b.w * b.h / 700); i++) {
    const x = b.x + hash(i + idSeed(b.id)) * b.w, y = b.y + hash(i + 128 + idSeed(b.id)) * b.h;
    P.line(g, ...r.w(x, y, 0), ...r.w(x + 5, y, 0), '#b4ad8b', 1);
  }
}

function drawServiceWalkway(r) {
  const path = rows(SNOWBOUND_WORLD.rescueRoute), g = r.ctx;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (!length) continue;
    const nx = -dy / length * 14, ny = dx / length * 14;
    poly(r, g, [[a.x + nx, a.y + ny], [b.x + nx, b.y + ny], [b.x - nx, b.y - ny], [a.x - nx, a.y - ny]], '#80938a');
    for (let d = 0; d < length; d += 19) {
      const x = a.x + dx * d / length, y = a.y + dy * d / length;
      P.line(g, ...r.w(x - nx, y - ny, 0), ...r.w(x + nx, y + ny, 0), '#5a756d', 1);
      P.line(g, ...r.w(x - nx, y - ny + 1, 0), ...r.w(x + nx, y + ny + 1, 0), '#c0cdb9', 1);
    }
  }
}

function drawObstacle(r, o, state) {
  const h = o.height || o.z || (/wall/.test(o.kind || '') ? 63 : /culvert|stone/.test(o.kind || '') ? 27 : /winch/.test(o.kind || '') ? 34 : 22);
  if (!r.visible(o.x + o.w / 2, o.y + o.h, 0, o.w * 2 + 40, h * 2 + 40, 80)) return;
  const ruined = state.worldChanges?.boilerDestroyed && /boiler/.test(o.building || o.id || '');
  const top = ruined ? Math.min(13, h) : h, stone = /wall|stone|culvert|kiln/.test(o.kind || ''), color = ruined ? '#4b5956' : stone ? '#768a86' : '#7f7259';
  r.queue(o.x + o.w / 2, o.y + o.h, 0, g => {
    const player = state.player, b = buildings().find(b => inside(player, b, player?.carrying ? 110 : 3) && inside({ x: o.x + o.w / 2, y: o.y + o.h / 2 }, b, 20));
    const fades = b && player.y < o.y + o.h;
    if (fades) { g.save(); g.globalAlpha *= .28; }
    r.box(g, o.x, o.y, 0, o.x + o.w, o.y + o.h, top, ruined ? '#7b8272' : '#c3d0bf', color);
    for (let z = 8; z < top; z += stone ? 12 : 7) P.line(g, ...r.w(o.x, o.y + o.h, z), ...r.w(o.x + o.w, o.y + o.h, z), stone ? '#566f6f' : '#5e5a48', 1);
    if (stone) for (let x = o.x + 16; x < o.x + o.w; x += 24) for (let z = 4; z < top; z += 24) P.line(g, ...r.w(x, o.y + o.h, z), ...r.w(x, o.y + o.h, Math.min(top, z + 11)), '#93a79b', 1);
    if (/crate|cover/.test(o.kind || '')) {
      P.line(g, ...r.w(o.x + 3, o.y + o.h, 3), ...r.w(o.x + o.w - 3, o.y + o.h, top - 3), '#b5a079', 2);
      P.line(g, ...r.w(o.x + 3, o.y + o.h, top - 3), ...r.w(o.x + o.w - 3, o.y + o.h, 3), '#b5a079', 2);
    }
    if (fades) { g.restore(); g._c = null; }
  });
}

function drawRoof(r, b, state) {
  const activeRescue = state.mission?.stage === 7 && (state.player?.carrying || state.flags?.adaEscorting) && inside(state.player, b, 120);
  if (inside(state.player, b, 32) || activeRescue || (state.worldChanges?.boilerDestroyed && /boiler/.test(b.id))) return;
  if (!r.visible(b.x + b.w / 2, b.y + b.h, 0, b.w * 2, 180, 80)) return;
  const h = b.height || 68, player = state.player, closeBehind = player && player.y < b.y + b.h && player.x > b.x - 25 && player.x < b.x + b.w + 25 && player.y > b.y - 100;
  r.queue(b.x + b.w / 2, b.y + b.h, .1, g => {
    if (closeBehind) { g.save(); g.globalAlpha *= .3; }
    const ridge = b.x + b.w * .5;
    poly(r, g, [[b.x - 7, b.y - 5, h], [ridge, b.y - 5, h + 21], [ridge, b.y + b.h + 6, h + 21], [b.x - 7, b.y + b.h + 6, h]], '#d2dece');
    poly(r, g, [[ridge, b.y - 5, h + 21], [b.x + b.w + 7, b.y - 5, h], [b.x + b.w + 7, b.y + b.h + 6, h], [ridge, b.y + b.h + 6, h + 21]], '#92afaa');
    for (let y = b.y; y < b.y + b.h; y += 16) P.line(g, ...r.w(b.x - 6, y, h + 1), ...r.w(ridge, y, h + 22), '#e1e6d3', 1);
    if (state.worldChanges?.relayDamaged && /relay/.test(b.id)) {
      // Damage persists on the usable relay rather than removing its doors.
      poly(r, g, [[ridge + 20, b.y + b.h - 61, h + 17], [b.x + b.w + 7, b.y + b.h - 48, h + 1], [b.x + b.w + 7, b.y + b.h + 6, h + 1], [ridge + 5, b.y + b.h + 6, h + 20]], '#526962');
      for (let i = 0; i < 4; i++) P.line(g, ...r.w(ridge + 27 + i * 21, b.y + b.h - 46, h + 13 - i * 2), ...r.w(ridge + 9 + i * 29, b.y + b.h + 7, h + 18 - i * 3), '#9d9b79', 2);
    }
    const name = r.w(ridge, b.y + b.h + 2, h - 12);
    P.rect(g, name[0] - 53, name[1] - 5, 106, 12, '#4d625e');
    E.font.text(g, b.name || b.id.toUpperCase(), name[0], name[1] - 3, '#d9d8b6', { align: 'center', outline: false });
    if (closeBehind) { g.restore(); g._c = null; }
  });
}

function drawSupply(r, p, collected) {
  if (collected || !r.visible(p.x, p.y, 0, 35, 60, 30)) return;
  r.queue(p.x, p.y, 0, g => {
    const [x, y] = r.w(p.x, p.y, 0), kind = p.kind || p.item || p.id;
    if (/blanket/.test(kind)) {
      P.rect(g, x - 12, y - 12, 24, 11, '#976d67'); P.rect(g, x - 10, y - 17, 21, 6, '#b49a7c');
      for (const dx of [-7, 5]) P.line(g, x + dx, y - 17, x + dx, y - 2, '#d1c8a4', 2);
    } else if (/oil/.test(kind)) {
      P.rect(g, x - 7, y - 17, 14, 16, '#6e8981'); P.rect(g, x - 5, y - 22, 7, 5, '#354e4d');
      P.rect(g, x - 4, y - 13, 8, 7, '#d0ba8c'); P.line(g, x + 4, y - 20, x + 8, y - 16, '#9ab3a3', 2);
    } else if (/oat/.test(kind)) {
      P.ell(g, x, y - 11, 13, 14, '#b8ae83'); P.ell(g, x, y - 24, 7, 3, '#7d8060');
      P.line(g, x - 6, y - 20, x + 6, y - 20, '#655f45', 2); E.font.text(g, 'OATS', x, y - 13, '#575d49', { align: 'center', outline: false });
    } else if (/bandage/.test(kind)) {
      P.rect(g, x - 12, y - 12, 24, 11, '#858875'); P.rect(g, x - 10, y - 17, 20, 5, '#c5c3a7');
      P.rect(g, x - 5, y - 13, 10, 3, '#9d6553'); P.rect(g, x - 2, y - 16, 3, 9, '#9d6553');
    } else if (/broth|can/.test(kind)) {
      for (let i = 0; i < 3; i++) { P.rect(g, x - 12 + i * 9, y - 12 - i % 2 * 4, 8, 11, '#b3996f'); P.ell(g, x - 8 + i * 9, y - 12 - i % 2 * 4, 4, 2, '#d7d0ad'); P.rect(g, x - 11 + i * 9, y - 8 - i % 2 * 4, 6, 4, '#9a6651'); }
    } else if (/kindling|wood/.test(kind)) {
      for (let i = 0; i < 5; i++) P.line(g, x - 15 + i * 3, y - 5 - i * 2, x + 11 + i * 2, y - 2 - i * 2, i % 2 ? '#a9936a' : '#766448', 3);
      P.line(g, x - 2, y - 15, x + 4, y - 1, '#d2be87', 2);
    } else if (/log|book/.test(kind)) {
      P.poly(g, [[x - 12, y - 12], [x, y - 15], [x + 12, y - 12], [x + 12, y - 3], [x, y - 5], [x - 12, y - 3]], '#ded7b5');
      P.line(g, x, y - 14, x, y - 5, '#766b4d', 1);
      for (let i = 0; i < 3; i++) P.line(g, x + 3, y - 11 + i * 2, x + 9, y - 10 + i * 2, '#7f7d60', 1);
    }
  });
}

function smoke(r, x, y, z, clock, steam = false, count = 5) {
  r.queue(x, y, z, g => {
    const at = r.w(x, y, z);
    for (let i = 0; i < count; i++) {
      const t = (clock * .23 + i / count) % 1;
      P.blend(g, (1 - t) * (steam ? .5 : .35), 'normal', () => P.ell(g, at[0] + t * 28 + Math.sin(t * 4 + i) * 4, at[1] - t * 70, 5 + t * 15, 4 + t * 10, steam ? '#dce4cf' : '#586960'));
    }
  });
}

function drawFire(r, x, y, clock, size = 1) {
  r.queue(x, y, 1, g => {
    const q = r.w(x, y, 0);
    for (let i = 0; i < 7; i++) {
      const dx = (i - 3) * 4 * size, h = (12 + Math.sin(clock * 9 + i * 2) * 5) * size;
      P.poly(g, [[q[0] + dx - 5 * size, q[1]], [q[0] + dx + Math.sin(clock * 4 + i) * 4, q[1] - h - 10 * size], [q[0] + dx + 5 * size, q[1]]], i % 2 ? '#d1874d' : '#e9b76c');
      P.line(g, q[0] + dx, q[1] - 2, q[0] + dx + 1, q[1] - h * .5, '#f1d6a0', 2);
    }
  });
}

function drawFence(r, o) {
  const horizontal = o.w >= o.h, a = [o.x, o.y], b = [o.x + (horizontal ? o.w : 0), o.y + (horizontal ? 0 : o.h)];
  const n = Math.ceil((horizontal ? o.w : o.h) / 38);
  for (let i = 0; i < n; i++) {
    const aa = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n];
    const bb = [a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n];
    r.queue((aa[0] + bb[0]) / 2, Math.max(aa[1], bb[1]), 0, g => {
      for (const p of [aa, bb]) { P.line(g, ...r.w(...p, 0), ...r.w(...p, 29), '#6d7561', 4); P.line(g, ...r.w(...p, 28), ...r.w(...p, 30), '#dbe1c9', 5); }
      for (const z of [10, 23]) { P.line(g, ...r.w(...aa, z), ...r.w(...bb, z), '#91896b', 3); P.line(g, ...r.w(...aa, z + 2), ...r.w(...bb, z + 2), '#c2c8ad', 1); }
    });
  }
}

function drawKiln(r, o, state, clock) {
  r.queue(o.x + o.w / 2, o.y + o.h, 0, g => {
    const [x, y] = r.w(o.x + o.w / 2, o.y + o.h, 0), w = o.w * r.view.ax * .52;
    P.poly(g, [[x - w, y], [x - w * .88, y - 80], [x - w * .53, y - 128], [x + w * .53, y - 128], [x + w * .9, y - 78], [x + w, y]], '#6d817a');
    P.poly(g, [[x - w, y], [x - w * .88, y - 80], [x - w * .53, y - 128], [x - w * .23, y - 125], [x - w * .55, y - 74], [x - w * .58, y]], '#93a69b');
    for (let z = 9; z < 118; z += 12) P.line(g, x - w * (z > 77 ? .68 : .92), y - z, x + w * (z > 77 ? .68 : .92), y - z, '#4c6964', 1);
    P.poly(g, [[x - w * .55, y - 129], [x + w * .55, y - 129], [x + w * .68, y - 120], [x - w * .68, y - 120]], '#d2dbbf');
    P.poly(g, [[x - 20, y], [x - 20, y - 35], [x - 10, y - 43], [x + 10, y - 43], [x + 20, y - 35], [x + 20, y]], '#263d3b');
    if (state.camp?.stoveLit || state.mission?.completed) P.poly(g, [[x - 15, y - 2], [x - 12, y - 25], [x, y - 31], [x + 13, y - 20], [x + 15, y - 2]], '#b2804e');
    const label = 'LIME KILN'; E.font.text(g, label, x, y - 53, '#d5ceb0', { align: 'center', outline: '#536d65' });
  });
  if (state.camp?.stoveLit || state.mission?.completed) smoke(r, o.x + o.w / 2, o.y + o.h / 2, 100, clock);
}

function drawTent(r, o) {
  r.queue(o.x + o.w / 2, o.y + o.h, 0, g => {
    const mid = o.x + o.w / 2, z = 43;
    poly(r, g, [[o.x, o.y + o.h], [mid, o.y + o.h, z], [mid, o.y, z], [o.x, o.y]], '#bdc1a4');
    poly(r, g, [[mid, o.y + o.h, z], [o.x + o.w, o.y + o.h], [o.x + o.w, o.y], [mid, o.y, z]], '#899f90');
    poly(r, g, [[o.x, o.y + o.h], [mid, o.y + o.h, z], [o.x + o.w, o.y + o.h]], '#b7b698');
    poly(r, g, [[mid - 13, o.y + o.h + .1], [mid, o.y + o.h + .1, 33], [mid + 13, o.y + o.h + .1]], '#4a6157');
    P.line(g, ...r.w(mid, o.y, z + 1), ...r.w(mid, o.y + o.h, z + 1), '#e1dfbd', 2);
  });
}

function drawBoiler(r, o, state, clock) {
  const ruined = state.worldChanges?.boilerDestroyed;
  r.queue(o.x + o.w / 2, o.y + o.h, 0, g => {
    const center = r.w(o.x + o.w / 2, o.y + o.h * .7, 0), x = center[0], y = center[1];
    const player = state.player, at = player && r.w(player.x, player.y, 0);
    const width = player?.carrying ? 46 : 20, height = player?.mounted || player?.carrying ? 96 : 72;
    const overlaps = (left, top, right, bottom) => at && at[0] + width > left && at[0] - width < right && at[1] > top && at[1] - height < bottom;
    const fades = !ruined && player && player.y < o.y + o.h && (overlaps(x + 27, y - 148, x + 54, y - 70) || overlaps(x - 66, y - 91, x + 62, y));
    if (fades) { g.save(); g.globalAlpha *= .3; }
    try {
    if (ruined) {
      r.box(g, o.x, o.y, 0, o.x + o.w, o.y + o.h, 9, '#687d75', '#485f5a');
      P.poly(g, [[x - 54, y - 12], [x - 48, y - 52], [x - 31, y - 35], [x - 10, y - 46], [x + 23, y - 15]], '#354e4c');
      P.ell(g, x + 30, y - 7, 25, 13, '#738779'); P.ell(g, x + 31, y - 10, 16, 8, '#344d4a');
      for (let i = 0; i < 8; i++) P.line(g, x - 60 + i * 16, y - 3 - hash(i + 256) * 7, x - 48 + i * 14, y - 10 - hash(i + 728) * 20, '#4c5b50', 3);
      P.line(g, x - 55, y - 40, x - 36, y - 27, '#a79462', 3);
      return;
    }
    r.box(g, o.x, o.y, 0, o.x + o.w, o.y + o.h, 23, '#889e8e', '#64786c');
    P.ell(g, x, y - 46, 57, 26, '#506f70'); P.rect(g, x - 57, y - 71, 114, 25, '#698985');
    P.ell(g, x, y - 71, 57, 25, '#8eaaa0');
    for (const dx of [-37, 30]) { P.line(g, x + dx, y - 88, x + dx, y - 27, '#344f50', 4); P.line(g, x + dx - 2, y - 87, x + dx - 2, y - 30, '#a7bbae', 1); }
    P.ell(g, x - 4, y - 53, 18, 17, '#344f50'); P.ell(g, x - 4, y - 53, 12, 12, '#a7b59a');
    P.line(g, x - 4, y - 53, x + 3, y - 59, state.worldChanges?.pressureReleased ? '#577a6d' : '#b77350', 2);
    P.rect(g, x + 29, y - 142, 22, 71, '#4d6866'); P.ell(g, x + 40, y - 143, 14, 5, '#aac0ab');
    for (let z = 85; z < 140; z += 15) P.line(g, x + 30, y - z, x + 50, y - z, '#314c4b', 1);
    P.ell(g, x - 5, y - 88, 38, 5, '#c8d2bd');
    P.line(g, x - 62, y - 33, x - 85, y - 33, '#415f5c', 6); P.line(g, x - 84, y - 33, x - 84, y - 12, '#415f5c', 6);
    } finally { if (fades) { g.restore(); g._c = null; } }
  });
  smoke(r, o.x + o.w * .74, o.y + o.h * .7, ruined ? 10 : 124, clock, false, ruined ? 3 : 6);
  if (state.worldChanges?.fireActive && !ruined) {
    // Releasing pressure protects the west service door. The main entrance
    // stays physically blocked until the rescue resolves in campaign.js.
    drawFire(r, 1390, 475, clock, state.worldChanges.pressureReleased ? .8 : 1.4);
    if (!state.worldChanges.pressureReleased) smoke(r, 1390, 475, 16, clock, true, 8);
    smoke(r, o.x + 15, o.y + o.h + 8, 15, clock, true, 4);
  }
}

function drawProp(r, p, state, clock, valveTurn = 1) {
  if (!r.visible(p.x, p.y, 0, 75, 155, 50)) return;
  if (p.kind === 'coat' && state.player?.coldcoat) return;
  if (p.kind === 'lantern' && state.player?.lantern) return;
  r.queue(p.x, p.y, 0, g => {
    const [x, y] = r.w(p.x, p.y, 0);
    const fadeStove = p.kind === 'stove' && state.player && state.player.y < p.y + 12 && Math.abs(state.player.x - p.x) < 34 && state.player.y > p.y - 85;
    if (fadeStove) { g.save(); g.globalAlpha *= .32; }
    if (p.kind === 'coat') {
      P.line(g, x, y, x, y - 63, '#716f53', 3); P.line(g, x - 17, y - 52, x + 17, y - 52, '#aaa383', 3);
      P.poly(g, [[x - 9, y - 55], [x + 9, y - 55], [x + 16, y - 43], [x + 10, y - 10], [x - 10, y - 10], [x - 16, y - 43]], '#587476');
      P.line(g, x - 7, y - 52, x + 7, y - 52, '#bdbbaa', 4); P.line(g, x, y - 49, x, y - 12, '#344e50', 2);
    } else if (p.kind === 'lantern' || /signal|lamp/.test(p.kind)) {
      const signal = p.kind !== 'lantern', off = signal && state.worldChanges?.relayCircuitOff, z = signal ? 72 : 20;
      P.line(g, x, y, x, y - z, '#647969', 3); P.line(g, x - 6, y - z - 4, x + 6, y - z - 4, '#bcc5a7', 2);
      P.rect(g, x - 5, y - z, 10, 13, off ? '#485f5d' : signal ? '#bb654b' : '#d6b476');
      P.line(g, x - 5, y - z + 3, x + 5, y - z + 3, '#344d45', 1); P.line(g, x, y - z, x, y - z + 13, '#627963', 1);
      if (!off) P.ddisc(g, x, y - z + 6, signal ? 18 : 15, signal ? '#d58957' : '#f0cb81', .18);
    } else if (p.kind === 'stove') {
      r.box(g, p.x - 18, p.y - 13, 0, p.x + 18, p.y + 13, 25, '#667c6c', '#435e54');
      P.rect(g, x - 11, y - 21, 22, 13, state.camp?.stoveLit || state.mission?.completed ? '#d69b5e' : '#2f4943');
      P.line(g, x + 18, y - 25, x + 18, y - 75, '#405d51', 8); P.ell(g, x + 18, y - 76, 6, 3, '#95ad91');
      P.line(g, x - 12, y - 12, x + 12, y - 12, '#bda479', 1);
      const bin = r.w(p.x + 34, p.y + 4, 0); P.rect(g, bin[0] - 14, bin[1] - 10, 28, 10, '#8f7e57');
    } else if (p.kind === 'hitch') {
      for (const dx of [-42, 42]) P.line(g, ...r.w(p.x + dx, p.y, 0), ...r.w(p.x + dx, p.y, 35), '#6b755e', 5);
      P.line(g, ...r.w(p.x - 47, p.y, 29), ...r.w(p.x + 47, p.y, 29), '#b3ad83', 4);
      P.line(g, ...r.w(p.x - 47, p.y, 32), ...r.w(p.x + 47, p.y, 32), '#d9ddbf', 2);
    } else if (p.kind === 'wire') {
      for (const dx of [-28, 28]) { P.line(g, x + dx, y, x + dx, y - 66, '#746f53', 4); P.line(g, x + dx - 12, y - 54, x + dx + 12, y - 54, '#a7ab86', 3); }
      P.line(g, x - 28, y - 60, x - 8, y - 43, '#4d6760', 1); P.line(g, x - 8, y - 43, x - 1, y - 3, '#4d6760', 1);
      P.line(g, x + 28, y - 61, x + 15, y - 12, '#4d6760', 1); P.ell(g, x + 9, y - 3, 14, 4, '#a7b8a4');
    } else if (p.kind === 'valve') {
      P.line(g, x, y, x, y - 40, '#526f61', 9); P.line(g, x - 17, y - 26, x + 17, y - 26, '#526f61', 8);
      P.disc(g, x, y - 43, 13, '#4f6c60'); P.disc(g, x, y - 43, 9, '#b49067');
      const angle = state.worldChanges?.pressureReleased ? Math.PI / 4 * valveTurn : 0;
      for (let i = 0; i < 4; i++) P.line(g, x, y - 43, x + Math.cos(angle + i * Math.PI / 2) * 12, y - 43 + Math.sin(angle + i * Math.PI / 2) * 12, '#dbc39c', 2);
      P.disc(g, x, y - 43, 3, '#415e53');
    } else if (p.kind === 'tube') {
      P.line(g, x, y, x, y - 47, '#8f9774', 5); P.line(g, x, y - 45, x + 13, y - 45, '#b6b18b', 4); P.ell(g, x + 16, y - 45, 5, 8, '#566f5c');
    } else if (p.kind === 'telegraph') {
      r.box(g, p.x - 23, p.y - 11, 0, p.x + 23, p.y + 11, 23, '#b09c75', '#7a7057');
      const q = r.w(p.x, p.y, 25); P.rect(g, q[0] - 15, q[1] - 7, 25, 7, '#3f5950'); P.line(g, q[0] - 10, q[1] - 6, q[0] + 5, q[1] - 10, '#a79c70', 3);
      P.disc(g, q[0] + 5, q[1] - 11, 3, '#d5bf91'); P.ell(g, q[0] - 3, q[1] - 9, 5, 3, '#8e8660');
      P.rect(g, q[0] + 13, q[1] - 5, 10, 5, '#d8d4b4');
    } else if (p.kind === 'chair') {
      P.poly(g, [[x - 15, y - 4], [x - 11, y - 16], [x + 8, y - 12], [x + 12, y]], '#886e50');
      for (const dx of [-11, 7]) P.line(g, x + dx, y - 10, x + dx + 9, y - 24, '#b39b74', 2);
      P.line(g, x - 3, y - 22, x + 17, y - 18, '#b39b74', 3);
    } else if (p.kind === 'clue') {
      P.poly(g, [[x - 12, y - 7], [x + 9, y - 13], [x + 14, y - 3], [x - 4, y + 2]], '#b2aa8c'); P.line(g, x - 5, y - 4, x + 7, y - 8, '#995e4b', 2);
    } else if (p.kind === 'platform') {
      r.box(g, p.x - 28, p.y - 18, 15, p.x + 28, p.y + 18, 20, '#9b8861', '#6e6650');
      for (const dx of [-22, 22]) P.line(g, ...r.w(p.x + dx, p.y + 15, 0), ...r.w(p.x + dx, p.y + 15, 20), '#5c6250', 4);
      for (let i = 0; i < 3; i++) { const q = r.w(p.x + i * 12 - 15, p.y, 23); P.ell(g, q[0], q[1], 10, 7, '#7e7b5c'); }
    } else if (p.kind === 'tag') {
      P.line(g, x, y, x, y - 21, '#7e8062', 2); P.rect(g, x - 6, y - 18, 12, 10, '#c9b993'); P.line(g, x - 4, y - 15, x + 4, y - 15, '#996849', 1);
    } else if (p.kind === 'tunnel') {
      P.poly(g, [[x - 42, y], [x - 37, y - 39], [x - 22, y - 62], [x + 22, y - 62], [x + 37, y - 39], [x + 42, y]], '#839d8e');
      P.poly(g, [[x - 26, y], [x - 26, y - 33], [x - 15, y - 46], [x + 16, y - 46], [x + 27, y - 32], [x + 27, y]], '#344b49'); P.line(g, x - 37, y - 43, x + 36, y - 43, '#b5c6af', 2);
    }
    if (fadeStove) { g.restore(); g._c = null; }
  });
  if (p.kind === 'valve' && state.worldChanges?.pressureReleased && !state.worldChanges?.boilerDestroyed) smoke(r, p.x + 17, p.y, 28, clock, true, 4);
  if (p.kind === 'stove' && (state.camp?.stoveLit || state.mission?.completed)) smoke(r, p.x + 12, p.y, 65, clock);
}

function makeHuman(id, hostile = false) {
  const colors = { cloth: '#697b75', coat: '#465f60', pants: '#384e52', skin: '#bba17f', hair: '#554837', boot: '#344743', belt: '#675a40', trim: '#c6b48c', glove: '#5a5947', metal: '#78897c' };
  let size = 1.7, build = 'heroic', hat = '#646550';
  if (id === 'mara') { colors.cloth = '#6b8583'; colors.coat = '#456570'; colors.pants = '#3e515b'; colors.hair = '#443b32'; hat = '#666b5b'; }
  if (id === 'tomas') { colors.cloth = '#916a4e'; colors.coat = '#675a45'; colors.pants = '#485950'; colors.hair = '#ada58a'; colors.skin = '#a68a6b'; size = 1.78; build = 'bulky'; hat = '#7c7a5b'; }
  if (id === 'inez') { colors.cloth = '#87946e'; colors.coat = '#657856'; colors.pants = '#465b4e'; colors.hair = '#342f28'; colors.skin = '#a28a65'; size = 1.57; hat = '#8c8060'; }
  if (id === 'ada') { colors.cloth = '#8fa7a0'; colors.coat = '#617d87'; colors.pants = '#465e65'; colors.hair = '#7f6951'; size = 1.61; hat = '#8e727f'; }
  if (id === 'gideon') { colors.cloth = '#b1ad95'; colors.coat = '#6f7770'; colors.pants = '#5b6355'; colors.hair = '#b2afa0'; size = 1.68; hat = null; }
  if (id === 'pavel') { colors.cloth = '#a47d5b'; colors.coat = '#965f48'; colors.pants = '#5b6a5f'; colors.hair = '#514533'; size = 1.69; hat = '#a29276'; }
  if (/voss/.test(id)) { colors.cloth = '#5d7376'; colors.coat = '#344950'; colors.pants = '#344b50'; colors.hair = '#473d32'; size = 1.83; hat = '#465454'; }
  if (/gauge/.test(id)) { colors.cloth = '#7c8870'; colors.coat = '#5b7360'; hat = '#777d5f'; }
  if (/flanker/.test(id)) { colors.cloth = '#9c8966'; colors.coat = '#7c7354'; size = 1.58; hat = '#8f8464'; }
  if (/saboteur/.test(id)) { colors.cloth = '#a17d62'; colors.coat = '#785548'; hat = '#6b6250'; }
  const armed = id === 'mara' || hostile || id === 'pavel' || id === 'inez';
  const rig = new E.Humanoid({ size, build, weapon: armed ? 'gun' : null, outfit: 'coat', hair: 'short', sleeves: 'long', colors });
  rig.t = hash(idSeed(id)) * 12;
  return { id, rig, colors, hat, armed, ready: false, flash: 0, phase: 0 };
}

function atJoint(rig, view, x, y, joint, offset = [0, 0, 0]) {
  const p = rig.J[joint], q = E.charView(view).p(...rig._w([p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]]));
  return [x + q[0], y + q[1]];
}

function drawColdOutfit(g, x, y, h, view, state) {
  if (EXPEDITION_CAST_IDS.has(h.id)) { drawExpeditionOutfit(E, g, [x,y], h, view, (state.npcs || []).find(a=>a.id===h.id), state); return; }
  const rig = h.rig;
  if ((rig.downW || 0) > .6) return;
  const head = atJoint(rig, view, x, y, 'head'), shoulder = atJoint(rig, view, x, y, 'shC'), hip = atJoint(rig, view, x, y, 'hipC');
  const coat = h.id !== 'mara' || state.player.coldcoat;
  if (coat) {
    P.line(g, shoulder[0] - 8, shoulder[1] - 1, shoulder[0] + 8, shoulder[1] - 1, '#b7bfaa', 4);
    P.line(g, shoulder[0] - 7, shoulder[1] + 1, shoulder[0] - 3, shoulder[1] + 7, '#cbd0b6', 2);
    P.line(g, shoulder[0] + 7, shoulder[1] + 1, shoulder[0] + 3, shoulder[1] + 7, '#9eae9c', 2);
    for (let i = 0; i < 3; i++) P.dot(g, hip[0] + 1, shoulder[1] + 7 + i * 5, '#d0c3a1');
  }
  if (h.id === 'ada') {
    P.ell(g, head[0], head[1] - 5, 9, 6, h.hat); P.line(g, head[0] - 8, head[1] - 1, head[0] + 8, head[1] - 1, '#bcabb1', 3);
    P.rect(g, hip[0] + 2, hip[1] - 1, 7, 8, '#a59971'); P.line(g, hip[0] + 5, hip[1] - 3, hip[0] + 5, hip[1] - 7, '#b5b9a5', 2);
    P.line(g, shoulder[0] + 7, shoulder[1] + 4, hip[0] - 5, hip[1] + 3, '#495b51', 2);
  } else if (h.id === 'inez') {
    P.ell(g, head[0], head[1] - 5, 9, 6, h.hat); P.ell(g, head[0] - 2, head[1] - 5, 7, 4, '#b1ae89');
    P.line(g, head[0] - 5, head[1] + 2, shoulder[0] - 8, shoulder[1] + 4, '#423e2e', 3);
    P.ell(g, hip[0] + 9, hip[1] + 1, 6, 8, '#a09668'); P.ell(g, hip[0] + 9, hip[1] + 1, 3, 5, '#586c54');
  } else if (h.hat) {
    P.ell(g, head[0], head[1] + 1, 13, 3, h.hat); P.rect(g, head[0] - 7, head[1] - 9, 14, 9, h.hat);
    P.poly(g, [[head[0] - 7, head[1] - 9], [head[0] - 4, head[1] - 13], [head[0], head[1] - 11], [head[0] + 4, head[1] - 13], [head[0] + 7, head[1] - 9]], E.shade(h.hat, .08));
    P.line(g, head[0] - 7, head[1] - 2, head[0] + 7, head[1] - 2, '#384e44', 2);
    if (h.id === 'tomas') P.line(g, head[0] - 8, head[1] - 7, head[0] + 8, head[1] - 7, '#bbb793', 3);
  }
  if (h.id === 'mara') {
    // A leather rifle sling crosses the coat; the equipped revolver remains
    // the small metal sidearm shown separately in the holster or right hand.
    P.line(g, shoulder[0] - 7, shoulder[1] + 1, hip[0] + 6, hip[1] + 3, '#716748', 3);
    P.rect(g, hip[0] + 2, hip[1] - 4, 5, 4, '#c2b78c');
    P.poly(g, [[shoulder[0] - 5, shoulder[1] + 1], [shoulder[0] + 5, shoulder[1] + 1], [shoulder[0] + 3, shoulder[1] + 11], [shoulder[0] - 2, shoulder[1] + 5]], '#ad6550');
    if (state.player.lantern) {
      const lamp = atJoint(rig, view, x, y, 'handL', [0, 0, -2]);
      P.line(g, lamp[0], lamp[1] - 1, lamp[0], lamp[1] + 4, '#b9ab7c', 1); P.rect(g, lamp[0] - 4, lamp[1] + 3, 8, 9, '#d6b173');
      P.line(g, lamp[0] - 4, lamp[1] + 3, lamp[0] + 4, lamp[1] + 3, '#465b48', 2); P.line(g, lamp[0], lamp[1] + 4, lamp[0], lamp[1] + 11, '#677950', 1);
      P.ddisc(g, lamp[0], lamp[1] + 7, 13, '#e8bf7a', .14);
    }
    if (state.player.carrying && !h.authoredCarry) {
      // Gideon's adult silhouette lies across Mara's shoulders; he has his
      // own persistent injury state in the simulation while being carried.
      const sg = atJoint(rig, view, x, y, 'shC', [-1, 0, 2]);
      P.line(g, sg[0] - 17, sg[1] - 4, sg[0] + 13, sg[1] - 4, '#939a84', 9);
      P.ell(g, sg[0] - 19, sg[1] - 7, 5, 6, '#baa586'); P.line(g, sg[0] - 17, sg[1] - 12, sg[0] - 22, sg[1] - 11, '#b8b49c', 2);
      P.line(g, sg[0] + 12, sg[1] - 3, sg[0] + 20, sg[1] + 6, '#5d6a57', 5); P.line(g, sg[0] + 20, sg[1] + 6, sg[0] + 24, sg[1] + 7, '#394d43', 4);
      P.line(g, sg[0] - 1, sg[1] - 7, sg[0] - 1, sg[1] + 1, '#c7c5a5', 3);
    }
  }
  if (/voss/.test(h.id)) { P.disc(g, shoulder[0] + 5, shoulder[1] + 6, 3, '#bcc5b2'); P.dot(g, shoulder[0] + 5, shoulder[1] + 6, '#6f7660'); }
  if (h.id === 'gideon') { P.line(g, shoulder[0] - 8, shoulder[1] + 4, hip[0] + 6, hip[1] - 1, '#cfc8aa', 4); P.line(g, shoulder[0] - 4, shoulder[1] + 6, hip[0] + 3, hip[1], '#ae7661', 1); }
}

function drawGun(g, x, y, h, view, player) {
  if (!h.armed || (h.rig.downW || 0) > .6 || (h.id === 'mara' && (player.weaponLost || player.weaponOwned === false))) return;
  const rig = h.rig;
  if (!h.ready) {
    const hip = atJoint(rig, view, x, y, 'hipR', [1.8, 1.3, -.5]);
    P.poly(g, [[hip[0] - 3, hip[1] - 2], [hip[0] + 4, hip[1] - 1], [hip[0] + 3, hip[1] + 8], [hip[0] - 2, hip[1] + 9]], '#71553c');
    P.line(g, hip[0] - 2, hip[1] - 4, hip[0] + 2, hip[1] - 3, '#41564d', 3);
    return;
  }
  const hand = atJoint(rig, view, x, y, 'handR'), d = rig.J.bladeDir;
  const end = atJoint(rig, view, x, y, 'handR', [d[0] * 3.8, d[1] * 3.8, d[2] * 3.8]), grip = atJoint(rig, view, x, y, 'handR', [-d[0] * .4, -d[1] * .4, -2]);
  P.line(g, ...hand, ...grip, '#735239', 3); P.line(g, ...hand, ...end, '#38554f', 3); P.line(g, hand[0], hand[1] - 1, end[0], end[1] - 1, '#a7b6a5', 1);
  P.disc(g, hand[0] + (end[0] - hand[0]) * .25, hand[1] + (end[1] - hand[1]) * .25, 2, '#7f9687');
  if (h.flash > 0) {
    P.ddisc(g, ...end, 10, '#dbb975', .17); P.poly(g, [[end[0] - 4, end[1]], [end[0], end[1] - 4], [end[0] + 7, end[1]], [end[0], end[1] + 3]], '#efd29a');
  }
}

function drawFuneral(r, actor, remembered) {
  r.queue(actor.x, actor.y + 15, 0, g => {
    const [x, y] = r.w(actor.x, actor.y, 0);
    P.line(g, x - 38, y + 5, x + 38, y + 5, '#746d52', 5); P.line(g, x - 28, y - 2, x + 35, y - 2, '#8c8463', 4);
    if (!remembered) {
      P.ell(g, x, y - 8, 34, 12, '#657f78'); P.poly(g, [[x - 31, y - 10], [x - 19, y - 17], [x + 26, y - 13], [x + 36, y - 4], [x + 17, y + 2], [x - 26, y]], '#90a391');
      P.line(g, x - 17, y - 14, x - 11, y - 1, '#c6c8ab', 2); P.line(g, x + 18, y - 12, x + 22, y - 1, '#c6c8ab', 2);
      P.ell(g, x - 27, y - 10, 7, 7, '#a3ac96');
    } else {
      P.poly(g, [[x - 17, y - 4], [x + 10, y - 5], [x + 15, y], [x - 15, y + 2]], '#90a391');
      P.rect(g, x - 7, y - 8, 10, 6, '#b9ac80'); P.line(g, x - 3, y - 8, x - 3, y - 13, '#d4c493', 1);
    }
    P.line(g, x - 42, y - 4, x - 42, y - 40, '#969879', 3); P.line(g, x - 50, y - 31, x - 34, y - 31, '#969879', 3);
    P.disc(g, x + 27, y - 16, 3, '#c6ba83'); P.line(g, x + 27, y - 13, x + 24, y - 8, '#67785b', 1);
  });
}

class SnowHorseRig {
  constructor(id) { this.id = id; this.phase = 0; this.time = 0; this.facing = 0; this.speed = 0; this.fear = 0; this.owned = false; }
  update(dt, body) {
    this.time += dt; this.speed = Math.hypot(body.vx || 0, body.vy || 0); this.phase += dt * this.speed * .055;
    if (this.speed > 2) this.facing = Math.atan2(body.vy, body.vx); else if (Number.isFinite(body.facing)) this.facing = body.facing;
    this.fear = Math.max(0, Math.min(1, (body.fear || 0) > 1 ? body.fear / 100 : body.fear || 0)); this.owned = body.owned || body.mounted;
  }
  sockets(x, y, s = 1) {
    const flip = Math.cos(this.facing) < 0 ? -1 : 1, bob = Math.sin(this.phase * 2) * Math.min(2.5, this.speed / 60);
    const q = (a, b) => [x + a * s * flip, y + (b + bob) * s];
    return { flip, saddle: q(-1, -44), pommel: q(9, -46), stirrupL: q(-7, -27), stirrupR: q(8, -28), reins: q(17, -47), neck: q(25, -49 - this.fear * 9), halter: q(34, -55 - this.fear * 9) };
  }
  draw(g, x, y, s = 1, body = {}) {
    const flip = Math.cos(this.facing) < 0 ? -1 : 1, headLift = this.fear * 9, bob = Math.sin(this.phase * 2) * Math.min(2.5, this.speed / 60);
    const q = (a, b) => [x + a * s * flip, y + (b + bob) * s];
    if (body.hp <= 0) { P.ell(g, ...q(0, -6), 29 * s, 10 * s, '#9c9475'); P.ell(g, ...q(29, -4), 13 * s, 6 * s, '#b2a283'); return; }
    for (let i = 0; i < 4; i++) {
      const base = i < 2 ? -14 : 14, stride = Math.sin(this.phase + i * Math.PI * .9) * (this.speed > 3 ? 8 : this.fear * 3), lift = Math.max(0, stride) * .8;
      P.line(g, ...q(base + (i % 2 ? 3 : -3), -24), ...q(base + stride * .5, -12 - lift), i % 2 ? '#8b8266' : '#657064', 4 * s);
      const hoof = q(base + stride, -lift); P.line(g, ...q(base + stride * .5, -12 - lift), ...hoof, i % 2 ? '#ada17a' : '#7e8065', 3 * s); P.line(g, hoof[0] - 3 * s, hoof[1], hoof[0] + 3 * s, hoof[1], '#3c554b', 3 * s);
    }
    P.ell(g, ...q(-2, -32), 26 * s, 13 * s, this.id === 'copper' ? '#b5a57e' : '#8d8b73'); P.ell(g, ...q(-13, -37), 13 * s, 9 * s, '#c0b18b');
    P.poly(g, [q(15, -29), q(17, -45 - headLift), q(25, -63 - headLift), q(35, -58 - headLift), q(32, -39), q(27, -28)], '#b09e78');
    P.poly(g, [q(17, -37), q(20, -56 - headLift), q(27, -66 - headLift), q(31, -62 - headLift), q(25, -42)], '#536252');
    P.poly(g, [q(25, -61 - headLift), q(40, -58 - headLift), q(45, -50 - headLift), q(40, -45 - headLift), q(29, -49 - headLift)], '#c1b18c');
    P.ell(g, ...q(42, -49 - headLift), 5 * s, 4 * s, '#887f60'); P.dot(g, ...q(37, -54 - headLift), '#314e42');
    P.poly(g, [q(26, -61 - headLift), q(24 + this.fear * 4, -73 - headLift), q(32, -64 - headLift)], '#8b825f');
    P.poly(g, [q(34, -60 - headLift), q(35 - this.fear * 4, -70 - headLift), q(39, -60 - headLift)], '#b4a580');
    const tail = Math.sin(this.time * 1.4 + this.fear * 5) * (3 + this.fear * 5);
    P.line(g, ...q(-25, -33), ...q(-30 + tail, -18), '#5b6550', 4 * s); P.line(g, ...q(-30 + tail, -18), ...q(-35 + tail, -9), '#5b6550', 3 * s);
    P.line(g, ...q(30, -55 - headLift), ...q(42, -51 - headLift), '#d7c79a', 2 * s); P.line(g, ...q(34, -58 - headLift), ...q(34, -47 - headLift), '#6e7857', 1);
    P.line(g, ...q(37, -53 - headLift), ...q(8, -43), '#c5b68e', 1); P.ell(g, ...q(-1, -44), 12 * s, 4 * s, '#465b4d');
    P.poly(g, [q(-15, -42), q(11, -42), q(14, -29), q(-14, -29)], '#718274'); P.line(g, ...q(-11, -41), ...q(9, -41), '#c7bea0', 2);
    for (const [a, b] of [[-7, -27], [8, -28]]) { P.line(g, ...q(a, -41), ...q(a, b), '#786647', 2); P.ell(g, ...q(a, b), 4 * s, 2 * s, '#b5b49a'); }
    if (this.owned || this.id === 'juniper') { P.rect(g, ...q(-18, -33), 13 * s, 13 * s, '#918866'); P.line(g, ...q(-17, -27), ...q(-7, -27), '#c0b58b', 2); }
    if (Math.sin(this.time * .7) > .5) { const muzzle = q(47, -48 - headLift); P.blend(g, .25, 'normal', () => P.ell(g, muzzle[0] + flip * 8, muzzle[1], 9, 4, '#dbe3cf')); }
  }
}

// All gameplay state remains in campaign.js. Renderer clocks and rig motion
// are presentation only and never grant an item or advance a mission stage.
export function createSnowboundRenderer(game) {
  const terrain = makeSnow(), scenery = treeScenery(), humans = new Map(), horses = new Map(), positions = new Map();
  const animation = createWesternAnimator(E);
  const expedition = createExpeditionActors(E, game);
  const willow = createWillowCampPresentation(game);
  let expeditionViewState = null, expeditionViewSource = null;
  function expeditionView(state) {
    if (!state.entities?.orla) return state;
    if (expeditionViewSource !== state) { expeditionViewSource = state; expeditionViewState = Object.create(state); }
    expeditionViewState.entities = Object.fromEntries(Object.entries(state.entities).filter(([, body]) => !ownsWillowActor(state, body)));
    return expeditionViewState;
  }
  let contacts = [];
  let clock = 0, pressureTime = null, rescuePresentation = false, huntPresentation = false;
  const humanFor = (id, hostile = false) => { if (!humans.has(id)) humans.set(id, EXPEDITION_CAST_IDS.has(id) ? createExpeditionHuman(E,id) : makeHuman(id, hostile)); return humans.get(id); };
  const horseFor = (id) => { if (!horses.has(id)) horses.set(id, new SnowHorseRig(id)); return horses.get(id); };
  function motion(id, body, dt) {
    const before = positions.get(id), vx = before && dt > 0 ? (body.x - before.x) / dt : 0, vy = before && dt > 0 ? (body.y - before.y) / dt : 0;
    positions.set(id, { x: body.x, y: body.y });
    return { vx: Math.abs(vx) < 600 ? vx : 0, vy: Math.abs(vy) < 600 ? vy : 0 };
  }
  function update(dt, state) {
    const rescue = isRescuePresentation(state), stream = getCampaignPresentation(state);
    rescuePresentation = rescue;
    huntPresentation = isHuntPresentation(state);
    animation.update(dt, state, rescue || isHuntPresentation(state) ? { ...stream, events: [] } : stream, game.reduceMotion);
    if (rescue) expedition.update(dt,expeditionView(state));
    if (state.entities?.orla) willow.update(dt,state);
    if (!game.reduceMotion) clock += dt;
    pressureTime = state.worldChanges?.pressureReleased ? (pressureTime ?? 0) + dt : null;
    const p = state.player;
    if (p) {
      const h = humanFor('mara');
      h.ready = !p.carrying && !p.weaponLost && p.weaponOwned !== false && (p.holstered === false || (p.holstered !== true && (state.aiming || p.shotTimer > 0)));
      h.flash = p.shotTimer > .24 ? p.shotTimer - .24 : 0;
      h.pickup = Math.max(0, (h.pickup || 0) - dt);
      h.gesture = Math.max(0, (h.gesture || 0) - dt);
      h.disarmed = Math.max(0, (h.disarmed || 0) - dt);
      const inventory = state.inventory || {};
      if (h.pack && Object.entries(inventory).some(([id, count]) => count > (h.pack[id] || 0))) h.pickup = .42;
      h.pack = { ...inventory };
      const flags = state.flags || {}, changes = state.worldChanges || {};
      const current = { coat: !!p.coldcoat, lantern: !!p.lantern, weapon: p.weaponOwned !== false, pat: !!flags.copperPatted, calm: !!flags.copperCalmed, restraint: !!flags.pavelSubdued, pressure: !!changes.pressureReleased };
      if (h.previous) {
        if (current.coat !== h.previous.coat || current.lantern !== h.previous.lantern) h.pickup = .5;
        if (current.weapon !== h.previous.weapon) { if (current.weapon) h.pickup = .42; else h.disarmed = .5; }
        if (current.pat && !h.previous.pat || current.calm && !h.previous.calm || current.pressure && !h.previous.pressure) h.gesture = .8;
        if (current.restraint && !h.previous.restraint) h.pickup = .65;
      }
      h.previous = current;
      const targetZ = 0;
      if (!Number.isFinite(h.mountZ)) h.mountZ = targetZ;
      h.mountZ += Math.sign(targetZ - h.mountZ) * Math.min(Math.abs(targetZ - h.mountZ), dt * 65);
      const mounting = Math.abs(h.mountZ - targetZ) > .5;
      const action = p.action || p.animation || '', melee = state.melee || {};
      const block = action === 'block' || p.blockTimer > 0 || melee.blocking || melee.blockTimer > 0;
      const shove = action === 'shove' || p.shoveTimer > 0 || melee.shoveTimer > 0 || state.timers?.shoveCooldown > .12;
      const coatClip = animation.pickup('coat');
      h.rig.o.outfit = p.coldcoat && (!coatClip || coatClip.age / coatClip.duration > .54) ? 'coat' : 'shirt';
      h.rig.update(dt, { ...p, z: h.mountZ, vx: p.mounted ? 0 : p.vx, vy: p.mounted ? 0 : p.vy, point: h.ready && (state.aiming || p.shotTimer > 0),
        pose: p.hp <= 0 ? 'die' : block || h.disarmed > 0 ? 'block' : shove || h.gesture > 0 ? 'cast' : h.pickup > 0 && !animation.clip('mara') ? 'kneel' : mounting || p.crouch ? 'crouch' : null,
        hurt: p.invulnerable > 0 && p.invulnerable < .3, stance: block ? 'guard' : null });
      h.leading = !!state.horse?.leading || (state.animals || []).some(a => a.leading);
      h.rig.o.cheat = h.leading ? 0 : .5;
      if (h.leading) { h.rig._cheat = 0; const sh = h.rig.J.shR; solveLimb(E, h.rig, 'R', [sh[0] + 3, sh[1] + 1, sh[2] - 4]); }
    }
    for (const actor of [...(state.npcs || []), ...(state.enemies || [])]) {
      if (actor.hidden || actor.departed || actor.id === 'neri') continue;
      const h = humanFor(actor.id, actor.faction === 'company' || (state.enemies || []).includes(actor)), m = motion(actor.id, actor, dt);
      h.ready = (actor.active || actor.id === 'inez' && state.mission?.stage === 3) && actor.hp > 0 && !actor.surrendered && !actor.captured && !actor.restrained;
      h.flash = Math.max(0, h.flash - dt);
      if (h.ready && Number.isFinite(h.fireTimer) && actor.fireTimer > h.fireTimer + .4) h.flash = .08;
      if (actor.id === 'inez' && Number.isFinite(h.shotTimer) && actor.shotTimer > h.shotTimer + .4) h.flash = .08;
      h.shotTimer = actor.shotTimer;
      h.fireTimer = actor.fireTimer;
      h.escortGesture = Math.max(0, (h.escortGesture || 0) - dt);
      if (actor.id === 'ada' && state.flags?.adaEscorting && !h.escorting) h.escortGesture = .7;
      h.escorting = actor.id === 'ada' && !!state.flags?.adaEscorting;
      const riding = !rescue && actor.id === 'tomas' && state.mission?.stage === 1;
      h.rig.update(dt, { ...actor, ...m, vx: riding ? 0 : m.vx, vy: riding ? 0 : m.vy, z: actor.z || 0, facing: actor.facing ?? (Math.hypot(m.vx, m.vy) > 3 ? Math.atan2(m.vy, m.vx) : 1.15), point: h.ready,
        pose: actor.hp <= 0 ? 'die' : actor.id === 'gideon' && actor.injured ? 'down' : actor.captured || actor.restrained || actor.bound || actor.surrendered ? 'guard' : h.escortGesture > 0 ? 'cast' : actor.id === 'tomas' && state.mission?.stage === 0 ? 'hips' : null });
    }
    if (state.horse && p) horseFor(state.horse.id || 'juniper').update(dt, p.mounted ? { ...p, hp: state.horse.hp, mounted: true } : { ...state.horse, ...motion(state.horse.id || 'juniper', state.horse, dt) });
    for (const animal of state.animals || []) if (animal.id !== state.horse?.id) horseFor(animal.id).update(dt, { ...animal, ...motion(animal.id, animal, dt) });
    for (const mount of state.mounts || []) horseFor(mount.id).update(dt, { ...mount, ...motion(mount.id, mount, dt) });
  }

  function drawPickupBundle(g, at, id) {
    const [x, y] = at;
    if (id === 'weapon') { P.line(g, x - 5, y, x + 6, y - 1, '#abc0b1', 3); P.line(g, x - 3, y, x - 2, y + 4, '#7a6147', 3); }
    else if (id === 'token') { P.disc(g, x, y + 2, 5, '#bfa471'); P.disc(g, x, y + 2, 3, '#e0c998'); }
    else if (id === 'oil') { P.rect(g, x - 6, y, 12, 12, '#6e8981'); P.rect(g, x - 2, y - 3, 5, 4, '#354e4d'); P.rect(g, x - 3, y + 4, 7, 5, '#d0ba8c'); }
    else if (id === 'oats') { P.ell(g, x, y + 7, 10, 11, '#b8ae83'); P.line(g, x - 5, y, x + 5, y, '#655f45', 2); }
    else if (id === 'kindling') { for (let i = 0; i < 4; i++) P.line(g, x - 9, y + i * 2, x + 12, y + 4 + i * 2, i % 2 ? '#a9936a' : '#766448', 3); P.line(g, x, y, x + 3, y + 11, '#d2be87', 2); }
    else if (id === 'broth') { P.rect(g, x - 5, y, 10, 12, '#b3996f'); P.ell(g, x, y, 5, 2, '#d7d0ad'); P.rect(g, x - 4, y + 4, 8, 5, '#9a6651'); }
    else { P.rect(g, x - 11, y, 22, 10, id === 'blankets' ? '#976d67' : id === 'logbook' ? '#ded7b5' : '#c5c3a7'); P.line(g, x - 3, y, x - 3, y + 9, id === 'bandages' ? '#9d6553' : '#d1c8a4', 2); }
  }

  function carriedAdult(r, carrier, root, state, load) {
    const h = humanFor('gideon'), rig = h.rig, restore = savePose(rig), cv = E.charView(r.view);
    rig.downW = 1; rig.facing = 0; rig.o.cheat = 0; rig._cheat = 0; rig._pose();
    const shoulder = jointScreen(carrier.rig, cv, root, 'shC'), hip = jointScreen(rig, cv, [0, 0], 'hipC');
    const lifted = [shoulder[0] + 1 - hip[0], shoulder[1] - 2 - hip[1]];
    const body = (state.npcs || []).find(n => n.id === 'gideon'), c = load.clip;
    const ground = c?.target || body || state.player, floor = r.w(ground.x, ground.y, 0);
    const at = [floor[0] + (lifted[0] - floor[0]) * load.load, floor[1] + (lifted[1] - floor[1]) * load.load];
    const left = jointScreen(rig, cv, at, 'shC'), right = jointScreen(rig, cv, at, 'hipR');
    const grip = Math.max(load.load, c ? Math.sin(Math.min(1, c.age / c.duration) * Math.PI) : 0);
    const carrierHeight = 6 + load.load * 32;
    for (const [side, target] of [['L', [left[0] + 4, left[1] + 2]], ['R', [right[0] + 8, right[1] + 3]]]) {
      const hit = contactHand(E, carrier.rig, cv, root, target, side, carrierHeight, grip);
      if (hit && grip > .995) contacts.push({ actorId: 'mara', kind: c?.kind || 'carrying', side, target, hit, error: Math.hypot(hit[0] - target[0], hit[1] - target[1]) });
    }
    return { restore, draw(g) {
      rig.draw(g, ...at, r.view);
      const head = jointScreen(rig, cv, at, 'head'), chest = jointScreen(rig, cv, at, 'shC');
      P.line(g, head[0] - 5, head[1] - 3, head[0] + 4, head[1] - 2, '#d1c8aa', 3);
      P.line(g, chest[0] - 3, chest[1] - 3, chest[0] + 7, chest[1] + 5, '#cfc8aa', 3);
      P.line(g, chest[0] - 1, chest[1], chest[0] + 4, chest[1] + 4, '#ae7661', 1);
    } };
  }

  function drawHuman(r, body, id, state, horizon) {
    if (state.entities?.orla && ownsWillowActor(state, body)) return;
    if (isRescuePresentation(state) && (id === 'mara' || id === 'inez' || EXPEDITION_CAST_IDS.has(id))) return;
    if (body.hidden || body.departed || body.escaped || body.carried || state.player?.carrying === id || id === 'gideon' && animation.carry(state)) return;
    const companionMounted = !isRescuePresentation(state) && id === 'tomas' && state.mission?.stage === 1;
    const h = humanFor(id, body.faction === 'company');
    const z = body.z || 0, at = r.w(body.x, body.y, 0);
    if (at[1] < horizon || !r.visible(body.x, body.y, z, 85, 130, 100)) return;
    if (id === 'neri') { drawFuneral(r, body, state.worldChanges?.neriRemembered); return; }
    r.shadow(body.x, body.y, body.mounted ? 15 : 8, .21, '#526d69');
    const queueBody = companionMounted ? state.mounts?.[0] || body : body;
    r.actor(queueBody.x, queueBody.y, z, (g, x, y) => {
      const horseId = id === 'tomas' ? state.mounts?.[0]?.id : state.horse?.id || 'juniper';
      const horseBody = id === 'tomas' ? state.mounts?.[0] || body : body.mounted ? body : state.horse || body;
      const horseAt = r.w(horseBody.x, horseBody.y, 0), horseRig = horseFor(horseId);
      const copper = (state.animals || []).find(a => a.id === 'copper') || (state.horse?.id === 'copper' ? state.horse : null);
      const copperAt = copper && r.w(copper.x, copper.y, 0);
      const cover = rows(SNOWBOUND_WORLD.props).find(p => p.id === 'cover-' + state.flags?.cover);
      const closeCover = cover && Math.hypot(body.x - cover.x, body.y - cover.y) < 80;
      const targetActor = (state.npcs || []).find(n => n.id === animation.clip(id)?.targetId) || (state.enemies || []).find(n => n.id === animation.clip(id)?.targetId);
      const targetAt = targetActor && r.w(targetActor.x, targetActor.y, 0);
      let partnerSockets;
      if (id === 'mara' && targetActor && ['block', 'shove', 'restrain'].includes(animation.clip(id)?.kind)) {
        const partner = humanFor(targetActor.id).rig;
        const preview = animation.applyHuman(targetActor.id, partner, targetAt, r.view, state, { project: (wx, wy, wz) => r.w(wx, wy, wz), reducedMotion: game.reduceMotion });
        const cv = E.charView(r.view), shoulder = jointScreen(partner, cv, preview.root, 'shC'), hip = jointScreen(partner, cv, preview.root, 'hipC');
        const a = jointScreen(partner, cv, preview.root, 'handL'), b = jointScreen(partner, cv, preview.root, 'handR');
        partnerSockets = { chest: [shoulder[0] * .75 + hip[0] * .25, shoulder[1] * .75 + hip[1] * .25], hands: [(a[0] + b[0]) * .5, (a[1] + b[1]) * .5] };
        preview.restore();
      }
      let playerHand;
      if (id === 'pavel' && animation.clip(id)?.kind === 'pavel-drop') {
        const mara = humanFor('mara').rig, at = r.w(state.player.x, state.player.y, 0);
        const preview = animation.applyHuman('mara', mara, at, r.view, state, { project: (wx, wy, wz) => r.w(wx, wy, wz), reducedMotion: game.reduceMotion });
        playerHand = jointScreen(mara, E.charView(r.view), preview.root, 'handR'); preview.restore();
      }
      const authored = animation.applyHuman(id, h.rig, [x, y], r.view, state, {
        project: (wx, wy, wz) => r.w(wx, wy, wz), mounted: companionMounted,
        sockets: horseRig.sockets(...horseAt, id === 'tomas' ? 1.12 : 1.17),
        copperSockets: copperAt && horseFor('copper').sockets(...copperAt, 1.16),
        partnerSockets,
        playerHands: { R: playerHand },
        exposed: !h.leading && !buildings().some(b => inside(body, b, 0)), cover: closeCover, coverSide: cover && body.x < cover.x ? -1 : 1,
        reducedMotion: game.reduceMotion,
        itemSocket: (c, p) => [p[0], p[1] - (c.kind === 'coat' ? 38 : c.kind === 'lantern' ? 20 : c.targetId === 'oats' ? 24 : c.targetId === 'oil' ? 21 : c.targetId === 'weapon' || c.targetId === 'token' ? 3 : 13)],
      });
      [x, y] = authored.root;
      contacts.push(...authored.diagnostics.map(c => ({ actorId: id, kind: animation.clip(id)?.kind, ...c })));
      h.authoredCarry = !!authored.carry;
      const carried = authored.carry ? carriedAdult(r, h, [x, y], state, authored.carry) : null;
      const weapon = h.rig.o.weapon; h.rig.o.weapon = null;
      try {
        h.rig.draw(g, x, y, r.view);
        if (carried) carried.draw(g);
        const coatClip = id === 'mara' && animation.pickup('coat'), lanternClip = id === 'mara' && animation.pickup('lantern');
        const visual = coatClip || lanternClip ? { ...state, player: { ...state.player, coldcoat: state.player.coldcoat && (!coatClip || coatClip.age / coatClip.duration > .54), lantern: state.player.lantern && (!lanternClip || lanternClip.age / lanternClip.duration > .54) } } : state;
        drawColdOutfit(g, x, y, h, r.view, visual);
        const disarm = id === 'mara' && animation.clip(id)?.kind === 'disarm' ? animation.clip(id) : null, wasReady = h.ready;
        if (disarm && disarm.age / disarm.duration < .58) { h.ready = true; drawGun(g, x, y, h, r.view, { ...visual.player, weaponOwned: true }); h.ready = wasReady; }
        else drawGun(g, x, y, h, r.view, visual.player);
        if (disarm && disarm.age / disarm.duration >= .58) {
          const hand = atJoint(h.rig, r.view, x, y, 'handR'), u = smooth((disarm.age / disarm.duration - .58) / .42);
          for (const id of ['weapon', 'token']) if (state.dropped?.[id]) {
            const dest = r.w(state.dropped[id].x, state.dropped[id].y, 0), at = [hand[0] + (dest[0] - hand[0]) * u, hand[1] + (dest[1] - hand[1]) * u - Math.sin(u * Math.PI) * 12];
            drawPickupBundle(g, at, id);
          }
        }
        const pickup = id === 'mara' && animation.clip(id);
        if (pickup && pickup.kind.startsWith('pickup:') && pickup.age / pickup.duration > .48) {
          const hand = atJoint(h.rig, r.view, x, y, 'handR');
          drawPickupBundle(g, hand, pickup.targetId);
        }
      if (body.captured || body.restrained || body.bound) {
        const hand = atJoint(h.rig, r.view, x, y, 'handR'); P.line(g, hand[0] - 5, hand[1], hand[0] + 5, hand[1], '#c9b485', 3); P.line(g, hand[0], hand[1] - 4, hand[0], hand[1] + 3, '#7c7051', 1);
      }
      if (body.hp > 0) {
        const head = atJoint(h.rig, r.view, x, y, 'head'), t = (clock * .28 + hash(idSeed(id))) % 1;
        if (t < .36) P.blend(g, (.36 - t) * .65, 'normal', () => P.ell(g, head[0] + 5 + t * 25, head[1] + 3 - t * 8, 3 + t * 12, 2 + t * 5, '#d9e2d0'));
      }
      } finally { h.rig.o.weapon = weapon; carried?.restore(); authored.restore(); }
    }, { outline: false, alpha: body.hp <= 0 ? .85 : 1, flash: id === 'mara' && body.invulnerable > 0 && body.invulnerable < .3 ? '#d4d8b4' : false, margin: 100 });
  }

  function markerPoint(state) {
    const target = state.interactionTarget || state.nearby;
    if (!target) return null;
    if (Number.isFinite(target.x) && Number.isFinite(target.y)) return target;
    const id = target.targetId || target.id;
    if (id === 'mount' || id === 'dismount') return id === 'mount' ? state.horse : state.player;
    const cleaned = String(id).replace(/^(supply:|pickup:|inspect:|gather:|talk:)/, '');
    if (cleaned === 'holster') return state.player;
    if (cleaned === 'deposit-supplies') return SNOWBOUND_WORLD.props.find(p => p.id === 'stove-store');
    if (cleaned === 'investigate-coal') return { x: 1180, y: 760 };
    if (state.dropped?.[cleaned]) return state.dropped[cleaned];
    return [...rows(SNOWBOUND_WORLD.props), ...rows(state.supplies || SNOWBOUND_WORLD.supplies), ...(state.npcs || []), ...(state.enemies || []), ...(state.animals || [])].find(p => p.id === cleaned);
  }

  function draw(r, state) {
    contacts = [];
    const horizon = drawMountainSky(r, clock, state), g = r.ctx;
    g.save(); g.beginPath(); g.rect(0, horizon, r.bw, r.bh - horizon); g.clip();
    P.rect(g, 0, horizon, r.bw, r.bh - horizon, C.snow);
    g.transform(r.view.ax, r.view.bx, r.view.ay, r.view.by, -r.ix, -r.iy); g.drawImage(terrain, 0, 0); g.restore();
    g.save(); g.beginPath(); g.rect(0, horizon, r.bw, r.bh - horizon); g.clip();
    drawServiceWalkway(r);
    for (const b of buildings()) drawFloor(r, b);
    drawExpeditionCamp(E,r,state);
    g.restore();
    for (const p of scenery) if (!(state.entities?.elin && p.x > 250 && p.x < 510 && p.y > 1140 && p.y < 1370) && !(state.entities?.orla && p.x > 20 && p.x < 300 && p.y > 1100 && p.y < 1400) && r.w(p.x, p.y, 0)[1] >= horizon) drawTree(r, p, clock, state.player);
    const roofState = animation.carry(state) && !state.player.carrying ? { ...state, player: { ...state.player, carrying: 'gideon' } } : state;
    for (const o of obstacles()) {
      if (r.w(o.x + o.w / 2, o.y + o.h, 0)[1] < horizon) continue;
      if (o.kind === 'fence') drawFence(r, o);
      else if (o.kind === 'kiln') drawKiln(r, o, state, clock);
      else if (o.kind === 'tent') drawTent(r, o);
      else if (o.kind === 'boiler') drawBoiler(r, o, state, clock);
      else drawObstacle(r, o, roofState);
    }
    for (const b of buildings()) if (r.w(b.x + b.w / 2, b.y + b.h, 0)[1] >= horizon) drawRoof(r, b, roofState);
    const coatClip = animation.pickup('coat'), lampClip = animation.pickup('lantern');
    const propState = coatClip || lampClip ? { ...state, player: { ...state.player, coldcoat: state.player.coldcoat && (!coatClip || coatClip.age / coatClip.duration > .54), lantern: state.player.lantern && (!lampClip || lampClip.age / lampClip.duration > .54) } } : state;
    for (const p of rows(SNOWBOUND_WORLD.props)) if (r.w(p.x, p.y, 0)[1] >= horizon) drawProp(r, p, propState, clock, animation.valveTurn(state));
    for (const p of rows(state.supplies || SNOWBOUND_WORLD.supplies)) if (r.w(p.x, p.y, 0)[1] >= horizon) drawSupply(r, p, (p.collected || p.taken || p.lost) && !(animation.pickup(p.id) && animation.pickup(p.id).age / animation.pickup(p.id).duration < .48));
    for (const [id, item] of Object.entries(state.dropped || {})) if (item && animation.clip('mara')?.kind !== 'disarm' && (!item.collected || animation.pickup(id) && animation.pickup(id).age / animation.pickup(id).duration < .48) && r.w(item.x, item.y, 0)[1] >= horizon) r.queue(item.x, item.y, 0, ctx => {
      const [x, y] = r.w(item.x, item.y, 0);
      if (id === 'weapon') { P.line(ctx, x - 7, y - 3, x + 8, y - 5, '#45645b', 3); P.line(ctx, x - 4, y - 2, x - 3, y + 3, '#856141', 3); P.line(ctx, x - 7, y - 4, x + 7, y - 6, '#afbeaa', 1); }
      else { P.disc(ctx, x, y - 2, 6, '#9c8860'); P.disc(ctx, x, y - 2, 4, '#d2bd82'); P.line(ctx, x - 2, y - 3, x + 2, y - 3, '#716d48', 1); P.line(ctx, x, y - 3, x, y + 1, '#716d48', 1); }
    });
    for (const animal of state.animals || []) {
      if (state.entities?.orla && ownsWillowActor(state, animal)) continue;
      if (isRescuePresentation(state)) continue;
      if (animal.id === state.horse?.id || animal.hidden || !r.visible(animal.x, animal.y, 0, 90, 140, 70) || r.w(animal.x, animal.y, 0)[1] < horizon) continue;
      r.shadow(animal.x, animal.y, 20, .21, '#56736a');
      r.actor(animal.x, animal.y, 0, (ctx, x, y) => horseFor(animal.id).draw(ctx, x, y, 1.16, animal), { outline: false, margin: 100 });
      if (animal.leading && state.player) r.queue(animal.x, animal.y, .1, ctx => {
        const horseRig = horseFor(animal.id), at = r.w(animal.x, animal.y, 0);
        const halter = horseRig.sockets(...at, 1.16).halter;
        const h = humanFor('mara'), foot = r.w(state.player.x, state.player.y, h.mountZ || 0), hand = atJoint(h.rig, r.view, ...foot, 'handR');
        P.line(ctx, ...halter, ...hand, '#62765c', 2); P.line(ctx, ...halter, ...hand, '#d5c59c', 1);
      });
    }
    for (const mount of state.mounts || []) {
      if (state.entities?.orla && ownsWillowActor(state, mount)) continue;
      if (isRescuePresentation(state)) continue;
      if (mount.hidden || r.w(mount.x, mount.y, 0)[1] < horizon) continue;
      r.shadow(mount.x, mount.y, 23, .22, '#58746b');
      r.actor(mount.x, mount.y, 0, (ctx, x, y) => horseFor(mount.id).draw(ctx, x, y, 1.12, mount), { outline: false, margin: 110 });
    }
    for (const actor of [...(state.npcs || []), ...(state.enemies || [])]) drawHuman(r, actor, actor.id, state, horizon);
    const p = state.player, horse = p?.mounted ? p : state.horse;
    if (!isRescuePresentation(state) && !isHuntPresentation(state) && horse && r.w(horse.x, horse.y, 0)[1] >= horizon) {
      r.shadow(horse.x, horse.y, 23, .22, '#58746b');
      r.actor(horse.x, horse.y, 0, (ctx, x, y) => horseFor(state.horse?.id || 'juniper').draw(ctx, x, y, 1.17, { ...horse, hp: state.horse?.hp ?? 100 }), { outline: false, margin: 110 });
    }
    if (p) drawHuman(r, p, 'mara', state, horizon);
    if (isRescuePresentation(state)) expedition.draw(r,expeditionView(state));
    if (state.entities?.orla) willow.draw(r,state);
    for (const shot of state.bullets || []) {
      const a = r.w(shot.x, shot.y, shot.z ?? 25), b = r.w(shot.x - shot.vx * .019, shot.y - shot.vy * .019, shot.z ?? 25);
      r.queue(shot.x, shot.y, 25, ctx => { P.line(ctx, ...a, ...b, shot.faction === 'player' ? '#ead9ad' : '#d9a673', 2); P.dot(ctx, ...a, '#f1e5c6'); });
    }
    r.overlay(ctx => {
      const interior = buildings().find(b => inside(state.player, b));
      if (interior) { const q = r.w(interior.x + interior.w / 2, interior.y + interior.h / 2, 0); P.ddisc(ctx, ...q, Math.min(125, interior.w * .4), '#d8ba7d', .04); }
      if (p?.lantern) { const q = r.w(p.x, p.y, 20); P.ddisc(ctx, ...q, 52, '#e0bd77', .05); }
      if (state.worldChanges?.fireActive && !state.worldChanges.boilerDestroyed) { const q = r.w(1390, 475, 0); P.ddisc(ctx, ...q, 85, '#eab176', .12); }
      for (let i = 0; i < (game.reduceMotion ? 0 : Math.min(110, Math.ceil(r.bw * r.bh / 6000))); i++) {
        const x = (hash(i + 745) * r.bw + clock * (15 + hash(i + 59) * 15)) % (r.bw + 24) - 12;
        const y = (hash(i + 543) * r.bh + clock * (14 + hash(i + 15) * 18)) % (r.bh + 24) - 12;
        P.blend(ctx, .25 + hash(i + 174) * .45, 'normal', () => P.line(ctx, x, y, x - 2, y + 2, '#e9ebd6', 1));
      }
      const target = markerPoint(state);
      if (target) {
        const q = r.w(target.x, target.y, 54);
        if (q[1] > horizon && q[1] < r.bh && q[0] > 0 && q[0] < r.bw) { P.poly(ctx, [[q[0], q[1] - 6], [q[0] + 5, q[1]], [q[0], q[1] + 6], [q[0] - 5, q[1]]], '#e0c99b'); P.disc(ctx, ...q, 2, '#586c54'); }
      }
      if (state.aiming && state.pointer) {
        const { x, y } = state.pointer;
        for (const d of [-1, 1]) { P.line(ctx, x + d * 5, y, x + d * 10, y, '#ece6c5', 1); P.line(ctx, x, y + d * 5, x, y + d * 10, '#ece6c5', 1); }
        P.dot(ctx, x, y, '#b27550');
      }
      if (p?.focusActive) P.blend(ctx, .07, 'normal', () => P.rect(ctx, 0, 0, r.bw, r.bh, '#d4b47b'));
    });
  }
  return { update, draw, inspectAnimation: () => huntPresentation ? willow.inspect() : rescuePresentation ? expedition.inspect() : ({ contacts: contacts.map(c => ({ ...c })), mara: animation.clip('mara'), pavel: animation.clip('pavel') }), inspectHuntAnimation: () => willow.inspect() };
}
