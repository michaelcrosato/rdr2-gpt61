/** Persistent campaign graph. Region/mission views never own duplicate bodies. */
import * as Opening from './campaign.js';
import * as Rescue from './rescue-mission.js';
import * as Hunt from './hunt-mission.js';
import * as Rival from './rival-mission.js';
import * as Train from './train-mission.js';
import {enableRivalContinuation,validateRivalContinuation,legacyContinuationFieldsAbsent} from './rival-continuation.js';
import {advanceRivalHolding} from './rival-aftermath.js';
import {recordCustodyShot} from './rival-weapon-custody.js';
import {activeRivalWeaponLoan} from './rival-weapon-loan.js';
import { SNOWBOUND_WORLD, SNOWBOUND_CAST, CAMPAIGN_ITEMS } from '../content/campaign/snowbound.js';
import { NORTH_CUTTING_WORLD, RESCUE_CAST, RESCUE_ITEMS } from '../content/campaign/north-cutting.js';
import { WILLOW_RUN_WORLD, HUNT_CAST, HUNT_ANIMALS, HUNT_ITEMS, HUNT_BOW } from '../content/campaign/willow-run.js';
import { RIVAL_WORLD, RIVAL_CAST, RIVAL_ENEMIES, RIVAL_ITEMS, RIVAL_CARBINE } from '../content/campaign/bellwether-works.js';
import {TRAIN_MASK_ID,validateTrainGear,validateTrainGearInstance} from './train-gear.js';
import {TRAIN_WORLD} from '../content/campaign/brass-cutting.js';

const OPENING_ID = 'snowbound-the-last-warm-light';
const GAME_ID = 'dust-and-mercy';
export const CURRENT_CAMPAIGN_VERSION=5;
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const adapters = new WeakMap();
const trainStepCheckpoints=new WeakMap();
const regions = { snowbound: SNOWBOUND_WORLD, 'north-cutting': NORTH_CUTTING_WORLD, 'willow-run': WILLOW_RUN_WORLD, 'bellwether-works': RIVAL_WORLD, [TRAIN_WORLD.id]:TRAIN_WORLD };
const huntPreyIds = new Set(HUNT_ANIMALS.filter(actor => actor.kind === 'deer').map(actor => actor.id));
const isDeadPrey = actor => actor && huntPreyIds.has(actor.id) && actor.kind === 'deer' && actor.hp === 0 && actor.dead === true;
const isCarcass = actor => isDeadPrey(actor) && !actor.processed;
const rescueCampWorld = { ...SNOWBOUND_WORLD,
  interiors: [...SNOWBOUND_WORLD.interiors, ...NORTH_CUTTING_WORLD.camp.interiors],
  obstacles: [...SNOWBOUND_WORLD.obstacles, ...NORTH_CUTTING_WORLD.camp.obstacles],
  props: [...SNOWBOUND_WORLD.props, ...NORTH_CUTTING_WORLD.camp.props],
  places: [...SNOWBOUND_WORLD.places, { id: 'medical-shelter', name: 'Medical Shelter', ...NORTH_CUTTING_WORLD.camp.bed }, { id: 'northern-gate', name: 'Northern Trail', ...NORTH_CUTTING_WORLD.camp.gate }],
};
const huntCampWorld = { ...rescueCampWorld,
  interiors: [...rescueCampWorld.interiors, ...WILLOW_RUN_WORLD.camp.interiors],
  obstacles: [...rescueCampWorld.obstacles, ...WILLOW_RUN_WORLD.camp.obstacles],
  props: [...rescueCampWorld.props, ...WILLOW_RUN_WORLD.camp.props],
  places: [...rescueCampWorld.places, { id: 'drying-shed-kitchen', name: 'Orla’s Kitchen', ...WILLOW_RUN_WORLD.camp.doorway }],
};
const rivalCampWorld = { ...huntCampWorld,
  interiors: [...huntCampWorld.interiors, ...RIVAL_WORLD.camp.interiors],
  obstacles: [...huntCampWorld.obstacles, ...RIVAL_WORLD.camp.obstacles],
  props: [...huntCampWorld.props, ...RIVAL_WORLD.camp.props],
  places: [...huntCampWorld.places, {id:'rival-stove-room',name:'Cooperative Stove Room',...RIVAL_WORLD.camp.briefing}, {id:'rival-tack-room',name:'Guarded Tack Room',...RIVAL_WORLD.camp.holding}, {id:'bellwether-camp-gate',name:'Bellwether Cart Trail',...RIVAL_WORLD.travelGate}],
};
const ROOT_VIEWS = ['player', 'horse', 'npcs', 'enemies', 'animals', 'mounts', 'mission', 'flags', 'timers', 'performance', 'worldChanges', 'supplies', 'dropped', 'checkpoint', 'traversal', 'rescue', 'tracks', 'predators', 'hunt', 'bow', 'processing', 'rival', 'focus', 'scope', 'captivity', 'rope','train'];
const CORE_KEYS = ['seed', 'elapsed', 'day', 'time', 'weather', 'inventory', 'companions', 'camp', 'sideQuests', 'wanted', 'honor', 'stats', 'failure', 'dialog', 'log', 'notices', 'bullets', 'lastSave'];
const openingShape = Opening.createCampaignState();
const openingNpcIds = new Set(SNOWBOUND_CAST.map(actor => actor.id));
const openingEnemyIds = new Set(openingShape.enemies.map(actor => actor.id));

const baseWorldForCampaign = s => s.region === 'snowbound' && s.campaign?.missions[Rival.RIVAL_ID] && s.campaign.missions[Rival.RIVAL_ID].status !== 'locked' ? rivalCampWorld : s.region === 'snowbound' && s.campaign?.missions[Hunt.HUNT_ID]?.status !== 'locked' && s.campaign?.missions[Hunt.HUNT_ID] ? huntCampWorld : s.region === 'snowbound' && s.campaign?.missions[Rescue.RESCUE_ID]?.status !== 'locked' ? rescueCampWorld : regions[s.region];
export function worldForCampaign(s){
  const base=baseWorldForCampaign(s);
  if(typeof Train.worldForTrainCamp==='function')return Train.worldForTrainCamp(s,base);
  if(s.campaign?.missions[Train.TRAIN_ID]?.train?.briefing?.setup?.finishedAt!=null)throw new TypeError('The actual prepared table requires its owning camp world');
  return base;
}
const version2Items = { ...CAMPAIGN_ITEMS, ...RESCUE_ITEMS };
const version3Items = { ...version2Items, ...HUNT_ITEMS };
const version4Items={...version3Items,...RIVAL_ITEMS};
export const campaignItems = { ...version4Items,...Train.TRAIN_ITEMS };
const recordFor = s => s.campaign.missions[s.campaign.activeMissionId];
function notice(s, text) { s.notices.push({ text, time: 6 }); s.notices = s.notices.slice(-5); }
function log(s, text) { s.log.push({ day: s.day, time: s.time, text }); s.log = s.log.slice(-100); }
function talk(s, id, speaker, text, choices) { s.dialog = { id, speaker, text, choices: choices.map(([id, label]) => ({ id, label })) }; }

