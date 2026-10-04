import Phaser from 'phaser';
import { createShmupState, movePlayer, createBulletPattern, tickPattern, createFormation, collisionGeometry, isGrazing, scoreKill } from './shmup/index.js';
import './style.css';

const STYLES = {
  dodonpachi: { title: 'DoDonPachi', subtitle: 'MECHANIZED BULLET STORM', bg: 0x080b20, accent: 0xffd34e, orientation: 'vertical', enemy: 0xd83b55, pattern: { type: 'radial', count: 10, speed: 92, interval: .7 } },
  deathsmiles: { title: 'DeathSmiles', subtitle: 'GOTHIC SIDE-SCROLLING NIGHTMARE', bg: 0x190b25, accent: 0xff83c8, orientation: 'horizontal', enemy: 0x8c5ad6, pattern: { type: 'fan', count: 7, spread: 1.6, speed: 82, interval: .8 } },
  guwange: { title: 'Guwange', subtitle: 'YOKAI ROUTE OF THE HIDDEN CITY', bg: 0x101d18, accent: 0x83e39b, orientation: 'diagonal', enemy: 0x2e9b70, pattern: { type: 'spiral', count: 8, speed: 74, interval: .65, phaseOffset: .12 } },
  progear: { title: 'Progear', subtitle: 'STEAM-POWERED AERIAL ASSAULT', bg: 0x21140c, accent: 0xffa04c, orientation: 'horizontal', enemy: 0xc45f32, pattern: { type: 'aimed', count: 1, speed: 110, interval: .55 } }
};

