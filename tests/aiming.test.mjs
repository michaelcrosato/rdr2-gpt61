import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePointerAim, resolveHuntPointerAim } from '../src/aiming.js';

test('clicking the visible body of a projected actor targets that actor rather than terrain behind it', () => {
  const state = { enemies: [{ id: 'guard', x: 150, y: 200, hp: 70 }], npcs: [], animals: [] };
  const project = (x, y) => [x * 1.5 - 100, y * 1.2 - 120];
  const bodyPointer = { x: 125, y: 88 };
  assert.deepEqual(resolvePointerAim(state, [150, 173.3], bodyPointer, project), [150, 200]);
  assert.deepEqual(resolvePointerAim(state, [250, 200], { x: 275, y: 120 }, project), [250, 200], 'empty terrain preserves free aiming');
});

test('departed, dead, delivered and carried actors do not steal pointer targets', () => {
  const state = { enemies: [{ x: 50, y: 60, hp: 0 }, { x: 50, y: 60, hp: 100, hidden: true }], npcs: [{ x: 50, y: 60, hp: 100, departed: true }, { x: 50, y: 60, hp: 100, carried: true }], animals: [{ x: 50, y: 60, hp: 100, returned: true }] };
  assert.deepEqual(resolvePointerAim(state, [50, 35], { x: 50, y: 35 }, (x, y) => [x, y]), [50, 35]);
});

test('a wolf’s wide low silhouette accepts flank aim while empty air above it remains free aim', () => {
  const state = { enemies: [{ id: 'pack-flanker', kind: 'wolf', x: 200, y: 150, hp: 70, phase: 'stalk' }], npcs: [], animals: [] };
  const project = (x, y) => [x, y];
  assert.deepEqual(resolvePointerAim(state, [224, 137], { x: 224, y: 137 }, project), [200, 150]);
  assert.deepEqual(resolvePointerAim(state, [200, 100], { x: 200, y: 100 }, project), [200, 100]);
});

test('wildlife body aim keeps a body height while an actual projected head selects its physical point', () => {
  const state = { animals: [{ id: 'doe', kind: 'deer', hp: 100 }] };
  const zones = () => [
    { id: 'body', x: 150, y: 200, z: 19, rx: 24, ry: 8, height: 15 },
    { id: 'head', x: 178, y: 200, z: 37, rx: 6, ry: 4, height: 8 },
  ];
  const project = (x, y, z) => [x, y - z];
  assert.deepEqual(resolveHuntPointerAim(state, [150, 181], { x: 150, y: 181 }, project, zones), { point: [150, 200], z: 19 });
  assert.deepEqual(resolveHuntPointerAim(state, [178, 163], { x: 178, y: 163 }, project, zones), { point: [178, 200], z: 37 });
  assert.deepEqual(resolveHuntPointerAim(state, [220, 160], { x: 220, y: 160 }, project, zones), { point: [220, 160], z: 0 });
});

test('dead and carried wildlife cannot redirect a free arrow aim point', () => {
  const state = { animals: [{ kind: 'deer', hp: 0 }, { kind: 'deer', hp: 100, attachment: { type: 'carried', targetId: 'mara' } }] };
  const zones = () => { throw new Error('Inactive bodies must not be considered'); };
  assert.deepEqual(resolveHuntPointerAim(state, [150, 180], { x: 150, y: 180 }, (x, y) => [x, y], zones), { point: [150, 180], z: 0 });
});
