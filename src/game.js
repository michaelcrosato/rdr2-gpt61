import * as Sim from './simulation.js';
import { createWorldRenderer } from './world-renderer.js';

const E = globalThis.My3D2dge;
const $ = (id) => document.getElementById(id);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE_KEY = 'dust-mercy.journey.v1';
const input = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  start: ['Enter', 'Pad9'], interact: ['KeyE', 'Pad0'], shoot: ['Mouse0', 'KeyJ', 'Pad7'], aim: ['Mouse2', 'Pad6'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad10'], focus: ['Space', 'Pad5'], reload: ['KeyR', 'Pad2'], whistle: ['KeyH', 'Pad1'],
  crouch: ['KeyC', 'Pad11'], pause: ['Escape', 'KeyP', 'Pad8'], map: ['KeyM'], journal: ['KeyL'], satchel: ['KeyI'],
  tonic: ['Digit1'], coffee: ['Digit2'], oats: ['Digit3'],
};
const game = new E.Game({ canvas: 'screen', view: 'threequarter', views: ['threequarter'], minH: 400, minW: 360, maxW: 1600, maxH: 1200, input, bg: '#838849' });
const world = createWorldRenderer(game);
let state = Sim.createState(), started = false, activePanel = '', previousDialog = null;
let uiClock = 0, saveClock = 0, lastMissionStage = 0, noticeText = '', statusTimer, previousShopSnapshot = '';
let muted = false, touchMove = [0, 0], touchHeld = new Set(), stickPointer = null;
let pointerMode = false, padAim = null;
const music = { bpm: 68, steps: 2, tracks: [
  { wave: 'triangle', vol: .12, notes: 'D3 - - . A3 - . . | F3 - - . C4 - . . | G3 - - . D4 - . . | A3 - - . E3 - . .' },
  { wave: 'sine', vol: .055, notes: 'D2 - - - - - . . | F2 - - - - - . . | G2 - - - - - . . | A2 - - - - - . .' },
] };
document.body.classList.add('intro');

function savedJourney() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? Sim.restore(raw) : null; } catch { return null; }
}
$('continue-game').hidden = !savedJourney();

function announce(text) {
  clearTimeout(statusTimer); $('save-status').textContent = text;
  statusTimer = setTimeout(() => { $('save-status').textContent = ''; }, 5000);
}
function saveJourney(manual = false) {
  if (!started) return false;
  try {
    localStorage.setItem(SAVE_KEY, Sim.serialize(state));
    announce(manual ? 'Journey saved on this device.' : 'Journey saved.');
    return true;
  } catch { announce('This browser cannot save locally. Export your journey in the menu.'); return false; }
}
function startJourney(continueSaved = false) {
  let next = Sim.createState();
  if (continueSaved) {
    const loaded = savedJourney();
    if (!loaded) { announce('No valid journey was found.'); return; }
    next = loaded;
  }
  beginJourney(next);
}
function beginJourney(next) {
  state = next;
  pointerMode = false; padAim = null; touchHeld.clear(); releaseStick();
  state.aiming = false; state.pointer = null; state.interactionTarget = null;
  started = true; lastMissionStage = state.mission.stage; saveClock = 0;
  document.body.classList.remove('intro'); $('welcome').hidden = true; $('hud').hidden = false;
  game.cam.snap = true; game.input.clear(); game.audio.music(music);
  $('screen').focus({ preventScroll: true }); updateUI();
}

