English | [中文](PROGRESS.zh-CN.md)

# Qiuqiu Pumpkin · Progress Tracker

> Last checked: 2026-11-04. Branch `main`. v1.1 committed (`9a97071`, `220ab54`), v1.2 committed (`b2d9220`).
> When you finish a task, or before and after each release, update the "Status", "Verification log" and "Changelog" sections of this file.

---

## 1. Handover guide

### 1. What to read first

1. [`README.md`](../README.md): gameplay, how to run, directory overview.
2. This file: current progress and known issues.
3. [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md): code structure and runtime flow.
4. [`docs/DEV_PLAN.md`](./DEV_PLAN.md): task list and next plans.
5. [`PLAN.md`](../PLAN.md): the original v1.0 plan. It is a historical snapshot. Places where it differs from the code are listed in section 5.

### 2. Local verification (about 2 minutes)

```bash
npm install
npm run typecheck        # type check
npm run test:smoke       # logic smoke test, expect 56 ✅ and 0 ❌
npm run build            # produces dist/index.html
npm run test:click       # headless Chrome real-click regression (needs Chrome on this machine; the macOS path is hard-coded, see T-10). Build first, because it reads dist/
npm run dev              # local development, http://localhost:5173 (add ?debug to show FPS)
```

### 3. The three things you most need to know when taking over

1. **All six tower types can be built, unlocked by level** (completed in v1.1). From level 2 onward, more towers are available to choose. See the assumption note in section 5.2.
2. **The docs originally said 10~15 waves per level, with the Boss in wave 15. The actual count is 4~8 waves.** Per decision D-2, we are not expanding it for now. The data follows the code.
3. **There is no verification record for real-device FPS or the in-WeChat experience.** PLAN M4 is marked as done, but these two acceptance criteria still have no evidence (T-07).

---

## 2. Milestone status

Status follows the milestone definitions in PLAN.md. The "Code check" column shows the result of the check on 2026-11-04.

| Milestone | PLAN mark | Code check result | Notes |
|-----------|-----------|-------------------|-------|
| M0 Scaffold | ✅ | Pass | 16:9 letterbox, fixed-step loop, scene switching, DPR capped at 2 |
| M1 Playable prototype | ✅ | Pass | Full battle loop: building towers, waves, gold, win/lose judgment |
| M2 Complete gameplay | ✅ | **Pass** (v1.2) | Six towers buildable (v1.1); Pumpkin Bomb death explosion and Boss hit stagger (v1.2); items, stars, early wave call, speed-up, and pause implemented |
| M3 Content and experience | ✅ | **Pass** (adjusted per D-2) | Five levels, level-select unlocks, sound effects and BGM, mute, save, per-level tower unlocks (v1.1). Wave count kept at 4~8 per D-2; PLAN synced to the actual numbers (v1.2) |
| M4 Release polish | ✅ | **Partial pass** | Safe area, pause on background, portrait hint, and accidental-tap prevention are implemented. "60 fps on mainstream real devices" and "playable in WeChat" have no evidence (T-07); "zero allocation in rendering" is not achieved (T-09) |

**Version progress**: v1.1 is complete. In v1.2, T-05, T-06 and T-08 are complete; T-07 needs a real device and is still open. v1.3 has not started.

---

## 3. Verification log

