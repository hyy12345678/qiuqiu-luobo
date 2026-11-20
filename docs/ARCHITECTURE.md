English | [中文](ARCHITECTURE.zh-CN.md)

# Qiuqiu Pumpkin · Architecture and Design

> Describes what the code actually does (baseline commit `723a02b`, checked 2026-11-04).
> For the original gameplay plan, see [`PLAN.md`](../PLAN.md). For differences between the plan and the code, see [PROGRESS.md section 5](./PROGRESS.md#5-document-and-code-deviations).

---

## 1. Tech Stack

| Item | Actual choice |
|----|----------|
| Language | TypeScript 5.9 (`strict`, `noUnusedLocals`) |
| Build | Vite 7 + `vite-plugin-singlefile`. Output is a single `dist/index.html` (about 70 KB, about 22 KB gzipped) |
| Rendering | Native Canvas 2D. Everything is drawn in code, with no image or audio assets |
| UI | DOM overlay (`#ui-root`). Buttons, panels and HUD are all DOM elements |
| Audio | Web Audio API, with synthesized sound effects and BGM |
| Save | localStorage, key `qqlb-save-v1` |
| Tests | `scripts/smoke.ts` (Node logic smoke test), `scripts/click-test.cjs` (drives local Chrome through puppeteer-core) |

The runtime has no framework and no third-party runtime dependencies. `puppeteer-core` is used only by the regression script.

---

## 2. Directory Structure

```
index.html              Page skeleton: #stage > canvas#game-canvas + #ui-root, inline CSS
src/
├── main.ts             Entry point: wires Renderer / SceneManager / Input / Game, registers the global audio unlock
├── core/
│   ├── Game.ts         Fixed-step main loop, game speed, pause, background handling. Draws the FPS debug label
│   ├── SceneManager.ts Scene registration and switching. Clears #ui-root on switch
│   ├── Input.ts        Detects "taps" from pointerdown/up and converts them to design coordinates
│   ├── EventBus.ts     Global event bus (singleton bus)
│   └── settings.ts     Global mutable state: speed (1/2), paused
├── scenes/
│   ├── MenuScene.ts    Level select (background drawn on canvas + DOM level cards)
│   └── BattleScene.ts  Battle scene: state, update, render, HUD, build/tower panels, pause and results
├── battle/
│   ├── Path.ts         Converts grid-coordinate corners into a pixel polyline, and finds positions by distance along it
│   ├── Grid.ts         16×9 build grid. Computes which cells cannot be built on
│   ├── WaveManager.ts  Wave timeline, countdown between waves, early calls
│   ├── Economy.ts      Gold income and spending
│   ├── effects.ts      Short-lived effects: floating text, smoke puffs, monster death ghosts
│   ├── explode.ts      Area damage from Pumpkin Bomb death explosions (pure function, easy to verify)
│   ├── target.ts       CombatTarget interface (shared by monsters and obstacles)
│   └── entities/
│       ├── Tower.ts    Six tower types: targeting, firing, three-level growth and drawing
│       ├── Bullet.ts   Homing bullet (Bullet) and piercing wind blade (FanBlade)
│       ├── Monster.ts  Monsters that walk the path: slowing, healing targets, health bar
│       └── Obstacle.ts Map obstacles (Candy Bucket / Coffin / Tombstone, keys chest / crate / rock)
├── data/               All gameplay numbers (plain TS objects, not JSON)
│   ├── towers.ts       Six tower stats, upgrade multipliers, branch definitions (i18n keys)
│   ├── monsters.ts     Five monsters plus the boss: stats and appearance. Names are i18n keys
│   ├── obstacles.ts    Three obstacle types: HP and rewards. Names are i18n keys
│   └── levels/         level01~05.ts + types.ts (LevelDef) + index.ts (ALL_LEVELS, selection). Level names are i18n keys
├── i18n/               Translations (see section 6.7)
│   ├── en.ts           English strings. Source of truth for keys (type TKey)
│   ├── zh.ts           Simplified Chinese strings. Must define every key in en.ts
│   └── index.ts        t(), setLang(), getLang(), applyStaticText(), LANGS, DEFAULT_LANG
├── render/
│   ├── Renderer.ts     Letterbox scaling for the 1280×720 design resolution, DPR capped at 2
│   ├── ground.ts       Off-screen ground cache (grass, path, decorations, wooden sign)
│   ├── projection.ts   Pseudo-3D projection (see section 6.5)
│   ├── sprites.ts      Hand-drawn functions for the pumpkin, monsters, obstacles (drawPumpkin, drawCandyBucket, drawCoffin, drawTombstone)
│   └── decor.ts        Clouds, flowers, tufts, rounded rectangles and other decoration and helpers
├── audio/AudioManager.ts  Synthesized sound effects (SfxName enum) and BGM timer
├── save/SaveManager.ts    Star records, mute preference and language
└── utils/              math.ts (point-to-polyline distance, etc.), rng.ts (seeded random)
scripts/
├── smoke.ts            Logic smoke test: path, grid, obstacles, wave duration, save unlocks
└── click-test.cjs      Real click regression: select level → click grass to build → click path does not open a panel
```

---

## 3. Runtime Architecture

### 3.1 Startup

1. `main.ts` gets the DOM nodes, registers a `pointerdown` handler to unlock audio, and a `visibilitychange` handler to pause and resume BGM.
2. Creates `Renderer` (sets the canvas size), `SceneManager` and `Input`.
3. Registers `MenuScene` and `BattleScene`, then switches to `menu`.
4. `Input.onTap` passes design coordinates to `scenes.current.onTap`.
5. `Game.start()` starts the rAF loop.

### 3.2 Main Loop (`Game.tick`)

- The rAF time delta is capped at 250 ms, so returning from the background does not run too many frames at once.
- Logic updates use an accumulator with a fixed step of `1/60 s`, running at most 12 steps per frame. Simulated time = frame delta × `settings.speed`.
- When paused (`settings.paused`), `update` is skipped but `render` still runs.
- After `scene.render(ctx)` each frame, if the URL has `?debug`, an FPS label is drawn in the top-left corner. It is hidden in normal play.

### 3.3 Scene Interface

```ts
interface Scene {
  readonly name: string;
  enter(): void;     // Build DOM, subscribe to events
  exit(): void;      // Unsubscribe (SceneManager clears #ui-root)
  update(dt: number): void;   // Fixed step
  render(ctx): void;          // Every frame, in design coordinates
  onTap?(x, y): void;
}
```

`SceneManager.reloadCurrent()` is used for "Play again" and "Next level". It calls `exit` and then `enter`, so all battle state is rebuilt.

### 3.4 Coordinates and Scaling

- All logic uses the design coordinate system of **1280×720**.
- `Renderer.resize` computes `scale = min(window width/1280, window height/720)`. The physical canvas size is the CSS size × `min(dpr, 2)`.
- On a click, `Input` uses `getBoundingClientRect` and `scale` to convert the position back to design coordinates.
- DOM UI font size scales with `scale` (`stage.style.fontSize = 16 × scale`).

### 3.5 Event Bus

| Event | Emitted by | Subscribed by | Purpose |
|------|--------|--------|------|
| `monster:killed` | `Monster.takeDamage` | `BattleScene` | Adds the bounty, shows floating text, plays sound |
| `monster:escaped` | `Monster.update` | `BattleScene` | Pumpkin loses HP. HP ≤ 0 is a loss |
| `app:paused` | `Game` (when backgrounded) | `BattleScene` | Opens the pause panel |

The event bus is used only for notifications inside battle. Direct calls between towers, bullets and obstacles still go through `TowerContext` callbacks.

---

## 4. Battle System

### 4.1 Update Order for One Battle Frame (`BattleScene.update`)

1. `WaveManager.update`: pushes monsters into `monsters` following the timeline, and shows the banner when a wave changes.
2. Every monster's `update`: advances distance along the path and updates position. Emits `escaped` on reaching the end.
3. Witch healing aura: every 2.5 s, heals other monsters within 90 px that are not at full HP by 25.
4. Filters out dead monsters.
5. Every tower's `update`. Towers can add bullets to `projectiles`.
6. Every bullet's `update`. Bullets are removed on hit.
7. Obstacles: the hit flash fades. On destruction, the reward is paid and the obstacle is removed.
8. Effects, screen shake and banner timers. Refreshes the wave bar.
9. Win/lose check: when the wave list is finished and no monsters remain, the player wins.

### 4.2 Map and Build Rules

- Grid: 16 columns × 9 rows, 80 px per cell.
- A cell cannot be built on when either of these is true:
  - The cell center is less than 58 px from any path polyline, or
  - The cell center is less than 95 px from the pumpkin.
- A cell with an obstacle cannot be built on while the obstacle exists. Once the obstacle is destroyed, the cell becomes buildable if it is not on the path. This is an implicit unlock, with no separate unlock state.
- `smoke.ts` checks obstacle positions in level data. They must be on buildable cells and must not overlap.

### 4.3 Towers (`data/towers.ts`, `entities/Tower.ts`)

| Tower | Cost | Range | Damage | Cooldown (s) | Behavior |
|----|------|------|------|------------|------|
| Potion Tower `bottle` | 100 | 155 | 22 | 0.55 | Single target, homing bullets |
| Spider Web `frost` | 140 | 150 | 12 | 0.8 | Homing bullets. A hit slows the target by 40% for 2 s |
| Bat Arrow `multishot` | 160 | 165 | 16 | 0.7 | Attacks the first 3 targets at once |
| Candle Tower `sunflower` | 180 | 115 | 10 | 0.5 | No projectile. Periodically burns all targets in range |
| Witch Broom `fan` | 220 | 190 | 26 | 0.9 | Straight wind blade that pierces targets along its line. Each target is hit only once |
| Pumpkin Cannon `rocket` | 260 | 185 | 55 | 1.6 | Homing bullets with area splash (radius 62 + 8×level, 70% damage) |

- **Targeting**: monsters come first, sorted by how far they have walked. Obstacles are attacked only when no monsters are present. The nearest obstacle in range is chosen.
- **Upgrades**: damage ×[1, 1.5, 2.25], range ×[1, 1.12, 1.25], cooldown ×[1, 0.92, 0.85]. Upgrade cost is `round(cost × 0.8 or 1.2, rounded to nearest 10)`.
- **Selling**: refunds 70% of the total invested (`invested`).
- **Build flow**: after tapping an empty cell, the build panel lists the tower types in this level's `unlockedTowers`. Selecting a type updates the range preview (dashed circle) and the cost on the confirm button. Pressing "Build" then charges the cost and places the tower. The confirm button is disabled when gold is insufficient.
- **Names and descriptions**: tower names and descriptions are i18n keys (`tower.<id>.name` / `tower.<id>.desc`, defined in `data/towers.ts`).
- **Lv3 branches**: each tower has two branches, A and B, chosen at Lv3. Their names and descriptions are also i18n keys (`branch.<id>.A|B.name` / `.desc`).
- **Unlocks by level**: Level 1 has only the Potion Tower. Level 2 adds Spider Web and Bat Arrow. Level 3 adds Candle Tower. Levels 4 and 5 add Witch Broom and Pumpkin Cannon. The level at which Bat Arrow unlocks is an assumption in this document. PLAN does not specify it (see PROGRESS section 5).

### 4.4 Monsters (`data/monsters.ts`)

Display names are i18n keys (`monster.<id>`). The table shows the English name, with the key in code font.

| Monster | HP | Speed (px/s) | Bounty | Damage to pumpkin | Notes |
|----|------|------|------|------|------|
| Little Ghost `grunt` | 100 | 62 | 10 | 1 | |
| Black Cat `runner` | 60 | 112 | 12 | 1 | Fast |
| Mummy `tank` | 420 | 44 | 25 | 2 | |
| Witch `healer` | 160 | 58 | 20 | 1 | Healing aura every 2.5 s |
| Pumpkin Bomb `bomber` | 85 | 92 | 15 | 2 | On death, explodes: radius 85, damage 50, can chain (v1.2) |
| Vampire Count `boss` | 3200 | 42 | 200 | 3 | Slow resistance 0.5. Hit stagger lasts 0.2 s, during which speed drops to 30%. Briefly squashes when hit (v1.2) |

- The `hpScale` in the wave table scales HP proportionally.
- Monsters move at constant speed along the path. The slow ratio is adjusted by resistance in `applySlow`.

### 4.5 Map Obstacles (`data/obstacles.ts`)

| Obstacle | HP | Reward on destruction |
|------|------|------|
| Candy Bucket `chest` | 150 | 120 |
| Coffin `crate` | 100 | 60 |
| Tombstone `rock` | 260 | 50 |

Obstacles block tower build spots. Towers attack obstacles only when no monsters are present.

### 4.6 Economy, Pumpkin and Stars

- Starting gold: 220 to 350, varies by level. A kill pays the monster's bounty.
- Pumpkin HP (`pumpkinHp` in level data): 10 in every level.
- Stars: after clearing a level, remaining HP ≥ 8 gives 3 stars, ≥ 4 gives 2 stars, otherwise 1 star. Stars never decrease.
- Early call: `bonus = ceil(min(remaining countdown, 6) × 10)`.

### 4.7 Wave Timeline (`WaveManager`)

- State machine: `prelude` (start) → `spawning` (monsters come out) → `countdown` (between waves) → … → `done`.
- Countdown before the first wave: 3.5 s. Countdown between waves: 6 s.
- Each `WaveEntry` spawns at `delay + n × interval` seconds. Entries in the same wave are sorted by time.
- The `path` field can set the entry path (used by levels with two entrances).

---

## 5. Data Formats

### 5.1 Levels (`LevelDef`, `data/levels/types.ts`)

```ts
interface LevelDef {
  id: number;                 // Starts at 1. Used for save keys and unlock checks
  name: TKey;                 // i18n key, e.g. 'level.1'
  startGold: number;
  pumpkinHp: number;          // Pumpkin HP
  unlockedTowers: TowerKind[];  // Tower types buildable in this level. Must include 'bottle'. Only grows from level to level
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;  // Corner points in grid coordinates. Multiple paths mean multiple entrances
  obstacles: Array<{ col: number; row: number; type: 'chest' | 'crate' | 'rock' }>;
  waves: WaveDef[];           // { entries: [{ monster, count, interval, delay?, hpScale?, path? }] }
}
```

To add a level: copy a `levelNN.ts`, change the settings, register it in `ALL_LEVELS` in `data/levels/index.ts`, and add its name key (`level.N`) to both `i18n/en.ts` and `i18n/zh.ts`. `smoke.ts` checks new levels automatically.

### 5.2 Save Data (`SaveManager`)

```json
{ "stars": { "1": 3, "2": 1 }, "muted": false, "lang": "en" }
```

The storage key is `qqlb-save-v1`. If storage is unavailable, the game falls back to memory-only mode. `lang` is `"en"` or `"zh"`, and defaults to `"en"`. Level N unlocks when level N−1 has more than 0 stars.

---

## 6. Rendering and Audio

- **Ground**: `buildGround` creates an off-screen canvas and caches it per level and language. Each frame it calls `drawImage` once.
- **Entities**: monsters, towers, obstacles, the pumpkin, bullets and effects are drawn directly every frame. Monsters and obstacles are sorted by y coordinate to get correct overlap.
- **HUD**: gold, wave, speed, mute and pause are DOM elements. `refreshHud` updates when gold changes.
- **Audio**: `AudioManager` unlocks the AudioContext on the first `pointerdown`. BGM is A minor pentatonic at 88 bpm, and stops when the page goes to the background. There are 17 sound effects (`SfxName`), all synthesized with Web Audio.

---

## 6.5 Pseudo-3D Rendering (`render/projection.ts`, `render/ground.ts`)

Logic still uses a 1280×720 flat plane. Coordinates are converted only when drawing and when handling clicks.

- **Projection formula**: `t = y / 720`, far-side scale `s = 0.7 + 0.3·t`, screen X = `640 + (x − 640)·s`, screen Y = `Y_TOP + 0.7·y`, `Y_TOP = 216`. The inverse projection is closed-form, so `unprojectX / unprojectY` are used directly.
- **Three constants**: `S_FAR`, `GROUND_K` and `Y_TOP` are at the top of `projection.ts`. `GROUND_K` determines `Y_TOP`, so the bottom edge of the world lands on the bottom of the screen.
- **Drawing method**: upright objects (tower bodies, monsters, obstacles, the pumpkin) use `enterUpright`, which scales the whole object by its distance. Ground objects (stone pads, range rings, cell highlights) use `enterGround`, which also multiplies the vertical axis by `GROUND_K`.
- **Ground**: `buildGround` draws the flat map, with `WORLD_PAD` extra width on each side. `tiltGround` warps the map into an oblique view in strips of 2 design units. It runs once per level, on first entry, and the result is cached. The sky and distant mountains are drawn in `drawBackdrop`.
- **Depth sorting**: obstacles, towers, monsters, ground props (wooden signs, bushes, mushrooms) and the pumpkin go into one list, sorted by `depthY` (the y of their feet) before drawing.
- **Clicks**: empty cells are unprojected first, then passed to `grid.worldToCell`. Towers and props use `hitUpright` for a screen-space bounding box test.
- **Flat mode**: with `?flat` in the URL, projection becomes the identity transform. The ground is not warped, and drawing falls back to the flat style.

## 6.6 Character Appearance and Animation

- **Towers**: every tower has a face (`drawTowerFace`) with three expressions: happy, excited while firing, and blinking. From Lv2, the stone base gets a bronze rim. At Lv3, the base becomes gold, with a glow in the tower's element color and sparkles that orbit the tower. The tower body bounces once on upgrade. When no living monster is in range, the tower does a small hop or sway every 4 to 8 seconds.
- **Monsters**: while walking, the body bounces and squashes. When hit, it squashes. It blinks about every 3 seconds. On death, `Effects.ghost` draws a fading ghost: it squashes, then pops up, with eyes closed as it fades out. The Black Cat has pointed ears. The Pumpkin Bomb is orange with an angry brow and a small lit fuse on top. The Little Ghost is a round shape with a wavy hem and no feet.
- **Constants**: the tower level scaling is in `TIER_SCALE`, and the idle duration is in `IDLE_DUR`. Both are at the top of `Tower.ts`.

## 6.7 Internationalization (`src/i18n/`)

- **Default language is English.** The choice is stored in the save data as the `lang` field (see `SaveManager`). Supported languages are `en` and `zh`.
- **Keys**: `en.ts` is the source of truth for keys. The `TKey` type is derived from it. `zh.ts` must define every key, so a missing Chinese string is a type error.
- **API** (`i18n/index.ts`):
  - `t(key, vars?)`: returns the string for the current language. `{name}` placeholders are replaced from `vars`.
  - `setLang(lang)`: saves the choice and calls `applyStaticText`. The caller redraws the current scene (`MenuScene` calls `scenes.reloadCurrent()`).
  - `getLang()`: returns the current language.
  - `applyStaticText()`: updates `<html lang>`, `<title>`, the description meta, and nodes marked `data-i18n` (plain text) or `data-i18n-html` (allows tags such as `<br>`).
- **Where text lives**: canvas text (HUD labels, banners, ground sign, map text) is drawn with `t()` on each render. The ground cache key is `${lang}:${levelId}`, so switching language rebuilds the ground.
- **Data**: names in `data/towers.ts`, `data/monsters.ts`, `data/obstacles.ts` and `data/levels/*` are keys, not text. Translate at display time with `t()`.
- **Language switch**: the menu button shows the other language's name (`lang.name`). Clicking it switches language and reloads the menu.

---

## 7. Known Design Trade-offs

- **No pathfinding**: monsters follow fixed corner points. There is no A\*.
- **No object pooling**: bullets, floating text and effects are created with `new` each time. PLAN called for pooling, but it is not implemented yet (see DEV_PLAN T-09).
- **No collision bodies**: targeting uses distance checks, and wind blades use circular distance checks.
- **Numbers live in `data/`**: changing a value does not require changing logic code.
- **No assets**: all graphics are drawn at runtime. There are no image files.
