English | [中文](DEV_PLAN.zh-CN.md)

# Qiuqiu Pumpkin · Follow-up Development Plan

> Based on a code review dated 2026-11-04. The v1.0 milestones (M0–M4) are marked complete in PLAN.md, but the actual content differs from the original plan. This file lists the next items to do, in priority order.
> Current progress and verification records are in [PROGRESS.md](./PROGRESS.md). Architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Decisions to make first

Two decisions need to be confirmed before development starts. Each one has a default recommendation. If there is no reply, follow the recommendation.

| ID | Question | Options | Recommendation |
|----|----------|---------|----------------|
| **D-1** | How should the five non-bottle towers be unlocked? | A. All available by default; pick any tower type from the build menu<br>B. Unlock by level (the design in PLAN section 3.5: Spider Web unlocks at level 2, Candle Tower at level 3, Witch Broom/Pumpkin Cannon at level 4) | **B (adopted, completed in v1.1)**. Matches PLAN and keeps the pacing across the five levels. `LevelDef` gets a new `unlockedTowers` field. |
| **D-2** | Should the wave count be expanded to 10–15 waves as in PLAN? | A. Keep the current 4–8 waves and treat each level as a short session<br>B. Expand to 10–15 waves, with the boss on wave 15 | **A (adopted)**. The current wave counts already run through the full flow. Whether to expand will be decided after playtesting D-1. |

---

## 2. Task list

Every item has acceptance criteria. When an item is finished, change its status to ✅ and add one line to the change log in PROGRESS.md.

### P0: Blocking gaps (v1.1, all completed)

| ID | Task | Files involved | Acceptance criteria |
|----|------|----------------|---------------------|
| **T-01** | Open the build entry for all six tower types. The build panel changes from "one button only" to a "tower type selector" that shows cost and description. When a cell is selected, the range circle follows the chosen tower type. The selectable set follows the D-1 decision. | `scenes/BattleScene.ts` (`openBuildPanel`, `buildAtSelected`, and the range circle in `onTap`), `data/levels/types.ts`, the individual level files | On level 4, the Witch Broom and Pumpkin Cannon towers can be built, the cost is charged correctly, and the range circle matches the actual range. `click-test` gains one case: "select a non-bottle tower and build it". |
| **T-02** | Remove the FPS debug label from the production build, or show it only with the `?debug` parameter or in the development environment. | `core/Game.ts` | The production build shows no FPS label in the top-left corner. It is still visible in development mode. |
| **T-03** | Hook the logic smoke test into an npm script (for example `test:smoke`) and update the README. The README currently gives a command that writes its output to `/tmp`, which is unreliable: after switching machines or rebooting, it cannot be reused directly. | `package.json`, `README.md` | `npm run test:smoke` runs successfully, with all 56 checks passing. The commands in the README match it. |
| **T-04** | Align PLAN.md with the code. The directories listed in PLAN section 4 (`ui/`, `ObjectPool.ts`, `Pumpkin.ts`, `levels/*.json`) do not exist in the repository. Choose one approach: update PLAN so it describes the actual structure, or adjust the code to match PLAN. | `PLAN.md`, possibly `src/` | The directory structure in PLAN matches `src/`, or the deviations are documented in PLAN with reasons. |

### P1: Gameplay and experience gaps (T-05, T-06, T-08 completed; T-07 waiting on real devices)

| ID | Task | Files involved | Acceptance criteria |
|----|------|----------------|---------------------|
| **T-05** ✅ | When a Pumpkin Bomb dies, it explodes in place and damages nearby monsters (PLAN section 3.3; obstacles and the pumpkin are not affected). Currently it is just a fast, 2-damage ordinary monster. | `battle/entities/Monster.ts`, `scenes/BattleScene.ts` | Killing a Pumpkin Bomb damages other monsters within its radius and plays an explosion effect. Pumpkin Bombs on levels 1 and 2 both have this effect. |
| **T-06** ✅ | Boss hit stun. PLAN states "taking a hit has a stun effect", but currently the boss only flashes white. | `battle/entities/Monster.ts` | When the boss is hit, its movement speed drops or it pauses briefly. Ordinary monsters are not affected. |
| **T-07** | Verification on real devices and in the WeChat built-in browser. The PLAN M4 acceptance criterion "mainstream real devices run at 60fps, and the game is playable inside WeChat" has no evidence in the repository. | No code changes | Record FPS on at least one iOS device and one Android device, and open a full session inside WeChat. Record the results in PROGRESS.md. |
| **T-08** ✅ | Wave content: decide whether to expand, based on the D-2 conclusion. | `data/levels/level0*.ts` | The wave count for each level matches PLAN section 3.5, or PLAN is changed to show the actual numbers. |