| Date | Item | Result | Notes |
|------|------|--------|-------|
| 2026-11-04 | `npm run typecheck` | ✅ Pass | Run once on the v1.0 baseline and once after the v1.1 changes |
| 2026-11-04 | `npm run build` | ✅ Pass | v1.1 output `dist/index.html` 71.61 kB, gzip 22.76 kB |
| 2026-11-04 | `npm run test:smoke` | ✅ 56 passed / 0 failed | v1.0 had 46 items. v1.1 added "unlocked tower type is valid / no duplicates / includes the bottle tower" and "unlocks only grow level by level", two per level, 10 items in total |
| 2026-11-04 | `npm run test:click` (local Chrome, headless) | ✅ ALL PASS | 9 items. Scenario 1: new save, level 1 shows only the bottle tower, building costs 100, tapping the road does not open a panel. Scenario 2: after clearing level 1, level 2 unlocks, shows the ice star, locked towers are hidden, choosing the ice star and building costs 140. No JS runtime errors |
| 2026-11-04 | Build panel screenshot (level 5, all six towers unlocked) | ✅ Layout correct | Bottom bar width 111~1169 px, within 1280 px; buttons do not wrap; when the rocket tower is selected, the gold outline is visible and the dashed range circle displays correctly |
| 2026-11-04 | Actual building on level 4 (headless Chrome) | ✅ Pass | Fan tower costs 220 (260 → 40); rocket tower costs 260 (260 → 0). Confirm button text matches the actual charge |
| 2026-11-04 | `?debug` FPS display (screenshot comparison) | ✅ Pass | With `?debug`, the top-left corner shows "FPS 60"; without the parameter, nothing is shown |
| 2026-11-04 | Bomb-bug explosion and Boss stagger logic check (`/tmp` script, Node) | ✅ All 9 items pass | Stagger: after being hit, the Boss moves at 30% of its unhit displacement (1.26 vs 4.20). Normal monsters unchanged. A killing blow does not trigger stagger. Explosion: normal monsters within the radius lose 50, those outside are unaffected, and a bomb bug caught in the blast chain-explodes and kills adjacent monsters |
| 2026-11-04 | Full runs of level 1 and level 5 (headless Chrome, continuous early wave calls) | ✅ Two runs with no JS errors | Both runs ended in a defeat screen (no towers built, as expected). Level 5 did not reach the Boss appearance, so Boss stagger is covered only by the logic script above |
| 2026-11-04 | `npm run test:smoke` / `typecheck` / `build` / `test:click` | ✅ Pass | Smoke 56 items; output 72.42 kB, gzip 23.01 kB; click regression 9 items |
| 2026-11-04 | T-09 allocation benchmark (level 4, 4 towers, 60 s, CDP sampling of JSHeapUsedSize) | ✅ Before change 109.7 MB / 160 drops; after change 73.0 MB / 118 drops (allocation -33%, drops -26%) | Changes: in-place compaction of obstacle and monster lists, reuse of target-search buffers, path sampling without allocation, in-place compaction of effects arrays, cached body gradients. No visible difference in screenshots before and after |
| 2026-11-04 | T-09 allocation hotspot sampling (CDP HeapProfiler, unminified build) | ℹ️ About 50% remains in `drawMonster` | Most remaining allocations come from boxing caused by passing non-integer coordinates to Canvas calls. Further reduction needs pre-rendered sprites, which were not done in this round |
| 2026-11-04 | `npm run test:click` (after changes) | ✅ ALL PASS | All 9 items pass, no JS runtime errors |
| 2026-11-06 | Pseudo-3D first version (`?flat` comparison) | ✅ Pass | `typecheck`, `build`, `test:smoke` and `test:click` all pass. Both the perspective version and the flat version can build towers and select by tapping the tower body. No leftover solid-background pixels outside the trapezoid (count is 0) |
| 2026-11-06 | Tower faces and upgrade appearance (test page, six towers × Lv1–3) | ✅ Pass | Appearance is correct for all three levels of all six towers; Lv3 has a glow and sparkles |
| 2026-11-06 | Idle animation (pixel sampling for 3 s after building a tower) | ✅ Pass | Frame-to-frame change matches the duration of the small hop. The build smoke at the start and the still frames were not misjudged |
| 2026-11-06 | Monster death afterimage and blinking (test page) | ✅ Pass | Afterimage states at 0 / 0.15 / 0.3 s are correct; closed-eye effect is correct |
| 2026-11-06 | Monster appearance (colors and headwear of the six monsters, test page) | ✅ Pass | Hopper has yellow rabbit ears; bomb bug has a red fuse; the rest are unchanged |
| 2026-11-10 | Ultimate and branch effects (script driving the real tower and bullet code) | ✅ Pass | Bottle B splash, bottle A shorter cooldown, multi-arrow A five-arrow volley (3 arrows by default), rocket A area, ice A slow ratio 0.25 are all correct |
| 2026-11-10 | Ice slow fix | ✅ Fixed | `Monster.applySlow` used `Math.max`, so the slow ratio was always 1. The ice star and ultimates had no slow effect. Changed to keep the stronger slow |
| 2026-11-10 | Depth occlusion (test page instantiates the real `BattleScene`, monsters placed in front of and behind towers) | ✅ Pass | When a monster is behind a tower, the tower body blocks it. When a monster is in front, it covers the tower body. Occlusion during a full random-movement run has no dedicated screenshot |
| — | Real-device FPS (iOS / Android) | ⏳ Not verified | See T-07; the DEV_PLAN appendix has a checklist |
| — | WeChat built-in browser | ⏳ Not verified | See T-07 |

