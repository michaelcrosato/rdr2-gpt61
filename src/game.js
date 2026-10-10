import * as Sim from './frontier.js';
import { createWorldRenderer } from './world-renderer.js';
import { createSnowboundRenderer } from './snowbound-renderer.js';
import { createNorthCuttingRenderer } from './north-cutting-renderer.js';
import { createWillowRunRenderer } from './willow-run-renderer.js';
import { createBellwetherRenderer } from './bellwether-renderer.js';
import { huntAnimalHitZones } from '../content/campaign/willow-run.js';
import { resolvePointerAim, resolveHuntPointerAim } from './aiming.js';
import { createSnowboundAudio } from './snowbound-audio.js';
import { castPortrait } from './cast-portraits.js';
import { rescueJournalDrawing } from './campaign-journal.js';
import { QUARRY_POCKET_OBJECTS } from '../content/campaign/quarry-papers.js';
import {saveSlotFor} from './save-slots.js';
import {createSaveRepository} from './save-database.js';
import {createTrainCampWorkView} from './train-camp-work-view.js';

const E = globalThis.My3D2dge;
const $ = (id) => document.getElementById(id);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OPENING_ID = 'snowbound-the-last-warm-light';
const RESCUE_ID = 'snowbound-a-voice-under-ice';
const HUNT_ID = 'snowbound-a-quiet-table';
const RIVAL_ID = 'snowbound-the-names-they-took';
const TRAIN_ID = 'snowbound-what-the-line-carries';
const PREFERENCES_KEY = 'dust-mercy.preferences.v1';
const requestedMode = new URLSearchParams(location.search).get('mode') === 'mercy' ? 'mercy' : 'campaign';
const input = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  start: ['Enter', 'Pad9'], interact: ['KeyE', 'Pad0'], shoot: ['Mouse0', 'KeyJ', 'Pad7'], aim: ['Mouse2', 'Pad6'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad10'], focus: ['Space', 'Pad5'], reload: ['KeyR', 'Pad2'], whistle: ['KeyH', 'Pad1'],
  crouch: ['KeyC', 'Pad11'], pause: ['Escape', 'KeyP', 'Pad8'], map: ['KeyM'], journal: ['KeyL'], satchel: ['KeyI'],
  tonic: ['Digit1'], coffee: ['Digit2'], oats: ['Digit3'],
  cancelDraw: ['KeyX'], holster: ['KeyQ', 'Pad3'], block: ['KeyF', 'Pad4'], shove: ['KeyV'], restrain: ['KeyB'],
};
const game = new E.Game({ canvas: 'screen', view: 'threequarter', views: ['threequarter'], minH: 400, minW: 360, maxW: 1600, maxH: 1200, input, bg: '#838849' });
const campWorkView=createTrainCampWorkView(document);
const normalView = E.VIEWS.threequarter;
const sightglassView = new E.View('rival-sightglass','Quarry sightglass',normalView.yawDeg,normalView.pitchDeg,normalView.scale,normalView.zBoost);
const campDetailView = new E.View('train-camp-detail','Camp preparation',normalView.yawDeg,normalView.pitchDeg,normalView.scale*1.35,normalView.zBoost);
const snowboundAudio = createSnowboundAudio(game.audio);
let state = Sim.createState(requestedMode), started = false, activePanel = '', previousDialog = null;
const renderers = new Map();
function rendererForState() {
  const id = Sim.isCampaign(state) ? state.region : 'mercy';
  if (!renderers.has(id)) renderers.set(id, id === 'bellwether-works' ? createBellwetherRenderer(game) : id === 'north-cutting' ? createNorthCuttingRenderer(game) : id === 'willow-run' ? createWillowRunRenderer(game) : id === 'snowbound' ? createSnowboundRenderer(game) : createWorldRenderer(game));
  return renderers.get(id);
}
let world = rendererForState();
// Read-only rendered-frame diagnostics; never exposes a mutable journey.
game.inspectTrainCampPresentation=()=>state.region==='snowbound'?renderers.get('snowbound')?.inspectTrainCampAnimation()??null:null;
let renderedRegion = state.region;
const progressKey = () => `${state.region}:${state.mission.id}:${state.mission.stage}:${state.mission.completed}`;
let uiClock = 0, saveClock = 0, lastProgress = progressKey(), noticeText = '', statusTimer, previousShopSnapshot = '';
let muted = false, touchMove = [0, 0], touchHeld = new Set(), stickPointer = null;
let pointerMode = false, padAim = null, gameplaySpaceHeld = false, touchCrouching = false;
let bowFireHeld = false, bowBlockedUntilRelease = false, huntPadCursor = null;
const bowEquipped = () => state.mission.id === HUNT_ID && state.weapons?.[state.player.equippedWeaponId]?.kind === 'bow';
function cancelBowInput() {
  Sim.cancelDraw(state); bowBlockedUntilRelease = true; bowFireHeld = false;
}
function setTouchCrouch(crouching) {
  touchCrouching = crouching;
  document.querySelector('[data-action="crouch"]').setAttribute('aria-pressed', String(crouching));
}
function syncRegionView() {
  if (renderedRegion === state.region && world === rendererForState()) return;
  cancelBowInput(); huntPadCursor = null;
  renderedRegion = state.region; world = rendererForState(); game.cam.snap = true;
  pointerMode = false; padAim = null;
  setTouchCrouch(false);
  state.aiming = false; state.pointer = null; state.interactionTarget = null;
  if (Sim.isCampaign(state)) snowboundAudio.reset(state);
}
try {
  const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {};
  muted = preferences.muted === true;
  if (typeof preferences.reduceMotion === 'boolean') game.reduceMotion = preferences.reduceMotion;
  if (['1', '1.2', '1.4'].includes(preferences.textScale)) document.documentElement.style.setProperty('--dialogue-scale', preferences.textScale);
} catch { /* Browser storage is optional; device defaults still apply. */ }
function savePreferences() {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ muted, reduceMotion: game.reduceMotion, textScale: document.documentElement.style.getPropertyValue('--dialogue-scale') || '1' })); } catch { /* Current preferences remain usable. */ }
}
const music = { bpm: 68, steps: 2, tracks: [
  { wave: 'triangle', vol: .12, notes: 'D3 - - . A3 - . . | F3 - - . C4 - . . | G3 - - . D4 - . . | A3 - - . E3 - . .' },
  { wave: 'sine', vol: .055, notes: 'D2 - - - - - . . | F2 - - - - - . . | G2 - - - - - . . | A2 - - - - - . .' },
] };
document.body.classList.add('intro');

const deviceSaves=createSaveRepository({restore:raw=>Sim.restore(raw),modeOf:value=>Sim.isCampaign(value)?'campaign':'mercy'});
let saveRequest=0,startRequest=0,journeyGeneration=0,reviewDisposition=null;
function savedJourney(mode = started ? Sim.isCampaign(state) ? 'campaign' : 'mercy' : requestedMode) {
  try{for(const raw of deviceSaves.candidates(mode)){const restored=Sim.restore(raw);if(restored&&(mode==='campaign'||!Sim.isCampaign(restored)))return restored;}}catch{}
  return null;
}
async function loadSavedJourney(mode){
  try{for(const raw of await deviceSaves.loadCandidates(mode)){const restored=Sim.restore(raw);if(restored&&(mode==='campaign'||!Sim.isCampaign(restored)))return restored;}}catch{announce('The saved journey could not be read. Your current journey can still be exported.');}
  return null;
}
$('continue-game').hidden=true;
function announce(text) {
  clearTimeout(statusTimer); $('save-status').textContent = text;
  statusTimer = setTimeout(() => { $('save-status').textContent = ''; }, 5000);
}
function saveJourney(manual = false) {
  if (!started||reviewDisposition&&!manual)return Promise.resolve(false);
  const generation=journeyGeneration,review=reviewDisposition,request=++saveRequest,status=$('save-status');status.dataset.saveRequest=String(request);status.dataset.saveState='saving';
  let serialized,slot;
  try{serialized=Sim.serialize(state);slot=saveSlotFor(Sim.isCampaign(state)?'campaign':'mercy');}
  catch{status.dataset.saveState='failed';announce('The journey could not be saved. Export it from the menu.');return Promise.resolve(false);}
  announce(manual?'Saving journey…':'Saving…');
  return deviceSaves.save(slot,serialized,{preservePrevious:!!review}).then(()=>{
    if(reviewDisposition===review&&generation===journeyGeneration)reviewDisposition=null;
    if(request===saveRequest&&generation===journeyGeneration){status.dataset.saveState='saved';status.dataset.saveCommit=String(request);announce(manual?'Journey saved on this device.':'Journey saved.');}
    return true;
  },()=>{
    if(request===saveRequest&&generation===journeyGeneration){status.dataset.saveState='failed';announce('This browser cannot save locally. Export your journey in the menu.');}
    return false;
  });
}
async function startJourney(continueSaved = false, mode = requestedMode) {
  game.audio.sfx('confirm',{vol:0});
  const request=++startRequest;await deviceSaves.ready;
  const next=continueSaved?await loadSavedJourney(mode):Sim.createState(mode);
  if(request!==startRequest)return;
  if(!next){announce('No valid journey was found.');return;}
  beginJourney(next);
}
function invalidateJourneyAcknowledgement(){
  journeyGeneration++;
  const status=$('save-status');clearTimeout(statusTimer);status.textContent=reviewDisposition?'Reviewing another journey. Save to make it current.':'';status.dataset.saveState=reviewDisposition?'preview':'unsaved';delete status.dataset.saveRequest;delete status.dataset.saveCommit;
}
function beginJourney(next,{review=null}={}) {
  reviewDisposition=review;invalidateJourneyAcknowledgement();
  cancelBowInput(); state = next; huntPadCursor = null;
  world = rendererForState(); renderedRegion = state.region;
  pointerMode = false; padAim = null; setTouchCrouch(false); touchHeld.clear(); releaseStick();
  state.aiming = false; state.pointer = null; state.interactionTarget = null;
  started = true; lastProgress = progressKey(); saveClock = 0;
  document.body.classList.remove('intro'); $('welcome').hidden = true; $('hud').hidden = false;
  game.cam.snap = true; game.input.clear();
  if (Sim.isCampaign(state)) snowboundAudio.reset(state); else game.audio.music(music);
  $('screen').focus({ preventScroll: true }); updateUI();
}