export function entityRegion(s, actor, visited = new Set()) {
  if (!actor || visited.has(actor.id)) return null;
  if (!actor.attachment) return actor.regionId;
  if (actor.attachment.type === 'rest') return actor.attachment.regionId || s.region;
  visited.add(actor.id);
  return entityRegion(s, s.entities[actor.attachment.targetId], visited);
}
function actors(s, category) { return Object.values(s.entities).filter(actor => actor.category === category && entityRegion(s, actor) === s.region); }
function bindWeapon(s) {
  const player = s.entities[s.party.playerId];
  for (const key of ['ammo', 'reserve']) Object.defineProperty(player, key, { configurable: true, enumerable: false,
    get() { return s.weapons[player.equippedWeaponId]?.[key] ?? 0; },
    set(value) { const weapon = s.weapons[player.equippedWeaponId]; if (weapon) weapon[key] = value; } });
}
function bind(s) {
  const view = (key, get, set = null) => Object.defineProperty(s, key, { configurable: true, enumerable: false, get, ...(set ? { set } : {}) });
  view('player', () => s.entities[s.party.playerId]);
  view('horse', () => s.entities[s.party.mountId]);
  for (const [key, category] of [['npcs', 'npc'], ['enemies', 'enemy'], ['animals', 'animal'], ['mounts', 'mount']]) {
    view(key, () => actors(s, category).filter(actor => key !== 'mounts' || actor.id !== s.party.mountId));
  }
  // Owned Copper still appears in the compatibility animal view, by identity.
  view('animals', () => [...actors(s, 'animal'), ...(s.party.mountId === 'copper' && entityRegion(s, s.horse) === s.region ? [s.horse] : [])]);
  for (const key of ['mission', 'flags', 'timers', 'performance', 'traversal', 'rescue', 'tracks', 'predators', 'hunt', 'bow', 'processing']) view(key, () => recordFor(s)[key], value => { recordFor(s)[key] = value; });
  for (const key of ['rival', 'focus', 'scope', 'captivity', 'rope']) view(key, () => s.campaign.missions[Rival.RIVAL_ID]?.[key], value => { if(s.campaign.missions[Rival.RIVAL_ID]) s.campaign.missions[Rival.RIVAL_ID][key] = value; });
  view('train',()=>s.campaign.missions[Train.TRAIN_ID]?.train,value=>{if(s.campaign.missions[Train.TRAIN_ID])s.campaign.missions[Train.TRAIN_ID].train=value;});
  for (const key of ['worldChanges', 'supplies', 'dropped']) view(key, () => s.regions[s.region][key], value => { s.regions[s.region][key] = value; });
  view('checkpoint', () => s.checkpoints?.[recordFor(s).checkpointId] || null);
  for (const [id, key] of [['mara', 'player'], ['inez', 'inez']]) {
    const actor = s.entities[id];
    Object.defineProperty(actor, 'traversal', { configurable: true, enumerable: false,
      get() { return s.campaign.activeMissionId === Rescue.RESCUE_ID ? s.campaign.missions[Rescue.RESCUE_ID].traversal[key] : null; },
      set(value) { if (s.campaign.activeMissionId === Rescue.RESCUE_ID) s.campaign.missions[Rescue.RESCUE_ID].traversal[key] = value; } });
  }
  for (const actor of Object.values(s.entities)) if (actor.kind === 'horse' || actor.category === 'mount') {
    delete actor.largeLoad;
    Object.defineProperty(actor, 'largeLoad', { configurable: true, enumerable: false, get() { return Object.values(s.entities).find(body => body.attachment?.type === 'large-load' && body.attachment.targetId === actor.id)?.id || null; } });
  }
  bindWeapon(s);
  syncAttachments(s);
  return s;
}
function addEntity(s, body, regionId, category) {
  if (s.entities[body.id]) return s.entities[body.id];
  if (!regions[regionId]) throw new Error('Unknown campaign region');
  const horseDefaults = body.kind === 'horse' || category === 'mount' ? { stamina: body.hp > 0 ? 100 : 0, fear: 0, bond: 1, owned: false, pack: {} } : {};
  const actor = { ...horseDefaults, ...copy(body), z: body.z || 0, regionId, category, attachment: null };
  delete actor.largeLoad;
  s.entities[actor.id] = actor;
  if (actor.kind === 'horse' || actor.category === 'mount') Object.defineProperty(actor, 'largeLoad', { configurable: true, enumerable: false, get() { return Object.values(s.entities).find(body => body.attachment?.type === 'large-load' && body.attachment.targetId === actor.id)?.id || null; } });
  s.regions[regionId].residentIds.push(actor.id);
  return actor;
}
function anchor(s, attachment) {
  const world = regions[attachment.regionId || s.region];
  return [...(world.anchors || []), ...(world.props || []), ...(world.restPads || []), ...(world.id === 'snowbound' ? [...NORTH_CUTTING_WORLD.camp.props, ...WILLOW_RUN_WORLD.camp.props, ...(s.version >= 4 ? RIVAL_WORLD.camp.props : [])] : [])].find(point => point.id === attachment.targetId);
}
function syncAttachments(s) {
  const resolved = new Set();
  function sync(actor, stack = new Set()) {
    if (!actor?.attachment || resolved.has(actor.id) || stack.has(actor.id)) return;
    stack.add(actor.id);
    const attachment = actor.attachment;
    const target = attachment.type === 'rest' ? anchor(s, attachment) : s.entities[attachment.targetId];
    if (target?.id && s.entities[target.id]) sync(target, stack);
    if (target) {
      actor.x = target.x; actor.y = target.y;
      actor.z = (target.z || 0) + (attachment.type === 'passenger' ? 23 : attachment.type === 'carried' ? isCarcass(actor) ? 18 : 25 : attachment.type === 'large-load' ? 16 : 0);
    }
    resolved.add(actor.id);
  }
  Object.values(s.entities).forEach(actor => sync(actor));
}
function setAttachment(s, id, attachment) {
  const actor = s.entities[id];
  if (!actor || attachment && actor.hp <= 0 && !(isCarcass(actor) || isDeadPrey(actor) && attachment.type === 'rest')) return false;
  const oldRegion = entityRegion(s, actor) || s.region;
  const previous = actor.attachment;
  const previousTarget = previous?.type === 'rest' ? anchor(s, previous) : previous ? s.entities[previous.targetId] : null;
  if (attachment) {
    if (!['carried', 'passenger', 'rest', 'large-load'].includes(attachment.type) || attachment.targetId === id) return false;
    if (isDeadPrey(actor) && attachment.type === 'passenger') return false;
    if (attachment.type === 'large-load' && !isCarcass(actor)) return false;
    const target = attachment.type === 'rest' ? anchor(s, { ...attachment, regionId: attachment.regionId || s.region }) : s.entities[attachment.targetId];
    if (!target || attachment.type !== 'rest' && target.hp <= 0) return false;
    if (['passenger', 'large-load'].includes(attachment.type) && target.kind !== 'horse' && target.category !== 'mount') return false;
    if (attachment.type === 'carried' && (!['player', 'npc'].includes(target.category) || target.mounted || target.carrying && target.carrying !== id)) return false;
    if (isDeadPrey(actor) && attachment.type === 'rest' && !['hunt-bench-mara', 'hunt-bench-juno'].includes(target.id)) return false;
    if (['passenger', 'large-load'].includes(attachment.type) && Object.values(s.entities).some(other => other.id !== id && ['passenger', 'large-load'].includes(other.attachment?.type) && other.attachment.targetId === attachment.targetId)) return false;
    if (Object.values(s.entities).some(other => other.id !== id && other.attachment?.type === attachment.type && other.attachment.targetId === attachment.targetId)) return false;
    let next = target;
    const visited = new Set([id]);
    while (next?.attachment && next.attachment.type !== 'rest') {
      if (visited.has(next.id)) return false;
      visited.add(next.id); next = s.entities[next.attachment.targetId];
    }
    if (next && visited.has(next.id)) return false;
    actor.attachment = { ...copy(attachment), ...(attachment.type === 'rest' ? { regionId: attachment.regionId || s.region } : {}) };
    actor.regionId = null;
    // Attached people and bodies cannot keep navigating a previous region.
    // Their movement/capture history belongs to the owning mission record.
    actor.route = []; delete actor.routeTarget; delete actor.goal;
    for (const region of Object.values(s.regions)) region.residentIds = region.residentIds.filter(value => value !== id);
  } else {
    actor.attachment = null; actor.regionId = oldRegion;
    if (previousTarget) actor.z = previous?.type === 'rest' && isDeadPrey(actor) ? 0 : previousTarget.z || 0;
    if (!s.regions[oldRegion].residentIds.includes(id)) s.regions[oldRegion].residentIds.push(id);
  }
  for (const carrier of Object.values(s.entities)) {
    if (carrier.carrying === id) carrier.carrying = null;
  }
  if (attachment?.type === 'carried') s.entities[attachment.targetId].carrying = id;
  actor.carried = attachment?.type === 'carried';
  syncAttachments(s);
  return true;
}
function transition(s, regionId, partyIds, positionsById = {}) {
  if (!regions[regionId] || !Array.isArray(partyIds) || new Set(partyIds).size !== partyIds.length || partyIds.some(id => !s.entities[id])) return false;
  const world = regions[regionId];
  if (partyIds.some(id => positionsById[id] && (!finite(positionsById[id].x) || !finite(positionsById[id].y) || positionsById[id].x < 0 || positionsById[id].x > world.width || positionsById[id].y < 0 || positionsById[id].y > world.height || positionsById[id].z !== undefined && (!finite(positionsById[id].z) || positionsById[id].z < 0 || positionsById[id].z > 160)))) return false;
  for (const id of partyIds) {
    const actor = s.entities[id];
    if (actor.attachment) continue;
    for (const env of Object.values(s.regions)) env.residentIds = env.residentIds.filter(value => value !== id);
    actor.regionId = regionId; s.regions[regionId].residentIds.push(id);
    if (positionsById[id]) Object.assign(actor, positionsById[id]);
    actor.route = []; actor.routeTarget = undefined;
  }
  s.region = regionId; syncAttachments(s); Opening.resetCampaignPresentation(s);
  return true;
}
function encodeBody(s) {
  syncAttachments(s);
  const body = {};
  for (const [key, value] of Object.entries(s)) if (!['checkpoints', 'missionEntries', 'replayCanonical'].includes(key) && !key.startsWith('_')) body[key] = value;
  // Render/input state is transient; active dialogue and clinical state persist.
  delete body.pointer; delete body.aiming; delete body.interactionTarget;
  body.notices = []; body.bullets = [];
  return copy(body);
}
function checkpoint(s, id, label) {
  const pending=trainStepCheckpoints.get(s);
  if(pending){pending.push({id,label,missionId:recordFor(s).mission.id,stage:recordFor(s).mission.stage});return;}
  const current = recordFor(s), key = `${current.mission.id}:${id}`;
  current.checkpointId = key;
  s.checkpoints[key] = { id: key, missionId: current.mission.id, stage: current.mission.stage, label, data: encodeBody(s) };
  notice(s, `Checkpoint · ${label}`);
}
function fail(s, reason) {
  if (s.failure) return;
  s.failure = { reason }; s.stats.deaths++; s.bullets = [];
  talk(s, 'mission-failed', `${s.mission.name} · Checkpoint`, reason, [['retry', 'Retry the latest checkpoint.'], ['restart', 'Restart this mission.'], ...(s.replayCanonical ? [['finish-replay', 'Return to the permanent journey.']] : [])]);
  notice(s, reason); log(s, `Mission failed: ${reason}`);
}
function startMission(s, id, nativeClinic = false) {
  const target = s.campaign.missions[id];
  if (!target || target.mission.completed || s.replayCanonical && s.campaign.replayMissionId !== id) return false;
  if (s.campaign.activeMissionId !== id && !recordFor(s).mission.completed) { notice(s, 'Finish the current expedition before accepting another.'); return false; }
  if (id === Rescue.RESCUE_ID && !s.campaign.missions[OPENING_ID].mission.completed) return false;
  if ([Hunt.HUNT_ID,Rival.RIVAL_ID].includes(id) && !s.campaign.missions[Rescue.RESCUE_ID].mission.completed) return false;
  if(id===Train.TRAIN_ID&&(!Train.TRAIN_PLAYABLE&&!nativeClinic||!s.campaign.missions[Hunt.HUNT_ID]?.mission.completed||!s.campaign.missions[Rival.RIVAL_ID]?.mission.completed))return false;
  if (!s.missionEntries[id]) s.missionEntries[id] = encodeBody(s);
  s.campaign.activeMissionId = id; target.status = 'active'; s.failure = null; s.dialog = null;
  Opening.resetCampaignPresentation(s);
  return true;
}
function complete(s, unlockIDs = []) {
  const current = recordFor(s);
  current.mission.completed = true; current.mission.rewardPaid = true; current.status = 'completed';
  for (const id of unlockIDs) s.campaign.unlocks[id] = { available: false, requirementKnown: true };
  if (current.mission.id === Rescue.RESCUE_ID && s.campaign.missions[Hunt.HUNT_ID]) {
    s.campaign.missions[Hunt.HUNT_ID].status = 'unstarted';
    s.campaign.unlocks['campaign-the-aftermath-of-genesis'] = { available: true, requirementKnown: true };
    Hunt.ensureHuntCast(s, context);
    const rival=s.campaign.missions[Rival.RIVAL_ID];
    if(rival&&rival.status==='locked') { rival.status='unstarted'; s.campaign.unlocks['campaign-old-friends']={available:true,requirementKnown:true}; Rival.ensureRivalCast(s,context); }
    current.mission.objective = 'Silas is home and healing. Orla’s food journey and the Bellwether expedition are both available at camp.';
  }
  if([Hunt.HUNT_ID,Rival.RIVAL_ID].includes(current.mission.id)) updateOnwardPrerequisite(s);
  checkpoint(s, 'complete', `${current.mission.name} completed`);
}
function updateOnwardPrerequisite(s) {
  const hunt=s.campaign.missions[Hunt.HUNT_ID],rival=s.campaign.missions[Rival.RIVAL_ID];
  if(!hunt?.mission.completed&&!rival?.mission.completed) return;
  const ready=!!(hunt?.mission.completed&&rival?.mission.completed);
  s.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall']={available:s.version>=5&&Train.TRAIN_PLAYABLE&&ready,requirementKnown:true,prerequisitesComplete:ready,equipmentSecured:!!rival?.flags.chargesStored};
  const train=s.campaign.missions[Train.TRAIN_ID];if(train&&['locked','unstarted'].includes(train.status))train.status=ready?'unstarted':'locked';
}
function postpone(s) {
  const record = s.campaign.missions[Rescue.RESCUE_ID], loan = s.weapons['coach-gun'];
  const borrowed = ['warmRation', 'rescueDressing', 'rescueRope', 'signalCartridge'];
  if (s.campaign.activeMissionId !== Rescue.RESCUE_ID || record.mission.stage !== 1 || s.region !== 'snowbound' || !loan || loan.owner !== 'community-rescue-chest' || loan.loanMissionId !== Rescue.RESCUE_ID || loan.ammo !== 2 || loan.reserve !== 8 || record.rescue.flask.servings !== 1 || borrowed.some(id => (s.inventory[id] || 0) + (s.horse.pack[id] || 0) !== 1) || Object.keys(record.transactions).some(id => id.includes(':use:'))) {
    notice(s, 'The rescue loan has already been used. Finish the search or restart this mission from the menu.'); return false;
  }
  // Return the exact loan while preserving all unrelated consumption, packing,
  // clock, people and world changes made since the accepted briefing.
  for (const id of borrowed) {
    if (s.inventory[id] > 0) s.inventory[id]--;
    else s.horse.pack[id]--;
    // The completed opening still uses its original item vocabulary. Remove
    // empty loan slots so returning the kit restores a compatible inventory.
    if (s.inventory[id] === 0) delete s.inventory[id];
    if (s.horse.pack[id] === 0) delete s.horse.pack[id];
  }
  if (s.player.equippedWeaponId === loan.id) { s.player.equippedWeaponId = 'mara-revolver'; s.player.holstered = true; s.player.armed = false; }
  delete s.weapons[loan.id]; s.player.reloadTimer = 0; delete s.player.reloadWeaponId;
  const fresh = Rescue.createRescueRecord(); fresh.status = 'unstarted'; fresh.flags.elinMet = true;
  s.campaign.missions[Rescue.RESCUE_ID] = fresh; s.campaign.activeMissionId = OPENING_ID;
  s.entities.inez.mounted = false; s.entities.inez.mountPending = false; delete s.entities.inez.goal;
  s.entities.thimble.hitched = true; s.entities.thimble.following = false; delete s.entities.thimble.goal;
  for (const [id, saved] of Object.entries(s.checkpoints)) if (saved.missionId === Rescue.RESCUE_ID) delete s.checkpoints[id];
  delete s.missionEntries[Rescue.RESCUE_ID]; s.dialog = null; s.failure = null;
  Opening.resetCampaignPresentation(s); adapters.delete(s);
  log(s, 'Mara returned the unused coach-gun loan, ammunition, rescue kit and Inez’s flask, and postponed the northern search.');
  checkpoint(s, 'postponed-search', 'The northern rescue remains available at the kiln');
  notice(s, 'Unused rescue equipment returned. Elin will be here when you are ready.'); return true;
}
function addItemInstance(s, body) {
  if (!object(body) || typeof body.id !== 'string' || s.itemInstances[body.id]) return false;
  s.itemInstances[body.id] = copy(body); return s.itemInstances[body.id];
}
function moveItemInstance(s, id, location) {
  const item = s.itemInstances[id]; if (!item || !object(location)) return false;
  item.location = copy(location); return true;
}
const context = {
  addEntity, entity: (s, id) => s.entities[id], setAttachment, transition, checkpoint, fail, notice, log, talk, startMission, complete,
  worldFor: worldForCampaign,
  present: Opening.emitCampaignPresentation,
  postpone, addItemInstance, moveItemInstance, itemInstance: (s, id) => s.itemInstances[id],
  requirementComplete: (s, id) => Object.values(s.campaign.missions).some(record => record.sourceRequirementId === id && record.mission.completed),
  rivalAftermath: s => { const record = Object.values(s.campaign.missions).find(record => record.sourceRequirementId === 'campaign-old-friends' && record.mission.completed); return record?.aftermath || null; },
  recordCustodyShot,
  startTrainClinic:s=>startMission(s,Train.TRAIN_ID,true),
};