Timeline from the smoke output (for reference only, not an acceptance criterion): the time for each level's waves to finish is about 51 s, 57 s, 80 s, 92 s and 93 s.

---

## 4. Known issues

Sorted by severity. Numbers match the tasks in [DEV_PLAN.md](./DEV_PLAN.md).

| Level | Issue | Location | Related task |
|-------|-------|----------|--------------|
| Medium | Device FPS and the in-WeChat experience are not recorded. The acceptance evidence for PLAN M4 is still missing. | — | T-07 |
| Low | The visual effects of the Boss stagger and Pumpkin Bomb explosion have not been checked by a person during a full run. The logic is verified by the `/tmp` script, and at runtime only the absence of errors in two levels was confirmed. | `battle/entities/Monster.ts`, `scenes/BattleScene.ts` | T-07 (check together on a real device) |
| Low | Many allocations per frame: bullets and floating text call `new` each time; `render` copies and sorts the obstacle array every frame; `allTargets` creates a new array on each call. Not yet measured with a profiler, so the impact is unknown. | `BattleScene.ts`, `Bullet.ts`, `Tower.ts` | T-09 |
| Low | `click-test.cjs` hard-codes the macOS Chrome path, so it only runs on this machine. | `scripts/click-test.cjs` | T-10 |
| Low | Battle rules have no unit tests, only level-level smoke tests. | `scripts/` | T-11 |
| Low | The level where multi-arrow unlocks (level 2) is an assumption made in this document. PLAN does not specify it. | `data/levels/level02.ts` | Please confirm, see 5.2 |
| Low | The targeting strategy is fixed to "furthest along the path first". PLAN 4.1 says it should be configurable (strongest, closest), but the code has no configuration entry. | `battle/entities/Tower.ts` | Not scheduled |
| Low | No lint or formatting configuration (ESLint, Prettier). | Repository root | Not scheduled |

Fixed in v1.1: only the bottle tower could be built (T-01); the range circle was fixed to the bottle tower (T-01); the release build showed the FPS label (T-02); the README smoke command wrote to `/tmp` (T-03).
Fixed in v1.2: bomb bugs did not explode on death (T-05); the Boss had no hit stagger (T-06).

---

## 5. Document and code deviations

The code is the reference. PLAN.md is kept as a historical snapshot, and the deviations are noted in comments at PLAN 4.2.

### 5.1 Directory structure

| PLAN section 4.2 | Actual |
|------------------|--------|
| `src/input/` | Actually `src/core/Input.ts` |
| `src/ui/` (Hud.ts, BuildMenu.ts, Panels.ts) | Does not exist. UI is written directly in `BattleScene.ts` (`buildHud`, `openBuildPanel`, `openTowerPanel`, `openPauseMenu`, `showResult`) |
| `src/battle/ObjectPool.ts` | Does not exist (see T-09) |
| `src/battle/entities/Pumpkin.ts` | Does not exist. The pumpkin is drawn by `drawPumpkin` (sprites.ts), and its HP is held in `BattleScene` |
| `src/render/sprites/` subdirectory | Actually a single file, `sprites.ts` |
| `src/data/levels/level0*.json` | Actually `.ts`, typed as `LevelDef`. TS was chosen for type checking |
| `public/assets/` | Does not exist. The project has no asset files |

### 5.2 Gameplay data

| Item | PLAN | Actual | Related task |
|------|------|--------|--------------|
| Waves per level | 10~15 waves | Levels 1~5 have 4, 5, 6, 7 and 8 waves. Kept as is per D-2; PLAN was changed to the actual numbers (v1.2) | T-08 complete |
| Level 5 Boss appearance | Wave 15 | Wave 8 (the last wave). PLAN synced (v1.2) | T-08 complete |
| Level 1 (tutorial level) content | 6 waves, only Little Ghosts | 4 waves, including Little Ghosts, Black Cats, Mummies, Pumpkin Bombs and Witches. PLAN not synced | Not changed, per D-2 |
| Tower unlocks | Level 2 ice star, level 3 sunflower, level 4 fan and rocket; level 1 has only the bottle tower | **Implemented** (v1.1). Level 2 also adds the multi-arrow, an assumption that PLAN does not state | Complete |
| Mummy HP | 400 | 420 | Acceptable, code is the reference |
| Witch HP | 150 | 160 | Same as above |
| Pumpkin Bomb HP | 80 | 85 | Same as above |
| Boss HP | 3000 | 3200 | Same as above |
| Monster speed | Multiplier (1.0, 1.8, etc.) | Pixels per second (62, 112, etc.) | Different units, no change needed |