function closePanel() {
  activePanel = ''; if ($('panel').open) $('panel').close(); game.input.clear();
  if (started) $('screen').focus({ preventScroll: true });
}
function openPanel(id) {
  if (!started && id !== 'menu') return;
  if (state.dialog) return;
  if (activePanel === id) { closePanel(); return; }
  activePanel = id; game.input.clear(); touchHeld.clear(); touchMove = [0, 0];
  renderPanel(); if (!$('panel').open) $('panel').showModal();
}
function panelRow(title, description, buttons = '') {
  return `<div class="panel-row"><div><h3>${escape(title)}</h3><p>${escape(description)}</p></div><div class="row-buttons">${buttons}</div></div>`;
}
function button(label, action, id, disabled = false) {
  return `<button data-command="${escape(action)}" data-id="${escape(id)}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
}
function renderPanel() {
  const titles = { map: ['THE COUNTRY AHEAD', 'Mercy Vale'], journal: ['THE MARKS WE LEAVE', 'Your journal'], satchel: ['READY FOR THE ROAD', 'Your satchel'], menu: ['TAKE A BREATH', 'Dust & Mercy'] };
  const [kicker, title] = titles[activePanel] || titles.menu;
  $('panel-title').textContent = title; $('panel-kicker').textContent = kicker;
  if (activePanel === 'map') {
    const river = Array.from({ length: 31 }, (_, i) => `${Sim.riverX(i * 40)},${i * 40}`).join(' ');
    const places = Sim.WORLD.places.map(p => `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#424b35"/><text x="${p.x + 24}" y="${p.y - 14}">${escape(p.name)}</text>`).join('');
    $('panel-body').innerHTML = `<svg class="map-art" viewBox="0 0 1600 1200" role="img" aria-label="Mercy Vale map with your position and named locations"><defs><pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#a08e64" stroke-width="1" opacity=".35"/></pattern></defs><rect width="1600" height="1200" fill="url(#map-grid)"/><path d="M70 170Q300 30 580 140T900 100M60 230Q300 110 580 230T900 170M1170 160Q1430 80 1560 210M1100 220Q1390 150 1560 290" fill="none" stroke="#a18c61" stroke-width="9" opacity=".4"/><polyline points="${river}" fill="none" stroke="#66897e" stroke-width="55"/><path d="M0 655L320 605L720 690L1010 510L1600 800M760 675L1040 880L1160 930L1600 980M1010 280V660" fill="none" stroke="#9c8056" stroke-width="9" stroke-dasharray="15 8"/><path d="M935 949H1600" stroke="#5c654b" stroke-width="9"/><path d="M${Sim.riverX(605) - 60} 605h120" stroke="#514f38" stroke-width="24"/>${places}<circle class="player-marker" cx="${state.player.x}" cy="${state.player.y}" r="15"/><text class="map-small" x="${state.player.x + 23}" y="${state.player.y + 40}">MARA</text><text x="1450" y="90">N ↑</text><text class="map-small" x="70" y="1130">MERCY VALE · A COUNTRY UNDER CONTRACT</text></svg><div class="map-legend"><span>● Mara Vale</span><span>— River</span><span>┄ Trail</span></div><p class="panel-copy">Cross the river at the bridge near Juniper Woods. Cinder Pump lies southeast of Mercy Crossing. The world continues when you close the map.</p>`;
  } else if (activePanel === 'journal') {
    const quests = Object.values(state.sideQuests).filter(q => q.stage > 0).map(q => `<li>${escape(q.name)}<small>${q.complete ? 'COMPLETED' : 'IN PROGRESS'}</small></li>`).join('');
    const log = state.log.slice().reverse().map(entry => `<div class="log-entry"><small>DAY ${entry.day} · ${formatTime(entry.time)}</small>${escape(entry.text)}</div>`).join('');
    $('panel-body').innerHTML = `<p class="eyebrow">${state.mission.completed ? 'COMPLETED' : 'CURRENT STORY'}</p><h3>${escape(state.mission.name)}</h3><p class="panel-copy">${escape(state.mission.objective)}</p>${quests ? `<ul class="quest-list">${quests}</ul>` : ''}<p class="eyebrow" style="margin-top:24px">FROM MARA’S NOTEBOOK</p>${log}`;
  } else if (activePanel === 'satchel') {
    let html = `<p class="panel-copy">$${state.player.money.toFixed(2)} · ${state.player.reserve} spare cartridges · Juniper’s bond ${state.horse.bond.toFixed(1)} / 4</p>`;
    for (const [id, item] of Object.entries(Sim.ITEMS)) {
      if (id === 'ammo') continue;
      const count = state.inventory[id] || 0;
      if (!count && !['tonic', 'coffee', 'oats', 'meat', 'pelt', 'trout'].includes(id)) continue;
      const usable = ['tonic', 'coffee', 'oats', 'meat', 'cookedMeat'].includes(id);
      html += panelRow(`${item.name} × ${count}`, item.description || '', usable ? button('Use', 'use', id, !count) : '');
    }
    const campDist = Math.hypot(state.player.x - 690, state.player.y - 750);
    if (Sim.RECIPES) {
      html += '<h3>Fieldcraft</h3><p class="panel-copy">Gather along the trails. Prepare supplies by Reed Camp’s fire.</p>';
      for (const [id, recipe] of Object.entries(Sim.RECIPES)) {
        const needs = recipe.ingredients || recipe.cost || {};
        const requirements = Object.entries(needs).map(([item, qty]) => `${qty} ${Sim.ITEMS[item]?.name || item}`).join(', ');
        html += panelRow(recipe.name || id, requirements, button('Craft', 'craft', id, campDist >= 160));
      }
    }
    if (state.camp) {
      html += `<h3>Reed Camp</h3><p class="panel-copy">Food ${Math.floor(state.camp.food)} · Medicine ${Math.floor(state.camp.medicine)} · Materials ${Math.floor(state.camp.materials)} · Morale ${Math.floor(state.camp.morale)} / 100</p>`;
      for (const [id, count] of Object.entries(state.inventory)) {
        if (count > 0 && ['meat', 'trout', 'berries', 'cookedMeat', 'herbs', 'tonic', 'timber'].includes(id)) html += panelRow(`Give ${Sim.ITEMS[id]?.name || id}`, `${count} in your satchel`, button('Donate 1', 'donate', id, campDist >= 160));
      }
      for (const [id, up] of Object.entries(Sim.CAMP_UPGRADES || {})) html += panelRow(up.name || id, `$${up.price} · ${up.materials} materials${up.medicine ? ` · ${up.medicine} medicine` : ''}. ${up.description || ''}`, button(state.camp.upgrades?.[id] ? 'Built' : 'Build', 'upgrade', id, campDist >= 160 || !!state.camp.upgrades?.[id]));
    }
    $('panel-body').innerHTML = html;
  } else {
    $('panel-body').innerHTML = `<div class="menu-buttons">${button('Return to the trail', 'resume', '', !started)}${button('Save journey', 'save', '', !started)}${button('Load saved journey', 'load', '', !savedJourney())}${button('Export save file', 'export', '', !started)}${button('Import save file', 'import', '')}${button(started ? 'Start a new journey' : 'Ride into Mercy Vale', 'new', '')}</div><div class="menu-settings"><label><input type="checkbox" id="mute-audio" ${muted ? 'checked' : ''}> Mute music and sound</label><label><input type="checkbox" id="reduce-motion" ${game.reduceMotion ? 'checked' : ''}> Reduce motion and camera shake</label></div><div class="panel-copy"><h3>On the trail</h3><p>WASD or arrows to move · E to interact · Shift to run · H to call Juniper · C to crouch. Aim with the mouse and click to shoot. R reloads. Hold Space to focus. 1 / 2 / 3 use tonic, coffee or horse feed.</p><p>Controller: left stick to move, right stick to aim, A to interact, RT to shoot, LT to aim, X to reload, B to call your horse, RB to focus. Press the left stick to run. View opens this menu.</p><p>On touch screens, drag the left stick to move. Tap the world to choose an aim point. Fire, Focus, Run and Call are on the right.</p><p>Foundation build 0.1.0 · The Last Water and Mercy Vale are playable. The full campaign and source coverage remain in production.</p></div><input id="save-file" type="file" accept=".json,application/json" hidden>`;
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
    $('speaker').textContent = d.speaker; $('dialogue-text').textContent = d.text;
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
  $('clock').textContent = formatTime(state.time);
  $('day-weather').textContent = `DAY ${state.day} · ${state.weather === 'rain' ? 'RAIN' : state.weather === 'overcast' ? 'OVERCAST' : 'MERCY VALE'}`;
  if (!started) return;
  $('mission-name').textContent = state.mission.name; $('objective-text').textContent = state.mission.objective;
  $('mission-count').textContent = state.mission.completed ? 'COMPLETE' : `${String(state.mission.stage + 1).padStart(2, '0')} / 07`;
  $('mission-progress').innerHTML = Array.from({ length: 7 }, (_, i) => `<span class="${i < state.mission.stage ? 'done' : ''}"></span>`).join('');
  for (const [key, id] of [['hp', 'health'], ['stamina', 'stamina'], ['focus', 'focus']]) {
    const value = Math.round(key === 'stamina' && state.player.mounted ? state.horse.stamina : state.player[key]);
    const el = $(`${id}-ring`); el.style.setProperty('--value', value); el.setAttribute('aria-valuenow', value);
    el.setAttribute('aria-valuetext', `${value} percent${key === 'stamina' && state.player.mounted ? ', horse stamina' : ''}`);
  }
  $('money').textContent = `$${state.player.money.toFixed(2)}`;
  $('honor').textContent = state.honor > 15 ? 'A NAME THE VALLEY TRUSTS' : state.honor < -15 ? 'A NAME THE VALLEY FEARS' : 'A NAME YET TO BE MADE';
  $('ammo').textContent = state.player.ammo; $('reserve').textContent = `/ ${state.player.reserve}`;
  $('weapon-status').textContent = state.player.reloadTimer > 0 ? 'Reloading…' : state.player.focusActive ? 'FOCUS · TIME SLOWS' : 'Right click to aim · Click to fire';
  $('weapon-name').textContent = state.player.mounted ? `RIDING ${state.horse.name.toUpperCase()}` : 'VALE REVOLVER';
  const interaction = Sim.getInteraction(state);
  $('interact').hidden = !interaction || !!state.dialog || !!activePanel;
  if (interaction) $('interaction-label').textContent = interaction.label;
  const closest = Sim.WORLD.places.slice().sort((a, b) => Math.hypot(state.player.x - a.x, state.player.y - a.y) - Math.hypot(state.player.x - b.x, state.player.y - b.y))[0];
  $('location-name').textContent = closest.name.toUpperCase();
  const wanted = state.wanted.pursuit || state.wanted.bounty > 0 || state.wanted.witnessTimer > 0;
  $('wanted').hidden = !wanted;
  if (wanted) $('wanted').textContent = `${state.wanted.pursuit ? 'WANTED · ' : state.wanted.witnessTimer > 0 ? 'WITNESSED · ' : 'BOUNTY · '}$${state.wanted.bounty}`;
  const latest = state.notices.at(-1)?.text || '';
  if (latest !== noticeText) { noticeText = latest; $('notices').innerHTML = latest ? `<div class="notice">${escape(latest)}</div>` : ''; }
  $('panel-feedback').textContent = activePanel === 'satchel' ? latest : '';
  $('trade-feedback').textContent = state.dialog?.shop ? latest : '';
  updateConversation();
}

