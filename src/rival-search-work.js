/** Physical cap and paper work for new operation histories. Older v4 histories
 * keep their already-earned custody and acquire no invented contact receipts. */
import { RIVAL_ID, RIVAL_WORLD as W } from '../content/campaign/bellwether-works.js';

export const PHYSICAL_SEARCH_TRANSACTION_KEYS = ['search:cap-tin', 'search:papers', 'handoff:cap-tin', 'handoff:papers'];
export const SEARCH_WORK = Object.freeze({
  cap: Object.freeze({ seconds: 1.5, handoffSeconds: 1.2, point: W.searchSites.capTin.workpoint }),
  papers: Object.freeze({ seconds: 1.5, handoffSeconds: 1.25, point: W.searchSites.plans.workpoint }),
});
const texts = Object.freeze({
  ruthAssigned: 'Ruth heads for the cap wagon. Keep the tin shut until she checks it.',
  maraAssigned: 'Keep beside the wagon while Mara checks its closed copper tin.',
  bastianAssigned: 'Bastian heads for the ledger desk to search the weighhouse.',
  capFound: 'Ruth has found the closed copper tin. She is taking it to the magazine.',
  capCarried: 'The copper tin is in Mara’s hands. Bring it to Ruth without opening it.',
  capPassed: 'Ruth has the closed tin. She will keep it separate from the charges.',
  papersFound: 'Bastian has found the diagram and the seizure list. Read them with him before he takes them to Tomas.',
  papersPassed: 'Tomas takes the diagram and the seizure list from Bastian.',
});
const record = s => s.campaign.missions[RIVAL_ID];
export const physicalSearchContract = s => record(s).rival.contractVersion === 2;
const workingScene = s => physicalSearchContract(s) && s.campaign.activeMissionId === RIVAL_ID && record(s).mission.stage === 8 && s.region === W.id && !s.dialog && !s.failure;
const point = a => ({ x: a.x, y: a.y, z: a.z || 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, radius) => a && b && Math.abs((a.z || 0) - (b.z || 0)) < 8 && distance(a, b) <= radius;
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const txid = key => `${RIVAL_ID}:${key}`;
const work = s => record(s).rival.searchWork;
function ensure(s) { return record(s).rival.searchWork ||= { schema: 1, cap: null, papers: null }; }
function assignGoal(a, target) { a.goal = point(target); a.route = []; delete a.routeTarget; }
function stop(a) { delete a.goal; a.route = []; delete a.routeTarget; a.vx = 0; a.vy = 0; }
function task(s, actorId) { return { actorId, phase: 'walking', assignedAt: s.elapsed, reachedAt: null, activeSeconds: 0, foundAt: null, foundPosition: null, handoff: null }; }
function receipt(s, key, data) { record(s).transactions[txid(key)] = { completed: true, ...data }; }
function own(s, id, kind, owner) { record(s).objects[id] = { id, kind, owner, location: { type: 'carried', targetId: owner } }; }
function event(s, ctx, kind, target, targetId, actorId) {
  const a = s.entities[actorId];
  ctx.present(s, kind, target, targetId, { ...point(a), facing: a.facing || 0 }, actorId, { sourceId: actorId });
}

export function requestPhysicalSearch(s, site, ctx) {
  if (!workingScene(s)) return false;
  const r = record(s), w = ensure(s);
  if (site === 'cap-wagon') {
    if (w.cap || !near(s.player, W.capTin, 55)) return false;
    r.flags.capWagonRead = true; w.cap = task(s, 'ruth');
    assignGoal(s.entities.ruth, SEARCH_WORK.cap.point); ctx.notice(s, texts.ruthAssigned);
  } else if (site === 'weighhouse') {
    if (w.papers || !near(s.player, W.plans, 55)) return false;
    r.flags.weighhouseRead = true; w.papers = task(s, 'bastian');
    assignGoal(s.entities.bastian, SEARCH_WORK.papers.point); ctx.notice(s, texts.bastianAssigned);
  } else return false;
  return true;
}

export function physicalSearchOffers(s) {
  if (!workingScene(s)) return [];
  const r = record(s), w = work(s), p = s.player, tin = r.objects['cap-tin'], list = [];
  if (!tin && !p.mounted && !p.carrying && (!w?.cap || w.cap.actorId === 'ruth' && w.cap.phase === 'walking')) {
    list.push({ id: 'search:cap-self', label: 'Search the cap wagon and carry its closed tin to Ruth', target: W.capTin, radius: 38 });
  }
  if (tin?.owner === 'mara' && !p.mounted && !p.carrying && !s.entities.ruth.mounted && w?.cap?.phase === 'found') {
    list.push({ id: 'handoff:cap-tin', label: 'Hand the closed copper tin to Ruth', target: s.entities.ruth, radius: 22 });
  }
  return list;
}

export function interactPhysicalSearch(s, id, ctx) {
  if (!workingScene(s)) return false;
  const r = record(s), w = ensure(s), p = s.player;
  if (id === 'search:cap-self') {
    if (r.objects['cap-tin'] || p.mounted || p.carrying || !near(p, W.capTin, 38) || w.cap && !(w.cap.actorId === 'ruth' && w.cap.phase === 'walking')) return false;
    r.flags.capWagonRead = true; w.cap = task(s, 'mara');
    w.cap.phase = 'working'; w.cap.reachedAt = s.elapsed;
    p.holstered = true; p.armed = false;
    event(s, ctx, 'inspect-cap', W.capTin, 'cap-tin', 'mara'); ctx.notice(s, texts.maraAssigned);
    return true;
  }
  if (id === 'handoff:cap-tin') {
    const a = s.entities.ruth, tin = r.objects['cap-tin'];
    if (w.cap?.phase !== 'found' || tin?.owner !== 'mara' || !near(p, a, 22) || p.mounted || a.mounted || p.carrying || a.carrying) return false;
    stop(a); w.cap.phase = 'handing';
    a.holstered = true; a.aiming = false;
    w.cap.handoff = { startedAt: s.elapsed, activeSeconds: 0, finishedAt: null, from: null, to: null };
    const contact = { x: (p.x + a.x) / 2, y: (p.y + a.y) / 2, z: (a.z || 0) + 32 };
    event(s, ctx, 'give-cap', contact, 'cap-tin', 'mara');
    event(s, ctx, 'receive-cap', contact, 'cap-tin', 'ruth');
    return true;
  }
  return false;
}

function advanceTask(s, key, dt, ctx) {
  const r = record(s), t = work(s)?.[key]; if (!t || !['walking', 'working'].includes(t.phase)) return;
  const a = s.entities[t.actorId], definition = SEARCH_WORK[key], target = key === 'cap' ? W.capTin : W.plans;
  const atWork = a?.hp > 0 && a.regionId === W.id && !a.mounted && !a.carrying && !(a.shotTimer > 0) && !(a.reloadTimer > 0) && !a.weaponAction && near(a, definition.point, t.actorId === 'mara' ? 34 : 8);
  if (!atWork) { if (t.phase === 'working') t.activeSeconds = 0; return; }
  if (t.phase === 'walking') {
    t.phase = 'working'; t.reachedAt = s.elapsed; stop(a); a.holstered = true; a.aiming = false;
    event(s, ctx, key === 'cap' ? 'inspect-cap' : 'search', target, key === 'cap' ? 'cap-tin' : 'route-plans', a.id);
    return;
  }
  t.activeSeconds = Math.min(definition.seconds, t.activeSeconds + dt);
  if (t.activeSeconds < definition.seconds) return;
  t.phase = 'found'; t.foundAt = s.elapsed; t.foundPosition = point(a);
  receipt(s, key === 'cap' ? 'search:cap-tin' : 'search:papers', { at: s.elapsed, actorId: a.id, position: point(a) });
  if (key === 'cap') {
    own(s, 'cap-tin', 'cap-tin', a.id);
    if (a.id === 'ruth') { assignGoal(a, W.charge); ctx.notice(s, texts.capFound); }
    else { assignGoal(s.entities.ruth, { x: s.player.x + 12, y: s.player.y + 12, z: s.player.z || 0 }); ctx.notice(s, texts.capCarried); }
  } else {
    for (const id of ['route-diagram', 'seizure-list']) own(s, id, 'document', 'bastian');
    ctx.notice(s, texts.papersFound);
  }
}
function advanceHandoff(s, key, fromId, toId, dt, ctx) {
  const r = record(s), t = work(s)?.[key], a = s.entities[fromId], b = s.entities[toId];
  if (!t) return;
  if (key === 'papers' && t.phase === 'found' && r.flags.plansRead && near(a, b, 22) && !a.mounted && !b.mounted && !a.carrying && !b.carrying) {
    stop(a); stop(b); a.holstered = true; b.holstered = true; a.aiming = false; b.aiming = false;
    t.phase = 'handing'; t.handoff = { startedAt: s.elapsed, activeSeconds: 0, finishedAt: null, from: null, to: null };
    const contact = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (b.z || 0) + 32 };
    event(s, ctx, 'give-plans', contact, 'route-diagram', fromId);
    event(s, ctx, 'receive-plans', contact, 'route-diagram', toId);
    return;
  }
  if (t.phase !== 'handing') return;
  if (!near(a, b, 22) || a.mounted || b.mounted || a.carrying || b.carrying || a.hp <= 0 || b.hp <= 0) { t.handoff.activeSeconds = 0; return; }
  t.handoff.activeSeconds = Math.min(SEARCH_WORK[key].handoffSeconds, t.handoff.activeSeconds + dt);
  if (t.handoff.activeSeconds < SEARCH_WORK[key].handoffSeconds) return;
  t.phase = 'transferred'; t.handoff.finishedAt = s.elapsed; t.handoff.from = point(a); t.handoff.to = point(b);
  receipt(s, key === 'cap' ? 'handoff:cap-tin' : 'handoff:papers', { at: s.elapsed, fromId, toId, from: point(a), to: point(b) });
  for (const id of key === 'cap' ? ['cap-tin'] : ['route-diagram', 'seizure-list']) {
    const o = r.objects[id]; o.owner = toId; o.location = { type: 'carried', targetId: toId };
  }
  if (key === 'cap') { assignGoal(b, W.charge); ctx.notice(s, texts.capPassed); }
  else { r.flags.plansDelivered = true; ctx.notice(s, texts.papersPassed); }
}
export function stepPhysicalSearchWork(s, dt, ctx) {
  if (!workingScene(s) || !work(s)) return;
  advanceTask(s, 'cap', dt, ctx); advanceTask(s, 'papers', dt, ctx);
  advanceHandoff(s, 'cap', 'mara', 'ruth', dt, ctx); advanceHandoff(s, 'papers', 'bastian', 'tomas', dt, ctx);
}