### 5.3 Gameplay behavior

| Item | PLAN | Actual | Related task |
|------|------|--------|--------------|
| Pumpkin Bomb death effect | Explodes in place and hits nearby monsters | Implemented (v1.2): radius 85, damage 50, can chain | Complete |
| Boss hit reaction | Shows a stagger | Implemented (v1.2): speed drops to 30% within 0.2 s, with a slight squash | Complete |
| Object pooling | Pool bullets, floating text and particles | Not implemented | T-09 |
| Pumpkin entity | `Pumpkin.ts` | Not split out | Not addressed, just recorded |
| Buildable towers | Unlocked by level | **Implemented** (v1.1) | Complete |

### 5.4 Implemented and consistent with PLAN

- Behavior of the six towers (tracking, slow, multi-target, burn, pierce, splash) and their three-level growth multipliers
- Tower types unlock by level, and the build panel previews the range
- Upgrade cost (0.8×, 1.2×, rounded to 10) and 70% refund on sale
- Star thresholds (≥8 gives 3 stars, ≥4 gives 2 stars)
- Early wave call reward formula
- Witch healing aura (25 HP every 2.5 s, radius 90)
- Ice slow of 40% for 2 s
- Obstacles drop gold when broken and release their build slot
- Speed-up, pause, and auto-pause when switching to the background
- Safe area, portrait hint, DPR capped at 2

---

## 6. Milestones and versions

| Version | Status | Content |
|---------|--------|---------|
| v1.0 | ✅ Complete (baseline `723a02b`) | PLAN M0–M4 |
| v1.1 | ✅ Complete (`9a97071`, `220ab54`) | T-01 build entry and per-level unlocks, T-02 FPS label only with `?debug`, T-03 `npm run test:smoke`, T-04 PLAN deviation notes, D-1 adopts option B |
| v1.2 | 🟡 Partially complete (`b2d9220`) | T-05 Pumpkin Bomb explosion, T-06 Boss stagger, T-08 PLAN wave count sync complete; T-07 waiting for a real device |
| v1.3 | 🟡 Partially complete (uncommitted) | T-09 complete (allocation -33%), T-10 complete; T-11 not done, waiting for an explicit request from the user |

For the exit conditions of each version, see [DEV_PLAN.md section 3](./DEV_PLAN.md#3-suggested-version-schedule).

---

## 7. Changelog

| Date | Commit | Content |
|------|--------|---------|
| 2026-11-06 | Uncommitted | Pseudo-3D rendering (`render/projection.ts`: perspective ground, depth sorting, prop layer, click back-projection, `?flat` comparison mode); tower faces, upgrade appearance, glow, idle small motions; monster blinking, hit squash, death afterimage, hopper rabbit ears, bomb bug fuse; `click-test.cjs` coordinates now use the same projection |
| 2026-11-04 | `b2d9220` | v1.2: bomb bug death explosion (`battle/explode.ts`, chainable, `MonsterType.deathBlast`); Boss hit stagger (`MonsterType.hitStagger`); PLAN wave counts and Boss appearance wave changed to actual numbers; DEV_PLAN adds the T-07 device verification checklist |
| 2026-11-04 | `9a97071` | v1.1: six towers buildable and unlocked by level (`LevelDef.unlockedTowers`, build panel selects tower type, range preview, confirm build); FPS label shown only with `?debug`; new `test:smoke` script and esbuild added as a dev dependency; click regression adds a level-2 case of choosing the ice star to build; smoke adds a tower-unlock check; PLAN 4.2 adds deviation notes; README updated with commands and unlock notes |
| 2026-11-04 | `220ab54` | Added `docs/`: ARCHITECTURE.md, DEV_PLAN.md, PROGRESS.md; README adds docs entry; PLAN.md header adds a note pointing to this file |
| 2026-08-28 | `723a02b` | test: added `test:click` headless browser click regression |
| 2026-08-28 | `bf5d04e` | fix: the `#ui-root` overlay blocked canvas clicks, so towers could not be built. Changed to pointer-transparent, with interactive elements enabling `pointer-events` individually |
| 2026-08-27 | `12d25e5` | chore: initialized repository, committed the full v1.0 version as the baseline |

> Note: the fix in `bf5d04e` and the regression test in `723a02b` go together. When changing the CSS layering in `index.html` in future, run `npm run test:click` as well.
