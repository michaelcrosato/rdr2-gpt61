// Post-pose authoring for the supplied My3D2dge humanoids. Gameplay and saves
// own every outcome; this layer only changes joints and temporary draw roots.
export const clamp01 = n => Math.max(0, Math.min(1, n));
export const smooth = n => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const vMix = (a, b, t) => a.map((n, i) => mix(n, b[i], t));
const JOINTS = ['hipC', 'hipL', 'hipR', 'shC', 'shL', 'shR', 'head', 'kneeL', 'kneeR', 'footL', 'footR', 'elbowL', 'elbowR', 'handL', 'handR', 'bladeDir'];

export function sampleTrack(keys, time) {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], t = smooth((time - a[0]) / (b[0] - a[0]));
    return Array.isArray(a[1]) ? vMix(a[1], b[1], t) : mix(a[1], b[1], t);
  }
  return keys[keys.length - 1][1];
}

// A world prop and a humanoid have different projection pitches. Invert the
// character projection at a chosen hand height so visible sockets agree.
export function localFromScreen(rig, view, root, point, height) {
  const xy = view.toGround(point[0] - root[0], point[1] - root[1] - view.bz * height);
  if (!xy) return null;
  const angle = rig.facing + (rig.spin || 0) + (rig._cheat || 0), c = Math.cos(angle), s = Math.sin(angle);
  const size = rig.o.size, k = (1 - (rig.sq || 0) * .4) * size, kz = (1 + (rig.sq || 0)) * size;
  return [(xy[0] * c + xy[1] * s) / k, (-xy[0] * s + xy[1] * c) / k, height / kz];
}
export function jointScreen(rig, view, root, joint) {
  const p = typeof joint === 'string' ? rig.J[joint] : joint, q = view.p(...rig._w(p));
  return [root[0] + q[0], root[1] + q[1]];
}
export function solveLimb(E, rig, side, target, weight = 1, leg = false, hint = null) {
  const start = rig.J[(leg ? 'hip' : 'sh') + side], endName = (leg ? 'foot' : 'hand') + side;
  const end = vMix(rig.J[endName], target, clamp01(weight));
  const a = leg ? rig.o.legUpper : rig.o.armUpper, b = leg ? rig.o.legLower : rig.o.armLower;
  const pole = hint || (leg ? [1, side === 'R' ? .3 : -.3, .1] : [-1, side === 'R' ? .7 : -.7, -.2]);
  const [bend, reached] = E.ik3(start, end, a, b, pole);
  rig.J[(leg ? 'knee' : 'elbow') + side] = bend; rig.J[endName] = reached;
  return reached;
}
export function contactHand(E, rig, view, root, point, side = 'R', height = 32, weight = 1) {
  const target = localFromScreen(rig, view, root, point, height);
  if (!target) return null;
  solveLimb(E, rig, side, target, weight);
  return jointScreen(rig, view, root, 'hand' + side);
}
export function savePose(rig) {
  const joints = {};
  for (const key of JOINTS) if (rig.J[key]) joints[key] = rig.J[key].slice();
  const values = { facing: rig.facing, spin: rig.spin, _cheat: rig._cheat, cheat: rig.o.cheat, downW: rig.downW };
  return () => { for (const [key, p] of Object.entries(joints)) rig.J[key] = p; const { cheat, ...rest } = values; Object.assign(rig, rest); rig.o.cheat = cheat; };
}
function torso(E, rig, drop, lean, side = 0) {
  const J = rig.J, feet = [J.footL.slice(), J.footR.slice()];
  for (const key of ['hipC', 'hipL', 'hipR', 'shC', 'shL', 'shR', 'head', 'elbowL', 'elbowR', 'handL', 'handR']) {
    const p = J[key], upper = /sh|head|elbow|hand/.test(key);
    J[key] = [p[0] + (upper ? lean : lean * .15), p[1] + (upper ? side : side * .3), p[2] - drop];
  }
  solveLimb(E, rig, 'L', feet[0], 1, true); solveLimb(E, rig, 'R', feet[1], 1, true);
}
function exactRoot(E, rig, view, root, point, side, height, weight) {
  if (weight <= 0) return root;
  // Move the temporary draw root only enough to bring a socket within reach.
  // The actor's authoritative collision root is never changed.
  const target = localFromScreen(rig, view, root, point, height);
  if (!target) return root;
  const sh = rig.J['sh' + side], d = target.map((n, i) => n - sh[i]), length = Math.hypot(...d);
  const reach = (rig.o.armUpper + rig.o.armLower) * .94;
  if (length <= reach) return root;
  const z = Math.max(-reach * .9, Math.min(reach * .9, d[2])), xyMax = Math.sqrt(reach * reach - z * z), xy = Math.hypot(d[0], d[1]);
  if (xy < .00001) return root;
  const allowed = [sh[0] + d[0] / xy * Math.min(xy, xyMax), sh[1] + d[1] / xy * Math.min(xy, xyMax), sh[2] + z];
  const at = jointScreen(rig, view, root, allowed);
  return [root[0] + (point[0] - at[0]) * weight, root[1] + (point[1] - at[1]) * weight];
}
const DURATION = { mount: 1.05, dismount: .95, hitch: .95, coat: 1.1, lantern: .85, 'pavel-drop': 1.15, disarm: 1.15, block: .45, shove: .55, restrain: 1, 'pat-copper': 1.05, 'calm-copper': .95, 'pressure-valve': 1.3, 'carry-gideon': 1.25, 'set-down-gideon': 1.15, 'safe-set-down-gideon': 1.15 };
const isPickup = kind => kind === 'coat' || kind === 'lantern' || kind.startsWith('pickup:');
const moving = p => Math.hypot(p.vx || 0, p.vy || 0);

