/**
 * Cave-inspired shmup toolkit for Phaser 4.
 * The simulation is renderer-agnostic: wire returned entities to Phaser sprites,
 * SpriteGPULayer, Arcade bodies, or your own renderer.
 */

const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const wrapAngle = (a) => ((a % TAU) + TAU) % TAU;
const mulberry32 = (seed) => () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export const PLAYER_MODES = Object.freeze({
  normal: { speed: 220, focusedSpeed: 120, shot: 'spread', damage: 1 },
  focus: { speed: 120, focusedSpeed: 120, shot: 'lock', damage: 1.25 },
  special: { speed: 180, focusedSpeed: 100, shot: 'piercing', damage: 2 }
});

export function createShmupState(options = {}) {
  const width = options.width ?? 320, height = options.height ?? 480;
  return {
    seed: options.seed ?? 1, rng: mulberry32(options.seed ?? 1), width, height,
    mode: options.mode ?? 'bullet-heaven', phase: 'playing', score: 0, combo: 1,
    comboTimer: 0, lives: 3, graze: 0, power: 0,
    player: { x: width / 2, y: height - 54, speed: 220, focused: false, hitboxRadius: 3, invulnerable: 0 },
    modes: PLAYER_MODES, bullets: [], enemyBullets: [], enemies: [], effects: []
  };
}

export function movePlayer(player, input = {}, dt, bounds) {
  const dx = (input.x ?? 0), dy = (input.y ?? 0);
  const length = Math.hypot(dx, dy) || 1;
  const focused = Boolean(input.focus);
  const speed = focused ? (player.focusedSpeed ?? 120) : (player.speed ?? 220);
  return { ...player, focused, x: clamp(player.x + dx / length * speed * dt, player.hitboxRadius, bounds.width - player.hitboxRadius), y: clamp(player.y + dy / length * speed * dt, player.hitboxRadius, bounds.height - player.hitboxRadius) };
}

export function aimAtPlayer(origin, player) { return Math.atan2(player.y - origin.y, player.x - origin.x); }

export function createBulletPattern(config = {}) {
  return { ...config, type: config.type ?? 'radial', count: config.count ?? 8, speed: config.speed ?? 100, angle: config.angle ?? 0, spread: config.spread ?? Math.PI / 3, interval: config.interval ?? 0, elapsed: 0 };
}

export function tickPattern(pattern, dt, origin, target) {
  const nextElapsed = pattern.elapsed + dt;
  if (pattern.interval > 0 && nextElapsed < pattern.interval) { pattern.elapsed = nextElapsed; return []; }
  pattern.elapsed = pattern.interval > 0 ? nextElapsed - pattern.interval : 0;
  const bullets = [];
  const add = (angle) => bullets.push({ x: origin.x, y: origin.y, angle: wrapAngle(angle), speed: pattern.speed, radius: pattern.radius ?? 3, color: pattern.color ?? 0xff4060 });
  if (pattern.type === 'aimed') add(aimAtPlayer(origin, target));
  else if (pattern.type === 'fan') for (let i = 0; i < pattern.count; i++) add(pattern.angle - pattern.spread / 2 + pattern.spread * (pattern.count === 1 ? .5 : i / (pattern.count - 1)));
  else if (pattern.type === 'spiral') for (let i = 0; i < pattern.count; i++) add(pattern.angle + i * (TAU / pattern.count) + pattern.phaseOffset * (pattern.elapsed || 1));
  else for (let i = 0; i < pattern.count; i++) add(pattern.angle + TAU * i / pattern.count);
  pattern.angle += pattern.rotation ?? 0;
  return bullets;
}

export function scoreKill(state, enemy = {}) {
  const value = enemy.value ?? 100;
  const chain = enemy.chain !== false;
  const combo = chain ? state.combo : 1;
  return { ...state, score: state.score + value * combo, combo: chain ? Math.min(999, state.combo + 1) : 1, comboTimer: chain ? 2.5 : 0 };
}

export function updateCombo(state, dt) {
  const timer = Math.max(0, state.comboTimer - dt);
  return { ...state, comboTimer: timer, combo: timer === 0 ? 1 : state.combo };
}

export function rankFromScore(score) { return score >= 100000 ? 'S' : score >= 25000 ? 'A' : score >= 5000 ? 'B' : 'C'; }

