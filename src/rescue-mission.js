/** A Voice Under Ice: original physical rescue. The journey owns registry, codec and replay. */
import { NORTH_CUTTING_WORLD as WORLD, RESCUE_CAST, RESCUE_STAGES, RESCUE_ITEMS } from '../content/campaign/north-cutting.js';
import { SNOWBOUND_WORLD } from '../content/campaign/snowbound.js';
import { WILLOW_RUN_WORLD } from '../content/campaign/willow-run.js';
export { NORTH_CUTTING_WORLD, NORTH_WORLD, RESCUE_ITEMS } from '../content/campaign/north-cutting.js';
export const RESCUE_ID = 'snowbound-a-voice-under-ice';
export const RESCUE_ENTITY_IDS = [...RESCUE_CAST.map(a => a.id), ...WORLD.predators.map(a => a.id)];
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const z = a => a?.z || 0;
const sameFloor = (a, b) => Math.abs(z(a) - z(b)) < 6;
const near = (a, b, radius) => a && b && sameFloor(a, b) && dist(a, b) <= radius;
const entity = (s, ctx, id) => ctx.entity(s, id);
const rec = s => s.campaign.missions[RESCUE_ID];
const active = s => s.campaign.activeMissionId === RESCUE_ID;
const point = a => ({ x: a.x, y: a.y, z: z(a) });
const prop = id => WORLD.props.find(p => p.id === id);
const transactionKinds = {
  'grant:coach-gun-loan': 1, 'grant:coach-shells': 10, 'grant:warm-ration': 1, 'grant:rescue-dressing': 1,
  'grant:rescue-rope': 1, 'grant:signal-cartridge': 1, 'grant:inez-flask': 1,
  'use:warm-ration': 1, 'use:rescue-dressing': 1, 'use:signal-cartridge': 1, 'use:inez-flask': 1,
  'return:warm-ration': 1, 'return:rescue-dressing': 1, 'return:rescue-rope': 1,
  'return:signal-cartridge': 1, 'return:inez-flask': 1,
  'grant:dispatch-case': 1, 'trust:secured-dispatch-recovery': 2, 'trust:listened-to-silas': 1,
  'reward:coach-gun-ownership': 1, 'care:repair-coat': 1,
  ...Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`care:watch-${n + 1}`, 1])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`care:dressing-${n + 1}`, 1])),
};
const flagDefaults = {
  briefed: false, elinMet: false, tomasUrged: false, inezVolunteered: false, kitGranted: false,
  coachInspected: false, northEntered: false, ashConfirmed: false, fordConfirmed: false, evacuationAccount: false,
  larkInspected: false, signalFired: false, signalAnswered: false, mountsHitched: false, hitchPending: false, coachRetrieved: false,
  firstClimb: false, secondClimb: false, braced: false, archPassed: false, ropeSecured: false, recessClimbed: false,
  listenedToSilas: false, breathingChecked: false, stabilized: false, securedAtPad: false, caseCollected: false, caseLost: false,
  loadingHandoff: false, diversion: false, loaded: false, strapped: false, mountedRetreat: false,
  waveOne: false, waveTwo: false, creekConcealed: false, leftBankExited: false, iceCollapsed: false,
  returned: false, unloaded: false, helpersReceived: false, delivered: false, familyReunited: false,
  tomasThanked: false, dellaRecorded: false, journalWritten: false, kitReturned: false, coachRewarded: false,
  flaskUsed: false, rationUsed: false, recoveryRest: false,
};
export function createRescueRecord() {
  return {
    status: 'locked', retryCount: 0, checkpointId: null,
    mission: { id: RESCUE_ID, name: 'A Voice Under Ice', stage: 0, stageCount: 10, completed: false, rewardPaid: false, objective: RESCUE_STAGES[0] },
    flags: { ...flagDefaults, routeIndex: 0, searchIndex: 0, descentIndex: 0, retreatIndex: 0, loadingIndex: 0, deliveryIndex: 0, inezRouteIndex: 0, descentPlayerIndex: 0, descentInezIndex: 0 },
    timers: { signal: 0, abandonment: 0, exposure: 0, loading: 0, diversion: 0, rest: 0, helper: 0, injury: 0, cold: 0 },
    performance: { shots: 0, hits: 0, wolvesKilled: 0, wolfBiteDamage: 0, allWolvesNoBites: false, accuracy80: false, eligibleNoBites: true, triggerSerial: 0, hitTriggers: [] },
    transactions: {}, choices: { provision: null, case: null },
    traversal: { player: null, inez: null, safePoint: { x: 500, y: 1180, z: 0 } },
    rescue: { silas: { stabilized: false, injury: 3, exposure: 0, trust: 0, healingHours: 0, careScheduled: false },
      flask: { ownerId: 'inez', servings: 0 }, loadingDistance: 0, helperDistance: 0, inezTrust: 0 },
    tracks: { inspected: { 'ash-embers': false, bootprints: false, 'paper-wrapper': false, 'ford-scrape': false, 'ford-exit': false, 'mail-sled': false },
      scentTrail: [], creek: { copper: 0, thimble: 0, previousCopper: null, previousThimble: null, nodeIndex: 0, prematureExits: 0 }, sampleTimer: 0 },
    predators: WORLD.predators.map(w => ({ id: w.id, role: w.role, wave: w.wave, phase: 'dormant', targetId: null, age: 0, biteCooldown: 0, wounded: false, killed: false, route: [], noise: 0 })),
  };
}
function tx(s, id, amount, apply) {
  const r = rec(s), key = `${RESCUE_ID}:${id}`;
  if (r.transactions[key]) return false;
  if (apply() === false) return false; r.transactions[key] = { amount, completed: true }; return true;
}
function objective(s) {
  const r = rec(s);
  r.mission.objective = r.mission.stage === 1 && !r.flags.tomasUrged ? 'Speak with Tomas at the kiln before inspecting the rescue weapon.' : r.mission.stage === 1 && !r.flags.inezVolunteered ? 'Speak with Inez beside Thimble. She will guide the northern search.' : r.mission.completed ? s.campaign.missions['snowbound-a-quiet-table']?.status === 'unstarted' ? 'Silas is home and healing. Speak with Orla in the drying-shed kitchen about fresh food.' : 'Silas is home and healing. The companion hunt and rival-camp investigation are next; they are not available yet.' : RESCUE_STAGES[r.mission.stage];
}
function advance(s, ctx, stage, checkpointId = null, label = '') {
  const r = rec(s); if (stage <= r.mission.stage) return;
  r.mission.stage = stage; objective(s);
  if (checkpointId) ctx.checkpoint(s, checkpointId, label);
}
function emit(s, ctx, kind, target, id, from = s.player, actorId = 'mara', sourceId = from?.id || actorId) { ctx.present(s, kind, target, id, { ...point(from), facing: from.facing || 0 }, actorId, { sourceId }); }
function addItem(s, id, count) { s.inventory[id] = (s.inventory[id] || 0) + count; }
function itemTotal(s, id) { return (s.inventory[id] || 0) + Object.values(s.entities).reduce((n, actor) => n + (actor.pack?.[id] || 0), 0); }
function takeBorrowed(s, id) {
  if (consume(s, id)) return true;
  const actor = Object.values(s.entities).find(a => a.pack?.[id] > 0);
  if (!actor) return false; actor.pack[id]--; return true;
}
function kitUnusedTotal(s) { return ['warmRation', 'rescueDressing', 'rescueRope', 'signalCartridge'].reduce((n, id) => n + itemTotal(s, id), 0); }
function unusedKit(s) {
  const r = rec(s), gun = s.weapons['coach-gun'];
  return r.mission.stage === 1 && gun?.ammo === 2 && gun.reserve === 8 && r.rescue.flask.servings === 1 && ['warmRation', 'rescueDressing', 'rescueRope', 'signalCartridge'].every(id => itemTotal(s, id) === 1) && !Object.keys(r.transactions).some(key => key.includes(':use:'));
}
function consume(s, id, amount = 1) { if ((s.inventory[id] || 0) < amount) return false; s.inventory[id] -= amount; return true; }
export function ensureRescueCast(s, ctx) {
  const r = rec(s); if (!r || r.status === 'locked') return s;
  for (const body of RESCUE_CAST) {
    const category = body.id === 'thimble' ? 'mount' : body.id === 'lark' ? 'animal' : 'npc';
    ctx.addEntity(s, { vx: 0, vy: 0, facing: 0, ...body }, body.regionId, category);
  }
  for (const w of WORLD.predators) ctx.addEntity(s, { ...w, name: 'Timber wolf', kind: 'wolf', faction: 'wild', hp: 70, z: 0, vx: 0, vy: 0, facing: 0, hidden: true, phase: 'dormant' }, WORLD.id, 'enemy');
  return s;
}
function grantKit(s, ctx) {
  tx(s, 'grant:coach-gun-loan', 1, () => { s.weapons['coach-gun'] = { id: 'coach-gun', kind: 'coach-gun', name: 'Short coach gun', capacity: 2, ammoType: 'coach-shell', ammo: 0, reserve: 0, condition: 1, owner: 'community-rescue-chest', loanMissionId: RESCUE_ID, location: 'saddle', rackMountId: s.horse.id }; });
  tx(s, 'grant:coach-shells', 10, () => { s.weapons['coach-gun'].ammo = 2; s.weapons['coach-gun'].reserve = 8; });
  for (const [id, item] of [['warm-ration', 'warmRation'], ['rescue-dressing', 'rescueDressing'], ['rescue-rope', 'rescueRope'], ['signal-cartridge', 'signalCartridge']]) tx(s, `grant:${id}`, 1, () => addItem(s, item, 1));
  tx(s, 'grant:inez-flask', 1, () => { rec(s).rescue.flask.servings = 1; });
  rec(s).flags.kitGranted = true; ctx.notice(s, 'Rescue kit: one ration, dressing, rope and sealed signal round. The coach gun is loaned on Copper’s rack.');
}
function offer(list, s, id, label, target, radius = 55, priority = 2, targetId = target?.id || id) {
  if (!target || !near(s.player, target, radius)) return;
  list.push({ id, label, targetId, ...point(target), distance: dist(s.player, target), priority });
}
const onFoot = s => !s.player.mounted && !s.player.carrying;
function ready(s) { return !s.failure && !s.dialog && !rec(s).traversal.player; }
function carriedBy(s, ctx, id) { const a = entity(s, ctx, 'silas')?.attachment; return a?.type === 'carried' && a.targetId === id; }
function nearestRevolver(s) { return Object.values(s.weapons).find(w => w.kind === 'revolver'); }
function weaponAvailable(s, weapon) { return weapon && (weapon.location === 'carried' || weapon.location === 'saddle' && near(s.player, s.entities[weapon.rackMountId], 58)); }
export function getRescueInteractions(s, ctx) {
  const r = rec(s), list = [];
  if (!r || r.status === 'locked' || s.failure || s.dialog) return list;
  ensureRescueCast(s, ctx);
  const p = s.player, i = entity(s, ctx, 'inez'), silas = entity(s, ctx, 'silas'), thimble = entity(s, ctx, 'thimble');
  if (!active(s) && !r.mission.completed) { if (s.mission.completed && r.status === 'unstarted' && s.region === 'snowbound') offer(list, s, 'rescue:elin', 'Speak with Elin about Silas', entity(s, ctx, 'elin'), 78, -2); return list; }
  if (!active(s) && s.region !== 'snowbound') return list;
  if (r.traversal.player || r.timers.rest > 0) return list;
  if (r.mission.completed) {
    if (s.region === 'snowbound') {
      for (const [id, label] of [['elin', 'Ask how Silas is healing'], ['fin', 'Look at Silas’s scarf'], ['silas', 'Speak with Silas'], ['della', 'Read the rescue ledger'], ['inez', 'Speak about the return trail'], ['tomas', 'Ask about the convoy']]) offer(list, s, `aftermath:${id}`, label, entity(s, ctx, id), 66, 2);
      if (r.rescue.silas.healingHours > 0 && r.timers.helper === 0 && onFoot(s) && ((s.inventory.bandages || 0) > 0 || s.camp.medicine > 0) && Array.from({ length: 6 }, (_, n) => `care:dressing-${n + 1}`).some(id => !r.transactions[`${RESCUE_ID}:${id}`])) offer(list, s, 'care:silas', 'Change Silas’s dressing and check his hands', { ...silas, z: 0 }, 65, 1);
      if (!silas.coatRepaired && onFoot(s) && s.camp.materials > 0) offer(list, s, 'repair:silas-coat', 'Ask Elin about Silas’s torn coat', entity(s, ctx, 'elin'), 65, 1);
      if (active(s)) offer(list, s, 'revisit:north', 'Ride back to the lower northern trail', WORLD.camp.gate, 65, 4);
    } else offer(list, s, 'return:kiln', 'Return to the kiln', WORLD.trail[0], 65, 3);
  } else {
    const stage = r.mission.stage;
    if (stage === 0) offer(list, s, 'rescue:elin', 'Prepare to search for Silas', entity(s, ctx, 'elin'), 80, -2);
    if (stage === 1) {
      offer(list, s, 'postpone:rescue', 'Speak with Elin about postponing the search', entity(s, ctx, 'elin'), 75, 5);
      if (!r.flags.tomasUrged) offer(list, s, 'brief:tomas', 'Hear Tomas’s request for the search', entity(s, ctx, 'tomas'), 80, -3);
      else if (!r.flags.inezVolunteered) offer(list, s, 'brief:inez', 'Ask Inez to guide the search', i, 80, -3);
      if (r.flags.tomasUrged && r.flags.inezVolunteered && !r.flags.coachInspected && onFoot(s)) offer(list, s, 'inspect:coach-case', 'Inspect the loaned coach gun at Copper’s rack', s.horse, 60, -1);
      if (r.flags.coachInspected && p.mounted && i.mounted && near(i, thimble, 35) && near(i, p, 140)) offer(list, s, 'depart:north', 'Take the northern trail with Inez', WORLD.camp.gate, 65, -2);
    }
    if (stage === 2 && r.flags.routeIndex >= WORLD.trail.length - 1 && onFoot(s)) {
      for (const id of ['ash-embers', 'bootprints', 'paper-wrapper']) if (!r.tracks.inspected[id]) offer(list, s, `inspect:${id}`, `Inspect ${id === 'ash-embers' ? 'the recent embers' : id === 'bootprints' ? 'the small bootprints' : 'the torn document wrapper'}`, prop(id), 42, -2);
    }
    if (stage === 3 && onFoot(s)) {
      if (!r.tracks.inspected['ford-scrape']) offer(list, s, 'inspect:ford-scrape', 'Read the scrape where the trail enters the water', prop('ford-scrape'), 48, -2);
      if (r.tracks.inspected['ford-scrape'] && !r.tracks.inspected['ford-exit']) offer(list, s, 'inspect:ford-exit', 'Find the hoofprints on the far bank', prop('ford-exit'), 48, -2);
      if (!r.tracks.inspected['mail-sled']) offer(list, s, 'inspect:mail-sled', 'Check the abandoned mail sled', prop('mail-sled'), 50, 3);
    }
    if (stage === 4 && onFoot(s)) {
      if (!r.flags.larkInspected) offer(list, s, 'inspect:lark', 'Inspect Lark’s saddle and wounds', entity(s, ctx, 'lark'), 58, -2);
      else if (!r.flags.signalFired) offer(list, s, 'signal:silas', 'Fire an upward revolver signal', entity(s, ctx, 'lark'), 90, -2);
      else if (r.flags.signalAnswered) {
        offer(list, s, 'call:silas', 'Call again toward the arches', WORLD.hitch, 170, 3);
        if (!r.flags.mountsHitched) offer(list, s, 'hitch:mounts', 'Hitch Copper and Thimble at the shelf', WORLD.hitch, 65, -2);
      }
    }
    if (stage === 5 && onFoot(s)) {
      if (!r.flags.coachRetrieved) offer(list, s, 'retrieve:coach-gun', 'Retrieve and equip the coach gun', s.horse, 60, -2);
      else {
        if (!r.flags.firstClimb) offer(list, s, 'climb:first-ledge', 'Climb to the lower ledge', WORLD.climbs[0].from, 40, -2);
        else if (!r.flags.secondClimb) { offer(list, s, 'climb:second-ledge', 'Climb the second ledge', WORLD.climbs[1].from, 42, p.stamina >= 30 ? -2 : 4); offer(list, s, 'rest:ledge', 'Rest in the sheltered ledge', WORLD.climbs[0].to, 45, 3); }
        else if (!r.flags.braced) offer(list, s, 'brace:ice-lip', 'Brace across the ice lip', WORLD.brace.from, 38, -2);
        else if (!r.flags.archPassed) offer(list, s, 'crouch:low-arch', 'Crouch through the low ice arch', WORLD.brace.to, 42, -2);
        else if (!r.flags.ropeSecured) offer(list, s, 'secure:arch-rope', 'Secure the rescue rope', WORLD.ropeAnchor, 40, -2);
        else offer(list, s, 'climb:recess-ledge', 'Climb toward Silas’s voice', WORLD.climbs[2].from, 44, -2);
      }
      if (r.flags.firstClimb && !r.flags.flaskUsed && r.rescue.flask.servings > 0 && near(p, i, 75) && p.stamina < 45) offer(list, s, 'aid:inez-flask', 'Accept a sip from Inez’s flask', i, 75, 0);
    }
    if (stage === 6 && !p.mounted) {
      if (!r.flags.listenedToSilas && onFoot(s)) offer(list, s, 'listen:silas', 'Listen to Silas', { ...silas, z: 108 }, 55, 0);
      if (!r.flags.breathingChecked && onFoot(s)) offer(list, s, 'inspect:silas-breathing', 'Check Silas’s breathing', { ...silas, z: 108 }, 48, -2);
      else if (!r.flags.stabilized && onFoot(s)) offer(list, s, 'stabilize:silas', 'Dress Silas’s shoulder', { ...silas, z: 108 }, 48, -2);
      else if (r.flags.stabilized) {
        if (!silas.attachment || silas.attachment.type === 'rest') offer(list, s, 'carry:silas', 'Lift Silas with the rescue sling', { ...silas, z: silas.attachment?.type === 'rest' ? 108 : z(silas) }, 46, -2);
        if (r.flags.descentIndex === 0 && carriedBy(s, ctx, 'mara')) offer(list, s, 'secure:silas-at-rest-pad', 'Lower Silas onto the sheltered rest pad', WORLD.restPad, 45, 1);
        if (r.flags.descentIndex === 0 && !r.flags.caseCollected && !p.carrying) offer(list, s, 'pickup:dispatch-case', r.flags.securedAtPad ? 'Recover the floating dispatch case' : 'Secure Silas before reaching for the case', WORLD.dispatchCase, 30, r.flags.securedAtPad && near(i, WORLD.restPad, 80) ? -3 : 1);
        if (r.flags.descentIndex < 3) {
          const edge = WORLD.descents[r.flags.descentIndex];
          if (carriedBy(s, ctx, 'mara') && !r.traversal.inez && r.flags.inezRouteIndex === 5 && near(i, edge.from, 45)) offer(list, s, `handoff:${edge.id}`, 'Hand Silas to Inez at the wide descent', edge.from, 45, -2);
          else if (carriedBy(s, ctx, 'inez') && !r.traversal.inez) {
            if (!sameFloor(p, edge.to) && r.flags.descentInezIndex === r.flags.descentIndex + 1) offer(list, s, `climb:${edge.id}`, 'Climb down with free hands', edge.from, 48, -2);
            else if (near(p, i, 45) && r.flags.descentPlayerIndex === r.flags.descentIndex + 1 && r.flags.descentInezIndex === r.flags.descentIndex + 1) offer(list, s, 'receive:silas', 'Receive Silas from Inez', i, 45, -2);
          }
        }
      }
    }
    if (stage === 7) {
      if (!r.flags.loadingHandoff && carriedBy(s, ctx, 'mara')) offer(list, s, 'handoff:loading', 'Hand Silas to Inez at the loading spur', WORLD.loadingSpur, 48, -2);
      else if (r.flags.loadingHandoff) {
        if (!r.flags.diversion) offer(list, s, 'divert:wolves', 'Call the wolves toward the refuge rock', WORLD.diversion, 70, -2);
        if (r.flags.loadingIndex >= WORLD.loadingRoute.length && !r.flags.loaded) offer(list, s, 'load:silas', 'Help Inez lift Silas onto Thimble', thimble, 78, -2);
        else if (r.flags.loaded && !r.flags.strapped) offer(list, s, 'strap:silas', 'Secure Silas’s passenger strap', thimble, 66, -2);
      }
    }
    if (stage === 8 && !r.flags.leftBankExited && r.flags.creekConcealed) offer(list, s, 'exit:left-bank', 'Leave the water together through the left bank', WORLD.creekExit, 75, -2);
    if (stage === 8 && r.flags.leftBankExited && p.mounted) offer(list, s, 'return:kiln', 'Return to the kiln with Silas', WORLD.trail[0], 65, -2);
    if (stage === 9) {
      if (!r.flags.unloaded && !p.mounted) offer(list, s, 'unload:silas', 'Lift Silas from Thimble’s rear saddle', thimble, 50, -2);
      else if (r.flags.unloaded && !r.flags.helpersReceived && carriedBy(s, ctx, 'mara')) offer(list, s, 'deliver:silas', 'Hand Silas to Moss and Vera', WORLD.camp.arrival, 50, -2);
      if (r.flags.delivered && !r.flags.familyReunited) offer(list, s, 'reunite:elin-fin', 'Let Elin and Fin settle beside Silas', WORLD.camp.bed, 78, -2);
      if (r.flags.familyReunited && !r.flags.tomasThanked) offer(list, s, 'rescue:tomas', 'Speak with Tomas about the rescue', entity(s, ctx, 'tomas'), 80, -2);
      if (r.flags.tomasThanked && !r.flags.dellaRecorded) offer(list, s, 'rescue:della', 'Record Lark and the rescue costs with Della', entity(s, ctx, 'della'), 80, -2);
      if (r.flags.dellaRecorded && !r.flags.journalWritten) offer(list, s, 'journal:rescue', 'Draw Silas’s return in the journal', entity(s, ctx, 'della'), 90, -2);
    }
  }
  if (!active(s)) return list.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
  if (!p.carrying && !r.traversal.player) {
    if (p.mounted) offer(list, s, 'dismount', 'Dismount Copper', s.horse, 35, 5);
    else if (!r.flags.mountsHitched || r.mission.stage >= 7 || r.mission.completed) offer(list, s, 'mount', 'Mount Copper', s.horse, 58, 5);
  }
  if (s.region === 'snowbound') {
    offer(list, s, 'camp:oats', 'Feed Copper from the camp oats', { x: 290, y: 1110, z: 0 }, 65, 5);
    if (near(p, s.horse, 65)) offer(list, s, 'pat:copper', 'Pat Copper', s.horse, 65, 6);
  }
  return list.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
}
function beginTraversal(s, ctx, actor, edge, kind, key, cost = 0) {
  const r = rec(s);
  if (r.traversal[key] || actor.mounted || actor.carrying && kind !== 'carry-descent') return false;
  if (!near(actor, edge.from, 50)) return false;
  if (key === 'player' && actor.stamina < cost) { ctx.notice(s, 'Your hands are shaking. Eat the warm ration, accept Inez’s flask, or rest on the sheltered ledge.'); return false; }
  if (key === 'player') actor.stamina = Math.max(0, actor.stamina - cost);
  const t = { kind, edgeId: edge.id, from: point(actor), to: point(edge.to), progress: 0, age: 0, duration: edge.duration };
  r.traversal[key] = t; actor.traversal = t; actor.crouch = kind === 'crouch';
  emit(s, ctx, kind, edge.to, edge.id, actor, actor.id); return true;
}
function transfer(s, ctx, targetId, kind = 'handoff') {
  const silas = entity(s, ctx, 'silas'), target = entity(s, ctx, targetId), from = silas.attachment?.type === 'rest' ? [...WORLD.props, ...WORLD.camp.props].find(a => a.id === silas.attachment.targetId) : silas.attachment?.targetId ? entity(s, ctx, silas.attachment.targetId) : silas;
  if (!target || target.hp <= 0 || target.carrying && target.carrying !== 'silas') return false;
  const location = silas.attachment ? { ...silas, z: z(from) } : silas;
  if (!near(target, location, 80) || target.mounted) return false;
  const source = { ...point(from), facing: from.facing || 0 };
  if (!ctx.setAttachment(s, 'silas', { type: 'carried', targetId })) return false;
  emit(s, ctx, kind, target, 'silas', source, targetId, from.id); return true;
}
function summon(s, ctx, id, target) {
  const actor = entity(s, ctx, id); if (!actor) return;
  actor.goal = point(target); actor.route = []; delete actor.routeTarget;
}
function protectedOpening(s, id) { return s.campaign.missions['snowbound-the-last-warm-light']?.flags[id]; }
export function interactRescue(s, requestedId = null, ctx) {
  const list = getRescueInteractions(s, ctx), found = requestedId ? list.find(a => a.id === requestedId) : list[0];
  if (!found) { ctx.notice(s, 'Move closer and finish the preceding physical task.'); return s; }
  const id = found.id, r = rec(s), f = r.flags, i = entity(s, ctx, 'inez'), silas = entity(s, ctx, 'silas'), thimble = entity(s, ctx, 'thimble');
  if (id === 'rescue:elin') {
    f.elinMet = true;
    const timing = protectedOpening(s, 'logSecured') ? 'Ada has the dispatch time from the station log.' : 'Ada’s memory and the yard testimony give us the same northern route.';
    ctx.talk(s, 'rescue-briefing', 'Elin Orr', `He sent the deeds north because paper can outlive a house. I need my brother to outlive the paper. ${timing} Tomas wants a search; Inez has already saddled Thimble.`, [['ask:departure', 'Did he choose to leave the convoy?'], ['accept-rescue', 'Inez and I will bring him home.'], ['leave', 'Give me a moment.']]);
  } else if (id === 'postpone:rescue') {
    ctx.talk(s, 'rescue-postpone', 'Elin Orr', unusedKit(s) ? 'The kit and borrowed gun are unused. I can put them back in the rescue chest until you and Inez are ready.' : 'The borrowed kit has already been used. Finish the search, or restart this mission from its recorded entry; I cannot count used supplies as an unused return.', unusedKit(s) ? [['postpone-rescue', 'Return the unused kit and loan; postpone the search.'], ['leave', 'Continue preparing.']] : [['leave', 'Continue the search.']]);
  } else if (id === 'care:silas') {
    const next = Array.from({ length: 6 }, (_, n) => `care:dressing-${n + 1}`).find(id => !r.transactions[`${RESCUE_ID}:${id}`]);
    if (!next || !((s.inventory.bandages || 0) > 0 || s.camp.medicine > 0)) { ctx.notice(s, 'Elin needs one clean personal bandage or medicine in the camp store for this care visit.'); return s; }
    tx(s, next, 1, () => { if (!consume(s, 'bandages')) s.camp.medicine--; silas.hp = Math.min(100, silas.hp + 8); r.rescue.silas.healingHours = Math.max(0, r.rescue.silas.healingHours - 2); r.rescue.silas.injury = Math.max(0, r.rescue.silas.injury - 0.15); });
    r.timers.helper = 6 * 80; emit(s, ctx, 'care', silas, 'silas'); ctx.notice(s, 'A clean dressing helps, but frostbite needs time. Elin will check him again in six world hours.');
  } else if (id === 'repair:silas-coat') {
    ctx.talk(s, 'rescue-repair-request', 'Elin Orr', 'His shoulder cannot bear the old seam. Give me one camp material and I can line the torn coat; his jaw scars and injured hands will still need time.', s.camp.materials > 0 ? [['repair-coat', 'Use one camp material to repair his coat.'], ['leave', 'Return when the camp has cloth.']] : [['leave', 'The camp needs cloth first.']]);
  } else if (id === 'brief:tomas') {
    f.tomasUrged = true; ctx.talk(s, 'rescue-urge', 'Tomas Reed', 'Silas may have taken the wrong road for the right reason. We do not leave him there to settle the argument. Take the kit Elin prepared; the coach gun is a loan until the rescue is finished.', [['leave', 'We will search the spillway.']]);
  } else if (id === 'brief:inez') {
    f.inezVolunteered = true; ctx.talk(s, 'rescue-companion', 'Inez Pike', 'He came back for me once. I can be useful in return. Thimble knows the lower ice; I will read the trail, carry him when your hands need the stone, and bring him behind my saddle.', [['leave', 'You lead the search. I will stay with you.']]);
  } else if (id === 'inspect:coach-case') {
    f.coachInspected = true; emit(s, ctx, 'inspect', s.horse, 'coach-gun');
    ctx.log(s, 'Checked the short coach gun: two shells chambered, eight held separately, loaned from the community chest.');
    ctx.notice(s, 'The coach gun stays on Copper’s saddle rack until the shelf. Mount and meet Inez at the northern gate.');
  } else if (id === 'depart:north') {
    if (!f.coachInspected || !s.weapons['coach-gun'] || !near(i, s.player, 140)) { ctx.notice(s, 'Bring Inez and the loaned gun with you.'); return s; }
    ctx.transition(s, WORLD.id, ['mara', s.horse.id, 'inez', 'thimble'], { mara: { x: 250, y: 1560, z: 0 }, [s.horse.id]: { x: 250, y: 1560, z: 0 }, inez: { x: 225, y: 1575, z: 0 }, thimble: { x: 225, y: 1575, z: 0 } });
    f.northEntered = true; i.mounted = true; thimble.hitched = false; advance(s, ctx, 2);
    ctx.log(s, 'Inez led the rescue into the northern spillway. Copper’s tack, pack and bond stayed with her.');
  } else if (id.startsWith('inspect:') && r.tracks.inspected[id.slice(8)] !== undefined) {
    const clue = id.slice(8); r.tracks.inspected[clue] = true; emit(s, ctx, 'inspect', found, clue);
    const messages = { 'ash-embers': 'The ash is still warm beneath the snow. Silas stopped here after the convoy.', bootprints: 'One narrow boot drags. He left uphill, away from the broad guard tracks.', 'paper-wrapper': 'A torn deed wrapper points to the ford; the courier kept the documents dry.', 'ford-scrape': 'The drag mark disappears into the running water. Read the opposite bank, not the frozen side trail.', 'ford-exit': 'Lark’s uneven hoofprints return beyond the ford. Inez sees a dark saddle higher up.', 'mail-sled': 'This sled is older than Silas’s trail. Wolves circle the mail pouch, not a living person.' };
    ctx.notice(s, messages[clue]); ctx.log(s, messages[clue]);
    if (['ash-embers', 'bootprints', 'paper-wrapper'].every(c => r.tracks.inspected[c])) { f.ashConfirmed = true; advance(s, ctx, 3, 'ash-trail', 'Recent trail confirmed at Ash Camp'); }
    if (r.tracks.inspected['ford-exit']) { f.fordConfirmed = true; advance(s, ctx, 4); }
  } else if (id === 'inspect:lark') {
    f.larkInspected = true; emit(s, ctx, 'inspect', entity(s, ctx, 'lark'), 'lark');
    ctx.talk(s, 'rescue-lark', 'Inez Pike', 'This saddle always sat crooked. He said the horse liked it that way. Those are wolf bites. His bootmarks leave the drift—he climbed on his own feet.', [['leave', 'Listen toward the stone arches.']]);
    ctx.log(s, 'Found Lark dead by the drift. The lost courier mount cannot be replaced by a rescue reward.');
  } else if (id === 'signal:silas') signal(s, ctx);
  else if (id === 'call:silas') { ctx.notice(s, 'Silas answers: “Stone arch! Below the iron! Don’t climb the white edge!”'); emit(s, ctx, 'call', { x: 1900, y: 365, z: 108 }, 'silas'); }
  else if (id === 'hitch:mounts') {
    f.hitchPending = true; if (i.mounted) dismountActor(s, ctx, i, thimble); i.mounted = false; s.horse.following = false; s.horse.hitched = false; thimble.hitched = false;
    summon(s, ctx, s.horse.id, WORLD.hitch); summon(s, ctx, 'thimble', WORLD.loadingRoute.at(-1));
    ctx.notice(s, 'Both mounts are walking into their hitch positions. Wait for Copper and Thimble before the climb.');
  } else if (id === 'retrieve:coach-gun') {
    const w = s.weapons['coach-gun']; if (!w || !weaponAvailable(s, w)) return s;
    w.location = 'carried'; delete w.rackMountId; s.player.equippedWeaponId = w.id; s.player.holstered = false; s.player.armed = true; f.coachRetrieved = true;
    emit(s, ctx, 'equip', s.horse, w.id); ctx.notice(s, 'Coach gun retrieved. Climbing needs both hands; it will sling safely across your back.');
  } else if (id === 'climb:first-ledge') beginTraversal(s, ctx, s.player, WORLD.climbs[0], 'climb', 'player', 24);
  else if (id === 'climb:second-ledge') beginTraversal(s, ctx, s.player, WORLD.climbs[1], 'climb', 'player', 30);
  else if (id === 'brace:ice-lip') beginTraversal(s, ctx, s.player, WORLD.brace, 'brace', 'player', 15);
  else if (id === 'crouch:low-arch') beginTraversal(s, ctx, s.player, { id: 'low-arch', from: WORLD.brace.to, to: { x: 1730, y: 430, z: 72 }, duration: 1.8 }, 'crouch', 'player');
  else if (id === 'secure:arch-rope') {
    if (!(s.inventory.rescueRope > 0)) { ctx.notice(s, 'The rescue rope is required at this anchor.'); return s; }
    f.ropeSecured = true; emit(s, ctx, 'rope', WORLD.ropeAnchor, WORLD.ropeAnchor.id); ctx.notice(s, 'Rope secured. Follow Silas’s reply toward the dark recess.');
  } else if (id === 'climb:recess-ledge') beginTraversal(s, ctx, s.player, WORLD.climbs[2], 'climb', 'player', 24);
  else if (id === 'rest:ledge') { r.timers.rest = 4; f.recoveryRest = true; emit(s, ctx, 'rest', s.player, 'sheltered-ledge'); ctx.notice(s, 'Resting beneath the ledge. Your hands warm and your climbing stamina returns.'); }
  else if (id === 'aid:inez-flask') flask(s, ctx);
  else if (id === 'listen:silas') {
    f.listenedToSilas = true; tx(s, 'trust:listened-to-silas', 1, () => { r.rescue.silas.trust++; });
    ctx.talk(s, 'rescue-reunion', 'Silas Orr', 'I thought the river was talking. The deeds fell below the arch. Leave them. My fingers won’t hold stone anymore.', [['leave', 'We’ll answer the river together.']]);
  } else if (id === 'inspect:silas-breathing') { f.breathingChecked = true; emit(s, ctx, 'inspect', silas, 'silas'); ctx.notice(s, 'He is breathing, but his shoulder needs the clean dressing before he can move.'); }
  else if (id === 'stabilize:silas') {
    if (!(s.inventory.rescueDressing > 0)) { ctx.notice(s, 'Keep the sealed rescue dressing for Silas.'); return s; }
    tx(s, 'use:rescue-dressing', 1, () => consume(s, 'rescueDressing')); f.stabilized = true; r.rescue.silas.stabilized = true;
    silas.hidden = false; silas.hp = Math.max(silas.hp, 55); emit(s, ctx, 'stabilize', silas, 'silas');
    ctx.checkpoint(s, 'silas-stabilized', 'Silas dressed before the carry'); ctx.notice(s, 'Use the wide southern ramp. A carried adult cannot fit beneath the low arch.');
  } else if (id === 'carry:silas') {
    if (transfer(s, ctx, 'mara', 'lift')) { f.securedAtPad = false; ctx.notice(s, 'Silas is in your sling. Move to the wide descent; keep him clear of the ice edge.'); }
  } else if (id === 'secure:silas-at-rest-pad') {
    if (!near(i, WORLD.restPad, 80) || !f.ropeSecured || !f.stabilized) { ctx.notice(s, 'Wait for Inez beside the pad and use the secured rope.'); return s; }
    const from = point(s.player); ctx.setAttachment(s, 'silas', { type: 'rest', targetId: WORLD.restPad.id }); f.securedAtPad = true;
    emit(s, ctx, 'setdown', WORLD.restPad, 'silas', from); ctx.notice(s, 'Silas is anchored under shelter, attended by Inez. The case can now be reached safely.');
  } else if (id === 'pickup:dispatch-case') {
    if (!f.securedAtPad || silas.attachment?.type !== 'rest' || !near(i, WORLD.restPad, 80)) { ctx.notice(s, 'Silas comes first. Dress him and secure him on the attended pad before reaching for paper.'); return s; }
    tx(s, 'grant:dispatch-case', 1, () => addItem(s, 'dispatchCase', 1)); tx(s, 'trust:secured-dispatch-recovery', 2, () => { r.rescue.silas.trust += 2; });
    f.caseCollected = true; r.choices.case = 'secured-recovery'; emit(s, ctx, 'pickup', WORLD.dispatchCase, 'dispatch-case'); ctx.log(s, 'Recovered the watermarked freight-seizure case only after Silas was safely anchored.');
  } else if (id.startsWith('handoff:descent-')) {
    const edge = WORLD.descents[f.descentIndex];
    if (r.traversal.inez || !near(i, edge.from, 45)) { ctx.notice(s, 'Wait for Inez at the stable edge before the handoff.'); return s; }
    if (transfer(s, ctx, 'inez')) beginTraversal(s, ctx, i, edge, 'carry-descent', 'inez');
  } else if (id.startsWith('climb:descent-')) {
    const edge = WORLD.descents[f.descentIndex]; beginTraversal(s, ctx, s.player, edge, 'climb-down', 'player');
  } else if (id === 'receive:silas') {
    if (transfer(s, ctx, 'mara')) { f.descentIndex++; r.traversal.safePoint = point(s.player); if (f.descentIndex === 3) advance(s, ctx, 7, 'loading-spur', 'Silas and Inez at the loading spur'); }
  } else if (id === 'handoff:loading') {
    if (!near(i, s.player, 65)) { ctx.notice(s, 'Wait for Inez beside the loading spur.'); return s; }
    if (transfer(s, ctx, 'inez')) { f.loadingHandoff = true; f.loadingIndex = 1; r.timers.loading = 3; activateWave(s, ctx, 0); emit(s, ctx, 'wolf-warning', entity(s, ctx, 'pack-flanker'), 'pack-flanker'); ctx.notice(s, 'Three wolves are assessing the spur. Call from the refuge rock while Inez carries Silas to Thimble.'); }
  } else if (id === 'divert:wolves') {
    f.diversion = true; r.timers.diversion = 12;
    for (const w of r.predators.filter(w => w.wave === 0 && !['dead', 'fled'].includes(w.phase))) { w.targetId = 'mara'; w.noise = 12; }
    emit(s, ctx, 'divert', WORLD.diversion, 'wolves'); ctx.notice(s, 'The pack turns toward your call. Keep it away from Inez’s loading route.');
  } else if (id === 'load:silas') {
    if (r.rescue.loadingDistance < 100 || !near(i, thimble, 35) || !carriedBy(s, ctx, 'inez')) { ctx.notice(s, 'Inez must finish carrying Silas to Thimble before the saddle lift.'); return s; }
    const from = point(i); ctx.setAttachment(s, 'silas', { type: 'passenger', targetId: 'thimble', strap: false }); f.loaded = true; emit(s, ctx, 'load', thimble, 'silas', from, 'inez');
  } else if (id === 'strap:silas') {
    if (silas.attachment?.type !== 'passenger') return s;
    ctx.setAttachment(s, 'silas', { type: 'passenger', targetId: 'thimble', strap: true }); f.strapped = true; i.mountPending = true; r.timers.loading = 0.95; thimble.hitched = false;
    emit(s, ctx, 'strap', thimble, 'silas', i, 'inez'); ctx.notice(s, 'Silas is strapped behind Inez. Mount Copper and lead the pack away from the shelf.');
  } else if (id === 'exit:left-bank') {
    if (!near(thimble, WORLD.creekExit, 120) || !s.player.mounted || !silas.attachment?.strap) { ctx.notice(s, 'Leave the water together, with Silas still strapped.'); return s; }
    f.leftBankExited = true; ctx.notice(s, 'The water has broken the trail. Keep Inez with you to the lower gate.');
  } else if (id === 'return:kiln') {
    if (!r.mission.completed && (!f.leftBankExited || !near(thimble, s.horse, 120))) { ctx.notice(s, 'Bring Inez and the concealed return trail to the gate together.'); return s; }
    ctx.transition(s, 'snowbound', ['mara', s.horse.id, 'inez', 'thimble', ...(silas.attachment ? [] : ['silas'])], { mara: { x: 720, y: 760, z: 0 }, [s.horse.id]: { x: 720, y: 760, z: 0 }, inez: { x: 690, y: 785, z: 0 }, thimble: { x: 690, y: 785, z: 0 } });
    if (!r.mission.completed) { f.returned = true; advance(s, ctx, 9, 'refuge-gate', 'Back at the kiln before unloading'); summon(s, ctx, 'moss', WORLD.camp.arrival); summon(s, ctx, 'vera', { x: 400, y: 1160, z: 0 }); }
  } else if (id === 'revisit:north') {
    if (!s.player.mounted) { ctx.notice(s, 'Mount Copper before taking the regional trail.'); return s; }
    ctx.transition(s, WORLD.id, ['mara', s.horse.id], { mara: { x: 250, y: 1560, z: 0 }, [s.horse.id]: { x: 250, y: 1560, z: 0 } });
  } else if (id === 'unload:silas') {
    if (!near(thimble, WORLD.camp.arrival, 130)) { ctx.notice(s, 'Bring Thimble close to the medical shelter before unloading.'); return s; }
    if (i.mounted) dismountActor(s, ctx, i, thimble); i.mounted = false; thimble.hitched = true;
    if (transfer(s, ctx, 'mara', 'unload')) f.unloaded = true;
  } else if (id === 'deliver:silas') {
    const moss = entity(s, ctx, 'moss'), vera = entity(s, ctx, 'vera');
    if (!near(moss, WORLD.camp.arrival, 55) || !near(vera, WORLD.camp.arrival, 55)) { ctx.notice(s, 'Moss and Vera are coming through the doorway. Wait for both helpers.'); return s; }
    if (transfer(s, ctx, 'moss', 'deliver')) { f.helpersReceived = true; f.deliveryIndex = 1; ctx.notice(s, 'Moss has Silas’s shoulders. Vera supports his leg; follow them through the door.'); }
  } else if (id === 'reunite:elin-fin') {
    f.familyReunited = true; ctx.talk(s, 'rescue-family', 'Elin Orr', `You can explain the deeds tomorrow. Tonight you learn how a person stays found. Fin kept your scarf warm. ${r.rescue.silas.injury > 3 ? 'The journey opened more wounds; we will keep watch beside you.' : 'The dressing holds; we will watch the shoulder through the night.'}`, [['leave', 'Let him rest beside the stove.']]);
    entity(s, ctx, 'fin').scarfDelivered = true; emit(s, ctx, 'care', silas, 'silas', entity(s, ctx, 'elin'), 'elin');
  } else if (id === 'rescue:tomas') {
    f.tomasThanked = true; ctx.talk(s, 'rescue-tomas', 'Tomas Reed', 'You brought a person back when the papers would have been easier. Inez has questions about the wagon and the people behind it. I owe her answers before we choose another road.', [['leave', 'Answers before another company town.']]); ctx.log(s, 'Tomas’s responsibility for the convoy remains unresolved; the rescue did not erase the opening choices.');
  } else if (id === 'rescue:della') {
    f.dellaRecorded = true; ctx.talk(s, 'rescue-ledger', 'Della Wren', `One lost mount, one used dressing, one living courier. ${f.caseCollected ? 'The seizure number is safe for a later hearing.' : 'The papers stayed in the channel; the person came first.'} When the freeze opens, the eastbound road is our chance. A companion hunt and the rival camp need separate work; neither is available yet.`, [['leave', 'Record the cost without taking Copper’s pack.']]);
  } else if (id === 'journal:rescue') {
    f.journalWritten = true; ctx.log(s, 'Journal drawing: three stone arches, two horses, a sling. His voice came through ice before we saw his face. We brought him home. The papers can wait; the questions cannot.'); finish(s, ctx);
  } else if (id === 'mount') {
    const from = { ...point(s.player), facing: s.player.facing }, saddle = safeSaddle(s, s.horse);
    if (!saddle) { ctx.notice(s, 'Lead Copper away from the wall before mounting.'); return s; }
    Object.assign(s.horse, saddle); Object.assign(s.player, saddle); s.player.mounted = true; s.horse.hitched = false; s.horse.following = false;
    emit(s, ctx, 'mount', s.horse, s.horse.id, from);
  } else if (id === 'dismount') {
    if (!dismountActor(s, ctx, s.player, s.horse)) ctx.notice(s, 'Move Copper away from the wall to find safe ground for dismounting.');
  }
  else if (id === 'camp:oats') { if (s.camp.food > 0 && near(s.player, s.horse, 110)) { s.camp.food--; s.horse.stamina = Math.min(100, s.horse.stamina + 30); s.horse.hp = Math.min(100, s.horse.hp + 12); ctx.notice(s, 'Copper ate a camp ration.'); } else ctx.notice(s, 'Bring Copper close; the community needs food in store.'); }
  else if (id === 'pat:copper') { s.horse.fear = Math.max(0, (s.horse.fear || 0) - 20); s.horse.bond = Math.min(4, (s.horse.bond || 1) + 0.05); emit(s, ctx, 'pat', s.horse, s.horse.id); }
  else if (id.startsWith('aftermath:')) {
    const actor = entity(s, ctx, id.slice(10));
    const lines = { elin: 'He will need clean cloth and patience. You gave us the time to supply both.', fin: 'I put the scarf where he can reach it with his good hand.', silas: f.caseCollected ? 'You saved me before you saved my foolish papers. I will remember the order.' : 'You let the papers go. I would not have done that for myself. Thank you.', della: 'The medical cost is written down. Copper’s pack and the station supplies belong to their own accounts.', inez: 'The creek kept their noses from our door. Tomas still owes us the story behind the broken wagon.', tomas: 'Silas is healing. The east road, the hunt and the rival camp each need their own plan.' };
    ctx.talk(s, `rescue-aftermath-${actor.id}`, actor.name, lines[actor.id], [['leave', 'Let the camp settle.']]);
  }
  objective(s); return s;
}
export function chooseRescue(s, id, ctx) {
  if (!s.dialog?.choices.some(c => c.id === id)) return s;
  const r = rec(s), scene = s.dialog.id;
  s.dialog = null;
  if (id === 'postpone-rescue' && scene === 'rescue-postpone' && unusedKit(s)) { if (typeof ctx.postpone === 'function') ctx.postpone(s); return s; }
  if (id === 'repair-coat' && scene === 'rescue-repair-request' && r.mission.completed && s.camp.materials > 0) { tx(s, 'care:repair-coat', 1, () => { s.camp.materials--; entity(s, ctx, 'silas').coatRepaired = true; }); ctx.log(s, 'Elin repaired Silas’s coat with one recorded camp material. His scars and slow recovery remain.'); return s; }
  if (id === 'ask:departure') { ctx.talk(s, 'rescue-briefing', 'Elin Orr', 'He took the deeds when the freight wagon burned. I do not know whether he ran from us or ran for us. Inez says he came back for her once; Tomas says the northern spillway is still passable.', [['accept-rescue', 'Inez and I will find him.'], ['leave', 'I will return.']]); }
  else if (id === 'accept-rescue' && scene === 'rescue-briefing') {
    if (!active(s) && !ctx.startMission(s, RESCUE_ID)) return s;
    r.flags.briefed = true; ensureRescueCast(s, ctx); grantKit(s, ctx);
    const i = entity(s, ctx, 'inez'), thimble = entity(s, ctx, 'thimble'); i.mounted = false; i.mountPending = true; thimble.hitched = false; delete thimble.goal;
    advance(s, ctx, 1, 'prepared-kiln', 'Rescue kit prepared at the kiln'); ctx.log(s, 'Mara: “He picked a poor night to be useful.” Inez: “He came back for me once. I can be useful in return.”');
  }
  return s;
}
function signal(s, ctx) {
  const r = rec(s), revolver = nearestRevolver(s); if (!revolver) return;
  if (revolver.ammo > 0) revolver.ammo--;
  else if (revolver.reserve > 0) revolver.reserve--;
  else if (!tx(s, 'use:signal-cartridge', 1, () => consume(s, 'signalCartridge'))) { ctx.notice(s, itemTotal(s, 'signalCartridge') > 0 ? 'The sealed signal round is in a mount pack. Take it into your satchel beside Copper before firing the required signal.' : 'No signal cartridge remains. Restore the approach checkpoint.'); return; }
  s.player.equippedWeaponId = revolver.id; s.player.holstered = false; s.player.armed = true; r.flags.signalFired = true; r.timers.signal = 2.1;
  s.bullets.push({ x: s.player.x, y: s.player.y, z: z(s.player) + 35, vx: 0, vy: -30, vz: 180, faction: 'signal', damage: 0, ttl: 1, signal: true });
  emit(s, ctx, 'signal', { x: s.player.x, y: s.player.y - 30, z: 180 }, 'sky'); ctx.notice(s, 'A single shot rings through the arches. Listen for the answer.');
}
function flask(s, ctx) {
  const r = rec(s); if (!r.rescue.flask.servings || !near(s.player, entity(s, ctx, 'inez'), 80)) return;
  tx(s, 'use:inez-flask', 1, () => { r.rescue.flask.servings--; s.player.stamina = Math.min(100, s.player.stamina + 65); });
  r.flags.flaskUsed = true; r.choices.provision = 'inez-flask'; emit(s, ctx, 'aid', s.player, 'inez-flask', entity(s, ctx, 'inez'), 'inez'); ctx.notice(s, 'Inez shares her one warm serving. Sheltered rest remains available when it is gone.');
}
function finish(s, ctx) {
  const r = rec(s), silas = entity(s, ctx, 'silas');
  tx(s, 'reward:coach-gun-ownership', 1, () => { const w = s.weapons['coach-gun']; w.owner = 'mara'; w.loanMissionId = null; }); r.flags.coachRewarded = true;
  for (const [suffix, item] of [['warm-ration', 'warmRation'], ['rescue-dressing', 'rescueDressing'], ['rescue-rope', 'rescueRope'], ['signal-cartridge', 'signalCartridge']]) {
    if (itemTotal(s, item) > 0) tx(s, `return:${suffix}`, 1, () => takeBorrowed(s, item));
  }
  if (r.rescue.flask.servings > 0) tx(s, 'return:inez-flask', 1, () => { r.rescue.flask.servings = 0; });
  r.flags.kitReturned = true; r.rescue.silas.careScheduled = true; r.rescue.silas.healingHours = 36; silas.injured = true; silas.scars = true; silas.hidden = false;
  s.sideQuests.silas = { ...(s.sideQuests.silas || {}), complete: true, status: 'healing', scars: true, caseRecovered: r.flags.caseCollected };
  r.performance.allWolvesNoBites = r.performance.wolvesKilled === 7 && r.performance.wolfBiteDamage === 0 && r.retryCount === 0;
  r.performance.eligibleNoBites = r.retryCount === 0; r.performance.accuracy80 = r.performance.shots > 0 && r.performance.hits / r.performance.shots >= 0.8;
  objective(s); ctx.complete(s, ['campaign-the-aftermath-of-genesis', 'campaign-old-friends']); objective(s);
  ctx.notice(s, 'Silas is safely home. The loaned coach gun is yours; unused rescue supplies returned once.');
}
const inside = (a, r, radius = 0) => a.x > r.x - radius && a.x < r.x + r.w + radius && a.y > r.y - radius && a.y < r.y + r.h + radius;
function geometry(s) { return s.region === WORLD.id ? WORLD : { ...SNOWBOUND_WORLD, obstacles: [...SNOWBOUND_WORLD.obstacles, ...WORLD.camp.obstacles, ...(s.campaign.missions['snowbound-a-quiet-table'] && s.campaign.missions['snowbound-a-quiet-table'].status !== 'locked' ? WILLOW_RUN_WORLD.camp.obstacles : [])] }; }
function blocked(s, x, y, height = 0, radius = 9, crouch = false) {
  const w = geometry(s), p = { x, y };
  if (x < radius || y < radius || x > w.width - radius || y > w.height - radius) return true;
  if (w.obstacles.some(o => inside(p, o, radius) && height < (o.z || 0) + (o.height || 60))) return true;
  if (s.region !== WORLD.id) return false;
  if (height === 0) {
    if (WORLD.elevationZones.some(o => inside(p, o, radius)) && !inside(p, WORLD.approachCorridor, -3) && dist(p, WORLD.climbs[0].from) > 43) return true;
  } else if (!WORLD.elevationZones.some(o => o.z === height && inside(p, o, -Math.min(radius, 5)))) return true;
  if (height === 72 && !crouch && inside(p, WORLD.lowArch, radius)) return true;
  if (height === 72 && s.player.carrying && inside(p, WORLD.lowArch, radius + 8)) return true;
  if (height === 108 && s.worldChanges.upperIceClosed) return true;
  return false;
}
function safeSaddle(s, horse) {
  if (!blocked(s, horse.x, horse.y, z(horse), 13)) return point(horse);
  for (const radius of [12, 24, 36]) for (let n = 0; n < 8; n++) {
    const p = { x: horse.x + Math.cos(n * Math.PI / 4) * radius, y: horse.y + Math.sin(n * Math.PI / 4) * radius, z: z(horse) };
    if (!blocked(s, p.x, p.y, p.z, 13)) return p;
  }
  return null;
}
function dismountActor(s, ctx, actor, horse) {
  const from = { x: actor.x, y: actor.y, z: z(horse) + 23, facing: actor.facing }, heading = horse.facing ?? actor.facing;
  for (const radius of [26, 34, 42]) for (const offset of [Math.PI / 2, -Math.PI / 2, Math.PI, 0, Math.PI / 4, -Math.PI / 4, Math.PI * 0.75, -Math.PI * 0.75]) {
    const landing = { x: horse.x + Math.cos(heading + offset) * radius, y: horse.y + Math.sin(heading + offset) * radius, z: z(horse) };
    if (blocked(s, landing.x, landing.y, landing.z, 9)) continue;
    actor.mounted = false; Object.assign(actor, landing); emit(s, ctx, 'dismount', actor, horse.id, from, actor.id, actor.id); return true;
  }
  return false;
}
function move(s, actor, dx, dy, radius = 9) {
  const old = point(actor);
  if (!blocked(s, actor.x + dx, actor.y, z(actor), radius, actor.crouch)) actor.x += dx;
  if (!blocked(s, actor.x, actor.y + dy, z(actor), radius, actor.crouch)) actor.y += dy;
  return dist(old, actor);
}
function obstacleBetween(s, a, b, bullet = false) {
  const w = geometry(s), count = Math.max(1, Math.ceil(dist(a, b) / 5));
  for (let k = 1; k < count; k++) {
    const u = k / count, p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, h = z(a) + (z(b) - z(a)) * u;
    if (w.obstacles.some(o => inside(p, o, bullet ? 1 : 6) && h <= (o.z || 0) + (o.height || 60))) return true;
  }
  return false;
}
const grids = new Map();
function path(s, actor, target, radius) {
  const unit = 20, w = geometry(s), cols = Math.ceil(w.width / unit), rows = Math.ceil(w.height / unit);
  const key = `${s.region}:${z(actor)}:${radius}:${s.worldChanges.upperIceClosed ? 1 : 0}:${actor.crouch ? 1 : 0}`;
  let grid = grids.get(key);
  if (!grid) { grid = Array.from({ length: cols * rows }, (_, n) => !blocked(s, n % cols * unit + 10, Math.floor(n / cols) * unit + 10, z(actor), radius, actor.crouch)); grids.set(key, grid); }
  const cell = p => clamp(Math.floor(p.y / unit), 0, rows - 1) * cols + clamp(Math.floor(p.x / unit), 0, cols - 1);
  const closest = id => {
    if (grid[id]) return id;
    let best = null, dd = Infinity;
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const xx = id % cols + x, yy = Math.floor(id / cols) + y, n = yy * cols + xx;
      if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || !grid[n] || x * x + y * y >= dd) continue;
      best = n; dd = x * x + y * y;
    }
    return best;
  };
  const start = closest(cell(actor)), end = closest(cell(target)); if (start === null || end === null) return [];
  const prev = new Int32Array(cols * rows).fill(-1), queue = [start]; prev[start] = start;
  for (let c = 0; c < queue.length && prev[end] < 0; c++) {
    const n = queue[c];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = n % cols + dx, yy = Math.floor(n / cols) + dy, next = yy * cols + xx;
      if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || !grid[next] || prev[next] >= 0) continue;
      prev[next] = n; queue.push(next);
    }
  }
  if (prev[end] < 0) return [];
  const result = [point(target)]; let n = end;
  while (n !== start) { result.push({ x: n % cols * unit + 10, y: Math.floor(n / cols) * unit + 10, z: z(actor) }); n = prev[n]; }
  return result.reverse();
}
function walkableLine(s, actor, target, radius) {
  const count = Math.max(1, Math.ceil(dist(actor, target) / 10));
  for (let n = 1; n <= count; n++) if (blocked(s, actor.x + (target.x - actor.x) * n / count, actor.y + (target.y - actor.y) * n / count, z(actor), radius, actor.crouch)) return false;
  return true;
}
function follow(s, actor, target, speed, dt, stop = 24, radius = 9) {
  if (!sameFloor(actor, target) || dist(actor, target) <= stop) { actor.vx = 0; actor.vy = 0; return 0; }
  if (!actor.routeTarget || dist(actor.routeTarget, target) > 48 || !actor.route?.length) {
    actor.routeTarget = point(target); actor.route = walkableLine(s, actor, target, radius) ? [point(target)] : path(s, actor, target, radius);
  }
  while (actor.route?.length && dist(actor, actor.route[0]) < 12) actor.route.shift();
  const goal = actor.route?.[0] || target, d = dist(actor, goal), step = Math.min(speed * dt, Math.max(0, d));
  const old = point(actor), dx = d ? (goal.x - actor.x) / d * step : 0, dy = d ? (goal.y - actor.y) / d * step : 0;
  move(s, actor, dx, dy, radius); actor.vx = (actor.x - old.x) / dt; actor.vy = (actor.y - old.y) / dt;
  if (Math.hypot(actor.vx, actor.vy) > 1) actor.facing = Math.atan2(actor.vy, actor.vx);
  return dist(old, actor);
}
function traversalStep(s, dt, ctx, key) {
  const r = rec(s), t = r.traversal[key]; if (!t) return;
  const actor = key === 'player' ? s.player : entity(s, ctx, 'inez');
  const old = point(actor); t.age = Math.min(t.duration, t.age + dt); t.progress = t.age / t.duration;
  const u = t.progress * t.progress * (3 - 2 * t.progress);
  actor.x = t.from.x + (t.to.x - t.from.x) * u; actor.y = t.from.y + (t.to.y - t.from.y) * u; actor.z = t.from.z + (t.to.z - t.from.z) * u;
  actor.vx = (actor.x - old.x) / dt; actor.vy = (actor.y - old.y) / dt; actor.facing = Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x); actor.traversal = t;
  if (t.progress < 1) return;
  Object.assign(actor, t.to); actor.vx = 0; actor.vy = 0; actor.traversal = null; r.traversal[key] = null; actor.route = [];
  if (key === 'inez') { if (t.kind === 'carry-descent') r.flags.descentInezIndex = r.flags.descentIndex + 1; else r.flags.inezRouteIndex++; return; }
  if (t.kind === 'climb-down') r.flags.descentPlayerIndex = r.flags.descentIndex + 1;
  r.traversal.safePoint = point(actor);
  const flags = { 'first-ledge': 'firstClimb', 'second-ledge': 'secondClimb', 'ice-lip': 'braced', 'low-arch': 'archPassed', 'recess-ledge': 'recessClimbed' };
  if (flags[t.edgeId]) r.flags[flags[t.edgeId]] = true;
  if (t.edgeId === 'first-ledge') { actor.stamina = Math.min(actor.stamina, 24); ctx.notice(s, 'Cold stone has drained your hands. The warm ration, Inez’s flask, or sheltered rest restores climbing stamina.'); }
  if (t.edgeId === 'recess-ledge') { entity(s, ctx, 'silas').hidden = false; advance(s, ctx, 6); ctx.notice(s, 'Silas: “I thought the river was talking.” Check his breathing before lifting him.'); }
}
function inezStep(s, dt, ctx) {
  const r = rec(s), f = r.flags, i = entity(s, ctx, 'inez'), horse = entity(s, ctx, 'thimble');
  if (!i || !horse || i.hp <= 0) return;
  if (r.traversal.inez) return;
  if (i.mountPending) { if (f.strapped && r.timers.loading > 0) return; follow(s, i, horse, 115, dt, 18); if (near(i, horse, 25)) { i.mounted = true; delete i.mountPending; emit(s, ctx, 'mount', horse, horse.id, i, 'inez'); } return; }
  if (i.goal) { follow(s, i, i.goal, 95, dt, 12); if (near(i, i.goal, 15)) delete i.goal; return; }
  if (i.mounted) {
    if (!horse.hitched) {
      const creekLead = r.mission.stage === 8 && f.retreatIndex >= 3 && !f.creekConcealed;
      if (creekLead) {
        const target = WORLD.creekRoute[r.tracks.creek.nodeIndex] || WORLD.creekRoute.at(-1);
        const ahead = dist(horse, s.player) > 70 && dist(target, s.player) > dist(horse, s.player);
        if (!ahead) follow(s, horse, { ...target, z: 0 }, 125, dt, 3, 13);
        else { horse.vx = 0; horse.vy = 0; }
      } else follow(s, horse, s.player, r.mission.stage >= 8 ? 150 : 170, dt, inCreek(s.player) ? 22 : 42, 13);
    }
    i.x = horse.x; i.y = horse.y; i.z = z(horse); i.vx = horse.vx; i.vy = horse.vy; i.facing = horse.facing; return;
  }
  if (r.mission.stage >= 5 && r.mission.stage <= 6 && f.inezRouteIndex < 5) {
    const sequence = [WORLD.climbs[0], WORLD.climbs[1], WORLD.brace, { id: 'low-arch', from: WORLD.brace.to, to: WORLD.ropeAnchor, duration: 1.8 }, WORLD.climbs[2]], required = [f.firstClimb, f.secondClimb, f.braced, f.archPassed, f.recessClimbed];
    const n = f.inezRouteIndex, edge = sequence[n];
    if (!required[n]) { follow(s, i, s.player, 85, dt, 40); return; }
    if (n === 3) i.crouch = true;
    follow(s, i, edge.from, 100, dt, 8);
    if (near(i, edge.from, 18)) beginTraversal(s, ctx, i, edge, n === 2 ? 'brace' : n === 3 ? 'crouch' : 'climb', 'inez');
    return;
  }
  if (r.mission.stage === 7 && f.loadingHandoff && !f.loaded) {
    if (r.timers.loading > 0) return;
    const target = WORLD.loadingRoute[f.loadingIndex];
    if (target) {
      r.rescue.loadingDistance += follow(s, i, target, 52, dt, 0, 11);
      if (near(i, target, 0.05)) { f.loadingIndex++; i.route = []; }
    }
    return;
  }
  if (r.mission.stage === 9 && f.helpersReceived) return;
  follow(s, i, s.player, 105, dt, 34, i.carrying ? 11 : 9);
}
function activateWave(s, ctx, wave) {
  const r = rec(s);
  for (const ai of r.predators.filter(w => w.wave === wave)) {
    if (ai.phase !== 'dormant') continue;
    const actor = entity(s, ctx, ai.id); actor.hidden = false; actor.phase = 'assess'; ai.phase = 'assess'; ai.age = 0;
    ai.targetId = ai.role === 'flanker' ? 'inez' : 'mara'; actor.targetId = ai.targetId;
  }
  ctx.notice(s, wave === 0 ? 'Wolves watch from the crest before approaching.' : 'A fresh pair descends from opposite slopes. Slow down to keep Inez covered.');
}
function wolfStep(s, dt, ctx) {
  const r = rec(s), i = entity(s, ctx, 'inez'), thimble = entity(s, ctx, 'thimble');
  for (const ai of r.predators) {
    const wolf = entity(s, ctx, ai.id); if (!wolf) continue;
    ai.biteCooldown = Math.max(0, ai.biteCooldown - dt); ai.noise = Math.max(0, ai.noise - dt); ai.age += dt;
    if (wolf.hp <= 0) {
      if (!ai.killed) { ai.killed = true; r.performance.wolvesKilled++; s.stats.kills++; }
      ai.phase = 'dead'; wolf.phase = 'dead'; wolf.vx = 0; wolf.vy = 0; continue;
    }
    if (['dormant', 'dead', 'fled'].includes(ai.phase)) continue;
    if (ai.phase === 'assess' && ai.age < 3) continue;
    if (ai.phase === 'assess') { ai.phase = 'stalk'; ai.age = 0; }
    if (ai.phase !== 'flee' && (ai.wounded && wolf.hp < 25 && ai.age > 1.2 || r.flags.creekConcealed && ai.wave > 0 || r.mission.stage >= 8 && ai.wave === 0 && dist(wolf, s.player) > 300)) { ai.phase = 'flee'; ai.age = 0; ai.targetId = null; }
    if (ai.phase === 'flee') {
      const target = { x: clamp(wolf.x + (wolf.x - s.player.x) * 2, 100, WORLD.width - 100), y: Math.max(100, wolf.y - 180), z: 0 };
      follow(s, wolf, target, 145, dt, 10, 9); if (dist(wolf, s.player) > 360 || ai.age > 12) { ai.phase = 'fled'; wolf.hidden = true; } wolf.phase = ai.phase; continue;
    }
    let target;
    if (ai.noise > 0 || ai.role === 'tester') { ai.targetId = s.player.mounted ? s.horse.id : 'mara'; target = s.player.mounted ? s.horse : s.player; }
    else if (ai.role === 'flanker') { ai.targetId = i.mounted ? thimble.id : 'inez'; target = i.mounted ? thimble : i; }
    else if (ai.role === 'hesitant') {
      if (!r.predators.some(w => ['charge', 'bite'].includes(w.phase))) { wolf.phase = ai.phase; continue; }
      ai.targetId = s.player.mounted ? s.horse.id : 'mara'; target = s.player.mounted ? s.horse : s.player;
    } else {
      target = dist(wolf, thimble) < dist(wolf, s.horse) ? thimble : s.horse; ai.targetId = target.id;
    }
    if (!target || !sameFloor(wolf, target)) continue;
    const visible = !obstacleBetween(s, wolf, target);
    if (visible && (dist(wolf, target) < 170 || ai.age > 2.5)) ai.phase = 'charge';
    const speed = ai.phase === 'charge' ? 144 : ai.role === 'flanker' ? 86 : 65;
    const destination = ai.phase === 'charge' ? { x: target.x + (target.vx || 0) * 0.22, y: target.y + (target.vy || 0) * 0.22, z: 0 } : target;
    follow(s, wolf, destination, speed, dt, 16, 9);
    if (near(wolf, target, 28) && !obstacleBetween(s, wolf, target) && ai.biteCooldown === 0) {
      ai.phase = 'bite'; ai.biteCooldown = 1.5; const damage = 10; target.hp = Math.max(0, target.hp - damage); r.performance.wolfBiteDamage += damage;
      if (target.kind === 'horse' || target.category === 'mount') target.fear = Math.min(100, (target.fear || 0) + 25);
      if (target.id === 'thimble') { r.rescue.silas.injury += 0.35; entity(s, ctx, 'silas').hp = Math.max(0, entity(s, ctx, 'silas').hp - 3); }
      emit(s, ctx, 'wolf-bite', target, target.id, wolf, wolf.id); ctx.notice(s, `A wolf bit ${target.name || 'Mara'}. Keep moving or use the refuge rocks.`);
    }
    wolf.phase = ai.phase; wolf.targetId = ai.targetId; wolf.route = wolf.route || []; ai.route = wolf.route.map(point);
  }
}
function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
function inWater(a) { return WORLD.river.slice(1).some((b, n) => segmentDistance(a, WORLD.river[n], b) <= WORLD.creekWidth / 2); }
function inCreek(a) { return WORLD.creekRoute.slice(1).some((b, n) => segmentDistance(a, WORLD.creekRoute[n], b) <= WORLD.creekWidth / 2); }
function creekStep(s, dt, ctx) {
  const r = rec(s), c = r.tracks.creek, thimble = entity(s, ctx, 'thimble'), silas = entity(s, ctx, 'silas');
  if (r.flags.creekConcealed) return;
  const together = dist(s.horse, thimble) <= 120, bothWet = inCreek(s.horse) && inCreek(thimble), strapped = silas.attachment?.type === 'passenger' && silas.attachment.strap;
  if (s.player.mounted && together && bothWet && strapped && r.flags.waveOne && r.flags.waveTwo) {
    for (const [key, actor, previous] of [['copper', s.horse, 'previousCopper'], ['thimble', thimble, 'previousThimble']]) {
      if (c[previous]) { const delta = dist(actor, c[previous]); if (delta <= dt * 245 + 3) c[key] += delta; else c[key] = 0; }
      c[previous] = point(actor);
    }
    const node = WORLD.creekRoute[c.nodeIndex]; if (node && dist(s.horse, node) < 40 && dist(thimble, node) < 40) c.nodeIndex++;
    if (c.copper >= 180 && c.thimble >= 180 && c.nodeIndex >= WORLD.creekRoute.length) {
      r.flags.creekConcealed = true; r.tracks.scentTrail = [];
      for (const ai of r.predators) if (ai.wave > 0 && !['dead', 'dormant', 'fled'].includes(ai.phase)) { ai.phase = 'flee'; ai.age = 0; ai.targetId = null; }
      ctx.notice(s, 'Both mounts have ridden enough running water to mask the trail. Leave together through the left bank.');
    }
  } else {
    if (c.copper > 20 || c.thimble > 20) { c.prematureExits++; ctx.notice(s, 'Inez: “Stay in the water with me. We cannot leave a trail to the kiln.”'); }
    c.copper = 0; c.thimble = 0; c.previousCopper = null; c.previousThimble = null; c.nodeIndex = 0;
  }
}
export function shootRescue(s, x, y, ctx) {
  const r = rec(s), p = s.player, w = s.weapons[p.equippedWeaponId];
  if (!active(s) || s.failure || s.dialog || r.traversal.player || p.carrying || p.holstered || p.reloadTimer > 0 || p.shotTimer > 0 || !w || w.location !== 'carried' || !Number.isFinite(x) || !Number.isFinite(y)) return s;
  if (!w.ammo) { ctx.notice(s, 'The selected weapon is empty. Reload its own ammunition.'); return s; }
  w.ammo--; p.shotTimer = w.kind === 'coach-gun' ? 0.6 : 0.33; p.facing = Math.atan2(y - p.y, x - p.x);
  r.performance.shots++; r.performance.triggerSerial++; s.stats.shots++;
  const trigger = r.performance.triggerSerial, volley = { killedIds: [] }, angle = p.facing, offsets = w.kind === 'coach-gun' ? [-0.05, -0.025, 0, 0.025, 0.05] : [0];
  for (const offset of offsets) s.bullets.push({ x: p.x + Math.cos(angle) * 17, y: p.y + Math.sin(angle) * 17, z: z(p) + (p.mounted ? 28 : 18), vx: Math.cos(angle + offset) * 680, vy: Math.sin(angle + offset) * 680, vz: 0, damage: w.kind === 'coach-gun' ? 34 : 42, ttl: w.kind === 'coach-gun' ? 0.62 : 1.25, faction: 'player', triggerId: trigger, volley, weaponKind: w.kind, traveled: 0 });
  for (const ai of r.predators) if (!['dead', 'dormant', 'fled'].includes(ai.phase)) { ai.noise = 4; ai.targetId = p.mounted ? s.horse.id : 'mara'; }
  emit(s, ctx, 'shoot', { x, y, z: z(p) }, w.id); return s;
}
function bulletsStep(s, dt, ctx) {
  const r = rec(s), remaining = [];
  for (const b of s.bullets) {
    const old = { x: b.x, y: b.y, z: b.z || 0 }, end = { x: b.x + b.vx * dt, y: b.y + b.vy * dt, z: (b.z || 0) + (b.vz || 0) * dt };
    b.ttl -= dt; b.traveled = (b.traveled || 0) + dist(old, end); let hit = false;
    if (!b.signal && b.faction === 'player') {
      const candidates = [...s.npcs, ...s.enemies, s.horse, ...s.mounts, ...s.animals].filter((a, n, all) => a && a.id !== 'mara' && !(s.player.mounted && a.id === s.horse.id) && (a.hp > 0 || a.kind === 'wolf' && b.volley?.killedIds.includes(a.id)) && !a.hidden && all.findIndex(other => other.id === a.id) === n).sort((a, c) => dist(a, old) - dist(c, old));
      for (const actor of candidates) {
        const floor = actor.attachment ? z(entity(s, ctx, actor.attachment.targetId)) : z(actor), radius = actor.kind === 'wolf' ? 17 : actor.kind === 'horse' || actor.category === 'mount' ? 20 : 12;
        if (end.z < floor || end.z > floor + 48 || segmentDistance(actor, old, end) > radius || obstacleBetween(s, old, { x: actor.x, y: actor.y, z: end.z }, true)) continue;
        hit = true;
        if (actor.kind !== 'wolf') { ctx.fail(s, `${actor.name || actor.id} was struck by your shot. Protected people and riding mounts must return alive.`); break; }
        if (actor.hp <= 0) break;
        const ai = r.predators.find(w => w.id === actor.id), damage = b.damage * (b.weaponKind === 'coach-gun' ? clamp(1.15 - b.traveled / 520, 0.3, 1) : 1);
        actor.hp = Math.max(0, actor.hp - damage); ai.wounded = true; ai.age = 0;
        if (!r.performance.hitTriggers.includes(b.triggerId)) { r.performance.hitTriggers.push(b.triggerId); r.performance.hits++; s.stats.hostileHits++; }
        if (actor.hp <= 0 && !ai.killed) { ai.killed = true; ai.phase = 'dead'; actor.phase = 'dead'; b.volley?.killedIds.push(actor.id); r.performance.wolvesKilled++; s.stats.kills++; }
        emit(s, ctx, 'hit', actor, actor.id); break;
      }
      if (!hit && obstacleBetween(s, old, end, true)) hit = true;
    }
    Object.assign(b, end); if (!hit && b.ttl > 0) remaining.push(b);
  }
  s.bullets = s.failure ? [] : remaining;
}
export function reloadRescue(s, ctx) {
  const p = s.player, w = s.weapons[p.equippedWeaponId];
  if (s.failure || s.dialog || rec(s).traversal.player || p.carrying || !w || w.location !== 'carried' || p.reloadTimer > 0 || w.ammo >= w.capacity || w.reserve <= 0) return s;
  p.reloadTimer = w.kind === 'coach-gun' ? 1.8 : 1.3; p.reloadWeaponId = w.id; emit(s, ctx, 'reload', p, w.id); ctx.notice(s, `Reloading ${w.name || w.kind}.`); return s;
}
export function useRescueItem(s, id, ctx) {
  if (s.failure || s.dialog || rec(s).traversal.player) return s;
  const r = rec(s);
  if (id === 'warmRation' || id === 'warm-ration') {
    if (!consume(s, 'warmRation')) { ctx.notice(s, 'That ration has already been used or returned. Sheltered rest remains available.'); return s; }
    tx(s, 'use:warm-ration', 1, () => {}); s.player.stamina = Math.min(100, s.player.stamina + 72); s.player.hp = Math.min(100, s.player.hp + 8);
    r.flags.rationUsed = true; r.choices.provision = 'warm-ration'; emit(s, ctx, 'eat', s.player, 'warmRation'); ctx.notice(s, 'The warm ration steadies your climbing hands.');
  } else if (id === 'inez-flask') flask(s, ctx);
  else if (['rescueDressing', 'rescueRope', 'signalCartridge', 'dispatchCase'].includes(id)) ctx.notice(s, RESCUE_ITEMS[id].description);
  else if (['tonic', 'coffee', 'broth', 'oats', 'bandages'].includes(id)) {
    if (!(s.inventory[id] > 0)) return s;
    if (id === 'tonic' && s.player.hp < 100) { consume(s, id); s.player.hp = Math.min(100, s.player.hp + 55); }
    else if (id === 'coffee' && s.player.focus < 100) { consume(s, id); s.player.focus = Math.min(100, s.player.focus + 50); }
    else if (id === 'bandages' && s.player.hp < 100) { consume(s, id); s.player.hp = Math.min(100, s.player.hp + 35); }
    else if (id === 'broth' && (s.player.stamina < 100 || s.player.hp < 100)) { consume(s, id); s.player.stamina = 100; s.player.hp = Math.min(100, s.player.hp + 15); }
    else if (id === 'oats' && near(s.player, s.horse, 80)) { consume(s, id); s.horse.stamina = 100; s.horse.bond = Math.min(4, (s.horse.bond || 1) + 0.2); }
    else return s;
    emit(s, ctx, id === 'bandages' ? 'bandage' : 'eat', s.player, id); ctx.notice(s, `${id === 'oats' ? 'Copper fed' : id === 'coffee' ? 'Focus restored' : 'Rescue supplies used'}.`);
  }
  return s;
}
export function whistleRescue(s, ctx) {
  if (s.failure || s.dialog || s.player.mounted) return s;
  if (rec(s).flags.mountsHitched && rec(s).mission.stage < 7) { ctx.notice(s, 'Copper is safely hitched below the climb. She cannot follow onto the ledges.'); return s; }
  s.horse.hitched = false; s.horse.following = true; emit(s, ctx, 'whistle', s.horse, s.horse.id); return s;
}
export function actionRescue(s, id, ctx) {
  if (s.failure || s.dialog || !active(s)) return s;
  const p = s.player, r = rec(s);
  if (id === 'holster') { p.holstered = true; p.armed = false; emit(s, ctx, 'holster', p, p.equippedWeaponId); }
  else if (id === 'draw') { const w = s.weapons[p.equippedWeaponId]; if (w?.location === 'carried' && !p.carrying && !r.traversal.player) { p.holstered = false; p.armed = true; emit(s, ctx, 'draw', p, w.id); } }
  else if (id.startsWith('equip:')) {
    const request = id.slice(6), w = s.weapons[request] || Object.values(s.weapons).find(a => a.kind === request);
    if (!weaponAvailable(s, w) || p.carrying || r.traversal.player) { ctx.notice(s, 'Move to the saddle rack and free both hands to select that weapon.'); return s; }
    w.location = 'carried'; delete w.rackMountId; p.equippedWeaponId = w.id; p.reloadTimer = 0; delete p.reloadWeaponId; p.holstered = false; p.armed = true; emit(s, ctx, 'equip', p, w.id);
  } else if (id === 'crouch') p.crouch = true;
  else if (id === 'stand') p.crouch = false;
  else if (id === 'block' && !p.mounted && !p.carrying && !r.traversal.player) { if (!(p.blockTimer > 0.25)) emit(s, ctx, 'block', p, 'mara'); p.blockTimer = 0.8; }
  else if (id === 'drop:silas' && p.carrying === 'silas') ctx.fail(s, 'Silas was dropped over unsafe ice. Lower him only on the authored sheltered pad.');
  else {
    const offered = getRescueInteractions(s, ctx).find(a => a.id === id || id === 'carry' && a.id === 'carry:silas' || id === 'release' && a.id === 'secure:silas-at-rest-pad');
    if (offered) interactRescue(s, offered.id, ctx);
  }
  return s;
}
function campHelperStep(s, dt, ctx) {
  const r = rec(s), f = r.flags, moss = entity(s, ctx, 'moss'), vera = entity(s, ctx, 'vera');
  if (!f.helpersReceived) { if (!moss.goal && !near(moss, WORLD.camp.arrival, 30)) summon(s, ctx, 'moss', WORLD.camp.arrival); if (!vera.goal && !near(vera, { x: 400, y: 1160, z: 0 }, 30)) summon(s, ctx, 'vera', { x: 400, y: 1160, z: 0 }); }
  for (const actor of [moss, vera, entity(s, ctx, 'elin'), entity(s, ctx, 'fin')]) if (actor?.goal) { follow(s, actor, actor.goal, 70, dt, 5, actor.carrying ? 11 : 9); if (near(actor, actor.goal, 9)) delete actor.goal; }
  if (!f.helpersReceived || f.delivered) return;
  const target = WORLD.camp.deliveryRoute[f.deliveryIndex]; if (!target) return;
  r.rescue.helperDistance += follow(s, moss, target, 42, dt, 2, 11);
  follow(s, vera, { x: moss.x + 16, y: moss.y + 9, z: 0 }, 65, dt, 12, 9);
  if (near(moss, target, 3) && dist(vera, moss) < 40) { f.deliveryIndex++; moss.route = []; }
  if (f.deliveryIndex >= WORLD.camp.deliveryRoute.length) {
    if (!ctx.setAttachment(s, 'silas', { type: 'rest', targetId: 'silas-bed' })) return; f.delivered = true; r.rescue.silas.exposure = 0;
    // The camp bed anchor is also exported in the northern world for root attachment resolution.
    emit(s, ctx, 'setdown', WORLD.camp.bed, 'silas', moss, 'moss');
    summon(s, ctx, 'elin', { x: 400, y: 1270, z: 0 }); summon(s, ctx, 'fin', { x: 430, y: 1270, z: 0 });
    ctx.notice(s, 'Moss and Vera have placed Silas in the warm bed. Elin and Fin can see him now.');
  }
}
function healingStep(s, dt, ctx) {
  const r = rec(s); if (!r.mission.completed || !r.rescue.silas.careScheduled || r.rescue.silas.healingHours <= 0) return;
  const patient = entity(s, ctx, 'silas'), elin = entity(s, ctx, 'elin');
  r.rescue.silas.healingHours = Math.max(0, r.rescue.silas.healingHours - dt / 80);
  r.rescue.silas.injury = Math.max(0, r.rescue.silas.injury - dt / (80 * 18));
  patient.hp = Math.min(100, patient.hp + dt / (80 * 2));
  const phase = Math.min(6, Math.floor((36 - r.rescue.silas.healingHours) / 6));
  if (s.region === 'snowbound' && phase > 0 && !r.transactions[`${RESCUE_ID}:care:watch-${phase}`]) {
    if (!near(elin, WORLD.camp.bed, 50)) summon(s, ctx, 'elin', { x: 400, y: 1270, z: 0 });
    else tx(s, `care:watch-${phase}`, 1, () => { emit(s, ctx, 'care', patient, 'silas', elin, 'elin'); ctx.log(s, 'Elin checked Silas’s dressing and warmed his frostbitten hands at the scheduled bedside watch.'); });
  }
  if (r.rescue.silas.healingHours === 0) { patient.injured = false; s.sideQuests.silas.status = 'recovering-strength'; ctx.notice(s, 'Silas’s dressing has held through the healing schedule. His scars remain; strength and trust still take time.'); }
}
/** Advance the existing bedside schedule while another mission owns the world clock.
 * The caller supplies its elapsed step; this helper never changes elapsed/time or
 * prior mission performance. Active-rescue stepping keeps its existing behavior.
 */