let selected = 'dodonpachi';
let state;
let pattern;
let lastShot = 0;
let elapsed = 0;
let scoreText, comboText, styleText;

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  create() {
    this.cameras.main.setBackgroundColor(STYLES[selected].bg);
    this.graphics = this.add.graphics();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE');
    this.input.keyboard.on('keydown-ONE', () => this.changeStyle('dodonpachi'));
    this.input.keyboard.on('keydown-TWO', () => this.changeStyle('deathsmiles'));
    this.input.keyboard.on('keydown-THREE', () => this.changeStyle('guwange'));
    this.input.keyboard.on('keydown-FOUR', () => this.changeStyle('progear'));
    this.input.keyboard.on('keydown-R', () => this.reset());
    this.input.keyboard.on('keydown-ESC', () => this.scene.pause());
    this.enemies = []; this.bullets = []; this.enemyBullets = []; this.stars = [];
    this.reset();
  }
  changeStyle(name) { selected = name; this.cameras.main.setBackgroundColor(STYLES[name].bg); this.reset(); }
  reset() {
    state = createShmupState({ width: 640, height: 720, seed: selected.length, mode: 'bullet-heaven' });
    state.player.x = 320; state.player.y = 620;
    pattern = createBulletPattern({ ...STYLES[selected].pattern });
    this.enemies = createFormation('line', { x: 320, y: 100, count: 8, gap: 60 }).map((p, i) => ({ ...p, anchorX: p.x, hp: 2 + i % 3, maxHp: 2 + i % 3, motion: i % 2 ? 'sine' : 'straight', phase: i * .4, value: 100 + i * 25 }));
    this.bullets = []; this.enemyBullets = []; this.stars = Array.from({ length: 55 }, (_, i) => ({ x: (i * 83) % 640, y: (i * 137) % 720, speed: 12 + i % 20 }));
  }
  update(time, delta) {
    const dt = Math.min(.05, delta / 1000); elapsed += dt;
    const k = this.keys; const input = { x: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0), y: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0), focus: k.SHIFT.isDown };
    state.player = movePlayer(state.player, input, dt, state);
    if (k.SPACE.isDown && time - lastShot > (input.focus ? 150 : 85)) { lastShot = time; for (const angle of input.focus ? [-Math.PI / 2] : [-Math.PI / 2 - .1, -Math.PI / 2, -Math.PI / 2 + .1]) this.bullets.push({ x: state.player.x, y: state.player.y, angle, speed: input.focus ? 620 : 560, radius: 4, damage: input.focus ? 2 : 1 }); }
    this.bullets.forEach(b => { b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt; });
    this.bullets = this.bullets.filter(b => b.y > -30 && b.y < 750 && b.x > -30 && b.x < 670);
    this.enemies = this.enemies.map(e => ({ ...e, x: e.motion === 'sine' ? e.anchorX + Math.sin(elapsed * 2 + e.phase) * 35 : e.x, y: e.y + 12 * dt }));
    const spawned = tickPattern(pattern, dt, { x: 320, y: 120 }, state.player); this.enemyBullets.push(...spawned.map(b => ({ ...b, x: 320, y: 120 })));
    this.enemyBullets.forEach(b => { b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt; });
    this.enemyBullets = this.enemyBullets.filter(b => b.x > -40 && b.x < 680 && b.y > -40 && b.y < 760);
    for (const b of this.bullets) for (const e of this.enemies) if (!b.dead && e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < 24) { b.dead = true; e.hp -= b.damage; if (e.hp <= 0) { state = scoreKill(state, { value: e.value, chain: true }); } }
    this.enemies = this.enemies.filter(e => e.hp > 0);
    for (const b of this.enemyBullets) { if (isGrazing(state.player, b, 24)) state.graze++; if (collisionGeometry(state.player, b) && !state.player.invulnerable) state.lives--; }
    this.draw();
  }
  draw() {
    const g = this.graphics; const s = STYLES[selected]; g.clear();
    for (const star of this.stars) { star.y = (star.y + star.speed * .016) % 720; g.fillStyle(s.accent, .22); g.fillCircle(star.x, star.y, 1 + star.speed / 30); }
    for (const b of this.enemyBullets) { g.fillStyle(s.accent, .9); g.fillCircle(b.x, b.y, b.radius ?? 4); }
    for (const b of this.bullets) { g.fillStyle(0xffffff, 1); g.fillRect(b.x - 2, b.y - 10, 4, 14); }
    for (const e of this.enemies) { g.fillStyle(s.enemy, 1); g.fillTriangle(e.x, e.y - 16, e.x - 14, e.y + 12, e.x + 14, e.y + 12); g.lineStyle(2, s.accent, .5); g.strokeCircle(e.x, e.y, 18); }
    g.fillStyle(s.accent, 1); g.fillCircle(state.player.x, state.player.y, state.player.focused ? 8 : 13); g.fillStyle(0xffffff, 1); g.fillCircle(state.player.x, state.player.y, 3);
    styleText.setText(`${s.title}  //  ${s.subtitle}`); scoreText.setText(`SCORE ${String(state.score).padStart(8, '0')}   GRAZE ${state.graze}`); comboText.setText(`CHAIN x${state.combo}   LIVES ${state.lives}`);
  }
}

const config = { type: Phaser.AUTO, width: 640, height: 720, parent: 'app', backgroundColor: '#080b20', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: GameScene };
const game = new Phaser.Game(config);
window.shmupGame = game;
window.setStyle = name => { selected = name; game.scene.getScene('GameScene')?.changeStyle(name); };

const ui = document.createElement('div'); ui.className = 'ui'; ui.innerHTML = `<div class="title"></div><div class="score"></div><div class="combo"></div><div class="help">1 DoDonPachi · 2 DeathSmiles · 3 Guwange · 4 Progear<br>WASD/Arrows move · Shift focus · Space fire · R reset</div><div class="buttons">${Object.keys(STYLES).map((x, i) => `<button data-style="${x}">${i + 1} ${STYLES[x].title}</button>`).join('')}</div>`; document.body.appendChild(ui);
styleText = ui.querySelector('.title'); scoreText = ui.querySelector('.score'); comboText = ui.querySelector('.combo'); ui.querySelectorAll('button').forEach(b => b.onclick = () => window.setStyle(b.dataset.style));