function aimTarget(auto = false) {
  if (padAim) return [state.player.x + padAim[0] * 400, state.player.y + padAim[1] * 400];
  if (!auto && pointerMode) { const p = game.mouseGround(); if (p) return p; }
  const enemy = state.enemies.filter(e => e.hp > 0 && e.active && !e.surrendered).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (enemy && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 450) return [enemy.x, enemy.y];
  return [state.player.x + Math.cos(state.player.facing) * 400, state.player.y + Math.sin(state.player.facing) * 400];
}
function fire(auto = false) {
  const shots = state.stats.shots, target = aimTarget(auto); Sim.shoot(state, ...target);
  if (state.stats.shots > shots) { game.audio.sfx('shoot', { vol: .32, pitch: .7 }); game.shake(.8); game.particles.smoke(state.player.x, state.player.y, 24, 2); }
}
function handleModalPad() {
  const modal = $('conversation').open ? $('conversation') : $('panel').open ? $('panel') : null;
  if (!modal) return;
  const controls = [...modal.querySelectorAll('button:not(:disabled),input:not([hidden])')];
  let index = controls.indexOf(document.activeElement);
  if (game.input.pressed('down') || game.input.pressed('right')) controls[(index + 1) % controls.length]?.focus();
  if (game.input.pressed('up') || game.input.pressed('left')) controls[(index - 1 + controls.length) % controls.length]?.focus();
  if (game.input.pressed('interact') || game.input.pressed('start')) document.activeElement?.click();
}
game.start({
  update(dt) {
    uiClock += dt;
    if (game.input.pressed('pause')) {
      if (state.dialog) { if (state.dialog.choices.some(c => c.id === 'leave')) Sim.choose(state, 'leave'); }
      else if (activePanel) closePanel(); else openPanel('menu');
    }
    if (!started) {
      if (activePanel) handleModalPad();
      if (game.input.pressed('start') && !activePanel) startJourney(false);
      game.focus(720, 680 - game.H * .1 / game.view.by); world.update(dt, state);
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
        } catch { padAim = null; }
        state.aiming = game.input.down('aim') || !!padAim;
        const mouse = game.input.mouseScreen();
        state.pointer = mouse ? { x: mouse[0] - game.r.ix, y: mouse[1] - game.r.iy } : null;
        if (game.input.pressed('interact')) { Sim.interact(state); game.audio.sfx('select', { vol: .2 }); }
        if (game.input.pressed('reload')) Sim.reload(state);
        if (game.input.pressed('whistle')) { Sim.whistle(state); game.audio.sfx({ wave: 'sine', freq: 1400, to: 1900, dur: .25, vol: .1 }); }
        if (game.input.pressed('shoot') || game.input.down('shoot') || touchHeld.has('shoot')) fire(touchHeld.has('shoot') && !pointerMode);
        for (const [key, item] of [['tonic', 'tonic'], ['coffee', 'coffee'], ['oats', 'oats']]) if (game.input.pressed(key)) Sim.useItem(state, item);
        const hp = state.player.hp;
        Sim.step(state, dt, { mx: move[0], my: move[1], sprint: game.input.down('sprint') || touchHeld.has('sprint'), crouch: game.input.down('crouch'), focus: game.input.down('focus') || touchHeld.has('focus') });
        if (state.player.hp < hp) { game.shake(1.4); game.audio.sfx('hurt', { vol: .2 }); }
        state.interactionTarget = Sim.getInteraction(state);
        world.update(dt, state);
        saveClock += dt;
        if (saveClock > 30 || state.mission.stage !== lastMissionStage) { saveClock = 0; lastMissionStage = state.mission.stage; saveJourney(); }
      }
    }
    const yOffset = game.H * .1 / game.view.by;
    game.focus(state.player.x, state.player.y - yOffset, state.player.mounted ? 10 : 0);
    if (uiClock > .1) { uiClock = 0; updateUI(); }
  },
  draw(r) { world.draw(r, state); },
});