export function advanceRescueClinical(s, dt, ctx) {
  const r = rec(s);
  // The caller supplies time that actually elapsed. A scene or failure opened
  // at the end of that tick must not erase its already advanced world hours.
  if (!r?.mission.completed || !Number.isFinite(dt)) return s;
  dt = clamp(dt, 0, 0.1); if (!dt) return s;
  if (!active(s)) r.timers.helper = Math.max(0, r.timers.helper - dt);
  healingStep(s, dt, ctx);
  if (!active(s) && s.region === 'snowbound') {
    const elin = entity(s, ctx, 'elin');
    if (elin?.goal) { follow(s, elin, elin.goal, 70, dt, 5, 9); if (near(elin, elin.goal, 9)) delete elin.goal; }
  }
  return s;
}
function safeSetdown(s, ctx) {
  const patient = entity(s, ctx, 'silas'); if (!patient?.attachment || patient.attachment.type === 'rest') return;
  const carrier = entity(s, ctx, patient.attachment.targetId), from = point(patient);
  if (ctx.setAttachment(s, 'silas', null)) {
    Object.assign(patient, { x: carrier.x, y: carrier.y, z: z(carrier) });
    emit(s, ctx, 'setdown', patient, patient.id, from, carrier.id, carrier.id);
  }
}
export function stepRescue(s, dt, input = {}, ctx) {
  const r = rec(s); if (!active(s) || !r || !Number.isFinite(dt)) return s;
  dt = clamp(dt, 0, 0.1); if (!dt) return s;
  ensureRescueCast(s, ctx);
  s.notices = s.notices.map(n => ({ ...n, time: n.time - dt })).filter(n => n.time > 0);
  if (s.failure || s.dialog) return s;
  s.elapsed += dt; s.time += dt / 80; if (s.time >= 24) { s.time -= 24; s.day++; }
  const p = s.player, f = r.flags, i = entity(s, ctx, 'inez'), thimble = entity(s, ctx, 'thimble'), silas = entity(s, ctx, 'silas');
  for (const key of Object.keys(r.timers)) r.timers[key] = Math.max(0, r.timers[key] - dt);
  p.shotTimer = Math.max(0, p.shotTimer - dt); p.blockTimer = Math.max(0, p.blockTimer - dt);
  if (p.reloadTimer > 0) { p.reloadTimer = Math.max(0, p.reloadTimer - dt); if (!p.reloadTimer) { const w = s.weapons[p.reloadWeaponId || p.equippedWeaponId]; if (w) { const amount = Math.min(w.capacity - w.ammo, w.reserve); w.ammo += amount; w.reserve -= amount; } delete p.reloadWeaponId; } }
  if (input.block) actionRescue(s, 'block', ctx);
  p.focusActive = !!input.focus && p.focus > 0 && !p.carrying && !r.traversal.player;
  p.focus = clamp(p.focus + (p.focusActive ? -19 : 7) * dt, 0, 100);
  if (!r.traversal.player && !r.timers.rest) {
    let mx = clamp(Number(input.mx) || 0, -1, 1), my = clamp(Number(input.my) || 0, -1, 1), len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    const sprint = !!input.sprint && !p.carrying && (p.mounted ? s.horse.stamina : p.stamina) > 1;
    p.crouch = !!input.crouch && !p.mounted || p.crouch && f.secondClimb && !f.archPassed;
    const body = p.mounted ? s.horse : p, water = s.region === WORLD.id && inWater(body);
    let speed = p.mounted ? sprint ? 225 : 155 : p.carrying ? 57 : p.crouch ? 65 : sprint ? 165 : 105;
    if (water) speed *= 0.78;
    if (p.mounted && (s.horse.fear || 0) > 70) speed *= 0.75;
    if (p.carrying && p.stamina < 1) speed = 22;
    const old = point(body), movement = move(s, body, mx * speed * dt, my * speed * dt, p.mounted ? 13 : p.carrying ? 11 : 9);
    s.stats.distance += movement;
    body.vx = (body.x - old.x) / dt; body.vy = (body.y - old.y) / dt;
    if (movement > 0.01) body.facing = Math.atan2(my, mx);
    if (p.mounted) { p.x = body.x; p.y = body.y; p.z = z(body); p.vx = body.vx; p.vy = body.vy; p.facing = body.facing; s.horse.stamina = clamp(s.horse.stamina + (movement > 0 ? sprint ? -8 : s.region === WORLD.id ? water ? -0.8 : -0.35 : 0 : 5) * dt, 0, 100); }
    else { p.stamina = clamp(p.stamina + (p.carrying && movement > 0 ? -1.6 : sprint && movement > 0 ? -10 : 5) * dt, 0, 100); }
  } else { p.vx = 0; p.vy = 0; if (r.timers.rest > 0) p.stamina = Math.min(100, p.stamina + 19 * dt); }
  traversalStep(s, dt, ctx, 'player'); traversalStep(s, dt, ctx, 'inez'); inezStep(s, dt, ctx);
  if (s.horse.following && !p.mounted && !s.horse.hitched) follow(s, s.horse, p, 155, dt, 38, 13);
  for (const horse of [s.horse, thimble]) if (horse.goal) {
    follow(s, horse, horse.goal, 145, dt, 3, 13);
    if (near(horse, horse.goal, 7)) { delete horse.goal; if (f.hitchPending) horse.hitched = true; }
  }
  if (f.hitchPending && near(s.horse, WORLD.hitch, 12) && near(thimble, WORLD.loadingRoute.at(-1), 12)) {
    f.hitchPending = false; f.mountsHitched = true; s.horse.hitched = true; thimble.hitched = true;
    advance(s, ctx, 5, 'mount-shelf', 'Both live mounts parked at the shelf'); ctx.notice(s, 'Both mounts are safely hitched. Retrieve the coach gun before climbing.');
  }
  s.horse.fear = Math.max(0, (s.horse.fear || 0) - dt * 2); thimble.fear = Math.max(0, thimble.fear - dt * 1.5);
  if (s.region === WORLD.id && !r.mission.completed) {
    if (r.mission.stage === 2) {
      const node = WORLD.trail[f.routeIndex]; if (node && near(p, node, 85) && near(i, p, 160)) f.routeIndex++;
    }
    if (r.mission.stage >= 3 && r.mission.stage <= 4) {
      const node = WORLD.searchRoute[f.searchIndex]; if (node && near(p, node, 90)) f.searchIndex++;
      if (!f.evacuationAccount && near(p, prop('ford-scrape'), 180)) { f.evacuationAccount = true; ctx.log(s, 'Inez: “Tomas said the wagon would break the chain. He never said who was behind it. Neri is dead, Gideon was hurt, and Silas is missing. I keep asking what Tomas knew.”'); ctx.notice(s, 'Inez questions the convoy escape. Read the water’s far bank before going uphill.'); }
    }
    if (f.signalFired && !f.signalAnswered && r.timers.signal === 0) { f.signalAnswered = true; ctx.notice(s, 'Silas calls from above: “Stone arch! Below the iron!” Hitch both mounts below the foot path.'); emit(s, ctx, 'reply', { x: 1900, y: 365, z: 108 }, 'silas', { x: 1900, y: 365, z: 108 }, 'silas'); }
    if (r.mission.stage === 7 && f.strapped && p.mounted && i.mounted) {
      const packResolved = r.predators.filter(w => w.wave === 0).every(w => ['dead', 'fled'].includes(w.phase));
      if (packResolved || dist(p, WORLD.hitch) > 210 && dist(thimble, WORLD.hitch) > 170) { f.mountedRetreat = true; advance(s, ctx, 8, 'mounted-descent', 'Silas strapped before mounted retreat'); activateWave(s, ctx, 1); f.waveOne = true; }
    }
    if (r.mission.stage === 8) {
      if (!f.waveOne) { f.waveOne = true; activateWave(s, ctx, 1); }
      const node = WORLD.retreatRoute[f.retreatIndex]; if (node && near(p, node, 90) && near(thimble, p, 150)) f.retreatIndex++;
      if (!f.waveTwo && (f.retreatIndex >= 2 || near(p, WORLD.retreatRoute[2], 145) || inCreek(p))) { f.waveTwo = true; activateWave(s, ctx, 2); }
      creekStep(s, dt, ctx);
      if (!f.iceCollapsed && dist(p, WORLD.loadingSpur) > 230) { f.iceCollapsed = true; f.caseLost = !f.caseCollected; if (!f.caseCollected) r.choices.case = 'omitted'; s.worldChanges.upperIceClosed = true; emit(s, ctx, 'collapse', { x: 1900, y: 365, z: 108 }, 'ice-recess'); ctx.notice(s, 'The upper ice falls into the recess. The lower trail remains open.'); }
    }
    if (r.mission.stage >= 6 && !f.delivered) {
      const safe = silas.attachment?.type === 'rest' || silas.attachment?.type === 'carried' || silas.attachment?.type === 'passenger' && silas.attachment.strap;
      r.rescue.silas.exposure = Math.max(0, r.rescue.silas.exposure + dt * (safe ? -0.5 : 1));
      if (r.rescue.silas.exposure > 45) { silas.hp = Math.max(0, silas.hp - dt * 1.5); r.rescue.silas.injury += dt * 0.015; }
    }
    if (r.mission.stage >= 2 && !r.mission.completed) {
      const apart = dist(p, i) > 320;
      r.timers.abandonment = apart ? r.timers.abandonment + dt * 2 : 0;
      if (apart && r.timers.abandonment > 2 && !r.timers.cold) { ctx.notice(s, 'Inez calls: “Stay within reach. We carry him together.”'); r.timers.cold = 3; }
      if (r.timers.abandonment >= 6) ctx.fail(s, 'Inez was left behind beyond shouting distance.');
    }
    wolfStep(s, p.focusActive ? dt * 0.55 : dt, ctx);
    r.tracks.sampleTimer += dt;
    if (r.tracks.sampleTimer >= 0.6) {
      r.tracks.sampleTimer = 0;
      if (!inWater(p) && !f.creekConcealed && p.mounted) { r.tracks.scentTrail.push({ x: p.x, y: p.y, z: z(p), age: 0 }); r.tracks.scentTrail = r.tracks.scentTrail.slice(-120); }
    }
  }
  if (s.region === 'snowbound' && r.mission.stage === 9) campHelperStep(s, dt, ctx);
  healingStep(s, dt, ctx);
  bulletsStep(s, p.focusActive ? dt * 0.55 : dt, ctx);
  if (!r.mission.completed) for (const actor of [p, i, silas, s.horse, thimble]) if (actor && actor.hp <= 0) { safeSetdown(s, ctx); ctx.fail(s, `${actor.name || actor.id} did not survive the rescue.`); break; }
  r.performance.eligibleNoBites = r.retryCount === 0;
  r.performance.accuracy80 = r.performance.shots > 0 && r.performance.hits / r.performance.shots >= 0.8;
  r.performance.allWolvesNoBites = r.performance.wolvesKilled === 7 && r.performance.wolfBiteDamage === 0 && r.retryCount === 0;
  objective(s); return s;
}
/** Strict mission-local validation; global identities/residence/attachments/weapons are journey-owned. */
export function validateRescueRecord(s) {
  try {
    const r = rec(s), object = v => v && typeof v === 'object' && !Array.isArray(v), number = (v, lo = 0, hi = 1e7) => Number.isFinite(v) && v >= lo && v <= hi;
    const integer = (v, lo = 0, hi = 1e7) => Number.isInteger(v) && v >= lo && v <= hi;
    const p = v => object(v) && number(v.x, 0, WORLD.width) && number(v.y, 0, WORLD.height) && number(v.z, 0, 108);
    if (!object(r) || !['locked', 'unstarted', 'active', 'completed'].includes(r.status) || !integer(r.retryCount, 0, 100000) || !(r.checkpointId === null || typeof r.checkpointId === 'string')) return false;
    const m = r.mission;
    if (!object(m) || m.id !== RESCUE_ID || m.name !== 'A Voice Under Ice' || m.stageCount !== 10 || !integer(m.stage, 0, 9) || typeof m.completed !== 'boolean' || typeof m.rewardPaid !== 'boolean' || typeof m.objective !== 'string' || m.objective.length > 1500) return false;
    if (m.completed !== (r.status === 'completed') || m.rewardPaid !== m.completed || m.completed && m.stage !== 9 || ['locked', 'unstarted'].includes(r.status) && m.stage !== 0) return false;
    const f = r.flags, initial = createRescueRecord();
    if (!object(f) || Object.keys(f).length !== Object.keys(initial.flags).length) return false;
    for (const [key, example] of Object.entries(initial.flags)) if (typeof example === 'boolean' ? typeof f[key] !== 'boolean' : !integer(f[key], 0, 20)) return false;
    if (f.routeIndex > WORLD.trail.length || f.searchIndex > WORLD.searchRoute.length || f.descentIndex > 3 || f.loadingIndex > WORLD.loadingRoute.length || f.deliveryIndex > WORLD.camp.deliveryRoute.length || f.retreatIndex > WORLD.retreatRoute.length || f.inezRouteIndex > 5 || f.descentPlayerIndex > 3 || f.descentInezIndex > 3 || f.descentPlayerIndex < f.descentIndex || f.descentInezIndex < f.descentIndex || f.descentPlayerIndex > f.descentIndex + 1 || f.descentInezIndex > f.descentIndex + 1) return false;
    if (!object(r.timers) || Object.keys(r.timers).length !== Object.keys(initial.timers).length || Object.keys(initial.timers).some(key => !number(r.timers[key]))) return false;
    if (!object(r.performance) || !['shots', 'hits', 'wolvesKilled', 'triggerSerial'].every(key => integer(r.performance[key])) || !number(r.performance.wolfBiteDamage) || r.performance.hits > r.performance.shots || r.performance.triggerSerial !== r.performance.shots || r.performance.wolvesKilled > 7 || !['allWolvesNoBites', 'accuracy80', 'eligibleNoBites'].every(key => typeof r.performance[key] === 'boolean')) return false;
    if (!Array.isArray(r.performance.hitTriggers) || r.performance.hitTriggers.length !== r.performance.hits || new Set(r.performance.hitTriggers).size !== r.performance.hitTriggers.length || r.performance.hitTriggers.some(n => !integer(n, 1, r.performance.triggerSerial))) return false;
    if (!object(r.transactions)) return false;
    for (const [key, t] of Object.entries(r.transactions)) { const suffix = key.slice(RESCUE_ID.length + 1); if (!key.startsWith(`${RESCUE_ID}:`) || !Object.hasOwn(transactionKinds, suffix) || !object(t) || t.completed !== true || t.amount !== transactionKinds[suffix] || Object.keys(t).length !== 2) return false; }
    const has = id => !!r.transactions[`${RESCUE_ID}:${id}`];
    for (const suffix of ['warm-ration', 'rescue-dressing', 'signal-cartridge', 'inez-flask']) if ((has(`use:${suffix}`) || has(`return:${suffix}`)) && !has(`grant:${suffix}`) || has(`use:${suffix}`) && has(`return:${suffix}`)) return false;
    if (has('return:rescue-rope') && !has('grant:rescue-rope') || has('reward:coach-gun-ownership') && !has('grant:coach-gun-loan') || has('trust:secured-dispatch-recovery') !== has('grant:dispatch-case')) return false;
    if (!object(r.choices) || ![null, 'warm-ration', 'inez-flask'].includes(r.choices.provision) || ![null, 'secured-recovery', 'omitted'].includes(r.choices.case)) return false;
    if (!object(r.traversal) || !p(r.traversal.safePoint)) return false;
    for (const key of ['player', 'inez']) {
      const t = r.traversal[key]; if (t === null) continue;
      const edges = [...WORLD.climbs, WORLD.brace, ...WORLD.descents, { id: 'low-arch', from: WORLD.brace.to, to: WORLD.ropeAnchor, duration: 1.8 }], edge = edges.find(e => e.id === t?.edgeId);
      if (!object(t) || !edge || !['climb', 'brace', 'crouch', 'carry-descent', 'climb-down'].includes(t.kind) || !p(t.from) || !p(t.to) || !number(t.progress, 0, 1) || !number(t.age, 0, t.duration) || t.duration !== edge.duration || Math.abs(t.progress - t.age / t.duration) > 1e-8 || dist(t.to, edge.to) > 0.01 || z(t.to) !== z(edge.to) || !near(t.from, edge.from, 50)) return false;
      if (m.stage < 5 || m.stage > 6 || key === 'player' && t.kind === 'carry-descent' || t.from.z !== edge.from.z) return false;
      const climbIndex = WORLD.climbs.findIndex(e => e.id === t.edgeId), descentIndex = WORLD.descents.findIndex(e => e.id === t.edgeId);
      if (descentIndex >= 0) {
        if (m.stage !== 6 || !f.stabilized || !f.breathingChecked || f.inezRouteIndex !== 5 || descentIndex !== f.descentIndex || t.kind !== (key === 'player' ? 'climb-down' : 'carry-descent')) return false;
        if (key === 'player' && f.descentInezIndex !== f.descentIndex + 1 || !s.failure && (s.entities.silas.attachment?.type !== 'carried' || s.entities.silas.attachment.targetId !== 'inez')) return false;
      } else {
        const flag = climbIndex >= 0 ? ['firstClimb', 'secondClimb', 'recessClimbed'][climbIndex] : t.edgeId === WORLD.brace.id ? 'braced' : 'archPassed';
        const required = climbIndex === 0 ? f.coachRetrieved : climbIndex === 1 ? f.firstClimb : climbIndex === 2 ? f.ropeSecured && f.archPassed : t.edgeId === WORLD.brace.id ? f.secondClimb : f.braced;
        const kind = climbIndex >= 0 ? 'climb' : t.edgeId === WORLD.brace.id ? 'brace' : 'crouch';
        const npcIndex = climbIndex === 0 ? 0 : climbIndex === 1 ? 1 : t.edgeId === WORLD.brace.id ? 2 : t.edgeId === 'low-arch' ? 3 : 4;
        if (t.kind !== kind || !required || key === 'player' && (m.stage !== 5 || f[flag]) || key === 'inez' && (!f[flag] || f.inezRouteIndex !== npcIndex)) return false;
      }
    }
    if (!object(r.rescue) || !object(r.rescue.silas) || !['stabilized', 'careScheduled'].every(k => typeof r.rescue.silas[k] === 'boolean') || !['injury', 'exposure', 'trust', 'healingHours'].every(k => number(r.rescue.silas[k], 0, k === 'trust' ? 20 : 10000)) || !object(r.rescue.flask) || r.rescue.flask.ownerId !== 'inez' || !integer(r.rescue.flask.servings, 0, 1) || !['loadingDistance', 'helperDistance', 'inezTrust'].every(k => number(r.rescue[k]))) return false;
    if (r.rescue.silas.stabilized !== f.stabilized || f.flaskUsed !== has('use:inez-flask') || f.rationUsed !== has('use:warm-ration') || f.stabilized !== has('use:rescue-dressing') || f.caseCollected !== has('grant:dispatch-case') || f.coachRewarded !== has('reward:coach-gun-ownership')) return false;
    if (!object(r.tracks) || !object(r.tracks.inspected) || Object.keys(r.tracks.inspected).length !== Object.keys(initial.tracks.inspected).length || Object.keys(initial.tracks.inspected).some(k => typeof r.tracks.inspected[k] !== 'boolean') || !Array.isArray(r.tracks.scentTrail) || r.tracks.scentTrail.length > 120 || r.tracks.scentTrail.some(v => !p(v) || !number(v.age)) || !number(r.tracks.sampleTimer, 0, 1)) return false;
    const c = r.tracks.creek; if (!object(c) || !number(c.copper) || !number(c.thimble) || !integer(c.nodeIndex, 0, WORLD.creekRoute.length) || !integer(c.prematureExits) || ![c.previousCopper, c.previousThimble].every(v => v === null || p(v))) return false;
    if (!Array.isArray(r.predators) || r.predators.length !== 7 || new Set(r.predators.map(w => w.id)).size !== 7) return false;
    for (const authored of WORLD.predators) {
      const ai = r.predators.find(w => w.id === authored.id);
      if (!object(ai) || ai.role !== authored.role || ai.wave !== authored.wave || !['dormant', 'assess', 'stalk', 'charge', 'bite', 'flee', 'fled', 'dead'].includes(ai.phase) || !(ai.targetId === null || ['mara', 'copper', 'inez', 'thimble'].includes(ai.targetId)) || !number(ai.age) || !number(ai.biteCooldown, 0, 1.5) || !number(ai.noise, 0, 12) || typeof ai.wounded !== 'boolean' || typeof ai.killed !== 'boolean' || ai.killed !== (ai.phase === 'dead') || !Array.isArray(ai.route) || ai.route.length > 1000 || ai.route.some(v => !p(v))) return false;
    }
    if (r.performance.wolvesKilled !== r.predators.filter(w => w.killed).length) return false;
    if (m.stage >= 1 && (!f.briefed || !f.kitGranted || !['coach-gun-loan', 'coach-shells', 'warm-ration', 'rescue-dressing', 'rescue-rope', 'signal-cartridge', 'inez-flask'].every(id => has(`grant:${id}`)))) return false;
    if (m.stage >= 2 && (!f.tomasUrged || !f.inezVolunteered || !f.coachInspected || !f.northEntered) || m.stage >= 3 && (!f.ashConfirmed || !['ash-embers', 'bootprints', 'paper-wrapper'].every(k => r.tracks.inspected[k])) || m.stage >= 4 && (!f.fordConfirmed || !r.tracks.inspected['ford-exit'] || !r.tracks.inspected['ford-scrape'])) return false;
    if (m.stage >= 5 && (!f.larkInspected || !f.signalFired || !f.signalAnswered || !f.mountsHitched) || m.stage >= 6 && (!f.coachRetrieved || !f.firstClimb || !f.secondClimb || !f.braced || !f.archPassed || !f.ropeSecured || !f.recessClimbed)) return false;
    if (m.stage >= 7 && (!f.stabilized || !f.breathingChecked || f.descentIndex !== 3) || m.stage >= 8 && (!f.loadingHandoff || !f.loaded || !f.strapped || !f.mountedRetreat || r.rescue.loadingDistance < 100) || m.stage >= 9 && (!f.creekConcealed || !f.leftBankExited || !f.returned)) return false;
    if (m.completed && (kitUnusedTotal(s) !== 0 || r.rescue.flask.servings !== 0 || !r.rescue.silas.careScheduled)) return false;
    if (m.completed && !['helpersReceived', 'delivered', 'familyReunited', 'tomasThanked', 'dellaRecorded', 'journalWritten', 'coachRewarded', 'kitReturned'].every(k => f[k])) return false;
    const earliest = { coachInspected: 1, northEntered: 2, ashConfirmed: 3, fordConfirmed: 4, larkInspected: 4, signalFired: 4, signalAnswered: 4, mountsHitched: 5, coachRetrieved: 5, firstClimb: 5, secondClimb: 5, braced: 5, archPassed: 5, ropeSecured: 5, recessClimbed: 6, listenedToSilas: 6, breathingChecked: 6, stabilized: 6, securedAtPad: 6, caseCollected: 6, loadingHandoff: 7, diversion: 7, loaded: 7, strapped: 7, mountedRetreat: 8, waveOne: 8, waveTwo: 8, creekConcealed: 8, leftBankExited: 8, iceCollapsed: 8, returned: 9, unloaded: 9, helpersReceived: 9, delivered: 9, familyReunited: 9, tomasThanked: 9, dellaRecorded: 9, journalWritten: 9, kitReturned: 9, coachRewarded: 9 };
    if (Object.entries(earliest).some(([key, stage]) => f[key] && m.stage < stage)) return false;
    for (const [key, previous] of [['secondClimb', 'firstClimb'], ['braced', 'secondClimb'], ['archPassed', 'braced'], ['ropeSecured', 'archPassed'], ['recessClimbed', 'ropeSecured'], ['signalAnswered', 'signalFired'], ['stabilized', 'breathingChecked'], ['caseCollected', 'stabilized'], ['loaded', 'loadingHandoff'], ['strapped', 'loaded'], ['waveTwo', 'waveOne'], ['creekConcealed', 'waveTwo'], ['leftBankExited', 'creekConcealed']]) if (f[key] && !f[previous]) return false;
    for (const [n, flag] of ['firstClimb', 'secondClimb', 'braced', 'archPassed', 'recessClimbed'].entries()) if (f.inezRouteIndex > n && !f[flag]) return false;
    if (f.descentIndex > 0 && m.stage < 6 || f.descentIndex === 3 && m.stage < 7 || f.loadingIndex > 0 && !f.loadingHandoff || f.loaded && r.rescue.loadingDistance < 100) return false;
    for (const ai of r.predators) if (ai.phase !== 'dormant' && (ai.wave === 0 && !f.loadingHandoff || ai.wave === 1 && !f.waveOne || ai.wave === 2 && !f.waveTwo)) return false;
    if (!validRescueDialog(s)) return false;
    const kit = [['warm-ration', 'warmRation'], ['rescue-dressing', 'rescueDressing'], ['rescue-rope', 'rescueRope'], ['signal-cartridge', 'signalCartridge']];
    for (const [suffix, item] of kit) {
      const expected = Number(has(`grant:${suffix}`)) - Number(has(`use:${suffix}`)) - Number(has(`return:${suffix}`));
      if (itemTotal(s, item) !== expected) return false;
    }
    if (itemTotal(s, 'dispatchCase') !== Number(has('grant:dispatch-case')) || r.rescue.flask.servings !== Number(has('grant:inez-flask')) - Number(has('use:inez-flask')) - Number(has('return:inez-flask'))) return false;
    const gun = s.weapons['coach-gun'];
    if (has('grant:coach-gun-loan')) {
      if (!gun || gun.kind !== 'coach-gun' || gun.capacity !== 2 || gun.ammoType !== 'coach-shell' || gun.owner !== (m.completed ? 'mara' : 'community-rescue-chest') || gun.loanMissionId !== (m.completed ? null : RESCUE_ID) || !has('grant:coach-shells')) return false;
    } else if (gun) return false;
    if (f.caseCollected && r.choices.case !== 'secured-recovery' || f.caseLost && (f.caseCollected || r.choices.case !== 'omitted') || f.listenedToSilas !== has('trust:listened-to-silas') || r.rescue.silas.healingHours > 36 || !m.completed && r.rescue.silas.careScheduled) return false;
    if (f.iceCollapsed !== !!s.regions[WORLD.id].worldChanges.upperIceClosed) return false;
    if (active(s)) {
      const player = s.entities.mara, inez = s.entities.inez;
      if (s.region === 'snowbound' && z(player) !== 0 || z(s.entities.copper) !== 0 || z(s.entities.thimble) !== 0) return false;
      if (s.region === WORLD.id) {
        const floor = m.stage < 5 || m.stage >= 7 ? 0 : m.stage === 5 ? f.secondClimb ? 72 : f.firstClimb ? 36 : 0 : [108, 72, 36, 0][f.descentPlayerIndex];
        const companionFloor = m.stage < 5 || m.stage >= 7 ? 0 : m.stage === 5 ? [0, 36, 72, 72, 72, 108][f.inezRouteIndex] : f.inezRouteIndex < 5 ? [0, 36, 72, 72, 72][f.inezRouteIndex] : [108, 72, 36, 0][f.descentInezIndex];
        for (const [body, t, expected] of [[player, r.traversal.player, floor], [inez, r.traversal.inez, companionFloor]]) {
          if (!t && z(body) !== expected) return false;
          if (t) { const u = t.progress * t.progress * (3 - 2 * t.progress); if (Math.abs(z(body) - (t.from.z + (t.to.z - t.from.z) * u)) > 1e-7 || Math.abs(body.x - (t.from.x + (t.to.x - t.from.x) * u)) > 1e-6 || Math.abs(body.y - (t.from.y + (t.to.y - t.from.y) * u)) > 1e-6) return false; }
        }
      }
      const patient = s.entities.silas;
      if (!s.failure && (m.stage === 8 || m.stage === 9 && !f.unloaded) && (patient.attachment?.type !== 'passenger' || patient.attachment.targetId !== 'thimble' || !patient.attachment.strap)) return false;
      if (!s.failure && f.securedAtPad && patient.attachment?.targetId !== WORLD.restPad.id) return false;
      if (m.completed && (patient.attachment?.type !== 'rest' || patient.attachment.targetId !== 'silas-bed' || !r.rescue.silas.careScheduled)) return false;
    }
    if (r.status !== 'locked') for (const id of RESCUE_ENTITY_IDS) if (!s.entities?.[id]) return false;
    if (r.status !== 'locked') {
      for (const body of RESCUE_CAST) {
        const saved = s.entities[body.id], category = body.id === 'thimble' ? 'mount' : body.id === 'lark' ? 'animal' : 'npc';
        if (saved.category !== category || saved.name !== body.name || body.id === 'fin' && saved.child !== true) return false;
      }
      if (s.entities.thimble.kind !== 'horse' || s.entities.thimble.ownerId !== 'inez' || s.entities.lark.kind !== 'horse' || s.entities.lark.hp !== 0 || s.entities.lark.dead !== true) return false;
      for (const body of WORLD.predators) { const saved = s.entities[body.id]; if (saved.category !== 'enemy' || saved.kind !== 'wolf' || saved.wave !== body.wave || saved.role !== body.role) return false; }
    }
    return true;
  } catch { return false; }
}
function validRescueDialog(s) {
  const d = s.dialog, r = rec(s); if (!d) return true;
  // Completed rescue still owns the camp clock during the hunt's prelude.
  // The authored Hunt scene is validated by its own strict mission validator.
  if (r.mission.completed && d.id?.startsWith('hunt') && ['unstarted', 'active'].includes(s.campaign.missions['snowbound-a-quiet-table']?.status)) return true;
  if (!active(s) && !d.id?.startsWith('rescue')) return true;
  if (!Array.isArray(d.choices) || typeof d.id !== 'string') return false;
  const ids = d.choices.map(c => c.id), exact = expected => ids.length === expected.length && ids.every((id, n) => id === expected[n]);
  const f = r.flags, stage = r.mission.stage;
  if (d.id === 'mission-failed') return !!s.failure && d.speaker === 'A Voice Under Ice · Checkpoint' && exact(['retry', 'restart', ...(s.campaign.replayMissionId === RESCUE_ID ? ['finish-replay'] : [])]);
  if (d.id === 'rescue-briefing') return stage === 0 && !f.briefed && f.elinMet && ['unstarted', 'active'].includes(r.status) && d.speaker === 'Elin Orr' && (exact(['ask:departure', 'accept-rescue', 'leave']) || exact(['accept-rescue', 'leave']));
  if (!active(s) && !r.mission.completed) return false;
  if (!active(s) && !['rescue-repair-request'].includes(d.id) && !d.id.startsWith('rescue-aftermath-')) return false;
  if (d.id === 'rescue-postpone') return stage === 1 && d.speaker === 'Elin Orr' && exact(unusedKit(s) ? ['postpone-rescue', 'leave'] : ['leave']);
  const scenes = {
    'rescue-urge': [stage === 1 && f.tomasUrged && !f.inezVolunteered, 'Tomas Reed'],
    'rescue-companion': [stage === 1 && f.tomasUrged && f.inezVolunteered, 'Inez Pike'],
    'rescue-lark': [stage === 4 && f.larkInspected && !f.signalFired, 'Inez Pike'],
    'rescue-reunion': [stage === 6 && f.listenedToSilas, 'Silas Orr'],
    'rescue-family': [stage === 9 && f.familyReunited && f.delivered, 'Elin Orr'],
    'rescue-tomas': [stage === 9 && f.tomasThanked && f.familyReunited, 'Tomas Reed'],
    'rescue-ledger': [stage === 9 && f.dellaRecorded && f.tomasThanked, 'Della Wren'],
  };
  if (scenes[d.id]) return scenes[d.id][0] && d.speaker === scenes[d.id][1] && exact(['leave']);
  if (d.id === 'rescue-repair-request') return r.mission.completed && !s.entities.silas.coatRepaired && d.speaker === 'Elin Orr' && exact(s.camp.materials > 0 ? ['repair-coat', 'leave'] : ['leave']);
  if (d.id.startsWith('rescue-aftermath-')) { const id = d.id.slice(17); return r.mission.completed && ['elin', 'fin', 'silas', 'della', 'inez', 'tomas'].includes(id) && d.speaker === s.entities[id]?.name && exact(['leave']); }
  return false;
}
