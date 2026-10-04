# CAVE Shmup Kit

A Phaser 4-friendly, renderer-agnostic toolkit for building dense arcade shoot-'em-ups.

The library is inspired by design patterns found in DoDonPachi, DeathSmiles, Guwange, and Progear. It does not include CAVE assets, code, or trademarked game content.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, then choose a style:

- `1` DoDonPachi — vertical mechanized bullet storm
- `2` DeathSmiles — gothic horizontal-style presentation
- `3` Guwange — yokai/diagonal route presentation
- `4` Progear — steampunk aerial assault

Controls: WASD/arrows move, Shift focus, Space fire, R reset.

## Library

`src/shmup/index.js` provides:

- focused movement and custom hitboxes;
- aimed, fan, radial, and spiral patterns;
- enemy formations and movement behaviors;
- graze and collision geometry;
- bullet cancellation and item conversion;
- combo scoring and rank calculation;
- enemy archetypes and data-driven stage definitions;
- deterministic seeded state.

The Phaser adapter is intentionally small. Gameplay state remains independent of rendering so it can later use Phaser 4 render nodes, SpriteGPULayer, or custom object pools.

## Verify

```bash
npm test
npm run check
npm run build
```

## Sources and scope

Design references consulted:

- https://en.wikipedia.org/wiki/DoDonPachi
- https://en.wikipedia.org/wiki/Deathsmiles
- https://en.wikipedia.org/wiki/Progear
- https://en.wikipedia.org/wiki/Guwange
- https://shmups.wiki/library/DoDonPachi

Exact mechanics vary between games. This repository treats those references as design inspiration, not as a claim to reproduce every original numeric rule.

## License

MIT
