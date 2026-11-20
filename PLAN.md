English | [中文](PLAN.zh-CN.md)

# Qiuqiu Pumpkin · H5 Tower Defense Game · Development Plan

> An H5 web tower defense game that pays homage to the gameplay of Bao Wei Luo Bo (Carrot Fantasy). It uses original art and an original name, and its game mechanics draw on classic tower defense.
> Document version: v1.0 (2026-08-26)
> Note: This file is a planning snapshot of v1.0. For current progress, deviations from the code, and later plans, see [docs/PROGRESS.md](./docs/PROGRESS.md) and [docs/DEV_PLAN.md](./docs/DEV_PLAN.md).

---

## 1. Project Overview

### 1.1 Goal
Build a landscape tower defense H5 game that runs smoothly in mobile browsers (WeChat built-in browser, Safari, Chrome):
- Core gameplay: monsters march along a fixed path. The player builds towers on empty ground beside the path to defend the **pumpkin** at the end of the map from being eaten.
- Signature mechanic (recreating the essence of Carrot Fantasy): **candy buckets, clouds, and other obstacle items** are scattered across the map. Destroying them drops gold coins and unlocks new tower slots.
- Mainly single player. Progress is saved in localStorage, so no server is needed.

### 1.2 First Release Scope
| Item | Quantity |
|------|------|
| Levels | 5 |
| Tower types | 6 (3 levels each) |
| Monster types | 5 + Boss |
| Waves | Data-driven, 4 to 8 waves per level (the original v1.0 plan was 10 to 15 waves. In 2026-11 we decided to keep the current count for now. See docs/DEV_PLAN.md D-2) |
| Platform | Mobile first, playable in desktop browsers (mouse controls) |

---

## 2. Technology Choices

### Recommended Option: Vite + TypeScript + Native Canvas 2D

| Item | Choice | Reason |
|----|------|------|
| Build | Vite | Starts with zero configuration, fast hot reload, and `npm run build` produces plain static files that can be deployed on any static host |
| Language | TypeScript | Towers, monsters, and bullets form many entity types, and the type system catches most basic mistakes |
| Rendering | Native Canvas 2D API | This game needs no physics, and 2D drawing is more than enough. Zero dependencies, small size, and full control |
| UI | DOM overlay (HTML/CSS placed on top of the canvas) | Buttons, menus, and text layout are much simpler with the DOM than with canvas drawing, and touch events are easy to handle |
| Audio | Web Audio API | On mobile, sound only plays after the first touch because of autoplay restrictions |
| Save data | localStorage | Level stars and unlock progress |
| State management | No framework needed. Scene classes plus an event bus are enough | |

**Alternative**: Phaser 3 (a mature game framework with ready-made scenes, tweens, and input. The cost is about 1 MB of dependencies and the learning curve of the framework).
It is worth considering if you want to add content quickly, but the entity logic in this project is not complex, so the native approach is lighter and easier to control.

---

## 3. Gameplay Design

### 3.1 Core Loop

```
Enter level → Study the path and build spots → Build or upgrade towers
   ↑                                                    ↓
   └──── Strengthen defenses with bounty ← Kill monsters for gold ← Monsters advance along the path ← Wave starts
                                                        ↓
                              Monster reaches the end and nibbles the pumpkin (pumpkin loses HP)
                                                        ↓
                          Pumpkin HP reaches zero → defeat / all waves cleared → settlement (1 to 3 stars)
```

- **Pumpkin**: starts with 10 HP. A regular monster takes off 1 HP per bite, and a Boss takes off 3. The pumpkin's appearance changes as its HP drops (intact → chipped → halved).
- **Star rating**: remaining HP ≥ 8 → 3 stars; ≥ 4 → 2 stars; > 0 → 1 star. Stars unlock later levels (at least 1 star unlocks the next level).
- **Speed-up**: 1x / 2x speed buttons.
- **Early call**: tap "Next Wave" during the gap between waves to send the next wave early. The bonus gold is calculated from the remaining wait time (an advanced tactic for experienced players).

### 3.2 Towers (6 types, first-release values, to be tuned)