export function createWesternAnimator(E) {
  let stateRef = null, generation = null, seq = 0, clock = 0;
  const clips = new Map();
  function update(dt, state, stream = { generation: 0, seq: 0, events: [] }, reducedMotion = false) {
    if (state !== stateRef || generation !== stream.generation) { stateRef = state; generation = stream.generation; seq = 0; clips.clear(); }
    if (!reducedMotion) clock += dt;
    for (const c of new Set(clips.values())) c.age += dt;
    for (const [id, c] of clips) if (c.age >= c.duration) clips.delete(id);
    for (const event of stream.events || []) {
      if (event.seq <= seq) continue;
      seq = event.seq;
      const aliases = {pickup: 'pickup:' + event.targetId, pat: 'pat-copper', calm: 'calm-copper', valve: 'pressure-valve', lift: 'carry-gideon', setdown: 'set-down-gideon', 'pavel-drop': 'pavel-drop', disarm: 'disarm'};
      const kind = aliases[event.kind] || event.kind, duration = DURATION[kind] || (isPickup(kind) ? .85 : 0);
      if (!duration) continue;
      const c = { ...event, kind, age: 0, duration, reducedMotion };
      clips.set(event.actorId || 'mara', c);
      if (kind === 'shove' || kind === 'restrain') clips.set(event.targetId || 'pavel', c);
    }
  }
  const clip = id => clips.get(id);
  function pickup(id) { const c = clip('mara'); return c && isPickup(c.kind) && (c.targetId === id || c.kind === id || c.kind === 'pickup:' + id) ? c : null; }
  function carry(state) { const c = clip('mara'); return state.player?.carrying === 'gideon' || c && ['carry-gideon', 'set-down-gideon', 'safe-set-down-gideon'].includes(c.kind); }
  function valveTurn(state) { const c = clip('mara'); return c?.kind === 'pressure-valve' ? sampleTrack([[0, 0], [.24, 0], [.85, 1], [1, 1]], c.age / c.duration) : state.worldChanges?.pressureReleased ? 1 : 0; }

  function applySeat(rig, view, root, sockets, amount, swing = 0) {
    const hip = rig.J.hipC, seated = [0, 0, rig.o.hipZ * .61], shift = seated.map((n, i) => (n - hip[i]) * amount);
    for (const key of JOINTS) if (!key.startsWith('foot') && !key.startsWith('knee') && key !== 'bladeDir') rig.J[key] = rig.J[key].map((n, i) => n + shift[i]);
    const hipAt = jointScreen(rig, view, [0, 0], 'hipC');
    const seatedRoot = [sockets.saddle[0] - hipAt[0], sockets.saddle[1] - hipAt[1]];
    root = vMix(root, seatedRoot, amount);
    for (const side of ['L', 'R']) {
      const target = sockets['stirrup' + side].slice();
      if (side === 'R') { target[0] += Math.sin(swing * Math.PI) * sockets.flip * 25; target[1] -= Math.sin(swing * Math.PI) * 43; }
      const local = localFromScreen(rig, view, root, target, 0);
      if (local) solveLimb(E, rig, side, local, amount, true, [sockets.flip, side === 'R' ? .8 : -.8, .4]);
    }
    contactHand(E, rig, view, root, sockets.reins, 'L', 36, amount);
    return root;
  }

  function applyHuman(id, rig, root, view, state, context = {}) {
    const restore = savePose(rig), cv = E.charView(view), body = id === 'mara' ? state.player : [...(state.npcs || []), ...(state.enemies || [])].find(n => n.id === id);
    const c = clip(id), u = c ? c.age / c.duration : 0, contact = c ? sampleTrack([[0, 0], [.26, 1], [.7, 1], [1, 0]], u) : 0;
    const authored = !!c || body?.mounted || context.mounted || id === 'mara' && carry(state);
    if (authored) { rig.o.cheat = 0; rig._cheat = 0; }
    const diagnostics = [];
    const hand = (point, side = 'R', height = 32, w = contact, fit = true) => {
      if (fit) root = exactRoot(E, rig, cv, root, point, side, height, w);
      const hit = contactHand(E, rig, cv, root, point, side, height, w);
      if (hit && w > .995) diagnostics.push({ side, target: point, hit, error: Math.hypot(hit[0] - point[0], hit[1] - point[1]) });
    };
    const pair = (left, right, height, w = contact) => {
      for (let i = 0; i < 6; i++) {
        root = exactRoot(E, rig, cv, root, left, 'L', height, w);
        root = exactRoot(E, rig, cv, root, right, 'R', height, w);
      }
      hand(left, 'L', height, w, false); hand(right, 'R', height, w, false);
    };
    if (id === 'mara' && body.hp > 0 && !body.mounted && !carry(state) && !c && context.exposed && !context.reducedMotion) {
      const wind = (body.coldcoat ? .32 : .7) * (.75 + Math.sin(clock * .67) * .25);
      torso(E, rig, wind * 1.5, -wind * 1.8, wind * .4);
      if (!state.aiming && moving(body) < 45) solveLimb(E, rig, 'L', [rig.J.shC[0] + 2, -1.4, rig.J.shC[2] + 1.8], wind);
    }
    if (id === 'mara' && !c && context.cover && !body.mounted && !carry(state)) {
      const peek = state.aiming ? 1 : body.crouch ? 0 : .2;
      torso(E, rig, (1 - peek) * 3.6, peek * 1.3, peek * context.coverSide * 2);
    }
    if (context.sockets && (body?.mounted || context.mounted || c && ['mount', 'dismount', 'hitch'].includes(c.kind))) {
      let amount = 1, swing = 0;
      if (c?.kind === 'mount') { amount = sampleTrack([[0, 0], [.15, 0], [.6, 1], [1, 1]], u); swing = sampleTrack([[0, 0], [.32, 0], [.7, 1], [1, 1]], u); }
      else if (c && ['dismount', 'hitch'].includes(c.kind)) { amount = sampleTrack([[0, 1], [.24, 1], [.82, 0], [1, 0]], u); swing = sampleTrack([[0, 1], [.18, 1], [.64, 0], [1, 0]], u); }
      if (c?.from && context.project) { const from = context.project(c.from.x, c.from.y, 0); root = vMix(from, root, smooth(u)); }
      root = applySeat(rig, cv, root, context.sockets, amount, swing);
      if (amount > .995 && (swing < .005 || swing > .995)) for (const side of ['L', 'R']) {
        const target = context.sockets['stirrup' + side], hit = jointScreen(rig, cv, root, 'foot' + side);
        diagnostics.push({ side: 'foot' + side, target, hit, error: Math.hypot(hit[0] - target[0], hit[1] - target[1]) });
      }
      if (c && u < .65) hand(context.sockets.pommel, 'R', 34, Math.sin(u / .65 * Math.PI), false);
    }
    if (c && context.project) {
      const target = c.target || c.from, p = target ? context.project(target.x, target.y, target.z || 0) : root;
      if (isPickup(c.kind)) {
        const high = c.kind === 'coat';
        torso(E, rig, high ? 1 : contact * rig.o.hipZ * .35, contact * 2.4);
        const socket = context.itemSocket ? context.itemSocket(c, p) : [p[0], p[1] - (high ? 38 : 13)];
        hand(socket, 'R', high ? 35 : 22);
        if (u > .48) hand([socket[0] - 7, socket[1] + 3], 'L', high ? 33 : 22, contact * .85, false);
      } else if (c.kind === 'pressure-valve') {
        torso(E, rig, contact * 1.2, contact * 1.2);
        const angle = Math.PI / 4 * valveTurn(state), center = [p[0], p[1] - 43];
        pair([center[0] - Math.cos(angle) * 11, center[1] - Math.sin(angle) * 11], [center[0] + Math.cos(angle) * 11, center[1] + Math.sin(angle) * 11], 37);
      } else if (c.kind === 'pat-copper' || c.kind === 'calm-copper') {
        const socket = context.copperSockets?.neck || [p[0] + 23, p[1] - 49];
        hand([socket[0], socket[1] + (c.kind === 'pat-copper' ? Math.sin(u * Math.PI * 6) * 2.3 : 0)], 'R', 37);
      } else if (c.kind === 'pavel-drop' || c.kind === 'disarm') {
        if (id === 'pavel') {
          const source = c.from || { x: 1145, y: 810 }, from = context.project(source.x, source.y, 0), end = context.project(body.x, body.y, 0);
          root = vMix(from, end, smooth(clamp01(u / .57))); root[1] -= (1 - Math.pow(clamp01(u / .5), 2)) * 45;
          torso(E, rig, Math.sin(clamp01((u - .35) / .3) * Math.PI) * 4.5, 2);
          const victim = context.playerHands?.R;
          if (victim && u > .45 && u < .8) hand(victim, 'R', 27, Math.sin((u - .45) / .35 * Math.PI), true);
        } else {
          torso(E, rig, Math.sin(u * Math.PI) * 2.5, -Math.sin(u * Math.PI) * 3);
          solveLimb(E, rig, 'R', [rig.J.shC[0] + 5, .8, rig.J.shC[2] - 3], Math.sin(u * Math.PI));
          solveLimb(E, rig, 'L', [rig.J.shC[0] + 3, -.7, rig.J.shC[2] + .4], Math.sin(u * Math.PI));
        }
      } else if (c.kind === 'shove' || c.kind === 'block' || c.kind === 'restrain') {
        if (id === 'mara') {
          torso(E, rig, contact * (c.kind === 'restrain' ? 4 : .8), contact * 2);
          const socket = context.partnerSockets?.[c.kind === 'restrain' ? 'hands' : 'chest'] || [p[0], p[1] - 31];
          pair([socket[0] - 4, socket[1]], [socket[0] + 4, socket[1]], c.kind === 'restrain' ? 23 : 33);
        } else if (id === c.targetId) { torso(E, rig, contact * (c.kind === 'restrain' ? 5 : 1.4), -contact * 3); if (c.kind === 'restrain') { solveLimb(E, rig, 'L', [3, -.7, 12], contact); solveLimb(E, rig, 'R', [3, .7, 12], contact); } }
      }
    }
    if (id === 'mara' && carry(state)) {
      const lifting = c?.kind === 'carry-gideon', lowering = c && ['set-down-gideon', 'safe-set-down-gideon'].includes(c.kind);
      const load = lifting ? sampleTrack([[0, 0], [.32, 0], [.8, 1], [1, 1]], u) : lowering ? sampleTrack([[0, 1], [.28, 1], [.82, 0], [1, 0]], u) : 1;
      if (lifting && c.target && context.project) {
        const approach = context.project(c.target.x - 8, c.target.y + 3, 0), weight = smooth(u / .24) * (1 - load);
        root = vMix(root, approach, weight);
      }
      const drop = lifting ? sampleTrack([[0, 0], [.28, 11], [.4, 11], [.86, 1], [1, 1]], u)
        : lowering ? sampleTrack([[0, 1], [.35, 4], [.72, 11], [.86, 11], [1, 0]], u) : 1;
      torso(E, rig, drop, 1.3 + (1 - load) * 2.5);
      return { root, restore, diagnostics, carry: { load, clip: c, view: cv } };
    }
    return { root, restore, diagnostics };
  }
  return { update, clip, pickup, carry, valveTurn, applyHuman, get clock() { return clock; } };
}