export function cancelBullets(bullets, policy = 'destroy', origin = null, radius = Infinity) {
  const kept = [], converted = [];
  for (const bullet of bullets) {
    const distance = origin ? Math.hypot(bullet.x - origin.x, bullet.y - origin.y) : 0;
    if (distance > radius) { kept.push(bullet); continue; }
    if (policy === 'convertToItem') converted.push({ x: bullet.x, y: bullet.y, value: bullet.value ?? 10, type: 'star' });
    else if (policy === 'slow') kept.push({ ...bullet, speed: (bullet.speed ?? 0) * 0.25, slowed: true });
  }
  return { bullets: kept, converted };
}

export function collisionGeometry(player, bullet) {
  return Math.hypot(player.x - bullet.x, player.y - bullet.y) <= (player.hitboxRadius ?? 3) + (bullet.radius ?? 3);
}

export function isGrazing(player, bullet, grazeRadius = 18) {
  const d = Math.hypot(player.x - bullet.x, player.y - bullet.y);
  return d > (player.hitboxRadius ?? 3) + (bullet.radius ?? 3) && d <= grazeRadius;
}

export const ENEMY_ARCHETYPES = Object.freeze({
  fodder: { health: 1, motion: 'straight', value: 100 },
  turret: { health: 8, motion: 'straight', value: 500, pattern: 'aimed' },
  spinner: { health: 5, motion: 'sine', value: 300, pattern: 'radial' },
  charger: { health: 3, motion: 'aimed', value: 400 },
  carrier: { health: 12, motion: 'straight', value: 1000, deathAction: 'spawn-fodder' },
  midboss: { health: 100, motion: 'sine', value: 5000, phases: 2 },
  boss: { health: 1000, motion: 'sine', value: 50000, phases: 3 }
});

export function defineStage(config = {}) {
  return {
    id: config.id ?? 'stage-1', orientation: config.orientation ?? 'vertical',
    scrollSegments: config.scrollSegments ?? [{ duration: 30, speed: 60 }],
    spawns: config.spawns ?? [], theme: config.theme ?? 'mechanized',
    routeId: config.routeId ?? 'default', boss: config.boss ?? null
  };
}

export function createFormation(type, options = {}) {
  const count = options.count ?? 8, cx = options.x ?? 160, cy = options.y ?? -30, gap = options.gap ?? 28;
  return Array.from({ length: count }, (_, i) => {
    if (type === 'v') { const side = i % 2 ? 1 : -1, step = Math.ceil(i / 2); return { x: cx + side * step * gap, y: cy + step * 12 }; }
    if (type === 'line') return { x: cx + (i - (count - 1) / 2) * gap, y: cy };
    if (type === 'circle') { const a = TAU * i / count; return { x: cx + Math.cos(a) * gap * 2, y: cy + Math.sin(a) * gap * 2 }; }
    return { x: cx, y: cy - i * gap };
  });
}

export function moveEnemy(enemy, dt, time, player) {
  const t = time + (enemy.phase ?? 0);
  if (enemy.motion === 'sine') return { ...enemy, x: enemy.anchorX + Math.sin(t * (enemy.frequency ?? 2)) * (enemy.amplitude ?? 40), y: enemy.y + (enemy.speed ?? 30) * dt };
  if (enemy.motion === 'aimed') { const a = aimAtPlayer(enemy, player); return { ...enemy, x: enemy.x + Math.cos(a) * (enemy.speed ?? 40) * dt, y: enemy.y + Math.sin(a) * (enemy.speed ?? 40) * dt }; }
  return { ...enemy, y: enemy.y + (enemy.speed ?? 50) * dt };
}

export { clamp, mulberry32 };
export default { createShmupState, movePlayer, createBulletPattern, tickPattern, createFormation, moveEnemy, scoreKill, updateCombo, rankFromScore, cancelBullets, collisionGeometry, isGrazing, defineStage };

/** Phaser 4 adapter: call from a Scene's update and map entities to SpriteGPULayer. */
export function attachShmup(scene, config = {}) {
  let state = createShmupState(config);
  return { get state() { return state; }, update(dt, input) { state = { ...state, player: movePlayer(state.player, input, dt, state) }; state = updateCombo(state, dt); return state; }, destroy() {} };
}

export const CAVE_DESIGN_NOTES = Object.freeze({
  movement: 'Give the player a fast normal mode, slower focused mode, and a visibly small collision core.',
  bullets: 'Use readable telegraphs, deterministic patterns, aimed/fan/radial/spiral primitives, and a graze system.',
  scoring: 'Reward chaining kills, point-blank risk, graze, medals/items, and route-specific mastery.',
  stages: 'Compose formations and patterns as data-driven timelines so bosses and stages are authored, not hard-coded.',
  art: 'Keep background motion layered: distant parallax, midground silhouettes, foreground accents; contrast bullets against all layers.'
});