function convertBody(legacy) {
  const s = { version: 4, itemInstances: {}, campaignId: GAME_ID, region: 'snowbound', entities: {}, weapons: {}, party: { playerId: 'mara', mountId: legacy.horse.id },
    regions: { snowbound: { residentIds: [], worldChanges: copy(legacy.worldChanges), supplies: copy(legacy.supplies), dropped: copy(legacy.dropped) },
      'north-cutting': { residentIds: [], worldChanges: {}, supplies: [], dropped: {} },
      'willow-run': { residentIds: [], worldChanges: {}, supplies: [], dropped: {} },
      'bellwether-works': { residentIds: [], worldChanges: {}, supplies: [], dropped: {} } },
    campaign: { chapter: 'snowbound', activeMissionId: OPENING_ID, unlocks: {}, missions: {
      [OPENING_ID]: { mission: copy(legacy.mission), flags: copy(legacy.flags), timers: copy(legacy.timers), performance: copy(legacy.performance), status: legacy.mission.completed ? 'completed' : 'active', retryCount: 0, checkpointId: null },
      [Rescue.RESCUE_ID]: Rescue.createRescueRecord(),
      [Hunt.HUNT_ID]: Hunt.createHuntRecord(),
      [Rival.RIVAL_ID]: Rival.createRivalRecord(),
    } }, checkpoints: {}, missionEntries: {}, replayCanonical: null };
  for (const key of CORE_KEYS) s[key] = copy(legacy[key] ?? (key === 'notices' || key === 'bullets' ? [] : null));
  const player = addEntity(s, legacy.player, 'snowbound', 'player');
  player.equippedWeaponId = 'mara-revolver';
  delete player.ammo; delete player.reserve;
  s.weapons['mara-revolver'] = { id: 'mara-revolver', kind: 'revolver', capacity: 6, ammoType: 'revolver-round', ammo: legacy.player.ammo, reserve: legacy.player.reserve, condition: 1, owner: 'mara', loanMissionId: null, location: 'carried' };
  addEntity(s, legacy.horse, 'snowbound', 'mount');
  legacy.mounts.forEach(actor => addEntity(s, actor, 'snowbound', 'mount'));
  legacy.npcs.forEach(actor => addEntity(s, actor, 'snowbound', 'npc'));
  legacy.enemies.forEach(actor => addEntity(s, actor, 'snowbound', 'enemy'));
  legacy.animals.forEach(actor => { if (actor.id !== legacy.horse.id) addEntity(s, actor, 'snowbound', 'animal'); });
  s.campaign.missions[Rescue.RESCUE_ID].status = legacy.mission.completed ? 'unstarted' : 'locked';
  if (legacy.mission.completed) s.campaign.missions[OPENING_ID].mission.objective = 'The kiln has light. Speak with Elin Orr to search for Silas beyond the north cutting.';
  bind(s);
  if (legacy.player.carrying === 'gideon') setAttachment(s, 'gideon', { type: 'carried', targetId: 'mara' });
  if (legacy.mission.completed) Rescue.ensureRescueCast(s, context);
  return s;
}
function migrateValidated(legacy) {
  // Each historical branch owns its own Copper authority and progress.
  const s = convertBody(legacy);
  if (legacy.checkpoint) {
    const saved = convertBody(legacy.checkpoint.data);
    const id = `${OPENING_ID}:legacy-checkpoint`;
    s.campaign.missions[OPENING_ID].checkpointId = id;
    saved.campaign.missions[OPENING_ID].checkpointId = id;
    s.checkpoints[id] = { id, missionId: OPENING_ID, stage: saved.mission.stage, label: legacy.checkpoint.label, data: encodeBody(saved) };
  } else checkpoint(s, 'migration', 'Migrated campaign journey');
  if (!legacy.mission.completed) {
    const initial = convertBody(Opening.createCampaignState());
    s.missionEntries[OPENING_ID] = encodeBody(initial);
  } else {
    // The authored opening entry is available independently of later loadouts.
    s.missionEntries[OPENING_ID] = encodeBody(convertBody(Opening.createCampaignState()));
  }
  if (legacy.replayCanonical) {
    const canonical = convertBody(legacy.replayCanonical);
    checkpoint(canonical, 'migration-canonical', 'Permanent journey after opening');
    canonical.missionEntries[OPENING_ID] = copy(s.missionEntries[OPENING_ID]);
    s.replayCanonical = encodeFull(canonical, false);
    s.campaign.replayMissionId = OPENING_ID;
  }
  Opening.resetCampaignPresentation(s);
  return s;
}
export function createCampaignState() { const s=migrateValidated(Opening.createCampaignState());upgradeVersion4(s);return s; }
/** Native first-scene entry while the complete train operation remains hidden.
 * The owning mission preflights actual patient proximity and initializes only
 * its implemented clinic scene. This is not a public twenty-scene shortcut. */