| Tower | Cost | Role | Traits |
|----|------|------|------|
| Potion Tower | 100 | Basic single-target rapid fire | Fast firing rate and good value. The early-game mainstay |
| Spider Web | 140 | Control | Slows hit targets by 40% for 2 seconds |
| Bat Arrow | 160 | Multi-target | Locks onto up to 3 targets at once |
| Candle Tower | 180 | Short-range AOE | Keeps burning every enemy in a ring around it |
| Witch Broom | 220 | Linear piercing | Its projectile passes through every enemy on a straight line |
| Pumpkin Cannon | 260 | High-damage splash | Slow but high damage, with area explosions that handle dense monster groups |

- Each tower can be upgraded to Lv3. Damage, range, and attack speed improve at each level. Upgrade costs are about 0.8x and 1.2x the build cost.
- Towers can be sold for 70% of the total invested cost.
- Clicking a built tower shows its range circle and the upgrade and sell buttons.

### 3.3 Monsters (5 types + Boss)

| Monster | HP | Speed | Bounty | Traits |
|----|------|------|------|------|
| Little Ghost | 100 | 1.0 | 10 | Standard unit |
| Black Cat | 60 | 1.8 | 12 | Rushes forward quickly, testing the use of slows |
| Mummy | 400 | 0.7 | 25 | Tank that absorbs firepower |
| Witch | 150 | 1.0 | 20 | Periodically heals nearby allies, forcing the player to focus fire |
| Pumpkin Bomb | 80 | 1.4 | 15 | Explodes on the spot when it dies, damaging nearby monsters (an easter egg of mutual destruction) |
| Boss | 3000 | 0.5 | 200 | Appears at the end of the level. Large body with a hit-stun animation |

(All values are baseline. They are scaled by a difficulty factor for each level.)

### 3.4 Map Items (a signature feature, must be implemented)

Obstacles such as **candy buckets, clouds, tombstones, and mushrooms** are placed on the buildable tiles of the map:
- They occupy the tile, so no tower can be built on it.
- Towers can attack them, and they have their own HP bars.
- Destroying one drops gold coins (candy buckets drop large amounts), and the tile becomes buildable.
- This is the most recognizable mechanic of Carrot Fantasy. At the start, players must plan which item to break first.

### 3.5 Level Design

- Canvas design resolution is **1280×720 (16:9, landscape)**. Tile size is 80 px, giving a grid of **16×9**.
- Each level is configured in JSON: the sequence of path corner points, the set of buildable tiles, the list of obstacles, the starting gold, and the wave table.
- Five levels, in order of difficulty:
  1. **Tutorial level**: a single S-shaped path. Only the Potion Tower is available, with 6 waves of little ghosts.
  2. **Two-gate level**: two enemy entrances merge. Spider Web is unlocked and Black Cats are introduced.
  3. **Item level**: many candy bucket obstacles, encouraging players to roll items for economy. Candle Tower is unlocked.
  4. **Maze level**: a long winding path. Witch Broom and Pumpkin Cannon towers are unlocked, and Witch monsters appear.
  5. **Boss level**: a combined challenge. The Boss appears in wave 8 (the final wave). (The original plan put it in wave 15, and it was changed to match the wave count.)

### 3.6 Wave Configuration Format (data-driven example)

```json
{
  "waves": [
    { "entries": [ { "monster": "grunt", "count": 8, "interval": 0.8 } ] },
    { "entries": [
      { "monster": "grunt",  "count": 6, "interval": 0.6 },
      { "monster": "runner", "count": 4, "interval": 1.0, "delay": 5 }
    ]}
  ]
}
```

---

## 4. Technical Architecture

### 4.1 Module Breakdown

```
core      Main game loop (fixed time step update + rAF render), scene management, event bus
scenes    MenuScene (level select) / BattleScene (battle) / settlement popup (DOM)
battle    Battle logic: Grid (tile grid), Path (path interpolation), WaveManager, Economy
          Entities: Tower / Monster / Bullet / Pumpkin / Obstacle, reused through object pools
render    Renderer draws in layers (off-screen cached background → entities → effects), procedural sprites
ui        HUD, build menu, tower action menu, settlement panel. All implemented in the DOM
audio     AudioManager: unlock on gesture, bgm/sfx playback, volume and mute toggle
data      towers.ts / monsters.ts value configs + levels/*.json level configs
save      localStorage wrapper (progress, stars, mute preference)
input     Unified touch and mouse handling with Pointer Events, converting coordinates to the design resolution
```

Key implementation decisions:

- **Main loop**: `update(dt)` uses a fixed step (such as 1/60 s, accumulator pattern) so speed stays the same at any refresh rate. `render()` follows rAF. Speed-up = dt × multiplier.
- **Layered rendering**: ground, path, and decorations are drawn once into an off-screen canvas cache, and each frame only draws that cache once with drawImage. Dynamic entities get their own layer. The DOM handles the UI.
- **Pathfinding**: no A*. Monsters move at constant speed by interpolating between the configured path corner points and turn at corners (standard practice in tower defense).
- **Targeting**: the default is "furthest along the path first" (first). Some towers can be set to strongest or closest.
- **Collision**: circle collision (radius vs radius). It is sufficient and the fastest.
- **Object pooling**: bullets, floating text, and particles are created and destroyed very often, so they must be pooled to avoid GC stutter.
- **Coordinate system**: internal logic always uses the design resolution (1280×720). The Renderer applies scaling and DPR adjustment in one place, so the logic code never depends on the screen size.

### 4.2 Directory Structure

> The following is the design from the v1.0 planning stage. The actual implementation differs in several places. The UI is not split into a separate `ui/` directory and is written in `BattleScene.ts`. Levels use TypeScript objects (typed as `LevelDef`) instead of JSON. There is no `ObjectPool.ts` or `Pumpkin.ts`, and the asset directory `public/assets/` does not exist. v1.0 prioritized getting the gameplay working and keeping type checking. For the specific differences, see [docs/PROGRESS.md section 5](./docs/PROGRESS.md#5-document-and-code-deviations). For the actual directory layout, see [docs/ARCHITECTURE.md section 2](./docs/ARCHITECTURE.md).

```
qiuqiu-luobo/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── assets/              # Image and sound assets added later
├── src/
│   ├── main.ts              # Entry point: initialization, starts the loop
│   ├── core/
│   │   ├── Game.ts          # Loop, speed-up, pause
│   │   ├── SceneManager.ts
│   │   └── EventBus.ts
│   ├── scenes/
│   │   ├── MenuScene.ts
│   │   └── BattleScene.ts
│   ├── battle/
│   │   ├── Grid.ts
│   │   ├── Path.ts
│   │   ├── WaveManager.ts
│   │   ├── Economy.ts
│   │   ├── ObjectPool.ts
│   │   └── entities/
│   │       ├── Tower.ts
│   │       ├── Monster.ts
│   │       ├── Bullet.ts
│   │       ├── Pumpkin.ts
│   │       └── Obstacle.ts
│   ├── render/
│   │   ├── Renderer.ts      # Scaling, DPR, layers
│   │   └── sprites/         # Procedural drawing functions (towers / monsters / pumpkin / effects)
│   ├── ui/
│   │   ├── Hud.ts
│   │   ├── BuildMenu.ts
│   │   └── Panels.ts        # Pause / settlement / victory popups
│   ├── audio/AudioManager.ts
│   ├── save/SaveManager.ts
│   ├── data/
│   │   ├── towers.ts
│   │   ├── monsters.ts
│   │   └── levels/level01.json ... level05.json
│   └── utils/math.ts
└── PLAN.md
```

---

## 5. Mobile Adaptation and Interaction

| Item | Approach |
|----|------|
| Screen orientation | Landscape design. In portrait mode, show a "Please rotate your phone" overlay (desktop play also works) |
| Viewport | `width=device-width, initial-scale=1, user-scalable=no`, which disables double-tap zoom |
| Scaling | Letterbox at a fixed ratio: the canvas fits the window at 16:9, is centered, and has black bars on both sides |
| Sharpness | Canvas physical pixels = display size × devicePixelRatio, to avoid blur |
| Touch | Pointer Events for all input. Every clickable element has a hit area of at least 44 px. `touch-action: none` prevents accidental scrolling |
| Audio | The first touch unlocks AudioContext. A mute button is provided and the preference is saved |
| Performance budget | Stable 60 fps on mid-range phones: object pools, background cache, particle cap, and no per-frame object allocation |

Interaction flow:
- Tapping an **empty buildable tile** opens the build panel, which shows the 6 tower icons and prices. Towers that the player cannot afford are grayed out.
- Tapping a **built tower** shows its range circle and the upgrade (with a preview of the next level) and sell buttons.
- Tapping the **wave entry area** sends the next wave early.
- The HUD always shows gold, current wave x/N, pumpkin HP, pause, speed-up, and mute.

---

## 6. Art and Audio Plan (starting with no assets)

**Principle: draw everything procedurally first so the game is playable, then replace the assets all at once later.**

- In the first phase, every figure is a cartoon shape drawn on Canvas: the pumpkin has a face, towers are rounded shapes with top ornaments to tell them apart, and monsters are jelly-colored blobs with eyes and a shape-changing walk animation. No frame images are needed.
- Motion effects come from code: a white flash when hit, monsters shrink and fade on death with floating gold text, the pumpkin shakes when bitten, towers recoil after firing, and rocket exhaust particles.
- Replacement options for later (pick any): free asset packs (Kenney's TD assets can be used commercially), AI-generated assets, or hand-drawn scans.
- ⚠️ Compliance: do not use any official images, audio, or names from Carrot Fantasy. Everything is original.

Audio list: battle BGM, menu BGM, and sound effects (building a tower / each tower firing / hit / monster death / gold / pumpkin bitten / victory / defeat / button). In the first phase, simple sound effects synthesized with Web Audio stand in. Sampled sounds replace them later.

---

## 7. Development Milestones

| Phase | Content | Estimate | Acceptance Criteria |
|------|------|----------|----------|
| ✅ **M0 Scaffold** (includes art upgrade v0.2: hand-drawn cartoon ground and characters) | Vite + TS setup, canvas adaptation and scaling, game loop, scene switching skeleton, event bus | 0.5 day | Opens in a mobile browser with the correct aspect ratio and a normal frame rate |
| ✅ **M1 Playable prototype** | Single path + Potion Tower + little ghosts + 3 monster waves + gold rewards for kills + win/loss check | 2 to 3 days | A full round can be played: build, defend, win or lose. The core loop works |
| ✅ **M2 Complete gameplay** | 6 towers, 5 monsters + upgrade and sell + wave table driven + speed-up and pause + map item obstacles + star settlement + early call | 3 to 4 days | A new level can be produced from a JSON config and provide a complete experience |
| ✅ **M3 Content experience** | 5 levels (including the two-gate and Boss levels) + level select screen (star unlocks) + synthesized sound effects and BGM + mute toggle + progress save | 2 to 3 days | Smooth flow from level select to clearing the game, with a sense of "game feel" |
| ✅ **M4 Release polish** | Safe-area adaptation, auto-pause when switching apps, audio lifecycle, DPR cap, zero allocation in rendering, accidental-tap prevention (exit goes through the pause panel), README | 1 to 2 days | Mainstream real devices at 60 fps, playable inside WeChat, and progress kept after refresh |

Total: about **9 to 13 days** (the pace can be stretched for part-time work, and you can stop and play at any milestone boundary).

Each milestone ends at a playable save point. Once M1 is finished, there is a minimal playable version.

> **Project status: all v1.0 milestones completed (2026-08-26).** For future expansion directions, see section 10.

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|------|------|
| WeChat and iOS limit audio autoplay | Unlock AudioContext on the first touch. Build the audio module first with graceful fallback (silent, no crash) |
| Poor tap accuracy on small screens | Enlarge hit areas and snap tower placement to the grid. Use a bottom drawer for the build panel instead of a small floating panel that follows the finger |
| Stutter on low-end devices | Background off-screen cache, object pools, particle cap, and avoid closure allocations. Profile on real devices in M4 |
| Weak art skills make the game look poor | The procedural cartoon style is itself the fallback. Keep a unified palette (warm grass and saturated characters) to set the look early |
| Legal compliance | Name, art, and audio are all original. Only the gameplay mechanics are borrowed (mechanics are not protected by copyright) |
| Unbalanced values (too hard or too easy) | Keep all values in the data/ config. Provide debug shortcuts (add gold, skip waves) and get real playtesters early |

---

## 9. Decision Points to Confirm

Three things need a decision before work starts. Each has a recommended default, and if there is no reply, the recommendation is followed:

1. **Tech stack**: recommended Vite + TypeScript + native Canvas (alternative: Phaser 3).
2. **Screen orientation**: recommended landscape 1280×720 to match the classic game (alternative: portrait, which suits one-handed play on the subway but limits map depth).
3. **Online features in the first release** (leaderboards / score sharing): recommended no. Keep it single player with localStorage, so server costs stay at zero.

---

## 10. Possible Future Directions (not in this release, recorded only)

- More levels and themed terrain (snow, desert, and underground cave reskins)
- Flying monsters (taking shortcut routes) and dedicated anti-air towers
- Active tower skills (the skill towers from Carrot Fantasy 2)
- Achievement system, daily challenges, and endless mode
- WeChat share poster for battle results