$('new-game').addEventListener('click', () => startJourney());
$('continue-game').addEventListener('click', () => startJourney(true));
document.querySelectorAll('[data-panel]').forEach(el => el.addEventListener('click', () => openPanel(el.dataset.panel)));
$('close-panel').addEventListener('click', closePanel);
$('panel').addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
$('conversation').addEventListener('cancel', e => { e.preventDefault(); if (state.dialog?.choices.some(c => c.id === 'leave')) { Sim.choose(state, 'leave'); updateUI(); } });
$('conversation').addEventListener('click', e => {
  const choice = e.target.closest('[data-choice]');
  if (!choice) return;
  Sim.choose(state, choice.dataset.choice); game.audio.sfx('confirm', { vol: .2 }); updateUI(); saveJourney();
  if (!state.dialog) $('screen').focus({ preventScroll: true });
});
$('interact').addEventListener('click', () => { Sim.interact(state); updateUI(); });
$('reload').addEventListener('click', () => { Sim.reload(state); updateUI(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-command]'); if (!el || el.disabled) return;
  const id = el.dataset.id;
  const commands = { buy: Sim.buy, sell: Sim.sell, use: Sim.useItem, craft: Sim.craft, donate: Sim.donate, upgrade: Sim.upgradeCamp };
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
    case 'resume': closePanel(); break;
    case 'save': saveJourney(true); break;
    case 'load': { const loaded = savedJourney(); if (loaded) { closePanel(); beginJourney(loaded); } break; }
    case 'new':
      if (started) {
        $('panel-kicker').textContent = 'A FRESH START'; $('panel-title').textContent = 'Leave this journey?';
        $('panel-body').innerHTML = `<p class="panel-copy">Your current journey stays saved until you save the new one. Start again in Mercy Vale?</p><div class="menu-buttons">${button('Keep riding', 'resume', '')}${button('Start again', 'confirm-new', '')}</div>`;
      } else { closePanel(); startJourney(); }
      break;
    case 'confirm-new': closePanel(); startJourney(); break;
    case 'export': { const url = URL.createObjectURL(new Blob([Sim.serialize(state)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'dust-and-mercy-journey.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Journey exported.'); break; }
    case 'import': $('save-file').click(); break;
  }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'mute-audio') { muted = e.target.checked; game.audio.setVolume(muted ? 0 : .65); }
  if (e.target.id === 'reduce-motion') game.reduceMotion = e.target.checked;
  if (e.target.id === 'save-file') {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 1024 * 1024) { announce('This save file is too large.'); return; }
    try {
      const loaded = Sim.restore(await file.text());
      if (!loaded) { announce('This file is not a valid Dust & Mercy journey.'); return; }
      closePanel(); beginJourney(loaded); saveJourney(true);
    } catch { announce('The journey file could not be read.'); }
  }
});
document.addEventListener('keydown', e => {
  const modal = $('conversation').open ? $('conversation') : $('panel').open ? $('panel') : null;
  if (!modal) return;
  if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.stopPropagation();
  if ($('conversation').open && /^Digit[1-9]$/.test(e.code)) { e.stopPropagation(); e.preventDefault(); const choice = state.dialog?.choices[Number(e.code.slice(-1)) - 1]; if (choice) { Sim.choose(state, choice.id); updateUI(); saveJourney(); } }
}, true);
$('screen').addEventListener('pointermove', e => { if (e.pointerType !== 'touch') pointerMode = true; });
$('screen').addEventListener('pointerdown', e => {
  pointerMode = true;
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
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); const action = el.dataset.action; if (action === 'whistle') { Sim.whistle(state); updateUI(); } else touchHeld.add(action); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(event, () => touchHeld.delete(el.dataset.action));
});
addEventListener('blur', () => { touchHeld.clear(); releaseStick(); if (started) saveJourney(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { touchHeld.clear(); releaseStick(); if (started) { saveJourney(); if (!activePanel && !state.dialog) openPanel('menu'); } } });
addEventListener('pagehide', () => { if (started) saveJourney(); });
game.audio.setVolume(.65);
if (new URLSearchParams(location.search).has('play')) startJourney(!!savedJourney());
updateUI();