export function beginCampaignTrainClinic(s){return typeof Train.beginTrainClinic==='function'?Train.beginTrainClinic(s,context):false;}

function legacyView(s) {
  let view = adapters.get(s);
  if (!view) { view = {}; adapters.set(s, view); }
  const old = s.campaign.missions[OPENING_ID];
  Object.assign(view, { version: 1, region: 'snowbound', player: s.player, horse: s.horse,
    npcs: Object.values(s.entities).filter(actor => openingNpcIds.has(actor.id)),
    enemies: Object.values(s.entities).filter(actor => openingEnemyIds.has(actor.id)),
    animals: [s.entities.copper], mounts: [s.entities['tomas-mount']],
    mission: old.mission, flags: old.flags, timers: old.timers, performance: old.performance,
    worldChanges: s.regions.snowbound.worldChanges, supplies: s.regions.snowbound.supplies, dropped: s.regions.snowbound.dropped,
    checkpoint: { label: s.checkpoint?.label || 'Campaign checkpoint', data: {} },
    replayCanonical: s.replayCanonical ? {} : null,
  });
  for (const key of CORE_KEYS) view[key] = s[key];
  return view;
}
function runOpening(s, method, ...args) {
  const view = legacyView(s), beforeCheckpoint = view.checkpoint, wasCompleted = view.mission.completed;
  Opening[method](view, ...args);
  for (const key of CORE_KEYS) s[key] = view[key];
  const current = s.campaign.missions[OPENING_ID];
  for (const key of ['mission', 'flags', 'timers', 'performance']) current[key] = view[key];
  s.regions.snowbound.worldChanges = view.worldChanges; s.regions.snowbound.supplies = view.supplies; s.regions.snowbound.dropped = view.dropped;
  if (s.party.mountId !== view.horse.id) {
    const previous = s.entities[s.party.mountId];
    if (previous) { previous.mounted = false; previous.hitched = true; }
    const copper = s.entities.copper;
    Object.assign(copper, view.horse, { category: 'mount', regionId: 'snowbound', attachment: null });
    s.party.mountId = copper.id;
  }
  // Legacy carrying remains a compatibility view of the single attachment.
  const gideon = s.entities.gideon;
  if (view.player.carrying === 'gideon' && gideon.attachment?.targetId !== 'mara') setAttachment(s, 'gideon', { type: 'carried', targetId: 'mara' });
  else if (view.player.carrying !== 'gideon' && gideon.attachment?.type === 'carried') setAttachment(s, 'gideon', null);
  if (s.failure && gideon.attachment?.type === 'carried' && (gideon.hp <= 0 || s.entities[gideon.attachment.targetId].hp <= 0)) setAttachment(s, 'gideon', null);
  Opening.forwardCampaignPresentation(s, view);
  const justCompleted = !wasCompleted && view.mission.completed;
  if (justCompleted) {
    current.status = 'completed'; s.campaign.missions[Rescue.RESCUE_ID].status = 'unstarted';
    Rescue.ensureRescueCast(s, context);
    view.mission.objective = 'The kiln has light. Speak with Elin Orr to search for Silas beyond the north cutting.';
  }
  if (view.checkpoint !== beforeCheckpoint && !justCompleted) checkpoint(s, `stage-${view.mission.stage}`, view.checkpoint.label);
  if (justCompleted) {
    checkpoint(s, 'complete', 'The Last Warm Light completed');
  }
  if (view.mission.completed) view.mission.objective = 'The kiln has light. Speak with Elin Orr to search for Silas beyond the north cutting.';
  syncAttachments(s);
  return s;
}
const rescueActive = s => s.campaign.activeMissionId === Rescue.RESCUE_ID;
const huntActive = s => s.campaign.activeMissionId === Hunt.HUNT_ID;
const rivalActive = s => s.campaign.activeMissionId === Rival.RIVAL_ID;
const trainActive = s => s.campaign.activeMissionId === Train.TRAIN_ID;
function huntOffers(s) {
  const record=s.campaign.missions[Hunt.HUNT_ID];
  return record?.status==='unstarted'&&!recordFor(s).mission.completed&&!huntActive(s)?[]:Hunt.getHuntInteractions(s,context);
}
function rivalOffers(s) { return Rival.getRivalInteractions(s,context); }
function trainOffers(s){return s.version>=5?Train.getTrainInteractions(s,context):[];}
export function stepCampaign(s, dt, input = {}) {
  const beforeElapsed=s.elapsed;
  const progressing = !s.dialog && !s.failure && finite(dt) && dt > 0;
  const trainFrame=trainActive(s)&&s.version>=5;
  if(trainFrame)trainStepCheckpoints.set(s,[]);
  try{
    if(trainActive(s))Train.stepTrain(s,dt,input,context);
    else if (rivalActive(s)) Rival.stepRival(s, dt, input, context);
    else if (huntActive(s)) Hunt.stepHunt(s, dt, input, context);
    else if (rescueActive(s)) Rescue.stepRescue(s, dt, input, context); else runOpening(s, 'stepCampaign', dt, input);
    if (!rescueActive(s) && progressing&&(!trainFrame||s.elapsed>beforeElapsed)) Rescue.advanceRescueClinical(s, trainFrame?s.elapsed-beforeElapsed:Math.min(dt, .1), context);
    if(progressing&&s.elapsed>beforeElapsed){
      const accepted=s.elapsed-beforeElapsed;
      advanceRivalHolding(s,accepted,{...context,acceptedWorldStep:true});
      if(s.version>=5&&typeof Train.advanceTrainWorldWork==='function')Train.advanceTrainWorldWork(s,accepted,context);
    }
    syncAttachments(s);
    if(trainFrame&&s.elapsed>beforeElapsed&&typeof Train.finishTrainAcceptedFrame==='function')Train.finishTrainAcceptedFrame(s,context);
    if(trainFrame){
      const pending=trainStepCheckpoints.get(s);trainStepCheckpoints.delete(s);
      for(const entry of pending){if(recordFor(s).mission.id!==entry.missionId||recordFor(s).mission.stage!==entry.stage)throw new TypeError('A train checkpoint crossed another scene within one accepted step');checkpoint(s,entry.id,entry.label);}
    }
    return s;
  }finally{if(trainFrame)trainStepCheckpoints.delete(s);}
}
export function getCampaignInteractions(s) {
  if (s.dialog || s.failure) return [];
  if(trainActive(s))return trainOffers(s);
  if (huntActive(s)||rivalActive(s)) {
    const care = Rescue.getRescueInteractions(s, context).map(action => action.id.startsWith('aftermath:') ? { ...action, priority: action.priority + 10 } : action);
    return [...trainOffers(s),...huntOffers(s), ...rivalOffers(s), ...care].sort((a, b) => a.priority - b.priority || a.distance - b.distance);
  }
  if (rescueActive(s)) return [...trainOffers(s),...huntOffers(s),...rivalOffers(s), ...Rescue.getRescueInteractions(s, context)].sort((a, b) => a.priority - b.priority || a.distance - b.distance);
  const opening = Opening.getCampaignInteractions(legacyView(s));
  const next = s.mission.completed ? Rescue.getRescueInteractions(s, context) : [];
  // Opening offers are already ordered by its higher-first priorities. The
  // rescue uses lower-first priorities internally; preserve both orderings.
  return [...trainOffers(s),...huntOffers(s),...rivalOffers(s), ...next, ...opening];
}
export const getCampaignInteraction = s => getCampaignInteractions(s)[0] || null;
export function interactCampaign(s, requestedId = null) {
  const offered = requestedId ? getCampaignInteractions(s).find(value => value.id === requestedId) : getCampaignInteraction(s);
  if (!offered) { notice(s, 'Move closer to the marked person or object.'); return s; }
  const rescueOffers = s.mission.completed || rescueActive(s) ? Rescue.getRescueInteractions(s, context) : [];
  if(trainOffers(s).some(value=>value.id===offered.id))Train.interactTrain(s,offered.id,context);
  else if (rivalOffers(s).some(value => value.id === offered.id)) Rival.interactRival(s,offered.id,context);
  else if (huntOffers(s).some(value => value.id === offered.id)) Hunt.interactHunt(s, offered.id, context);
  else if (rescueOffers.some(value => value.id === offered.id) || (huntActive(s)||rivalActive(s)) && Rescue.getRescueInteractions(s, context).some(value => value.id === offered.id)) Rescue.interactRescue(s, offered.id, context);
  else runOpening(s, 'interactCampaign', offered.id);
  syncAttachments(s); return s;
}
export function chooseCampaign(s, id) {
  if (!s.dialog?.choices.some(choice => choice.id === id)) return s;
  if (['retry', 'restart', 'finish-replay'].includes(id)) return campaignAction(s, id);
  if(s.dialog.id.startsWith('train-')||trainActive(s))Train.chooseTrain(s,id,context);
  else if (s.dialog.id.startsWith('rival-')) Rival.chooseRival(s,id,context);
  else if (s.dialog.id.startsWith('rescue') || s.dialog.speaker === 'Elin Orr') Rescue.chooseRescue(s, id, context);
  else if (huntActive(s) || s.dialog.id.startsWith('hunt')) Hunt.chooseHunt(s, id, context);
  else if (rivalActive(s)) Rival.chooseRival(s,id,context);
  else if (rescueActive(s)) Rescue.chooseRescue(s, id, context);
  else runOpening(s, 'chooseCampaign', id);
  syncAttachments(s); return s;
}
function replace(s, body, checkpoints, entries, canonical = null) {
  adapters.delete(s);
  for (const key of [...Object.keys(s), ...ROOT_VIEWS]) delete s[key];
  Object.assign(s, copy(body), { checkpoints: copy(checkpoints), missionEntries: copy(entries), replayCanonical: canonical && copy(canonical) });
  bind(s); clearTransientActions(s); Opening.resetCampaignPresentation(s); return s;
}
function clearTransientActions(s) {
  Hunt.cancelHuntDraw(s,context);
  // Saving keeps rope position/tension and captive custody. Restoring discards
  // pending focus fire without firing or spending a restored chamber twice.
  if(s.campaign.missions[Rival.RIVAL_ID]) Rival.cancelRivalFocus(s);
  if(s.campaign.missions[Train.TRAIN_ID])Train.cancelTrainTransient(s,context);
  if(Object.hasOwn(s.player,'focusActive')) s.player.focusActive=false;
}
function retry(s) {
  const saved = s.checkpoint;
  if (!saved) return s;
  const deaths = s.stats.deaths, attempts = (recordFor(s).retryCount || 0) + 1;
  const checkpoints = s.checkpoints, entries = s.missionEntries, canonical = s.replayCanonical;
  replace(s, saved.data, checkpoints, entries, canonical);
  s.stats.deaths = deaths; recordFor(s).retryCount = attempts; s.failure = null; s.dialog = null;
  if (huntActive(s)||rivalActive(s)||trainActive(s)) recordFor(s).performance.eligible = false;
  notice(s, `Retry · ${saved.label}. Regions, people, mounts, equipment and supplies restored.`); return s;
}
function restart(s) {
  const id = s.campaign.activeMissionId, entry = s.missionEntries[id];
  if (!entry) return s;
  const entries = s.missionEntries, canonical = s.replayCanonical;
  replace(s, entry, {}, entries, canonical);
  if (id !== OPENING_ID) startMission(s, id);
  checkpoint(s, 'restart', `${s.mission.name} restarted`); return s;
}
export function beginCampaignReplay(s, id) {
  if (s.replayCanonical || !s.campaign.missions[id]?.mission.completed || !s.missionEntries[id]) { notice(s, 'Complete this mission before replaying it.'); return s; }
  const canonical = encodeFull(s, false), entries = s.missionEntries, entry = s.missionEntries[id];
  replace(s, entry, {}, entries, canonical);
  s.campaign.replayMissionId = id;
  if (id !== OPENING_ID) startMission(s, id);
  checkpoint(s, 'replay-entry', `${s.mission.name} replay`);
  notice(s, 'Mission replay. The complete permanent campaign is preserved.'); return s;
}
export function campaignAction(s, action) {
  if (action === 'retry') return retry(s);
  if (action === 'restart') return restart(s);
  if (action === 'replay' || action.startsWith('replay:')) return beginCampaignReplay(s, action === 'replay' ? s.mission.id : action.slice(7));
  if (action === 'finish-replay') {
    if (!s.replayCanonical) return s;
    const canonical = s.replayCanonical;
    replace(s, canonical, canonical.checkpoints, canonical.missionEntries, null);
    delete s.campaign.replayMissionId;
    notice(s, 'Permanent campaign restored. Replay choices and rewards did not transfer.'); return s;
  }
  if (s.dialog || s.failure) return s;
  if (action.startsWith('store:')) return storeCampaignItem(s, action.slice(6));
  if (action.startsWith('take:')) return takeCampaignItem(s, action.slice(5));
  if (action.startsWith('withdraw:')) return takeCampaignItem(s, action.slice(9));
  if(trainActive(s))Train.actionTrain(s,action,context);
  else if (rivalActive(s)) Rival.actionRival(s,action,context);
  else if (huntActive(s)) Hunt.actionHunt(s, action, context);
  else if (rescueActive(s)) Rescue.actionRescue(s, action, context); else runOpening(s, 'campaignAction', action);
  syncAttachments(s); return s;
}
export const restartCampaign = restart;
export function shootCampaign(s, x, y, aim = {}) {
  if(trainActive(s))return(Train.shootTrain(s,x,y,context,aim),s);
  if(rivalActive(s))return (Rival.shootRival(s,x,y,context,aim),s);
  const id=s.player.equippedWeaponId,before=s.weapons[id]?.ammo||0;
  if(huntActive(s))Hunt.shootHunt(s,x,y,context,aim);
  else if(rescueActive(s))Rescue.shootRescue(s,x,y,context);
  else runOpening(s,'shootCampaign',x,y);
  const consumed=before-(s.weapons[id]?.ammo||0);if(consumed>0)recordCustodyShot(s,'mara',id,consumed);
  return s;
}
export const beginCampaignDraw = (s, x, y, aim = {}) => huntActive(s) ? Hunt.beginHuntDraw(s, x, y, context, aim) : s;
export const releaseCampaignDraw = (s, x, y, aim = {}) => huntActive(s) ? Hunt.releaseHuntDraw(s, x, y, context, aim) : s;
export const cancelCampaignDraw = s => huntActive(s) ? Hunt.cancelHuntDraw(s, context) : s;
export function reloadCampaign(s) { return trainActive(s)?(Train.reloadTrain(s,context),s):rivalActive(s)?(Rival.reloadRival(s,context),s):huntActive(s) ? (Hunt.reloadHunt(s, context), s) : rescueActive(s) ? (Rescue.reloadRescue(s, context), s) : runOpening(s, 'reloadCampaign'); }
export function useCampaignItem(s, id) {
  const huntOwned=['quietRation','quiet-ration','eat:quiet-ration','warmCider'].includes(id);
  const rescueOwned=['warmRation','warm-ration'].includes(id);
  if(huntOwned||rescueOwned){
    const item=id==='warmCider'?'warmCider':huntOwned?'quietRation':'warmRation';
    const stock=()=>item==='warmCider'?(s.camp.pantry?.warmCider||0):(s.inventory[item]||0);
    const before=stock();
    if(huntOwned)Hunt.useHuntItem(s,id,context);else Rescue.useRescueItem(s,id,context);
    const consumed=before-stock();
    const grading=trainActive(s)?s.campaign.missions[Train.TRAIN_ID]:rivalActive(s)?s.campaign.missions[Rival.RIVAL_ID]:null;
    if(grading&&!grading.mission.completed&&consumed>0){
      const performance=grading.performance;
      performance.healingUses+=consumed;performance.noHealingItems=false;
    }
    return s;
  }
  return trainActive(s)?(Train.useTrainItem(s,id,context),s):rivalActive(s)?(Rival.useRivalItem(s,id,context),s):huntActive(s)?(Hunt.useHuntItem(s,id,context),s):rescueActive(s)?(Rescue.useRescueItem(s,id,context),s):runOpening(s,'useCampaignItem',id);
}
export function whistleCampaign(s) { return trainActive(s)?(Train.whistleTrain(s,context),s):rivalActive(s)?(Rival.whistleRival(s,context),s):huntActive(s) ? (Hunt.whistleHunt(s, context), s) : rescueActive(s) ? (Rescue.whistleRescue(s, context), s) : runOpening(s, 'whistleCampaign'); }
export function storeCampaignItem(s, id, amount = 1) {
  amount = Math.floor(amount);
  if (!Object.hasOwn(campaignItems, id) || !finite(amount) || amount < 1 || !(s.inventory[id] >= amount) || s.failure) return s;
  if (!s.horse.storageUnlocked || distance(s.player, s.horse) >= 80) { notice(s, 'Stand beside Copper to use her unlocked pack.'); return s; }
  const used = Object.values(s.horse.pack).reduce((total, count) => total + count, 0);
  if (used + amount > 12) { notice(s, 'Copper’s pack holds twelve units.'); return s; }
  s.inventory[id] -= amount; s.horse.pack[id] = (s.horse.pack[id] || 0) + amount;
  notice(s, `Stored ${amount} ${campaignItems[id].name.toLowerCase()} in Copper’s pack.`); return s;
}
export function takeCampaignItem(s, id, amount = 1) {
  amount = Math.floor(amount);
  if (!Object.hasOwn(campaignItems, id) || !finite(amount) || amount < 1 || !(s.horse.pack?.[id] >= amount) || s.failure) return s;
  if (!s.horse.storageUnlocked || distance(s.player, s.horse) >= 80 || (s.inventory[id] || 0) + amount > 99) { notice(s, 'Stand beside Copper with space in your satchel.'); return s; }
  s.horse.pack[id] -= amount; s.inventory[id] = (s.inventory[id] || 0) + amount;
  notice(s, `Took ${amount} ${campaignItems[id].name.toLowerCase()} from Copper’s pack.`); return s;
}

