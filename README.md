English | [中文](README.zh-CN.md)

# Qiuqiu Pumpkin 🎃

A Halloween-themed H5 tower defense game inspired by the Carrot Fantasy style of gameplay. Everything is drawn procedurally and the sound is synthesized with Web Audio, so there are **no external assets**. The build is a single HTML file: double-click it to play, or host it anywhere.

## Gameplay

Monsters march along a path toward the pumpkin at the end (10 HP). Build towers on empty ground beside the path to defend it. Kills give gold, which you spend on building, upgrading, or selling towers. Breaking candy buckets, coffins, and tombstones on the map unlocks building spots and pays a bounty. Survive every wave to earn 1 to 3 stars.

- **Six towers**: Potion Tower (rapid fire), Spider Web (slows), Bat Arrow (hits several targets), Candle Tower (burns nearby enemies), Witch Broom (pierces in a line), Pumpkin Cannon (area blast). Each tower can be upgraded to level 3, and level 3 offers two branches.
- **Six monsters**: Little Ghost, Black Cat (fast), Mummy (tanky), Witch (heals allies), Pumpkin Bomb (explodes and can chain), and the Vampire Count boss.
- **Five levels**: a tutorial, a twin-entrance level, a treasure-rich economy level, a long winding maze, and a boss finale. Towers unlock level by level: level 1 has only the Potion Tower, level 2 adds Spider Web and Bat Arrow, level 3 adds Candle Tower, and level 4 adds Witch Broom and Pumpkin Cannon.
- Tap the wave bar during the gap between waves to **call the next wave early** for bonus gold. Other controls: 2x speed, pause, and automatic pause when the app goes to the background.
- **Language**: English is the default. Use the button in the top-right corner of the main menu to switch to 中文. Your choice is saved.

## Docs

- [docs/PROGRESS.md](docs/PROGRESS.md): progress tracking, verification log, known issues (start here when taking over)
- [docs/DEV_PLAN.md](docs/DEV_PLAN.md): next steps and the to-do list
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture and design notes
- [PLAN.md](PLAN.md): the original v1.0 plan (a historical snapshot)

## Local development

```bash
npm install
npm run dev              # dev server at http://localhost:5173
npm run dev -- --host    # open to the LAN so a phone on the same WiFi can test
```

## Build and checks

```bash
npm run typecheck        # TypeScript type check
npm run build            # produces the single-file dist/index.html
npm run test:smoke       # logic smoke tests (see below)
npm run test:click       # headless-browser click regression (needs local Chrome, run build first)
```

The smoke tests cover each level's path length and bounds, obstacle validity, the wave timeline, tower unlocks, and save-based unlock logic.

Debugging: add `?debug` to the URL (for example `http://localhost:5173/?debug`) to show an FPS label in the top-left corner. The label is hidden in normal play.

`test:click` drives your local Chrome with puppeteer-core. It simulates "select level → tap grass to build → tap the path without opening a panel" with real pointer events. It catches event-blocking bugs that the logic tests cannot see. To test a live site, pass its URL: `node scripts/click-test.cjs https://your-domain/`.

## Deployment

`dist/index.html` is a self-contained single file. Put it on any static host (GitHub Pages, object storage, nginx). No server is needed.

## Tuning

All gameplay values are plain data, and changes apply immediately:

| Content | File |
|------|------|
| Tower stats and upgrade multipliers | `src/data/towers.ts` |
| Monster stats | `src/data/monsters.ts` |
| Obstacle rewards and HP | `src/data/obstacles.ts` |
| Levels (paths, gold, waves) | `src/data/levels/level0*.ts` |
| Text for both languages | `src/i18n/en.ts` (keys), `src/i18n/zh.ts` (Chinese) |

To add a level, copy a level file, edit it, and register it in `src/data/levels/index.ts`. Add its name key to both `en.ts` and `zh.ts`. The smoke test checks new levels automatically.

## Structure

```
src/
├── core/       fixed-step game loop (with speed and pause), scene manager, event bus, input, global settings
├── scenes/     menu (level select) and battle scene
├── battle/     grid, path, waves, economy, effects, and entities/ (towers, monsters, bullets, obstacles)
├── render/     Renderer (scaling), ground cache, pumpkin/monster/prop sprites, decorations
├── audio/      Web Audio synthesized sound effects and background music
├── data/       all gameplay numbers and names (keys into i18n)
├── i18n/       translations (en.ts is the source of keys, zh.ts is Chinese) and t()
├── save/       localStorage progress: stars, mute, language
└── utils/      math helpers, seeded random
```

Progress (stars, unlocks, mute, language) is stored in localStorage and survives a page refresh.