function closePanel() {
  activePanel = ''; if ($('panel').open) $('panel').close(); game.input.clear();
  if (started) $('screen').focus({ preventScroll: true });
}
function openPanel(id) {
  if (!started&&!['menu','recoveries'].includes(id))return;
  if (state.dialog) return;
  if (activePanel === id) { closePanel(); return; }
  cancelBowInput(); activePanel = id; game.input.clear(); touchHeld.clear(); touchMove = [0, 0];
  renderPanel(); if (!$('panel').open) $('panel').showModal();
}
function downloadJourneyBytes(raw){
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='dust-and-mercy-journey.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Journey exported.');
}

function panelRow(title, description, buttons = '') {
  return `<div class="panel-row"><div><h3>${escape(title)}</h3><p>${escape(description)}</p></div><div class="row-buttons">${buttons}</div></div>`;
}
function button(label, action, id, disabled = false) {
  return `<button data-command="${escape(action)}" data-id="${escape(id)}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
}
function completedStories() {
  if (!Sim.isCampaign(state)) return [];
  return state.campaign ? Object.values(state.campaign.missions).filter(record => record.mission.completed) : state.mission.completed ? [{ mission: state.mission, performance: state.performance }] : [];
}
function journeyMarks(record) {
  const mark = passed => passed ? '✓' : '○', p = record.performance;
  if (record.mission.id === OPENING_ID) return `<p>${mark(p.noYardInjury)} No injury in the boiler yard<br>${mark(p.allSixSupplies)} All six supply objects recovered<br>${mark(p.accurate)} At least 80% shooting accuracy · ${Math.round(p.accuracy * 100)}%</p>`;
  if (record.mission.id === HUNT_ID) return `<p>${mark(p.oneArrowEach)} Each deer killed with one arrow<br>${mark(p.noSpook)} Neither deer frightened<br>${mark(p.secondCleanKill)} Second deer killed cleanly</p>`;
  if (record.mission.id === RESCUE_ID) return `<p>${mark(p.allWolvesNoBites)} All seven wolves killed without a bite<br>${mark(p.accuracy80)} At least 80% shooting accuracy · ${Math.round(p.shots ? p.hits / p.shots * 100 : 0)}%</p>`;
  if (record.mission.id === RIVAL_ID) return `<p>${mark(p.quickCapture)} Levi bound within 55 seconds<br>${mark(p.threeFocusKills)} Three kills in one automatic focus sequence<br>${mark(p.fifteenHeadshots)} Fifteen actual headshot kills<br>${mark(p.noHealingItems)} No healing supplies used<br>${mark(p.underTime)} Operation completed within 22 minutes</p>`;
  return '';
}
function renderSnowboundMap(region) {
  const north = state.region === 'north-cutting';
  const trail = (north ? region.trail : [{ x: 320, y: 1100 }, ...region.trail]).map(p => `${p.x},${p.y}`).join(' ');
  const places = region.places.map(p => `<circle cx="${p.x}" cy="${p.y}" r="8" fill="#42535e"/><text x="${p.x + 20}" y="${p.y - 14}" class="map-small">${escape(p.name)}</text>`).join('');
  const rooms = (region.interiors || []).map(room => `<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="#a99b79" fill-opacity=".45"/>`).join('');
  const walls = region.obstacles.map(w => `<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="#4d5b60" fill-opacity=".6"/>`).join('');
  if (state.region === 'willow-run') {
    const line = points => points.map(p => `${p.x},${p.y}`).join(' ');
    const confirmed = region.props.filter(prop => state.tracks?.inspected?.[prop.id]).map(prop => `<circle cx="${prop.x}" cy="${prop.y}" r="15" fill="none" stroke="#8a573f" stroke-width="4"/>`).join('');
    $('panel-body').innerHTML = `<svg class="map-art willow-map" viewBox="0 0 ${region.width} ${region.height}" role="img" aria-label="Willow Run map with Mara, inspected sign, stream, ford and hillside return"><rect width="${region.width}" height="${region.height}" fill="#b5b69a"/><polyline points="${line(region.stream)}" fill="none" stroke="#628985" stroke-width="56"/>${walls}<polyline points="${line(region.trail)}" fill="none" stroke="#766746" stroke-width="10" stroke-dasharray="18 8"/><polyline points="${line(region.returnRoute)}" fill="none" stroke="#7b5945" stroke-width="8" stroke-dasharray="12 12"/>${places}${confirmed}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="15"/><text x="${state.player.x + 25}" y="${state.player.y + 40}" class="map-small">MARA</text><text x="${region.width - 170}" y="100">N ↑</text></svg><div class="map-legend"><span>● Mara Vale</span><span>○ Inspected sign</span><span>┄ Sheltered return</span></div><p class="panel-copy">Hitch at the sheltered bank and follow fresh hoofprints and browsed stems. Cross the shallow ford for the cedar shelf. The bear is across the gorge; bring both loads home along the hillside.</p>`;
    return;
  }
  if (north) {
    const line = points => points.map(p => `${p.x},${p.y}`).join(' ');
    const shelfNames = { 'ledge-one': 'Lower ledge', 'upper-arch': 'Upper arch', recess: 'Maintenance recess', 'south-middle': 'Middle descent shelf', 'south-lower': 'Lower descent shelf' };
    const heights = region.elevationZones.map(zone => `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" fill="#657680" fill-opacity="${.12 + zone.z / 600}"/><text x="${zone.x + 10}" y="${zone.y + 20}" class="map-small">${escape(shelfNames[zone.id] || 'Cliff shelf')}</text>`).join('');
    const sign = region.props.filter(prop => state.tracks?.inspected?.[prop.id]).map(prop => `<circle cx="${prop.x}" cy="${prop.y}" r="15" fill="none" stroke="#a3694f" stroke-width="5"/>`).join('');
    $('panel-body').innerHTML = `<svg class="map-art snow-map" viewBox="0 0 ${region.width} ${region.height}" role="img" aria-label="North Cutting map with Mara, confirmed tracks, river, cliff ledges and the return creek"><rect width="${region.width}" height="${region.height}" fill="#c1c7b5"/><polyline points="${line(region.river)}" fill="none" stroke="#779998" stroke-width="55"/>${heights}${walls}<polyline points="${trail}" fill="none" stroke="#667a82" stroke-width="10" stroke-dasharray="18 8"/><polyline points="${line(region.searchRoute)}" fill="none" stroke="#887658" stroke-width="7" stroke-dasharray="12 12"/><polyline points="${line(region.creekRoute)}" fill="none" stroke="#547c7d" stroke-width="12"/>${places}${sign}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="15"/><text x="${state.player.x + 25}" y="${state.player.y + 40}" class="map-small">MARA</text><text x="${region.width - 170}" y="100">N ↑</text></svg><div class="map-legend"><span>● Mara Vale</span><span>○ Confirmed sign</span><span>— Return creek</span></div><p class="panel-copy">Read the tracks at Ash camp and Split Ford. Leave both mounts at the shelf before climbing. The southern ramp is wide enough to carry Silas; the return creek conceals the party’s trail.</p>`;
    return;
  }
  $('panel-body').innerHTML = `<svg class="map-art snow-map" viewBox="0 0 ${region.width} ${region.height}" role="img" aria-label="Snowbound mountain map with Mara, the switchback, refuge, station, interior door gaps and animal pen"><defs><pattern id="snow-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#657983" stroke-width="1" opacity=".2"/></pattern></defs><rect width="1800" height="1400" fill="url(#snow-grid)"/><path d="M30 300Q300 70 600 300T1100 170M40 400Q300 170 600 410T1050 280M50 500Q320 280 560 500" fill="none" stroke="#84939b" stroke-width="12" opacity=".25"/><polyline points="${trail}" fill="none" stroke="#667a82" stroke-width="10" stroke-dasharray="18 8"/>${rooms}${walls}${places}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="15"/><text x="${state.player.x + 25}" y="${state.player.y + 40}" class="map-small">MARA</text><text x="1650" y="100">N ↑</text><text class="map-small" x="70" y="1320">SNOWBOUND · FOLLOW THE WIRE</text></svg><div class="map-legend"><span>● Mara Vale</span><span>┄ Switchback trail</span><span>▣ Shelter & cover</span></div><p class="panel-copy">Follow the telegraph line from the kiln to the traveling hitch. The relay room opens to the south and west; the coal store opens to the north and east. The stone service walkway lies west of the station.</p>`;
}
function renderPanel() {
  const campaign = Sim.isCampaign(state), items = Sim.itemsFor(state), region = Sim.worldFor(state);
  const titles = { map: ['THE COUNTRY AHEAD', campaign ? state.region === 'bellwether-works' ? 'Bellwether Works' : state.region === 'willow-run' ? 'Willow Run' : state.region === 'north-cutting' ? 'North Cutting' : 'Snowbound' : 'Mercy Vale'], journal: ['THE MARKS WE LEAVE', 'Your journal'], satchel: ['READY FOR THE ROAD', 'Your satchel'], menu: ['TAKE A BREATH', 'Dust & Mercy'] };
  const [kicker, title] = titles[activePanel] || titles.menu;
  $('panel-title').textContent = title; $('panel-kicker').textContent = kicker;
  if(activePanel==='recoveries'){
    $('panel-title').textContent='Other saved journeys';$('panel-kicker').textContent='REVIEW BEFORE CHANGING';
    const copies=deviceSaves.recoveries();
    $('panel-body').innerHTML='<p class="panel-copy">These journeys differ from your current saved journey. Load one to review it while paused, or export its original file. Automatic saves stay off during review; Save makes the reviewed journey current.</p>'+copies.map(copy=>{const restored=Sim.restore(copy.raw);return panelRow(restored.mission.name,`${Sim.isCampaign(restored)?'Snowbound campaign':'Mercy Vale'} · Day ${restored.day} · ${formatTime(restored.time)} · ${restored.mission.completed?'Completed':`Scene ${restored.mission.stage+1}`}`,button('Load for review','recover-load',copy.key)+button('Export original copy','recover-export',copy.key));}).join('');return;
  }
  if (activePanel === 'actions') {
    $('panel-title').textContent = 'Within reach'; $('panel-kicker').textContent = 'PEOPLE AND EQUIPMENT';
    $('panel-body').innerHTML = `<p class="panel-copy">Choose an action available at your current position.</p><div class="menu-buttons">${Sim.getInteractions(state).map(action=>button(action.label,'nearby',action.id)).join('') || '<p>No action is within reach. Return to the trail and move closer.</p>'}</div>`;
    return;
  }
  if (activePanel === 'map') {
    if(campaign&&state.region==='bellwether-works'){
      const lines=[region.trail,region.descent,region.convoyRoute,region.chase.route,region.returnRoute].map(path=>`<polyline points="${path.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#798880" stroke-width="12" stroke-dasharray="24 12"/>`).join('');
      const cover=region.obstacles.map(o=>`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#665e49" opacity=".5"/>`).join('');
      const places=region.places.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="12" fill="#4c5c50"/><text x="${p.x+25}" y="${p.y-16}" font-size="35">${escape(p.name)}</text>`).join('');
      $('panel-body').innerHTML=`<svg class="map-art snow-map rival-map" viewBox="0 0 ${region.width} ${region.height}" role="img" aria-label="Bellwether Works, observation ridge, quarry searches, patrol approaches and return routes">${cover}${lines}${places}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="20"/></svg><p class="panel-copy">The observation ridge overlooks the traverser. The magazine, cap wagon and weighhouse are separate searches. Follow the real horse ramp and pulley creek; cover and doorways are shown where they block travel.</p>`;return;
    }
    if (campaign) { renderSnowboundMap(region); return; }
    const river = Array.from({ length: 31 }, (_, i) => `${Sim.riverX(i * 40)},${i * 40}`).join(' ');
    const places = Sim.WORLD.places.map(p => `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#424b35"/><text x="${p.x + 24}" y="${p.y - 14}">${escape(p.name)}</text>`).join('');
    $('panel-body').innerHTML = `<svg class="map-art" viewBox="0 0 1600 1200" role="img" aria-label="Mercy Vale map with your position and named locations"><defs><pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#a08e64" stroke-width="1" opacity=".35"/></pattern></defs><rect width="1600" height="1200" fill="url(#map-grid)"/><path d="M70 170Q300 30 580 140T900 100M60 230Q300 110 580 230T900 170M1170 160Q1430 80 1560 210M1100 220Q1390 150 1560 290" fill="none" stroke="#a18c61" stroke-width="9" opacity=".4"/><polyline points="${river}" fill="none" stroke="#66897e" stroke-width="55"/><path d="M0 655L320 605L720 690L1010 510L1600 800M760 675L1040 880L1160 930L1600 980M1010 280V660" fill="none" stroke="#9c8056" stroke-width="9" stroke-dasharray="15 8"/><path d="M935 949H1600" stroke="#5c654b" stroke-width="9"/><path d="M${Sim.riverX(605) - 60} 605h120" stroke="#514f38" stroke-width="24"/>${places}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="15"/><text class="map-small" x="${state.player.x + 23}" y="${state.player.y + 40}">MARA</text><text x="1450" y="90">N ↑</text><text class="map-small" x="70" y="1130">MERCY VALE · A COUNTRY UNDER CONTRACT</text></svg><div class="map-legend"><span>● Mara Vale</span><span>— River</span><span>┄ Trail</span></div><p class="panel-copy">Cross the river at the bridge near Juniper Woods. Cinder Pump lies southeast of Mercy Crossing. The world continues when you close the map.</p>`;
  } else if (activePanel === 'journal') {
    const quests = Object.entries(state.sideQuests).filter(([,q]) => q.stage > 0).map(([id,q]) => `<li>${escape(q.name)}<small>${q.complete ? 'COMPLETED' : campaign && id === 'silas' && q.unlocked && state.campaign?.missions[RESCUE_ID]?.status === 'unstarted' ? 'AVAILABLE AT THE KILN' : campaign && q.unlocked && (id !== 'silas' || !state.campaign) ? 'NEXT STORY · NOT AVAILABLE YET' : 'IN PROGRESS'}</small></li>`).join('');
    const log = state.log.slice().reverse().map(entry => `<div class="log-entry"><small>DAY ${entry.day} · ${formatTime(entry.time)}</small>${escape(entry.text)}</div>`).join('');
    const history = completedStories().map(record => `<div class="panel-copy"><h3>${escape(record.mission.name)}</h3>${journeyMarks(record)}${button('Replay this story', 'story', `replay:${record.mission.id}`, !!state.replayCanonical)}</div>`).join('');
    $('panel-body').innerHTML = `<p class="eyebrow">${state.mission.completed ? 'COMPLETED' : 'CURRENT STORY'}</p><h3>${escape(state.mission.name)}</h3><p class="panel-copy">${escape(state.mission.objective)}</p>${button('Read notebook', 'notebook', '')}${quests ? `<ul class="quest-list">${quests}</ul>` : ''}${history ? `<h3>The marks of this journey</h3>${history}` : ''}<section id="notebook"><p class="eyebrow" style="margin-top:24px">FROM MARA’S NOTEBOOK</p>${rescueJournalDrawing(state)}${log}</section>`;
  } else if (activePanel === 'satchel') {
    let html = `<p class="panel-copy">$${state.player.money.toFixed(2)} · ${state.player.reserve} spare cartridges · ${escape(state.horse.name)}’s bond ${state.horse.bond.toFixed(1)} / 4</p>`;
    if (campaign && state.weapons) {
      html += '<h3>Weapons</h3>';
      for (const weapon of Object.values(state.weapons)) {
        if(!['mara','community-rescue-chest'].includes(weapon.owner))continue;
        const selected = state.player.equippedWeaponId === weapon.id;
        const rack = state.entities[weapon.rackMountId];
        const withinReach = weapon.location === 'carried' || weapon.location === 'saddle' && rack && Math.hypot(state.player.x - rack.x, state.player.y - rack.y) <= 58 && Math.abs((state.player.z || 0) - (rack.z || 0)) < 6;
        const needsInspection = weapon.kind === 'bow' && state.mission.id === HUNT_ID && !state.flags.bowInspected || weapon.kind === 'carbine' && state.mission.id === RIVAL_ID && !state.flags.carbineInspected;
        const canSelect = [RESCUE_ID, HUNT_ID, RIVAL_ID, TRAIN_ID].includes(state.mission.id) && withinReach && !needsInspection && !state.player.carrying && !state.player.toolHeld && !state.traversal?.player;
        html += panelRow(weapon.name || (weapon.kind === 'coach-gun' ? 'Short coach gun' : 'Vale revolver'), `${weapon.kind === 'lariat' ? 'Reusable working rope' : `${weapon.ammo} loaded · ${weapon.reserve} spare ${weapon.kind === 'bow' ? 'arrows' : weapon.kind === 'coach-gun' ? 'shells' : 'rounds'}`} · ${weapon.loanMissionId ? 'Community loan' : 'Owned'}${weapon.location === 'saddle' ? ` · On ${rack?.name || 'the horse'}’s rack` : ''}${needsInspection ? ` · Inspect the ${weapon.kind === 'carbine' ? 'carbine' : 'bow'} beside Copper before equipping it.` : ''}`, button(selected ? 'Equipped' : needsInspection ? 'Inspect at rack' : 'Equip', 'equipment', `equip:${weapon.id}`, selected || !canSelect));
      }
    }
    if (campaign && state.itemInstances && Object.keys(state.itemInstances).length) {
      html += '<h3>Hides and tools</h3>';
      for (const item of Object.values(state.itemInstances)) html += panelRow(item.kind === 'face-covering' ? escape(item.name) : item.kind === 'field-knife' ? 'Field skinning knife' : `${item.sourceEntityId === 'willow-creek-doe' ? 'Creek doe' : 'Cedar buck'} hide · Quality ${item.quality} / 3`, `${item.owner === 'community' ? 'Community owned' : 'Owned'} · ${item.location.type.replaceAll('-', ' ')}`, item.kind === 'deer-hide' && item.owner === 'mara' ? button('Carry hide', 'equipment', `take-hide:${item.id}`, item.location.type === 'carried') + button('Store on Copper', 'equipment', `store-hide:${item.id}`, item.location.type === 'saddle') : '');
    }
    const pocketObjects=campaign&&state.campaign?.missions[RIVAL_ID]?.objects;
    const personalPapers=QUARRY_POCKET_OBJECTS.filter(paper=>pocketObjects?.[paper.id]?.owner==='mara');
    if(personalPapers.length){
      html+='<h3>Recovered personal belongings</h3>';
      for(const paper of personalPapers)html+=`<article class="panel-copy" data-pocket-object="${paper.id}"><h4>${escape(paper.name)}</h4><p style="white-space:pre-line">${escape(paper.text)}</p><small>Owned by Mara · From ${escape(state.entities[paper.sourceEntityId]?.name||'the individual pocket')}</small></article>`;
    }
    for (const [id, item] of Object.entries(items)) {
      if (id === 'ammo') continue;
      const count = state.inventory[id] || 0;
      if (!count && !['tonic', 'coffee', 'oats', 'meat', 'pelt', 'trout'].includes(id)) continue;
      const usable = ['tonic', 'coffee', 'oats', 'meat', 'cookedMeat', 'bandages', 'broth', 'warmRation', 'quietRation', 'tableBroth', 'warmCider'].includes(id);
      html += panelRow(`${item.name} × ${count}`, item.description || '', usable ? button('Use', 'use', id, !count) : '');
    }
    const campDist = Math.hypot(state.player.x - 690, state.player.y - 750);
    if (!campaign && Sim.RECIPES) {
      html += '<h3>Fieldcraft</h3><p class="panel-copy">Gather along the trails. Prepare supplies by Reed Camp’s fire.</p>';
      for (const [id, recipe] of Object.entries(Sim.RECIPES)) {
        const needs = recipe.ingredients || recipe.cost || {};
        const requirements = Object.entries(needs).map(([item, qty]) => `${qty} ${Sim.ITEMS[item]?.name || item}`).join(', ');
        html += panelRow(recipe.name || id, requirements, button('Craft', 'craft', id, campDist >= 160));
      }
    }
    if (!campaign && state.camp) {
      html += `<h3>Reed Camp</h3><p class="panel-copy">Food ${Math.floor(state.camp.food)} · Medicine ${Math.floor(state.camp.medicine)} · Materials ${Math.floor(state.camp.materials)} · Morale ${Math.floor(state.camp.morale)} / 100</p>`;
      for (const [id, count] of Object.entries(state.inventory)) {
        if (count > 0 && ['meat', 'trout', 'berries', 'cookedMeat', 'herbs', 'tonic', 'timber'].includes(id)) html += panelRow(`Give ${Sim.ITEMS[id]?.name || id}`, `${count} in your satchel`, button('Donate 1', 'donate', id, campDist >= 160));
      }
      for (const [id, up] of Object.entries(Sim.CAMP_UPGRADES || {})) html += panelRow(up.name || id, `$${up.price} · ${up.materials} materials${up.medicine ? ` · ${up.medicine} medicine` : ''}. ${up.description || ''}`, button(state.camp.upgrades?.[id] ? 'Built' : 'Build', 'upgrade', id, campDist >= 160 || !!state.camp.upgrades?.[id]));
    }
    if (campaign) html += `<h3>The kiln community</h3><p class="panel-copy">Food ${Math.floor(state.camp.food)} · Medicine ${Math.floor(state.camp.medicine)} · Materials ${Math.floor(state.camp.materials)}. Bring recovered essentials to the stove store at the refuge. ${state.horse.owned ? 'Copper’s ownership and care are yours.' : 'Copper still needs a patient hand.'}</p>`;
    if (campaign && state.horse.storageUnlocked) {
      const pack = state.horse.pack, used = Object.values(pack).reduce((sum, count) => sum + count, 0);
      const nearby = Math.hypot(state.player.x - state.horse.x, state.player.y - state.horse.y) < 80;
      html += `<h3>Copper’s pack · ${used} / 12</h3><p class="panel-copy">Stand beside Copper to transfer supplies between her pack and your satchel. Take camp oats from the stove store to feed her.</p>`;
      for (const [id, item] of Object.entries(items)) {
        const count = state.inventory[id] || 0, stored = pack[id] || 0;
        if (count || stored) html += panelRow(item.name, `${count} in satchel · ${stored} in pack`, button('Store 1', 'pack', `store:${id}`, !nearby || !count || used >= 12) + button('Take 1', 'pack', `withdraw:${id}`, !nearby || !stored));
      }
    }
    $('panel-body').innerHTML = html;
  } else {
    const browse = ['actions', 'map', 'journal', 'satchel'].map(name => button({ actions: 'Nearby actions', map: 'View map', journal: 'Read journal', satchel: 'Open satchel' }[name], 'panel', name, !started)).join('');
    const replays = completedStories().map(record => button(`Replay ${record.mission.name}`, 'story', `replay:${record.mission.id}`, !!state.replayCanonical)).join('');
    $('panel-body').innerHTML = `<p class="panel-copy">${reviewDisposition?'Reviewing another journey. Save to make it current. Automatic saves are off.':''}</p><div class="menu-buttons">${button('Return to the trail', 'resume', '', !started)}${button('Save journey', 'save', '', !started)}${button('Load saved journey', 'load', '', !savedJourney())}${button('Other saved journeys','panel','recoveries',deviceSaves.recoveries().length===0)}${button('Export save file', 'export', '', !started)}${button('Import save file', 'import', '')}${button(started ? 'Start a new journey' : 'Begin the story', 'new', '')}${campaign && started ? button('Retry checkpoint', 'story', 'retry') : ''}${replays}${state.replayCanonical ? button('Return to your saved world', 'story', 'finish-replay') : ''}${browse}</div><div class="menu-settings"><label><input type="checkbox" id="mute-audio" ${muted ? 'checked' : ''}> Mute music and sound</label><label><input type="checkbox" id="reduce-motion" ${game.reduceMotion ? 'checked' : ''}> Reduce motion and camera shake</label><label for="text-size">Dialogue text size <select id="text-size"><option value="1">Standard</option><option value="1.2">Large</option><option value="1.4">Extra large</option></select></label></div><div class="panel-copy"><h3>On the trail</h3><p>WASD or arrows to move · E to interact · Shift to run · H to call your horse · C to crouch. Aim with the mouse and click to shoot. With the bow, hold to draw and release to loose an arrow; X cancels the draw. R reloads. Q draws/holsters. Hold Space to focus. 1 / 2 / 3 use tonic, coffee or horse feed.</p><p>In a close fight, F blocks, V shoves, and B restrains. The same actions are available as on-screen buttons.</p><p>Controller: left stick to move, right stick to aim, A to interact, RT to shoot, LT to aim, X to reload, B to call your horse, RB to focus, Y to holster, LB to block. Press the left stick to run. View opens this menu; its map, journal and satchel controls work with the D-pad and A. With the bow, move the aiming cursor with the right stick, hold RT to draw and release to loose; X cancels. The right stick scrolls open panels. In close combat, A performs the displayed shove or restraint.</p><p>On touch screens, drag the left stick to move. Tap the world to choose an aim point. Tap Crouch to lower your stance, move with the stick, then tap it again to stand. The right-side buttons act. With the bow, tap the animal to aim, hold Fire to draw, then release. Cancel draw puts the arrow back.</p><p>Campaign build 0.5.0 · The full campaign and source coverage remain in production.</p></div><input id="save-file" type="file" accept=".json,application/json" hidden>`;
    $('text-size').value = document.documentElement.style.getPropertyValue('--dialogue-scale') || '1';
  }
}

function formatTime(hour) {
  const minutes = Math.floor(hour * 60) % 1440, h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function updateConversation() {
  const d = state.dialog;
  if (!d) { if ($('conversation').open) $('conversation').close(); previousDialog = null; previousShopSnapshot = ''; return; }
  if (previousDialog !== d) {
    cancelBowInput();
    $('speaker').textContent = d.speaker; $('dialogue-text').textContent = d.text;
    document.querySelector('.dialogue-portrait').innerHTML = Sim.isCampaign(state) ? castPortrait(d.speaker, state) : '✦';
    $('choices').innerHTML = d.choices.map((c, i) => `<button data-choice="${escape(c.id)}"><kbd>${i + 1}</kbd>${escape(c.label)}</button>`).join('');
    previousDialog = d;
    if (!$('conversation').open) { game.input.clear(); $('conversation').showModal(); }
  }
  const shopSnapshot = `${d.id}:${state.player.money}:${state.player.reserve}:${JSON.stringify(state.inventory)}`;
  if (d.shop && previousShopSnapshot !== shopSnapshot) {
    const focusedCommand = document.activeElement?.dataset.command, focusedId = document.activeElement?.dataset.id;
    $('shop').innerHTML = `<p class="eyebrow">YOUR PURSE · $${state.player.money.toFixed(2)}</p>` + Object.entries(Sim.ITEMS).map(([id, item]) => {
      return `<div class="shop-row"><div>${escape(item.name)}<small>${escape(item.description || '')} · Owned: ${id === 'ammo' ? state.player.reserve : state.inventory[id] || 0}</small></div><div class="shop-actions">${button(`Buy $${item.price}`, 'buy', id, state.player.money < item.price)}${item.sell ? button(`Sell $${item.sell}`, 'sell', id, !state.inventory[id]) : ''}</div></div>`;
    }).join('');
    previousShopSnapshot = shopSnapshot;
    if (focusedCommand && focusedId) [...$('shop').querySelectorAll('button')].find(b => b.dataset.command === focusedCommand && b.dataset.id === focusedId && !b.disabled)?.focus();
  } else if (!d.shop) { $('shop').innerHTML = ''; previousShopSnapshot = ''; }
}

function updateUI() {
  const campaign = Sim.isCampaign(state), regionName = campaign ? state.region === 'bellwether-works' ? 'BELLWETHER WORKS' : state.region === 'willow-run' ? 'WILLOW RUN' : state.region === 'north-cutting' ? 'NORTH CUTTING' : 'SNOWBOUND' : 'MERCY VALE';
  $('clock').textContent = formatTime(state.time);
  $('day-weather').textContent = `DAY ${state.day} · ${state.weather === 'snow' ? 'SNOW' : state.weather === 'rain' ? 'RAIN' : state.weather === 'overcast' ? 'OVERCAST' : regionName}`;
  document.body.dataset.region = campaign ? state.region : 'mercy';
  $('screen').setAttribute('aria-label', `${regionName} game world. Move with WASD or arrow keys and interact with E. Q draws or holsters. F blocks, V shoves and B restrains in close combat.`);
  if (!started) {
    $('welcome-place').innerHTML = `<span></span> ${regionName}, 1893`;
    $('welcome-title').innerHTML = campaign ? 'A last light<br>in the snow.' : 'Every drop<br>has a price.';
    document.querySelector('.welcome-copy').innerHTML = campaign ? 'An evicted community.<br>A signal station in the mountains.<br>One more chance to bring them home.' : 'A railroad owns the water.<br>A valley refuses to surrender.<br>And you still have a choice.';
    $('new-game').innerHTML = `${campaign ? 'Begin the story' : 'Ride into Mercy Vale'} <span aria-hidden="true">→</span>`;
    $('mercy-game').hidden = !campaign;
  }
  if (!started) return;
  $('mission-name').textContent = state.mission.name; $('objective-text').textContent = state.mission.objective;
  const stageCount = state.mission.stageCount || 7;
  $('mission-count').textContent = state.mission.completed ? 'COMPLETE' : `${String(state.mission.stage + 1).padStart(2, '0')} / ${String(stageCount).padStart(2, '0')}`;
  let detail = '';
  if (campaign && state.replayCanonical) detail = 'MISSION REPLAY · PERMANENT WORLD PRESERVED';
  if (campaign && state.mission.id === OPENING_ID && state.mission.stage === 6) detail = `COPPER’S FEAR · ${Math.round(state.animals.find(a => a.id === 'copper').fear)} / 100`;
  if (campaign && state.mission.id === OPENING_ID && state.mission.stage === 7) {
    const remaining = Math.max(0, Math.ceil(state.timers.crisis));
    detail = `FUSE · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · ${state.worldChanges.pressureReleased ? 'PRESSURE RELEASED' : 'OPEN THE WEST VALVE'}`;
  }
  if (campaign && state.mission.id === RESCUE_ID && !state.mission.completed) {
    if (state.traversal?.player) detail = 'KEEP YOUR HANDS FREE · CLIMB IN PROGRESS';
    else if (state.mission.stage === 6) detail = state.player.carrying ? 'TAKE THE WIDE DESCENT · HAND SILAS TO INEZ' : 'STABILIZE SILAS · USE THE SHELTERED REST PAD';
    else if (state.mission.stage === 8) detail = state.flags.creekConcealed ? 'BOTH MOUNTS’ TRAIL IS CONCEALED · TAKE THE LEFT BANK' : 'KEEP BOTH MOUNTS IN THE CREEK TO CONCEAL THEIR TRAIL';
  }
  if (campaign && state.mission.id === HUNT_ID && !state.mission.completed) {
    if (state.bow?.drawing) detail = `BOW DRAW · ${Math.round(state.bow.charge * 100)}% · RELEASE TO LOOSE · X / CANCEL TO LOWER`;
    else if ([3, 4, 5].includes(state.mission.stage)) detail = 'CROUCH AND READ THE SIGN · AIM AT THE ANIMAL';
    else if (state.player.carrying) detail = 'ONE BODY, ONE LOAD · CALL COPPER AND WAIT FOR HER';
  }
  const passengerPressure=state.mission.id===RIVAL_ID&&state.rival?.contractVersion===2&&state.rival.transport&&state.entities?.levi?.attachment?.type==='passenger'?state.rival.transport:null;
  if(passengerPressure)detail=`STRAP ${Math.round(passengerPressure.strapQuality*100)}% · COPPER STAMINA ${Math.round(state.horse.stamina)}%`;
  $('mission-detail').hidden = !detail; $('mission-detail').textContent = detail;
  $('mission-progress').innerHTML = Array.from({ length: stageCount }, (_, i) => `<span class="${i < state.mission.stage ? 'done' : ''}"></span>`).join('');
  for (const [key, id] of [['hp', 'health'], ['stamina', 'stamina'], ['focus', 'focus']]) {
    const value = Math.round(key === 'stamina' && state.player.mounted ? state.horse.stamina : state.player[key]);
    const el = $(`${id}-ring`); el.style.setProperty('--value', value); el.setAttribute('aria-valuenow', value);
    el.setAttribute('aria-valuetext', `${value} percent${key === 'stamina' && state.player.mounted ? ', horse stamina' : ''}`);
  }
  $('money').textContent = `$${state.player.money.toFixed(2)}`;
  $('honor').textContent = state.honor > 15 ? 'A NAME THE VALLEY TRUSTS' : state.honor < -15 ? 'A NAME THE VALLEY FEARS' : 'A NAME YET TO BE MADE';
  const weapon=state.weapons?.[state.player.equippedWeaponId],ropeTool=weapon?.kind==='lariat';
  const rope=state.campaign?.missions[RIVAL_ID]?.rope;
  $('ammo').textContent=ropeTool?(rope?.phase==='flying'?'Flying':rope?.phase==='taut'?'Held':'Ready'):state.player.ammo;
  $('reserve').textContent=ropeTool?'':`/ ${state.player.reserve}`;
  $('reload').disabled=ropeTool;
  $('weapon-status').textContent=ropeTool?(rope?.phase==='taut'?'Keep tension · Dismount and bind':rope?.phase==='flying'?'Loop in flight':state.mission.id===RIVAL_ID&&state.mission.stage===10?'Aim ahead · Click to throw':'Working rope · Use capture actions within reach'):state.player.reloadTimer>0?'Reloading…':state.player.focusActive?'FOCUS · TIME SLOWS':bowEquipped()?state.bow?.drawing?`Draw ${Math.round(state.bow.charge*100)}% · Release to loose`:'Hold Fire to draw · Release to loose':'Right click to aim · Click to fire';
  const weaponLabel=weapon?.kind==='carbine'?'TERN CARBINE':ropeTool?'WORKING LARIAT':weapon?.kind==='bow'?'ASH BOW':weapon?.kind==='coach-gun'?'COACH GUN':'REVOLVER';
  document.querySelector('.shoot-button').textContent=ropeTool?'Throw':'Fire';
  if(passengerPressure)$('weapon-status').textContent=`Rear strap ${Math.round(passengerPressure.strapQuality*100)}% · Copper stamina ${Math.round(state.horse.stamina)}% · Stop, dismount and check the load`;
  const carried = state.entities?.[state.player.carrying]?.name?.split(' ')[0] || 'Gideon';
  $('weapon-name').textContent = state.player.carrying ? `CARRYING ${carried.toUpperCase()}` : state.player.mounted ? `RIDING ${state.horse.name.toUpperCase()}` : state.player.weaponOwned === false ? 'DISARMED' : state.player.holstered ? `${weaponLabel} HOLSTERED` : weapon?.name?.toUpperCase() || (weapon?.kind === 'coach-gun' ? 'SHORT COACH GUN' : 'VALE REVOLVER');
  $('campaign-controls').hidden = !campaign || !!state.dialog || !!activePanel;
  const melee = campaign && state.mission.id === OPENING_ID && state.mission.stage === 5;
  document.body.classList.toggle('melee', melee);
  $('holster-label').textContent = state.player.holstered ? 'Draw' : 'Holster';
  document.querySelectorAll('[data-story-action]').forEach(el => { el.hidden = el.dataset.storyAction === 'nearby-actions' ? state.mission.id !== RIVAL_ID && !state.campaign?.missions[RIVAL_ID] || !Sim.getInteractions(state).some(a=>a.id.startsWith('rival')) && state.mission.id !== RIVAL_ID : el.dataset.storyAction.startsWith('scope:') ? !state.scope?.raised : el.dataset.storyAction === 'cancel-rope' ? state.mission.id!==RIVAL_ID || state.mission.stage!==10 || !['flying','taut'].includes(rope?.phase) : el.dataset.storyAction === 'cancel-bow' ? !bowEquipped() || !state.bow?.drawing : el.dataset.storyAction !== 'holster' && !melee; el.disabled = el.dataset.storyAction === 'holster' && state.player.weaponOwned === false; });
  const nearbyButton=document.querySelector('[data-story-action="nearby-actions"]');
  if(campaign&&Sim.getInteractions(state).some(a=>a.id.startsWith('holding:')||state.mission.id===TRAIN_ID&&a.id.startsWith('train:')))nearbyButton.hidden=false;
  document.body.classList.toggle('expanded-actions',!nearbyButton.hidden);
  const interaction = Sim.getInteraction(state);
  $('interact').hidden = !interaction || !!state.dialog || !!activePanel;
  if (interaction) $('interaction-label').textContent = interaction.label;
  const closest = Sim.worldFor(state).places.slice().sort((a, b) => Math.hypot(state.player.x - a.x, state.player.y - a.y) - Math.hypot(state.player.x - b.x, state.player.y - b.y))[0];
  $('location-name').textContent = closest.name.toUpperCase();
  const wanted = state.wanted.pursuit || state.wanted.bounty > 0 || state.wanted.witnessTimer > 0;
  $('wanted').hidden = !wanted;
  if (wanted) $('wanted').textContent = `${state.wanted.pursuit ? 'WANTED · ' : state.wanted.witnessTimer > 0 ? 'WITNESSED · ' : 'BOUNTY · '}$${state.wanted.bounty}`;
  const latest = state.notices.at(-1)?.text || '';
  if (latest !== noticeText) { noticeText = latest; $('notices').innerHTML = latest ? `<div class="notice">${escape(latest)}</div>` : ''; }
  $('panel-feedback').textContent = activePanel === 'satchel' ? latest : '';
  $('trade-feedback').textContent = state.dialog?.shop ? latest : '';
  updateConversation();
  campWorkView.sync(state,{screen:game.screen});
}

function aimTarget(auto = false) {
  if (padAim) return [state.player.x + padAim[0] * 400, state.player.y + padAim[1] * 400];
  if (!auto && pointerMode) {
    const p = game.mouseGround(), screen = game.input.mouseScreen();
    if (p) return resolvePointerAim(state, p, screen ? { x: screen[0] - game.r.ix, y: screen[1] - game.r.iy } : null, (x, y, z) => game.r.w(x, y, z));
  }
  const enemy = state.enemies.filter(e => e.hp > 0 && (e.kind === 'wolf' ? !['dormant', 'dead', 'fled'].includes(e.phase) : e.active) && !e.hidden && !e.surrendered && !e.captured && !e.escaped).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (enemy && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 450) return [enemy.x, enemy.y];
  return [state.player.x + Math.cos(state.player.facing) * 400, state.player.y + Math.sin(state.player.facing) * 400];
}
function huntAim() {
  let ground, pointer;
  if (huntPadCursor) {
    ground = [state.player.x + huntPadCursor.x, state.player.y + huntPadCursor.y];
    const projected = game.r.w(...ground, 0); pointer = { x: projected[0], y: projected[1] };
  } else if (pointerMode) {
    ground = game.mouseGround(); const screen = game.input.mouseScreen();
    pointer = screen ? { x: screen[0] - game.r.ix, y: screen[1] - game.r.iy } : null;
  }
  const region = Sim.worldFor(state);
  const bounded = point => [Math.max(0, Math.min(region.width, point[0])), Math.max(0, Math.min(region.height, point[1]))];
  if (!ground) return { point: bounded([state.player.x + Math.cos(state.player.facing) * 400, state.player.y + Math.sin(state.player.facing) * 400]), z: 19 };
  const aim = resolveHuntPointerAim(state, ground, pointer, (x, y, z) => game.r.w(x, y, z), huntAnimalHitZones);
  aim.point = bounded(aim.point); return aim;
}
function rivalAim() {
  const looking=!!state.scope?.raised;
  const fallback=looking?state.scope.camera||state.scope.aim:{x:state.player.x+Math.cos(state.player.facing)*450,y:state.player.y+Math.sin(state.player.facing)*450};
  const ground=pointerMode&&game.mouseGround(),screen=pointerMode&&game.input.mouseScreen();
  if(looking){
    const rx=Math.min(game.r.bw*.43,230),ry=Math.min(game.r.bh*.4,145);
    const aim=ground||[fallback.x+(padAim?.[0]||0)*90/state.scope.zoom,fallback.y+(padAim?.[1]||0)*90/state.scope.zoom];
    const projected=screen?[screen[0]-game.r.ix,screen[1]-game.r.iy]:game.r.w(aim[0],aim[1],0);
    const x=projected[0]-game.r.bw/2,y=projected[1]-game.r.bh/2;
    const scopeActors=['calder','grout','levi','skein'].filter(id=>{
      const actor=state.entities[id];if(!actor||actor.hidden||actor.departed||actor.hp<=0||actor.regionId!==state.region)return false;
      const p=game.r.w(actor.x,actor.y,(actor.z||0)+(actor.kind==='horse'?25:actor.mounted?65:30));
      return ((p[0]-game.r.bw/2)/rx)**2+((p[1]-game.r.bh/2)/ry)**2<=.95;
    });
    return {point:aim,z:0,visible:(x/rx)**2+(y/ry)**2<=1,scopeActors};
  }
  if(padAim)return {point:[state.player.x+padAim[0]*500,state.player.y+padAim[1]*500],z:30};
  if(!ground)return {point:[fallback.x,fallback.y],z:30};
  const pointer={x:screen[0]-game.r.ix,y:screen[1]-game.r.iy},candidates=[];
  for(const actor of Object.values(state.entities||{})){
    if(actor.id==='mara'||actor.hp<=0||actor.hidden||actor.departed||actor.escaped||actor.regionId!==state.region)continue;
    const mounted=actor.mounted,base=actor.z||0,head=base+(mounted?78:46),chest=base+(mounted?65:30);
    for(const [height,radius]of [[head,12],[chest,24]]){const q=game.r.w(actor.x,actor.y,height),d=Math.hypot(pointer.x-q[0],pointer.y-q[1]);if(d<radius)candidates.push({score:d/radius,point:[actor.x,actor.y],z:height});}
  }
  candidates.sort((a,b)=>a.score-b.score);return candidates[0]||{point:ground,z:30};
}
function fire(auto = false) {
  const shots = state.stats.shots, aim = state.mission.id === RIVAL_ID ? rivalAim() : null, target = aim?.point || aimTarget(auto); Sim.shoot(state, ...target, aim ? {z:aim.z} : {});
  if (state.stats.shots > shots) { game.audio.sfx('shoot', { vol: .32, pitch: .7 }); game.shake(.8); game.particles.smoke(state.player.x, state.player.y, 24, 2); }
}
function performAction(id) {
  if (id === 'nearby-actions') { openPanel('actions'); return; }
  if (id === 'cancel-bow') { cancelBowInput(); updateUI(); return; }
  const next = Sim.action(state, id);
  const replaced=next&&next!==state;
  if(replaced){state=next;world=rendererForState();game.cam.snap=true;}
  syncRegionView();
  if(replaced||['retry','restart','replay','finish-replay'].includes(id)||id.startsWith('replay:')){
    ++startRequest;invalidateJourneyAcknowledgement();
    game.cam.snap = true; game.input.clear(); touchHeld.clear(); releaseStick();
    pointerMode = false; padAim = null; setTouchCrouch(false); saveClock = 0; lastProgress = progressKey();
    if (Sim.isCampaign(state)) snowboundAudio.reset(state);
    saveJourney();
  }
  updateUI();
}
function chooseOption(id) {
  const reset = ['retry', 'restart', 'finish-replay'].includes(id) && state.dialog?.choices.some(choice => choice.id === id);
  Sim.choose(state, id);
  syncRegionView();
  if (reset) {
    ++startRequest;invalidateJourneyAcknowledgement();
    game.cam.snap = true; game.input.clear(); touchHeld.clear(); releaseStick();
    pointerMode = false; padAim = null; setTouchCrouch(false); snowboundAudio.reset(state);
    saveClock = 0; lastProgress = progressKey(); saveJourney();
  }
}
function handleModalPad() {
  const modal = $('conversation').open ? $('conversation') : $('panel').open ? $('panel') : null;
  if (!modal) return;
  try {
    const pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected);
    const scroll = pad?.axes[3] || 0;
    if (Math.abs(scroll) > .2) modal.scrollTop += scroll * 12;
  } catch { /* Keyboard, pointer and touch scrolling remain available. */ }
  const controls = [...modal.querySelectorAll('button:not(:disabled),input:not([hidden]),select:not(:disabled)')];
  let index = controls.indexOf(document.activeElement);
  const selected = document.activeElement;
  if (selected?.tagName === 'SELECT' && (game.input.pressed('left') || game.input.pressed('right'))) {
    selected.selectedIndex = Math.max(0, Math.min(selected.options.length - 1, selected.selectedIndex + (game.input.pressed('right') ? 1 : -1)));
    selected.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (game.input.pressed('down') || game.input.pressed('right')) controls[(index + 1) % controls.length]?.focus();
  if (game.input.pressed('up') || game.input.pressed('left')) controls[(index - 1 + controls.length) % controls.length]?.focus();
  if (game.input.pressed('interact') || game.input.pressed('start')) document.activeElement?.click();
}
game.start({
  update(dt) {
    uiClock += dt;
    const looking = state.mission.id === RIVAL_ID && state.scope?.raised;
    const desiredScale = normalView.scale * (looking ? state.scope.zoom : 1);
    if(looking && (game.view !== sightglassView || Math.abs(game.view.scale-desiredScale)>1e-8)){
      sightglassView.set(normalView.yawDeg,normalView.pitchDeg,desiredScale,normalView.zBoost);game.setView(sightglassView);
    }else if(!looking){const detail=campWorkView.frame(state,{view:campDetailView,screen:game.screen}),view=detail?.fits&&detail.context.startsWith('train-preparation:')?campDetailView:normalView;if(game.view!==view)game.setView(view);}
    if (game.input.pressed('pause')) {
      if (state.dialog) { if (state.dialog.choices.some(c => c.id === 'leave')) chooseOption('leave'); }
      else if (activePanel) closePanel(); else openPanel('menu');
    }
    if (!started) {
      if (activePanel) handleModalPad();
      if (game.input.pressed('start') && !activePanel) startJourney(false);
      game.focus(state.player.x, state.player.y - game.H * .1 / game.view.by); world.update(dt, state);
    } else if (activePanel || state.dialog) handleModalPad();
    else {
      for (const name of ['map', 'journal', 'satchel']) if (game.input.pressed(name)) { openPanel(name); break; }
      if (!activePanel) {
        let move = touchMove.some(v => v !== 0) ? touchMove : game.input.move();
        move = game.view.screenDirToGround(...move);
        try {
          const pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected);
          const x = pad?.axes[2] || 0, y = pad?.axes[3] || 0;
          padAim = Math.hypot(x, y) > .2 ? game.view.screenDirToGround(x, y) : null;
          if (bowEquipped() && padAim) {
            pointerMode = false;
            huntPadCursor ||= { x: Math.cos(state.player.facing) * 160, y: Math.sin(state.player.facing) * 160 };
            huntPadCursor.x = Math.max(-500, Math.min(500, huntPadCursor.x + padAim[0] * 240 * dt));
            huntPadCursor.y = Math.max(-500, Math.min(500, huntPadCursor.y + padAim[1] * 240 * dt));
          }
        } catch { padAim = null; }
        state.aiming = game.input.down('aim') || !!padAim || bowEquipped() && (state.bow?.drawing || !!huntPadCursor);
        const mouse = game.input.mouseScreen();
        state.pointer = mouse ? { x: mouse[0] - game.r.ix, y: mouse[1] - game.r.iy } : null;
        if (game.input.pressed('interact')) { Sim.interact(state); game.audio.sfx('select', { vol: .2 }); }
        if (game.input.pressed('reload')) { if (bowEquipped()) cancelBowInput(); Sim.reload(state); }
        if (game.input.pressed('cancelDraw') && bowEquipped()) cancelBowInput();
        if (game.input.pressed('whistle')) { Sim.whistle(state); game.audio.sfx({ wave: 'sine', freq: 1400, to: 1900, dur: .25, vol: .1 }); }
        for (const name of ['holster', 'block', 'shove', 'restrain']) if (game.input.pressed(name)) performAction(name);
        const fireHeld = game.input.down('shoot') || touchHeld.has('shoot');
        const bowAim = bowEquipped() ? huntAim() : null, quarryAim = state.mission.id === RIVAL_ID ? rivalAim() : null;
        if (bowAim) {
          if (!fireHeld) bowBlockedUntilRelease = false;
          if (fireHeld && !bowFireHeld && !bowBlockedUntilRelease) Sim.beginDraw(state, ...bowAim.point, { z: bowAim.z });
          if (!fireHeld && bowFireHeld && !bowBlockedUntilRelease) {
            const before = state.bow.serial; Sim.releaseDraw(state, ...bowAim.point, { z: bowAim.z });
            if (state.bow.serial > before) game.audio.sfx({ wave: 'noise', freq: 1400, to: 380, dur: .13, vol: .1, filter: 'lowpass' });
          }
          bowFireHeld = fireHeld;
        } else {
          bowFireHeld = false; huntPadCursor = null;
          if (game.input.pressed('shoot') || fireHeld) fire(touchHeld.has('shoot') && !pointerMode);
        }
        for (const [key, item] of [['tonic', 'tonic'], ['coffee', 'coffee'], ['oats', 'oats']]) if (game.input.pressed(key)) Sim.useItem(state, item);
        const hp = state.player.hp;
        Sim.step(state, dt, { mx: move[0], my: move[1], sprint: game.input.down('sprint') || touchHeld.has('sprint'), crouch: game.input.down('crouch') || touchCrouching, focus: game.input.down('focus') || touchHeld.has('focus'), block: game.input.down('block') || touchHeld.has('block'), drawHeld: bowEquipped() && fireHeld && !bowBlockedUntilRelease, ...(bowAim || quarryAim ? { aimX: (bowAim || quarryAim).point[0], aimY: (bowAim || quarryAim).point[1], aimZ: (bowAim || quarryAim).z,scopeVisible:quarryAim?.visible!==false,scopeActors:quarryAim?.scopeActors } : {}) });
        if (state.aiming && !state.player.mounted && !state.player.carrying && state.player.weaponOwned !== false) {
          const target = bowEquipped() ? huntAim().point : aimTarget();
          state.player.facing = Math.atan2(target[1] - state.player.y, target[0] - state.player.x);
        }
        if (state.player.hp < hp) { game.shake(1.4); game.audio.sfx('hurt', { vol: .2 }); }
        state.interactionTarget = Sim.getInteraction(state);
        syncRegionView();
        world.update(dt, state);
        saveClock += dt;
        if (saveClock > 30 || progressKey() !== lastProgress) { saveClock = 0; lastProgress = progressKey(); saveJourney(); }
      }
    }
    const yOffset = game.H * .1 / game.view.by;
    syncRegionView();
    const scopeCamera = state.mission.id === RIVAL_ID && state.scope?.raised && state.scope.camera;
    const workFrame=!scopeCamera&&campWorkView.frame(state,{view:game.view,screen:game.screen});
    if(workFrame?.fits)game.focus(workFrame.focus.x,workFrame.focus.y,workFrame.focus.z);
    else game.focus(scopeCamera ? scopeCamera.x : state.player.x, (scopeCamera ? scopeCamera.y : state.player.y) - yOffset, (!scopeCamera && ['north-cutting','bellwether-works'].includes(state.region) ? state.player.z || 0 : 0) + (!scopeCamera && state.player.mounted ? 10 : 0));
    if (started && Sim.isCampaign(state)) snowboundAudio.update(dt, state, !!activePanel || !!state.dialog || !!state.failure);
    if (uiClock > .1) { uiClock = 0; updateUI(); }
  },
  draw(r) {
    world.draw(r, state);
    if (started && bowEquipped() && !activePanel && !state.dialog && (pointerMode || huntPadCursor)) {
      const aim = huntAim(), [x, y] = r.w(...aim.point, aim.z);
      r.overlay(() => { const g = r.ctx; g.save(); g.strokeStyle = state.bow?.charge >= .8 ? '#edcf88' : '#f1ead5'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.moveTo(x - 9, y); g.lineTo(x - 3, y); g.moveTo(x + 3, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y - 3); g.moveTo(x, y + 3); g.lineTo(x, y + 9); g.stroke(); g.restore(); });
    }
  },
});

$('new-game').addEventListener('click', () => startJourney());
$('mercy-game').addEventListener('click', () => startJourney(false, 'mercy'));
$('continue-game').addEventListener('click', () => startJourney(true));
// Welcome controls become ready only after the existing saves are known.
document.querySelectorAll('[data-panel]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.panel)));
$('close-panel').addEventListener('click', closePanel);
$('panel').addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
$('conversation').addEventListener('cancel', e => { e.preventDefault(); if (state.dialog?.choices.some(c => c.id === 'leave')) { chooseOption('leave'); updateUI(); } });
$('conversation').addEventListener('click', e => {
  const choice = e.target.closest('[data-choice]');
  if (!choice) return;
  chooseOption(choice.dataset.choice); game.audio.sfx('confirm', { vol: .2 }); updateUI(); saveJourney();
  if (!state.dialog) $('screen').focus({ preventScroll: true });
});
$('interact').addEventListener('click', () => { Sim.interact(state); syncRegionView(); updateUI(); });
$('reload').addEventListener('click', () => { Sim.reload(state); updateUI(); });
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-command]'); if (!el || el.disabled) return;
  const id = el.dataset.id;
  const commands = { buy: Sim.buy, sell: Sim.sell, use: Sim.useItem, craft: Sim.craft, donate: Sim.donate, upgrade: Sim.upgradeCamp, pack: Sim.action, equipment: Sim.action };
  if (commands[el.dataset.command]) {
    commands[el.dataset.command](state, id); updateUI();
    if (activePanel) {
      renderPanel();
      const next = [...$('panel-body').querySelectorAll('button')].find(b => b.dataset.command === el.dataset.command && b.dataset.id === id && !b.disabled);
      (next || $('close-panel')).focus();
    }
    saveJourney(); return;
  }
  switch (el.dataset.command) {
    case 'nearby': closePanel(); Sim.interact(state,id); syncRegionView(); updateUI(); saveJourney(); break;
    case 'resume': closePanel(); break;
    case 'panel': openPanel(id); break;
    case 'notebook': $('notebook')?.scrollIntoView({ block: 'start', behavior: game.reduceMotion ? 'instant' : 'smooth' }); break;
    case 'save': saveJourney(true); break;
    case 'load': { game.audio.sfx('confirm',{vol:0});const request=++startRequest,mode=Sim.isCampaign(state)?'campaign':'mercy',loaded=await loadSavedJourney(mode);if(request===startRequest&&loaded){closePanel();beginJourney(loaded);}break; }
    case 'new':
      if (started) {
        $('panel-kicker').textContent = 'A FRESH START'; $('panel-title').textContent = 'Leave this journey?';
        $('panel-body').innerHTML = `<p class="panel-copy">Your current journey stays saved until you save the new one. Begin a new story in Snowbound?</p><div class="menu-buttons">${button('Keep riding', 'resume', '')}${button('Start again', 'confirm-new', '')}</div>`;
      } else { closePanel(); startJourney(); }
      break;
    case 'confirm-new': closePanel(); startJourney(false, 'campaign'); break;
    case 'story': { closePanel(); performAction(id); break; }
    case 'recover-load': {game.audio.sfx('confirm',{vol:0});const request=++startRequest;await deviceSaves.loadCandidates(requestedMode);if(request!==startRequest)break;const copy=deviceSaves.recoveries().find(copy=>copy.key===id),loaded=copy&&Sim.restore(copy.raw);if(loaded){closePanel();beginJourney(loaded,{review:copy});openPanel('menu');announce('Reviewing another journey. Save to make it current.');}break;}
    case 'recover-export': {const copy=deviceSaves.recoveries().find(copy=>copy.key===id);if(copy)downloadJourneyBytes(copy.raw);break;}
    case 'export': downloadJourneyBytes(Sim.serialize(state));break;
    case 'import': game.audio.sfx('confirm',{vol:0});$('save-file').click(); break;
  }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'mute-audio') { muted = e.target.checked; game.audio.setVolume(muted ? 0 : .65); }
  if (e.target.id === 'reduce-motion') game.reduceMotion = e.target.checked;
  if (e.target.id === 'text-size') document.documentElement.style.setProperty('--dialogue-scale', e.target.value);
  if (['mute-audio', 'reduce-motion', 'text-size'].includes(e.target.id)) savePreferences();
  if (e.target.id === 'save-file') {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { announce('This save exceeds the 8 MB import limit.'); return; }
    const request=++startRequest;
    try {
      const loaded = Sim.restore(await file.text());
      if (!loaded) { announce('This file is not a valid Dust & Mercy journey.'); return; }
      await deviceSaves.ready;if(request!==startRequest)return;closePanel();beginJourney(loaded);await saveJourney(true);
    } catch { announce('The journey file could not be read.'); }
  }
});
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && (gameplaySpaceHeld || (started && !activePanel && !state.dialog))) {
    gameplaySpaceHeld = true;
    e.preventDefault();
  }
  const modal = $('conversation').open ? $('conversation') : $('panel').open ? $('panel') : null;
  if (!modal) return;
  if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.stopPropagation();
  if ($('conversation').open && /^Digit[1-9]$/.test(e.code)) { e.stopPropagation(); e.preventDefault(); const choice = state.dialog?.choices[Number(e.code.slice(-1)) - 1]; if (choice) { chooseOption(choice.id); updateUI(); saveJourney(); } }
}, true);
document.addEventListener('keyup', e => {
  // A focus hold can outlive the frame that opens a failure conversation.
  // Its release must not activate the newly focused Retry button.
  if (e.code === 'Space' && gameplaySpaceHeld) { e.preventDefault(); gameplaySpaceHeld = false; }
}, true);
$('screen').addEventListener('pointermove', e => { if (e.pointerType !== 'touch') { pointerMode = true; huntPadCursor = null; } });
$('screen').addEventListener('pointerdown', e => {
  pointerMode = true; huntPadCursor = null;
  if (e.pointerType === 'touch') { e.stopImmediatePropagation(); game.input.mouse = { cx: e.clientX, cy: e.clientY, active: true }; }
}, true);
const joystick = $('joystick');
function moveStick(e) {
  const rect = joystick.getBoundingClientRect(), radius = rect.width / 2;
  let x = (e.clientX - rect.left - radius) / (radius - 14), y = (e.clientY - rect.top - radius) / (radius - 14);
  const m = Math.max(1, Math.hypot(x, y)); x /= m; y /= m;
  touchMove = [x, y]; $('stick').style.transform = `translate(${x * (radius - 17)}px,${y * (radius - 17)}px)`;
}
joystick.addEventListener('pointerdown', e => { if (stickPointer !== null) return; e.preventDefault(); stickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); moveStick(e); });
joystick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) moveStick(e); });
function releaseStick(e) { if (e && e.pointerId !== stickPointer) return; stickPointer = null; touchMove = [0, 0]; $('stick').style.transform = ''; }
joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick); joystick.addEventListener('lostpointercapture', releaseStick);
document.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); const action = el.dataset.action; if (action === 'crouch') setTouchCrouch(!touchCrouching); else if (action === 'whistle') { Sim.whistle(state); updateUI(); } else touchHeld.add(action); });
  el.addEventListener('click', e => { if (el.dataset.action === 'crouch' && e.detail === 0) setTouchCrouch(!touchCrouching); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(event, () => touchHeld.delete(el.dataset.action));
});
document.querySelectorAll('[data-story-action]').forEach(el => {
  el.addEventListener('pointerdown', e => {
    if(el.dataset.storyAction==='nearby-actions')return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    performAction(el.dataset.storyAction);
    if (el.dataset.storyAction === 'block') touchHeld.add('block');
    updateUI();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(name, () => touchHeld.delete('block'));
  el.addEventListener('click', e => { if (e.detail === 0 || el.dataset.storyAction==='nearby-actions') performAction(el.dataset.storyAction); });
});
addEventListener('blur', () => { cancelBowInput(); gameplaySpaceHeld = false; touchHeld.clear(); releaseStick(); if (started) saveJourney(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelBowInput(); touchHeld.clear(); releaseStick(); if (started) { saveJourney(); if (!activePanel && !state.dialog) openPanel('menu'); } } });
addEventListener('pagehide', () => { if (started) saveJourney(); });
game.audio.setVolume(muted ? 0 : .65);
deviceSaves.ready.then(available=>{
  $('save-status').dataset.saveBackend=available?'indexeddb':'unavailable';
  $('continue-game').hidden=!savedJourney();
  for(const id of ['new-game','continue-game','mercy-game'])$(id).disabled=false;
  if(new URLSearchParams(location.search).has('play'))startJourney(!!savedJourney());
});
updateUI();