function encodeFull(s, replay = true) {
  return { ...encodeBody(s), checkpoints: copy(s.checkpoints), missionEntries: copy(s.missionEntries), replayCanonical: replay && s.replayCanonical ? copy(s.replayCanonical) : null };
}
export function serializeCampaign(s) { syncAttachments(s); return JSON.stringify(encodeFull(s)); }

function validPoint(actor, regionId, s = null) {
  const world = regions[regionId];
  const maxZ=s?.version>=5&&regionId===TRAIN_WORLD.id&&s.campaign.missions[Train.TRAIN_ID]?.train?.runtimeVersion===1?Train.TRAIN_MAX_BODY_Z:160;
  return world && finite(actor.x) && finite(actor.y) && actor.x >= 0 && actor.y >= 0 && actor.x <= world.width && actor.y <= world.height && finite(actor.z) && actor.z >= 0 && actor.z <= maxZ;
}
function validateItemInstances(s) {
  if(s.version>=5&&!validateTrainGear(s))return false;
  const ids = ['hunt-hide-doe', 'hunt-hide-buck', 'field-knife'];
  for (const [id, item] of Object.entries(s.itemInstances)) {
    if(id===TRAIN_MASK_ID){if(s.version<5||!validateTrainGearInstance(s,item))return false;continue;}
    if (!ids.includes(id) || !object(item) || item.id !== id || item.kind !== (id === 'field-knife' ? 'field-knife' : 'deer-hide') || !Number.isInteger(item.quality) || item.quality < 1 || item.quality > 3 || !['mara', 'community'].includes(item.owner)) return false;
    if (item.sourceEntityId !== (id === 'field-knife' ? 'kitchen-knife' : id === 'hunt-hide-doe' ? 'willow-creek-doe' : 'willow-cedar-buck')) return false;
    const location = item.location;
    if (!object(location) || !['carried', 'saddle', 'bench', 'pantry', 'drying-rack'].includes(location.type)) return false;
    if (item.owner === 'community' && ['carried', 'saddle'].includes(location.type)) return false;
    const regionId = location.regionId || (['carried', 'saddle'].includes(location.type) ? entityRegion(s, s.entities[location.targetId]) : 'snowbound');
    if (!regions[regionId]) return false;
    if (location.type === 'carried' && location.targetId !== 'mara' || location.type === 'saddle' && !['copper', 'bracken'].includes(location.targetId)) return false;
    const station = WILLOW_RUN_WORLD.camp.props.find(prop => prop.id === location.targetId);
    if (['bench', 'pantry', 'drying-rack'].includes(location.type) && (regionId !== 'snowbound' || !station || location.type === 'drying-rack' && station.id !== 'kitchen-hide-rack' || location.type === 'bench' && !['hunt-bench-mara', 'hunt-bench-juno'].includes(station.id) || location.type === 'pantry' && station.id !== 'kitchen-pantry')) return false;
    if (id === 'field-knife' && (item.owner !== 'mara' || item.quality !== 1)) return false;
  }
  return true;
}
function validateBody(s) {
  if (!object(s) || ![2, 3, 4, 5].includes(s.version) || s.campaignId !== GAME_ID || !regions[s.region] || !object(s.entities) || !object(s.weapons) || !object(s.party) || !object(s.regions) || !object(s.campaign?.missions) || !object(s.campaign.unlocks)) return false;
  const expanded = s.version >= 3, rivalExpanded=s.version>=4,trainExpanded=s.version>=5;
  const expectedMissions = [OPENING_ID,Rescue.RESCUE_ID,...(expanded?[Hunt.HUNT_ID]:[]),...(rivalExpanded?[Rival.RIVAL_ID]:[]),...(trainExpanded?[Train.TRAIN_ID]:[])];
  const expectedRegions = ['snowbound','north-cutting',...(expanded?['willow-run']:[]),...(rivalExpanded?['bellwether-works']:[]),...(trainExpanded?[TRAIN_WORLD.id]:[])];
  const items = trainExpanded?campaignItems:rivalExpanded?version4Items:expanded?version3Items:version2Items;
  if (expectedMissions.some(id => !s.campaign.missions[id]) || !expectedMissions.includes(s.campaign.activeMissionId) || Object.keys(s.campaign.missions).length !== expectedMissions.length) return false;
  const sourceIds = { [OPENING_ID]: 'campaign-outlaws-from-the-west', [Rescue.RESCUE_ID]: 'campaign-enter-pursued-by-a-memory', [Hunt.HUNT_ID]: 'campaign-the-aftermath-of-genesis', [Rival.RIVAL_ID]:'campaign-old-friends', [Train.TRAIN_ID]:Train.TRAIN_SOURCE_REQUIREMENT };
  if (Object.entries(s.campaign.missions).some(([id, record]) => record.sourceRequirementId !== undefined && record.sourceRequirementId !== sourceIds[id])) return false;
  if (!expectedRegions.includes(s.region) || expectedRegions.some(id => !s.regions[id])) return false;
  if (expanded ? !object(s.itemInstances) : s.itemInstances !== undefined) return false;
  const allowed = new Set(['mara', 'juniper', 'copper', 'tomas-mount', ...openingNpcIds, ...openingEnemyIds, ...RESCUE_CAST.map(actor => actor.id), ...(Rescue.RESCUE_ENTITY_IDS || []), ...(NORTH_CUTTING_WORLD.predators || []).map(actor => actor.id), ...(expanded ? [...HUNT_CAST, ...HUNT_ANIMALS].map(actor => actor.id) : []), ...(rivalExpanded?[...RIVAL_CAST,...RIVAL_ENEMIES].map(actor=>actor.id):[]),...(trainExpanded?Train.TRAIN_ENTITY_IDS:[])]);
  const expectedCategories = new Map([
    ['mara', 'player'], ['juniper', 'mount'], ['tomas-mount', 'mount'],
    ...[...openingNpcIds].map(id => [id, 'npc']), ...[...openingEnemyIds].map(id => [id, 'enemy']),
    ...RESCUE_CAST.map(actor => [actor.id, actor.id === 'thimble' ? 'mount' : actor.id === 'lark' ? 'animal' : 'npc']),
    ...NORTH_CUTTING_WORLD.predators.map(actor => [actor.id, 'enemy']),
    ...(expanded ? HUNT_CAST.map(actor => [actor.id, actor.kind === 'horse' ? 'mount' : 'npc']) : []),
    ...(expanded ? HUNT_ANIMALS.map(actor => [actor.id, 'animal']) : []),
    ...(rivalExpanded?RIVAL_CAST.map(actor=>[actor.id,actor.kind==='horse'?'mount':'npc']):[]),
    ...(rivalExpanded?RIVAL_ENEMIES.map(actor=>[actor.id,'enemy']):[]),
    ...(trainExpanded?Train.TRAIN_ENTITY_SPECS.map(actor=>[actor.id,actor.category]):[]),
  ]);
  if (!s.entities.mara || !s.entities[s.party.mountId] || s.party.playerId !== 'mara' || !['juniper', 'copper'].includes(s.party.mountId)) return false;
  if ([...openingNpcIds, ...openingEnemyIds, 'copper', 'tomas-mount'].some(id => !s.entities[id])) return false;
  for (const [id, actor] of Object.entries(s.entities)) {
    if (!allowed.has(id) || !object(actor) || actor.id !== id || !['player', 'npc', 'enemy', 'animal', 'mount'].includes(actor.category) || !finite(actor.hp) || actor.hp < 0 || actor.hp > Math.max(100, expanded ? HUNT_ANIMALS.find(body => body.id === id)?.hp || 0 : 0, rivalExpanded?[...RIVAL_CAST,...RIVAL_ENEMIES].find(body=>body.id===id)?.hp||0:0)) return false;
    if (expectedCategories.has(id) && actor.category !== expectedCategories.get(id) || id === 'copper' && actor.category !== (s.party.mountId === 'copper' ? 'mount' : 'animal')) return false;
    if (Object.prototype.propertyIsEnumerable.call(actor, 'traversal') || Object.prototype.propertyIsEnumerable.call(actor, 'largeLoad')) return false;
    if(actor.support!=null&&(!trainExpanded||actor.attachment||!Train.validateTrainEntitySupport(s,actor)))return false;
    if (!['vx', 'vy', 'facing', 'fireTimer', 'shotTimer', 'invulnerable'].every(key => actor[key] === undefined || finite(actor[key]))) return false;
    if (actor.carrying !== undefined && actor.carrying !== null && (!s.entities[actor.carrying] || s.entities[actor.carrying].attachment?.type !== 'carried' || s.entities[actor.carrying].attachment.targetId !== id)) return false;
    if (!validPoint(actor, entityRegion(s, actor),s)) return false;
    if (!actor.attachment && actor.regionId === 'snowbound' && actor.z !== 0) return false;
    if (actor.attachment) {
      const a = actor.attachment;
      if (!object(a) || !(expanded ? ['carried', 'passenger', 'rest', 'large-load'] : ['carried', 'passenger', 'rest']).includes(a.type) || typeof a.targetId !== 'string' || actor.regionId !== null || a.targetId === id) return false;
      const target = a.type === 'rest' ? anchor(s, a) : s.entities[a.targetId];
      if (!target || a.type !== 'rest' && target.hp <= 0 || ['passenger', 'large-load'].includes(a.type) && !['horse', 'mount'].includes(target.kind || target.category)) return false;
      if (a.type === 'large-load' && !isCarcass(actor) || actor.hp <= 0 && !(isCarcass(actor) || isDeadPrey(actor) && a.type === 'rest')) return false;
      if (isDeadPrey(actor) && a.type === 'passenger') return false;
      if (a.type === 'carried' && (!['player', 'npc'].includes(target.category) || target.mounted || target.carrying !== id)) return false;
      if (isDeadPrey(actor) && a.type === 'rest' && !['hunt-bench-mara', 'hunt-bench-juno'].includes(target.id)) return false;
      if (['passenger', 'large-load'].includes(a.type) && Object.values(s.entities).some(other => other.id !== id && ['passenger', 'large-load'].includes(other.attachment?.type) && other.attachment.targetId === a.targetId)) return false;
      if (a.strap !== undefined && typeof a.strap !== 'boolean') return false;
      if (Object.values(s.entities).some(other => other.id !== id && other.attachment?.type === a.type && other.attachment.targetId === a.targetId)) return false;
    } else if (!regions[actor.regionId]) return false;
    if (actor.route !== undefined && (!Array.isArray(actor.route) || actor.route.length > 10000 || actor.route.some(point => !validPoint({ ...point, z: point.z || 0 }, entityRegion(s, actor),s)))) return false;
    if (actor.routeTarget !== undefined && !validPoint({ ...actor.routeTarget, z: actor.routeTarget.z || 0 }, entityRegion(s, actor),s)) return false;
    if (actor.goal !== undefined && !validPoint({ ...actor.goal, z: actor.goal.z || 0 }, entityRegion(s, actor),s)) return false;
    if (actor.kind === 'horse' || actor.category === 'mount') {
      if (!finite(actor.stamina) || actor.stamina < 0 || actor.stamina > 100 || actor.fear !== undefined && (!finite(actor.fear) || actor.fear < 0 || actor.fear > 100) || actor.bond !== undefined && (!finite(actor.bond) || actor.bond < 1 || actor.bond > 4) || typeof actor.owned !== 'boolean') return false;
      if (actor.pack !== undefined && (!object(actor.pack) || Object.entries(actor.pack).some(([id, count]) => !Object.hasOwn(items, id) || !Number.isInteger(count) || count < 0 || count > 12) || Object.values(actor.pack).reduce((total, count) => total + count, 0) > 12)) return false;
    }
  }
  for (const [id, env] of Object.entries(s.regions)) {
    if (!regions[id] || !object(env) || !Array.isArray(env.residentIds) || new Set(env.residentIds).size !== env.residentIds.length || !object(env.worldChanges) || !Array.isArray(env.supplies) || !object(env.dropped)) return false;
    if (env.residentIds.some(actorId => !s.entities[actorId] || s.entities[actorId].attachment || s.entities[actorId].regionId !== id)) return false;
  }
  if (Object.keys(s.regions).length !== expectedRegions.length || Object.values(s.entities).some(actor => !actor.attachment && !s.regions[actor.regionId].residentIds.includes(actor.id))) return false;
  if (Object.keys(s.weapons).length < 1 || Object.keys(s.weapons).length > (trainExpanded?6+Object.keys(Train.TRAIN_WEAPON_DEFINITIONS).length:rivalExpanded?6:expanded ? 3 : 2) || !s.weapons[s.entities.mara.equippedWeaponId]) return false;
  for (const [id, weapon] of Object.entries(s.weapons)) {
    const trainWeapon=trainExpanded?Train.TRAIN_WEAPON_DEFINITIONS[id]:null;
    const laterBorrowed=trainExpanded&&weapon?.owner==='bastian'&&!!activeRivalWeaponLoan(s,id);
    const kinds = { 'mara-revolver': ['revolver', 6, 'revolver-round'], 'coach-gun': ['coach-gun', 2, 'coach-shell'], ...(expanded ? { [HUNT_BOW.id]: ['bow', 1, 'arrow'] } : {}), ...(rivalExpanded?{[RIVAL_CARBINE.id]:['carbine',7,'tern-cartridge'],'working-lariat':['lariat',0,'rope'],'bastian-engraved-revolver':['revolver',6,'engraved-round']}: {}),...(trainWeapon?{[id]:[trainWeapon.kind,trainWeapon.capacity,trainWeapon.ammoType]}:{}) };
    if (!kinds[id] || !object(weapon) || weapon.id !== id || weapon.kind !== kinds[id][0] || weapon.capacity !== kinds[id][1] || typeof weapon.ammoType !== 'string' || !Number.isInteger(weapon.ammo) || weapon.ammo < 0 || weapon.ammo > weapon.capacity || !Number.isInteger(weapon.reserve) || weapon.reserve < 0 || weapon.reserve > 999 || !finite(weapon.condition) || weapon.condition < 0 || weapon.condition > 1 || !(rivalExpanded&&id==='bastian-engraved-revolver'?['carried','dropped']:['carried', 'saddle', 'chest']).includes(weapon.location)) return false;
    if (weapon.ammoType !== kinds[id][2]) return false;
    if (!(trainWeapon?trainWeapon.owners:rivalExpanded&&id==='bastian-engraved-revolver'?['mara','bastian','bellwether-revolver-thief']:['mara', 'community-rescue-chest']).includes(weapon.owner)&&!laterBorrowed || ![null, Rescue.RESCUE_ID].includes(weapon.loanMissionId)) return false;
    if(rivalExpanded&&[RIVAL_CARBINE.id,'working-lariat'].includes(id)&&(weapon.owner!=='mara'&&!laterBorrowed||weapon.loanMissionId!==null||id==='working-lariat'&&(weapon.ammo!==0||weapon.reserve!==0))) return false;
    if(id==='bastian-engraved-revolver'&&weapon.location==='dropped'&&(!object(weapon.dropPoint)||!validPoint(weapon.dropPoint,weapon.dropPoint.regionId,s)))return false;
    if (weapon.rackMountId !== undefined && !s.entities[weapon.rackMountId]) return false;
  }
  for (const key of ['elapsed', 'time', 'day', 'seed', 'honor']) if (!finite(s[key])) return false;
  if (s.elapsed < 0 || s.time < 0 || s.time >= 24 || !Number.isInteger(s.day) || s.day < 1 || !Number.isInteger(s.seed) || s.seed < 0 || !Array.isArray(s.log) || s.log.length > 100 || s.log.some(entry => !object(entry) || typeof entry.text !== 'string' || !finite(entry.day) || !finite(entry.time))) return false;
  if (!object(s.inventory) || Object.entries(s.inventory).some(([id, count]) => !Object.hasOwn(items, id) || !Number.isInteger(count) || count < 0 || count > 99) || Object.keys(CAMPAIGN_ITEMS).some(id => !Number.isInteger(s.inventory[id]))) return false;
  if (!object(s.stats) || Object.values(s.stats).some(value => !finite(value) || value < 0) || !object(s.camp) || !['food', 'medicine', 'materials', 'morale'].every(key => finite(s.camp[key]) && s.camp[key] >= 0) || !object(s.companions) || !object(s.sideQuests) || !object(s.wanted)) return false;
  const typed = (value, shape) => object(value) && Object.entries(shape).every(([key, example]) => example === null || typeof example === 'object' || typeof value[key] === typeof example && (typeof example !== 'number' || finite(value[key])));
  const player = s.entities.mara;
  const selected = s.weapons[player.equippedWeaponId];
  if (!typed({ ...player, ammo: selected.ammo, reserve: selected.reserve }, openingShape.player) || !['stamina', 'focus'].every(key => player[key] >= 0 && player[key] <= 100) || player.reloadTimer < 0 || player.reloadTimer > 4 || player.shotTimer < 0 || player.shotTimer > 2 || player.blockTimer < 0 || player.blockTimer > 1.5) return false;
  if (!typed(s.stats, openingShape.stats) || !typed(s.wanted, openingShape.wanted) || !typed(s.camp, openingShape.camp) || !object(s.camp.upgrades) || Object.entries(openingShape.companions).some(([id, shape]) => !typed(s.companions[id], shape))) return false;
  const opening = s.campaign.missions[OPENING_ID];
  if (!object(opening.mission) || opening.mission.id !== OPENING_ID || opening.mission.stageCount !== 9 || !Number.isInteger(opening.mission.stage) || opening.mission.stage < 0 || opening.mission.stage > 8 || typeof opening.mission.completed !== 'boolean' || typeof opening.mission.rewardPaid !== 'boolean') return false;
  if (opening.status !== (opening.mission.completed ? 'completed' : 'active') || !Number.isInteger(opening.retryCount) || opening.retryCount < 0 || opening.retryCount > 100000) return false;
  if (!typed(opening.flags, openingShape.flags) || !typed(opening.timers, openingShape.timers) || !object(opening.performance) || ![null, 'release', 'bind', 'kill'].includes(opening.flags.pavelChoice) || ![null, 'preserve-log', 'carry-gideon-first'].includes(opening.flags.rescuePriority)) return false;
  if (opening.mission.completed && (!opening.mission.rewardPaid || opening.mission.stage !== 8 || !opening.flags.suppliesDeposited || !opening.flags.adaSafe || !opening.flags.gideonSafe || !opening.flags.rescueClue || !opening.flags.copperHitched || !opening.flags.pavelChoice)) return false;
  if (!opening.mission.completed && opening.mission.rewardPaid) return false;
  const winter = s.regions.snowbound;
  if (!typed(winter.worldChanges, openingShape.worldChanges) || winter.supplies.length !== SNOWBOUND_WORLD.supplies.length || new Set(winter.supplies.map(item => item.id)).size !== winter.supplies.length) return false;
  if (SNOWBOUND_WORLD.supplies.some(item => !winter.supplies.some(saved => saved.id === item.id && typeof saved.collected === 'boolean' && typeof saved.lost === 'boolean' && Number.isInteger(saved.delivered) && saved.delivered >= 0 && saved.delivered <= item.amount))) return false;
  if (opening.mission.completed && (!winter.worldChanges.boilerDestroyed || !winter.worldChanges.relayCircuitOff || !winter.worldChanges.pressureReleased)) return false;
  if (s.campaign.activeMissionId !== OPENING_ID && !opening.mission.completed || s.region === 'north-cutting' && s.campaign.activeMissionId !== Rescue.RESCUE_ID || s.region === 'willow-run' && s.campaign.activeMissionId !== Hunt.HUNT_ID || s.region==='bellwether-works'&&s.campaign.activeMissionId!==Rival.RIVAL_ID) return false;
  const rescue = s.campaign.missions[Rescue.RESCUE_ID], summary = s.sideQuests.silas;
  if (!object(rescue.mission) || rescue.mission.id !== Rescue.RESCUE_ID || rescue.mission.stageCount !== 10 || !Number.isInteger(rescue.mission.stage) || rescue.mission.stage < 0 || rescue.mission.stage > 9 || typeof rescue.mission.completed !== 'boolean' || typeof rescue.mission.rewardPaid !== 'boolean' || !['locked', 'unstarted', 'active', 'completed'].includes(rescue.status) || !Number.isInteger(rescue.retryCount) || rescue.retryCount < 0 || rescue.retryCount > 100000) return false;
  if (rescue.mission.completed !== (rescue.status === 'completed') || rescue.mission.completed !== rescue.mission.rewardPaid || !opening.mission.completed && rescue.status !== 'locked') return false;
  if (rescue.status === 'active' && s.campaign.activeMissionId !== Rescue.RESCUE_ID || s.campaign.activeMissionId === Rescue.RESCUE_ID && !['active', 'completed'].includes(rescue.status)) return false;
  if (!object(summary) || typeof summary.name !== 'string' || !Number.isInteger(summary.stage) || summary.stage < 0 || summary.stage > 10 || summary.unlocked !== opening.mission.completed || summary.complete !== rescue.mission.completed) return false;
  bind(s);
  if (s.campaign.activeMissionId === OPENING_ID) {
    const view = legacyView(s);
    const plain = copy({ ...view, player: { ...view.player, ammo: view.player.ammo, reserve: view.player.reserve }, replayCanonical: null, checkpoint: null });
    if (plain.dialog?.id === 'rescue-briefing'||rivalExpanded&&plain.dialog?.id.startsWith('rival-')) plain.dialog = null;
    if (plain.dialog?.id === 'mission-failed') plain.dialog.choices = plain.dialog.choices.filter(choice => choice.id !== 'finish-replay');
    plain.checkpoint = { label: 'Validation of active opening', data: copy(plain) };
    if (!Opening.restoreCampaign(plain)) return false;
  }
  if (typeof Rescue.validateRescueRecord === 'function' && !Rescue.validateRescueRecord(s)) return false;
  if (expanded && (!validateItemInstances(s) || !Hunt.validateHuntRecord(s))) return false;
  if(rivalExpanded&&!Rival.validateRivalRecord(s)) return false;
  if(rivalExpanded) {
    const rival=s.campaign.missions[Rival.RIVAL_ID],ids=[...RIVAL_CAST,...RIVAL_ENEMIES].map(actor=>actor.id);
    if(rival.status==='locked'?ids.some(id=>s.entities[id]):ids.some(id=>!s.entities[id])) return false;
    if(rival.flags.carbineGranted!==Object.hasOwn(s.weapons,RIVAL_CARBINE.id)||rival.flags.lariatGranted!==Object.hasOwn(s.weapons,'working-lariat')) return false;
    const onward=s.campaign.unlocks['campaign-who-the-hell-is-leviticus-cornwall'];
    const ready=!!(s.campaign.missions[Hunt.HUNT_ID].mission.completed&&rival.mission.completed);
    if(onward?.available&&(!trainExpanded||!Train.TRAIN_PLAYABLE||!ready)||onward?.prerequisitesComplete!==undefined&&onward.prerequisitesComplete!==ready) return false;
    if(trainExpanded){const train=s.campaign.missions[Train.TRAIN_ID];if(['locked','unstarted'].includes(train.status)&&train.status!==(ready?'unstarted':'locked')||!validateRivalContinuation(s)||!Train.validateTrainRecord(s))return false;}
  }
  if (s.dialog && (!object(s.dialog) || typeof s.dialog.id !== 'string' || typeof s.dialog.speaker !== 'string' || typeof s.dialog.text !== 'string' || s.dialog.text.length > 10000 || !Array.isArray(s.dialog.choices) || s.dialog.choices.length > 20 || s.dialog.choices.some(choice => !object(choice) || typeof choice.id !== 'string' || typeof choice.label !== 'string') || new Set(s.dialog.choices.map(choice => choice.id)).size !== s.dialog.choices.length)) return false;
  if (s.failure !== null && (!object(s.failure) || typeof s.failure.reason !== 'string')) return false;
  return true;
}
function validateFull(s, nested = false) {
  if (!validateBody(s) || !object(s.checkpoints) || !object(s.missionEntries) || s.version<5&&Object.keys(s.checkpoints).length > 100 || Object.keys(s.missionEntries).length > (s.version>=5?5:s.version>=4?4:s.version === 3 ? 3 : 2)) return false;
  for (const [id, saved] of Object.entries(s.checkpoints)) {
    if (!object(saved) || id !== saved.id || !s.campaign.missions[saved.missionId] || !Number.isInteger(saved.stage) || typeof saved.label !== 'string' || saved.label.length > 200 || saved.data?.version !== s.version || !validateBody(saved.data) || saved.data.checkpoints || saved.data.missionEntries || saved.data.replayCanonical || saved.data.campaign.activeMissionId !== saved.missionId || saved.data.mission.stage !== saved.stage) return false;
    if (saved.stage > s.campaign.missions[saved.missionId].mission.stage) return false;
    for (const [missionId, history] of Object.entries(saved.data.campaign.missions)) {
      const current = s.campaign.missions[missionId];
      if (history.mission.stage > current.mission.stage || history.mission.completed && !current.mission.completed) return false;
    }
  }
  const cp = s.checkpoints[recordFor(s).checkpointId];
  if (!cp || cp.missionId !== s.mission.id || cp.stage > s.mission.stage) return false;
  for (const [id, entry] of Object.entries(s.missionEntries)) if (!s.campaign.missions[id] || entry.version !== s.version || !validateBody(entry) || entry.checkpoints || entry.missionEntries || entry.replayCanonical) return false;
  if (s.replayCanonical && (nested || s.replayCanonical.version !== s.version || !validateFull(s.replayCanonical, true) || !s.replayCanonical.campaign.missions[s.campaign.replayMissionId]?.mission.completed)) return false;
  if (nested && s.replayCanonical) return false;
  return true;
}
function reconcile(s) {
  const authored = new Map([
    openingShape.player, openingShape.horse, ...openingShape.npcs, ...openingShape.enemies, ...openingShape.animals, ...openingShape.mounts, ...RESCUE_CAST, ...HUNT_CAST, ...HUNT_ANIMALS, ...RIVAL_CAST, ...RIVAL_ENEMIES,...(s.version>=5?Train.TRAIN_ENTITY_SPECS:[]),
    ...NORTH_CUTTING_WORLD.predators.map(wolf => ({ ...wolf, name: 'Timber wolf', kind: 'wolf', faction: 'wild' })),
  ].map(actor => [actor.id, actor]));
  for (const actor of Object.values(s.entities)) {
    const original = authored.get(actor.id);
    for (const key of ['name', 'role', 'faction', 'kind', 'child']) {
      if (original[key] !== undefined) actor[key] = original[key];
      else if (['role', 'faction', 'child'].includes(key)) delete actor[key];
    }
  }
  const winter = s.regions.snowbound;
  winter.supplies = SNOWBOUND_WORLD.supplies.map(item => ({ ...winter.supplies.find(saved => saved.id === item.id), ...item }));
  s.campaign.missions[OPENING_ID].mission.name = 'The Last Warm Light';
  s.campaign.missions[Rescue.RESCUE_ID].mission.name = 'A Voice Under Ice';
  s.sideQuests.silas.name = 'A Voice Under Ice';
  if (s.campaign.missions[Hunt.HUNT_ID]) s.campaign.missions[Hunt.HUNT_ID].mission.name = 'A Quiet Table';
  if (s.campaign.missions[Rival.RIVAL_ID]) s.campaign.missions[Rival.RIVAL_ID].mission.name = 'The Names They Took';
  for (const saved of Object.values(s.checkpoints || {})) reconcile(saved.data);
  for (const entry of Object.values(s.missionEntries || {})) reconcile(entry);
  if (s.replayCanonical) reconcile(s.replayCanonical);
}
function upgradeVersion2(s) {
  // Validation precedes migration; each historical body gets its own new state.
  s.version = 3; s.itemInstances = {};
  s.regions['willow-run'] = { residentIds: [], worldChanges: {}, supplies: [], dropped: {} };
  s.campaign.missions[Hunt.HUNT_ID] = Hunt.createHuntRecord();
  if (s.campaign.missions[Rescue.RESCUE_ID].mission.completed) {
    s.campaign.missions[Hunt.HUNT_ID].status = 'unstarted';
    s.campaign.unlocks['campaign-the-aftermath-of-genesis'] = { available: true, requirementKnown: true };
    bind(s); Hunt.ensureHuntCast(s, context);
    s.campaign.missions[Rescue.RESCUE_ID].mission.objective = 'Silas is home and healing. Speak with Orla in the drying-shed kitchen about fresh food.';
  }
  for (const saved of Object.values(s.checkpoints || {})) upgradeVersion2(saved.data);
  for (const entry of Object.values(s.missionEntries || {})) upgradeVersion2(entry);
  if (s.replayCanonical) upgradeVersion2(s.replayCanonical);
  bind(s);
}
function upgradeVersion3(s) {
  // Called only after the complete old graph has passed its own schema. Each
  // history independently gains an unstarted/locked sibling; no gift or custody
  // transaction follows from adding the operation to an earlier journey.
  s.version=4;
  s.regions['bellwether-works']={residentIds:[],worldChanges:{},supplies:[],dropped:{}};
  s.campaign.missions[Rival.RIVAL_ID]=Rival.createRivalRecord();
  if(s.campaign.missions[Rescue.RESCUE_ID].mission.completed) {
    s.campaign.missions[Rival.RIVAL_ID].status='unstarted';
    s.campaign.unlocks['campaign-old-friends']={available:true,requirementKnown:true};
    bind(s); Rival.ensureRivalCast(s,context);
    s.campaign.missions[Rescue.RESCUE_ID].mission.objective='Silas is home and healing. Orla’s food journey and the Bellwether expedition are both available at camp.';
  }
  for(const saved of Object.values(s.checkpoints||{})) upgradeVersion3(saved.data);
  for(const entry of Object.values(s.missionEntries||{})) upgradeVersion3(entry);
  if(s.replayCanonical) upgradeVersion3(s.replayCanonical);
  bind(s);
}
function upgradeVersion4(s){
  // Full owning-codec validation precedes this extension. Every snapshot gains
  // its own empty record; no custody, kit, cap, actor or dialogue is invented.
  if(!legacyContinuationFieldsAbsent(s)||Object.values(s.entities).some(actor=>actor.support!=null)||Train.TRAIN_ENTITY_IDS.some(id=>Object.hasOwn(s.companions,id)))throw new TypeError('Older graph contains undeclared future continuation facts');
  s.version=5;s.regions[TRAIN_WORLD.id]={residentIds:[],worldChanges:{},supplies:[],dropped:{}};
  s.campaign.missions[Train.TRAIN_ID]=Train.createTrainRecord();enableRivalContinuation(s.campaign.missions[Rival.RIVAL_ID]);
  if(s.campaign.missions[Hunt.HUNT_ID].mission.completed&&s.campaign.missions[Rival.RIVAL_ID].mission.completed)s.campaign.missions[Train.TRAIN_ID].status='unstarted';
  for(const saved of Object.values(s.checkpoints||{}))upgradeVersion4(saved.data);
  for(const entry of Object.values(s.missionEntries||{}))upgradeVersion4(entry);
  if(s.replayCanonical)upgradeVersion4(s.replayCanonical);
  bind(s);
}
export function validateLegacyCampaign(raw){
  try{const parsed=typeof raw==='string'?JSON.parse(raw):copy(raw);return parsed?.version===1?!!Opening.restoreCampaign(parsed):[2,3,4].includes(parsed?.version)&&validateFull(parsed);}catch{return false;}
}
export function restoreCampaign(raw) {
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : copy(raw); } catch { return null; }
  if (parsed?.version === 1) {
    const valid = Opening.restoreCampaign(parsed);
    if(!valid)return null;
    try{const s=migrateValidated(valid);if(!validateFull(s))return null;upgradeVersion4(s);return validateFull(s)?s:null;}catch{return null;}
  }
  try {
    if (!validateFull(parsed)) return null;
    if (parsed.version === 2) { upgradeVersion2(parsed); if (!validateFull(parsed)) return null; }
    if (parsed.version === 3) { upgradeVersion3(parsed); if (!validateFull(parsed)) return null; }
    if(parsed.version===4){upgradeVersion4(parsed);if(!validateFull(parsed))return null;}
    reconcile(parsed);
    parsed.notices = []; parsed.bullets = [];
    bind(parsed); clearTransientActions(parsed); Opening.resetCampaignPresentation(parsed);
    notice(parsed, 'Campaign journey restored.'); return parsed;
  } catch { return null; }
}