const validPoint = p => object(p) && Object.keys(p).length === 3 && ['x', 'y', 'z'].every(k => Number.isFinite(p[k])) && p.x >= 0 && p.x <= W.width && p.y >= 0 && p.y <= W.height;
const owns = (r, id, owner) => r.objects[id]?.owner === owner && r.objects[id].location?.type === 'carried' && r.objects[id].location.targetId === owner;
function validTask(s, key, t) {
  if (t === null) return true;
  const r = record(s), definition = SEARCH_WORK[key], time = v => Number.isFinite(v) && v >= 0 && v <= s.elapsed;
  if (!object(t) || Object.keys(t).length !== 8 || !(key === 'cap' ? ['mara', 'ruth'] : ['bastian']).includes(t.actorId) || !['walking', 'working', 'found', 'handing', 'transferred'].includes(t.phase) || !time(t.assignedAt) || !Number.isFinite(t.activeSeconds) || t.activeSeconds < 0 || t.activeSeconds > definition.seconds) return false;
  if (t.phase === 'walking') return t.reachedAt === null && t.activeSeconds === 0 && t.foundAt === null && t.foundPosition === null && t.handoff === null;
  if (!time(t.reachedAt) || t.reachedAt < t.assignedAt || t.activeSeconds > s.elapsed - t.reachedAt + 1e-8) return false;
  if (t.phase === 'working') {
    const a = s.entities[t.actorId];
    return t.foundAt === null && t.foundPosition === null && t.handoff === null && (t.activeSeconds === 0 || a?.regionId === W.id && !a.mounted && !a.carrying && near(a, definition.point, t.actorId === 'mara' ? 34 : 8));
  }
  if (!time(t.foundAt) || t.foundAt < t.reachedAt + definition.seconds - 1e-8 || t.activeSeconds !== definition.seconds || !validPoint(t.foundPosition) || !near(t.foundPosition, definition.point, t.actorId === 'mara' ? 34 : 8)) return false;
  const source = r.transactions[txid(key === 'cap' ? 'search:cap-tin' : 'search:papers')];
  if (!source || Object.keys(source).length !== 4 || source.at !== t.foundAt || source.actorId !== t.actorId || JSON.stringify(source.position) !== JSON.stringify(t.foundPosition)) return false;
  if (t.phase === 'found') return t.handoff === null;
  const h = t.handoff;
  if (!object(h) || Object.keys(h).length !== 5 || !time(h.startedAt) || h.startedAt < t.foundAt || !Number.isFinite(h.activeSeconds) || h.activeSeconds < 0 || h.activeSeconds > definition.handoffSeconds || h.activeSeconds > s.elapsed - h.startedAt + 1e-8 || key === 'cap' && t.actorId !== 'mara' || key === 'papers' && !r.flags.plansRead) return false;
  if (t.phase === 'handing') {
    const a = s.entities[key === 'cap' ? 'mara' : 'bastian'], b = s.entities[key === 'cap' ? 'ruth' : 'tomas'];
    return h.finishedAt === null && h.from === null && h.to === null && (h.activeSeconds === 0 || near(a, b, 22) && !a.mounted && !b.mounted && !a.carrying && !b.carrying);
  }
  const transfer = r.transactions[txid(key === 'cap' ? 'handoff:cap-tin' : 'handoff:papers')];
  return time(h.finishedAt) && h.finishedAt >= h.startedAt + definition.handoffSeconds - 1e-8 && h.activeSeconds === definition.handoffSeconds && validPoint(h.from) && validPoint(h.to) && near(h.from, h.to, 22) && transfer && Object.keys(transfer).length === 6 && transfer.at === h.finishedAt && transfer.fromId === (key === 'cap' ? 'mara' : 'bastian') && transfer.toId === (key === 'cap' ? 'ruth' : 'tomas') && JSON.stringify(transfer.from) === JSON.stringify(h.from) && JSON.stringify(transfer.to) === JSON.stringify(h.to);
}
export function validatePhysicalSearchWork(s) {
  const r = record(s), w = work(s), keys = PHYSICAL_SEARCH_TRANSACTION_KEYS.map(txid);
  if (r.rival.contractVersion !== undefined && r.rival.contractVersion !== 2) return false;
  if (!physicalSearchContract(s)) return w === undefined && keys.every(key => !r.transactions[key]);
  if (w === undefined) return !r.flags.capWagonRead && !r.flags.weighhouseRead && !r.objects['cap-tin'] && !r.objects['route-diagram'] && !r.objects['seizure-list'] && keys.every(key => !r.transactions[key]);
  if (!object(w) || Object.keys(w).length !== 3 || w.schema !== 1 || r.mission.stage < 8 || !validTask(s, 'cap', w.cap) || !validTask(s, 'papers', w.papers) || r.flags.capWagonRead !== !!w.cap || r.flags.weighhouseRead !== !!w.papers) return false;
  const acquired = t => t && ['found', 'handing', 'transferred'].includes(t.phase);
  for (const [key, t] of [['cap', w.cap], ['papers', w.papers]]) {
    const found = !!acquired(t), transferred = t?.phase === 'transferred';
    if (Boolean(r.transactions[txid(key === 'cap' ? 'search:cap-tin' : 'search:papers')]) !== found || Boolean(r.transactions[txid(key === 'cap' ? 'handoff:cap-tin' : 'handoff:papers')]) !== transferred) return false;
    const ids = key === 'cap' ? ['cap-tin'] : ['route-diagram', 'seizure-list'];
    if (ids.some(id => Boolean(r.objects[id]) !== found || found && r.objects[id].kind !== (key === 'cap' ? 'cap-tin' : 'document'))) return false;
    if (!found) continue;
    const owner = key === 'cap' ? transferred ? 'ruth' : t.actorId : transferred ? r.aftermath?.holding?.visit2?.borrowed ? 'mara' : 'tomas' : 'bastian';
    if (ids.some(id => key === 'cap' && r.flags.chargesStored ? r.objects[id].owner !== 'ruth' || r.objects[id].location.type !== 'station' || r.objects[id].location.targetId !== W.camp.charges.id : !owns(r, id, owner))) return false;
  }
  if (r.flags.plansRead && !acquired(w.papers) || r.flags.plansDelivered !== (w.papers?.phase === 'transferred')) return false;
  if (r.mission.stage >= 9 && (!acquired(w.cap) || w.cap.actorId === 'mara' && w.cap.phase !== 'transferred' || w.papers?.phase !== 'transferred')) return false;
  return true;
}
