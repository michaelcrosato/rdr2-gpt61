import { SNOWBOUND_WORLD } from '../content/campaign/snowbound.js';
import { NORTH_CUTTING_WORLD } from '../content/campaign/north-cutting.js';

// Original motifs and environmental synthesis use the supplied engine's audio
// bus, so mute/volume and its browser gesture handling apply to every voice.
const SCORES = {
  cold: { bpm: 54, steps: 2, tracks: [
    { wave: 'triangle', vol: .09, notes: 'D3 - - . A3 - . . | F3 - - . E3 - . . | D3 - - . C3 - . . | A2 - - - . . . .' },
    { wave: 'sine', vol: .035, notes: 'D2 - - - - - . . | Bb1 - - - - - . . | C2 - - - - - . . | A1 - - - - - . .' },
  ] },
  approach: { bpm: 70, steps: 2, tracks: [
    { wave: 'triangle', vol: .085, notes: 'D3 . A3 . F3 . E3 . | D3 . A3 . G3 . E3 . | Bb2 . F3 . D3 . C3 . | A2 . E3 . C#3 . . .' },
    { wave: 'sine', vol: .04, notes: 'D2 - . . D2 - . . | D2 - . . C2 - . . | Bb1 - . . Bb1 - . . | A1 - . . A1 - . .' },
  ] },
  yard: { bpm: 108, steps: 2, tracks: [
    { wave: 'triangle', vol: .075, notes: 'D3 A3 D4 . F3 A3 E4 . | D3 A3 C4 . E3 A3 G3 . | Bb2 F3 D4 . F3 C4 Bb3 . | A2 E3 C#4 . A3 E3 C#3 .' },
    { wave: 'sine', vol: .075, notes: 'D2 . D2 . D2 . . . | C2 . C2 . A1 . . . | Bb1 . Bb1 . F2 . . . | A1 . A1 . A1 . . .' },
    { wave: 'drums', vol: .035, notes: 'k . . . t . h . k . . . t . . .' },
  ] },
  rescue: { bpm: 92, steps: 2, tracks: [
    { wave: 'triangle', vol: .07, notes: 'D4 . A3 . D4 . E4 . | F4 . E4 . D4 . A3 . | Bb3 . F4 . E4 . D4 . | C#4 . A3 . E4 . . .' },
    { wave: 'sine', vol: .055, notes: 'D2 . . D2 . . D2 . | D2 . . D2 . . C2 . | Bb1 . . Bb1 . . Bb1 . | A1 . . A1 . . A1 .' },
  ] },
  home: { bpm: 58, steps: 2, tracks: [
    { wave: 'triangle', vol: .09, notes: 'D3 - F3 - A3 - - . | G3 - F3 - E3 - - . | F3 - A3 - C4 - A3 - | G3 - E3 - D3 - - -' },
    { wave: 'sine', vol: .04, notes: 'D2 - - - - - . . | C2 - - - - - . . | Bb1 - - - - - . . | D2 - - - - - . .' },
  ] },
  search: { bpm: 62, steps: 2, tracks: [
    { wave: 'triangle', vol: .075, notes: 'E3 - . B3 . . G3 . | F#3 . . A3 - . E3 . | C3 - . G3 . . B3 . | D3 . . F#3 . E3 - .' },
    { wave: 'sine', vol: .035, notes: 'E2 - - - . . . . | D2 - - - . . . . | C2 - - - . . . . | B1 - - - . . . .' },
  ] },
  ledges: { bpm: 48, steps: 2, tracks: [
    { wave: 'sine', vol: .065, notes: 'B3 - . . E4 . . . | D4 - . . G3 . . . | C4 - . B3 . A3 . . | F#3 . . . E3 - - .' },
    { wave: 'triangle', vol: .025, notes: 'E2 - - . . . . . | C2 - - . . . . . | A1 - - . . . . . | B1 - - . . . . .' },
  ] },
  pack: { bpm: 116, steps: 2, tracks: [
    { wave: 'triangle', vol: .065, notes: 'E3 B3 E4 . G3 D4 F#4 . | C3 G3 B3 . D3 A3 E4 . | E3 B3 G4 . F#3 B3 E4 . | D3 A3 F#4 . B2 F#3 D4 .' },
    { wave: 'sine', vol: .065, notes: 'E2 . E2 . . B1 . . | C2 . C2 . . D2 . . | E2 . E2 . . G2 . . | B1 . B1 . . B1 . .' },
    { wave: 'drums', vol: .03, notes: 'k . h . . t . h k . . . t . h .' },
  ] },
  care: { bpm: 56, steps: 2, tracks: [
    { wave: 'triangle', vol: .075, notes: 'E3 - G3 - B3 - . . | D4 - B3 - A3 - . . | C4 - E4 - G4 - E4 . | D4 - B3 - E3 - - .' },
    { wave: 'sine', vol: .035, notes: 'E2 - - - . . . . | D2 - - - . . . . | C2 - - - . . . . | E2 - - - . . . .' },
  ] },
};
const inside = (p, room) => p.x > room.x && p.x < room.x + room.w && p.y > room.y && p.y < room.y + room.h;
export function createSnowboundAudio(audio) {
  let phase = '', wind = 0, steps = 0, hoof = 0, steam = 0, fuse = 0;
  let wasRuined = false, wasCarrying = false, heardShots = new WeakSet(), previousFear = 80;
  let previousTraversal = '', previousIce = false, wolfPhases = new Map(), water = 0;
  return {
    reset(state) {
      phase = ''; wind = steps = hoof = steam = fuse = water = 0; heardShots = new WeakSet();
      wasRuined = !!state?.worldChanges.boilerDestroyed; wasCarrying = !!state?.player.carrying; previousFear = state?.animals.find(a => a.id === 'copper')?.fear ?? 80;
      previousTraversal = state?.traversal?.player?.edgeId || ''; previousIce = !!state?.worldChanges.upperIceClosed;
      wolfPhases = new Map((state?.predators || []).map(w => [w.id, w.phase]));
    },
    update(dt, state, paused = false) {
      const expedition = state.mission.id === 'snowbound-a-voice-under-ice';
      const next = state.failure ? 'cold' : expedition ? state.mission.completed || state.mission.stage === 9 ? 'care' : state.mission.stage >= 7 ? 'pack' : state.mission.stage >= 5 ? 'ledges' : 'search' : state.mission.completed || state.mission.stage === 8 ? 'home' : state.mission.stage === 3 || state.mission.stage === 5 ? 'yard' : state.mission.stage === 7 ? 'rescue' : state.mission.stage >= 2 ? 'approach' : 'cold';
      if (next !== phase) { phase = next; audio.music(SCORES[phase]); }
      if (paused) return;
      const p = state.player, north = state.region === 'north-cutting';
      const indoor = !north && [...SNOWBOUND_WORLD.interiors, ...(expedition ? NORTH_CUTTING_WORLD.camp.interiors : [])].some(room => inside(p, room));
      wind -= dt;
      if (wind <= 0) { audio.sfx({ wave: 'noise', freq: indoor ? 200 : 550, to: indoor ? 120 : 900, dur: 2.6, attack: .45, vol: indoor ? .006 : .035, filter: 'lowpass' }); wind = 2.2; }
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 8) {
        steps += speed * dt;
        const stride = p.mounted ? 58 : p.carrying ? 19 : 27;
        if (steps >= stride) {
          steps %= stride;
          audio.sfx(p.mounted ? [
            { wave: 'noise', freq: 260, dur: .08, vol: .09, filter: 'lowpass' },
            { wave: 'sine', freq: 95, to: 55, dur: .055, vol: .06, delay: .08 },
          ] : { wave: 'noise', freq: indoor ? 850 : p.y < 520 ? 1700 : 430, to: 150, dur: indoor ? .07 : .11, vol: .045, filter: 'lowpass' });
        }
      }
      const copper = state.animals.find(a => a.id === 'copper');
      hoof -= dt;
      previousFear = Math.min(previousFear, copper.fear);
      if (copper.fear > previousFear + 8 && Math.hypot(copper.x - p.x, copper.y - p.y) < 180 && hoof <= 0) {
        audio.sfx({ wave: 'triangle', freq: 310, to: 180, dur: .5, vib: [17, .1], vol: .065 }); hoof = 2; previousFear = copper.fear;
      }
      if (!expedition && state.mission.stage === 7 && state.worldChanges.fireActive) {
        steam -= dt; fuse -= dt;
        const near = Math.hypot(p.x - 1415, p.y - 450) < 350;
        if (steam <= 0 && near) { audio.sfx({ wave: 'noise', freq: 2700, to: 1800, dur: .8, vol: state.worldChanges.pressureReleased ? .012 : .045, filter: 'highpass' }); steam = 1.2; }
        if (fuse <= 0 && near) { audio.sfx({ wave: 'noise', freq: 4600, dur: .07, vol: state.timers.crisis < 45 ? .035 : .015, filter: 'highpass' }); fuse = state.timers.crisis < 45 ? .4 : 1; }
      }
      if (state.worldChanges.boilerDestroyed && !wasRuined) audio.sfx('boom', { vol: .3, pitch: .7 });
      if (p.carrying && !wasCarrying) audio.sfx({ wave: 'noise', freq: 550, to: 180, dur: .2, vol: .07 });
      wasRuined = state.worldChanges.boilerDestroyed; wasCarrying = !!p.carrying;
      if (expedition) {
        const traversal = state.traversal?.player?.edgeId || '';
        if (traversal && traversal !== previousTraversal) audio.sfx([{ wave: 'noise', freq: 950, to: 220, dur: .18, vol: .055, filter: 'lowpass' }, { wave: 'noise', freq: 180, dur: .3, vol: .025, delay: .12 }]);
        previousTraversal = traversal;
        if (state.worldChanges.upperIceClosed && !previousIce) audio.sfx([{ wave: 'noise', freq: 3200, to: 800, dur: .45, vol: .12, filter: 'highpass' }, { wave: 'sine', freq: 90, to: 35, dur: .7, vol: .08 }]);
        previousIce = !!state.worldChanges.upperIceClosed;
        for (const wolf of state.predators || []) {
          if (wolfPhases.get(wolf.id) === 'dormant' && wolf.phase !== 'dormant') audio.sfx({ wave: 'triangle', freq: 230, to: 430, dur: .6, vib: [5, .06], vol: .045 });
          wolfPhases.set(wolf.id, wolf.phase);
        }
        water -= dt;
        if (north && speed > 8 && water <= 0 && NORTH_CUTTING_WORLD.creekRoute.some(a => Math.hypot(p.x-a.x, p.y-a.y) < 100)) {
          audio.sfx({ wave: 'noise', freq: 1800, to: 600, dur: .24, vol: .04, filter: 'lowpass' }); water = .42;
        }
      }
      // Audible reports follow real projectile creation, including distant guards.
      for (const bullet of state.bullets) {
        if (bullet.faction !== 'company') continue;
        if (heardShots.has(bullet)) continue;
        heardShots.add(bullet);
        audio.sfx('shoot', { vol: Math.max(.025, .17 - Math.hypot(bullet.x - p.x, bullet.y - p.y) / 3000), pitch: .55 });
      }
    },
  };
}
