import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShmupState, movePlayer, aimAtPlayer, createBulletPattern,
  tickPattern, scoreKill, rankFromScore
} from '../src/shmup/index.js';

test('player movement uses a focused hitbox and clamps to playfield', () => {
  const p = createShmupState({ width: 320, height: 480 }).player;
  const moved = movePlayer(p, { x: 1, y: -1, focus: true }, 1 / 60, { width: 320, height: 480 });
  assert.equal(moved.focused, true);
  assert.ok(moved.x > p.x && moved.y < p.y);
  assert.equal(moved.hitboxRadius, 3);
  const edge = movePlayer({ ...p, x: 1, y: 1 }, { x: 1, y: 1 }, 1, { width: 320, height: 480 });
  assert.ok(edge.x <= 310 && edge.y <= 470);
});

test('aim-at-player gives a deterministic aimed angle', () => {
  assert.ok(Math.abs(aimAtPlayer({ x: 100, y: 100 }, { x: 100, y: 200 }) - Math.PI / 2) < 1e-9);
});

test('pattern emits a radial volley with configured speed', () => {
  const pattern = createBulletPattern({ type: 'radial', count: 4, speed: 120, angle: 0 });
  const bullets = tickPattern(pattern, 0, { x: 160, y: 240 });
  assert.equal(bullets.length, 4);
  assert.equal(bullets[0].speed, 120);
  assert.equal(bullets[2].angle, Math.PI);
});

test('pattern scheduler respects interval and repeats', () => {
  const pattern = createBulletPattern({ type: 'fan', count: 3, spread: Math.PI / 2, interval: 0.2, speed: 80 });
  assert.equal(tickPattern(pattern, 0.1, { x: 0, y: 0 }).length, 0);
  assert.equal(tickPattern(pattern, 0.1, { x: 0, y: 0 }).length, 3);
  assert.equal(tickPattern(pattern, 0.2, { x: 0, y: 0 }).length, 3);
});

test('score combo decays after its grace window and rank is derived from score', () => {
  let state = createShmupState();
  state = scoreKill(state, { value: 100, chain: true });
  assert.equal(state.combo, 2);
  assert.equal(state.score, 100);
  assert.equal(rankFromScore(100000), 'S');
  assert.equal(rankFromScore(100), 'C');
});

test('state exposes CAVE-inspired mode presets without copying game assets', () => {
  const state = createShmupState({ mode: 'bullet-heaven' });
  assert.equal(state.mode, 'bullet-heaven');
  assert.ok(state.modes.focus && state.modes.normal && state.modes.special);
});

test('all public simulation output is deterministic', () => {
  const a = createShmupState({ seed: 42 });
  const b = createShmupState({ seed: 42 });
  assert.deepEqual({ ...a, rng: undefined }, { ...b, rng: undefined });
});