### P2: Engineering quality and performance (when time allows)

| ID | Task | Files involved | Acceptance criteria |
|----|------|----------------|---------------------|
| **T-09** ✅ | Reduce per-frame allocations (completed 2026-11-04: allocations went from 109.7 MB to 73.0 MB; see the verification record in PROGRESS). Bullets and floating text currently call `new` every time; `BattleScene.render` copies and sorts `obstacles` every frame; `allTargets` creates a new array on every call. Measure with the Chrome Performance panel first, then decide whether to use object pooling. | `battle/entities/Bullet.ts`, `scenes/BattleScene.ts`, `battle/effects.ts` | There is clear before-and-after data on GC count for 60 seconds of battle. |
| **T-10** ✅ | Make the Chrome path in `click-test.cjs` configurable (completed: it reads the `CHROME_PATH` environment variable and, if that is unset, uses the default path for the platform). It previously hard-coded the macOS path. | `scripts/click-test.cjs` | With `CHROME_PATH` set, the script runs on other operating systems. |
| **T-11** | Add unit tests for the logic (tower upgrade multipliers, sell refunds, early-call rewards, `WaveManager.tryCallNext`). Currently only level-level smoke tests exist, and no battle rules are directly covered. | `scripts/` or a new `tests/` directory | The tests cover the rules above. (Do this only after the user explicitly asks for it. See the project conventions.) |

### P3: Future extensions (from PLAN section 10, not in this round)

- More levels and themed terrain (snow, desert, underground caves)
- Flying monsters and anti-air towers
- Active skills for towers
- Achievement system, daily challenges, endless mode
- WeChat share poster for results

---

## 3. Suggested version schedule

| Version | Contents | Exit condition |
|---------|----------|----------------|
| v1.0 (completed) | PLAN M0–M4 | Baseline commit `723a02b` |
| **v1.1** (completed) | T-01, T-02, T-03, T-04; D-1 decided | All five tower types can be built on their levels; `npm run typecheck`, `build`, `test:smoke`, and `test:click` all pass |
| v1.2 (partly completed, `b2d9220`) | T-05, T-06, T-08 completed; T-07 waiting on real devices | Real-device records are complete; Pumpkin Bomb and boss behavior match PLAN |
| v1.3 (partly completed) | T-09, T-10 completed; T-11 not started, waiting for an explicit request from the user | Performance comparison data exists; tests cover the battle rules |

At the end of each version, update the milestone table and the verification records in PROGRESS.md.

---

## Appendix: T-07 device verification checklist

This item needs real devices and cannot be completed in the development environment. During testing, add `?debug` to the URL, and the FPS will show in the top-left corner. Enter the results in the verification record table in PROGRESS.md.

| Device | OS / browser | Average FPS (level 4, all towers built) | Lowest FPS | Playable when opened in WeChat | Notes |
|--------|--------------|------------------------------------------|------------|--------------------------------|-------|
| iPhone (to fill in) | iOS / Safari | | | | |
| Android (to fill in) | Android / Chrome | | | | |
| Android (to fill in) | WeChat built-in browser | | | | |

Checklist:
1. Select a level, build towers, upgrade, sell, pause, change game speed, and return after switching to the background. The display and the logic must both work correctly.
2. After the level 5 boss appears, the boss shows a clear squash and slowdown when hit, and it does not get stuck.
3. On level 4, when Pumpkin Bombs die in a group, the explosion effect and screen shake work correctly, and the frame rate does not drop noticeably.
4. After refreshing the page, star ratings and unlock state are preserved.
