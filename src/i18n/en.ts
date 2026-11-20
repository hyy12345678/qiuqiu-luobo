/** English strings (default language). Keys are shared with zh.ts; zh.ts must define every key. */
export const en = {
  'app.title': 'Qiuqiu Pumpkin',
  'app.description':
    'Qiuqiu Pumpkin: a Halloween H5 tower defense game with 5 levels, 6 towers, 5 monsters and a vampire boss.',
  'rotate.hint': 'Qiuqiu Pumpkin plays in landscape<br />Please rotate your phone',
  'lang.name': 'English',

  // ---- menu ----
  'menu.subtitle': 'Halloween tower defense · Protect the pumpkin, beat back the undead',
  'menu.locked': 'Beat level {n}',
  'menu.stars': 'Stars collected ⭐{n} / {max} · Tap the screen once to turn on sound',

  // ---- battle HUD ----
  'hud.tip': '👆 Tap an empty grass tile to build!',
  'hud.skillReady': '✨ Ultimate ready!',
  'hud.skill': '✨ Ultimate {p}%',
  'hud.firstWave': '⏳ Wave 1 in {s}s · tap to call early!',
  'hud.nextWave': '⏳ Next wave in {s}s · tap to call early!',
  'hud.waveProgress': '⚔️ Wave {n} / {total}',
  'hud.allSpawned': '🎉 All waves have arrived',
  'banner.wave': 'Wave {n} / {total}',
  'call.early': 'Early call +{n}',
  'skill.frost': '❄ Frost gust!',
  'obstacle.smash': '{name} · +{reward}🪙',

  // ---- build panel ----
  'build.tooltip': '{desc} · Range {range}',
  'build.confirm': '✔ Build ({cost})',
  'build.cancel': 'Cancel',

  // ---- tower panel ----
  'tower.title': '{name} Lv{lv}',
  'tower.maxed': 'Max level ⭐',
  'tower.upgrade': '⬆️ Upgrade ({cost})',
  'tower.sell': '💰 Sell +{n}',
  'tower.branch': '{name} ({cost})<br><small>{desc}</small>',

  // ---- pause and result ----
  'pause.title': 'Paused ⏸',
  'pause.resume': '▶ Resume',
  'pause.restart': 'Play again',
  'pause.menu': 'Back to menu',
  'result.win': 'Victory! 🎉',
  'result.lose': 'The pumpkin was eaten… 😿',
  'result.hp': 'Pumpkin HP left: {hp} / {max}',
  'result.wave': 'Survived to wave {n}',
  'result.next': 'Next ▶ {name}',
  'result.again': 'Play again',
  'result.menu': 'Back to menu',

  // ---- map ----
  'ground.sign': '🎃 Undead incoming',

  // ---- towers ----
  'tower.bottle.name': 'Potion Tower',
  'tower.bottle.desc': 'Fast single-target shots',
  'tower.frost.name': 'Spider Web',
  'tower.frost.desc': 'Slows enemies on hit',
  'tower.multishot.name': 'Bat Arrow',
  'tower.multishot.desc': 'Hits up to 3 targets at once',
  'tower.sunflower.name': 'Candle Tower',
  'tower.sunflower.desc': 'Burns everything nearby',
  'tower.fan.name': 'Witch Broom',
  'tower.fan.desc': 'Pierces everything in a line',
  'tower.rocket.name': 'Pumpkin Cannon',
  'tower.rocket.desc': 'High damage with area blasts',

  // ---- tower branches (Lv3 choice) ----
  'branch.bottle.A.name': 'Rapid Fire',
  'branch.bottle.A.desc': 'Shoots faster, weaker shots',
  'branch.bottle.B.name': 'Big Splash',
  'branch.bottle.B.desc': 'Splashes into nearby enemies',
  'branch.frost.A.name': 'Deep Freeze',
  'branch.frost.A.desc': 'Stronger, longer slow',
  'branch.frost.B.name': 'Ice Burst',
  'branch.frost.B.desc': 'Bursts into ice shards on hit',
  'branch.multishot.A.name': 'Five Arrows',
  'branch.multishot.A.desc': 'Fires at 5 targets at once',
  'branch.multishot.B.name': 'Heavy Arrow',
  'branch.multishot.B.desc': 'Harder hits, slower fire',
  'branch.sunflower.A.name': 'Blaze',
  'branch.sunflower.A.desc': 'Larger burn area',
  'branch.sunflower.B.name': 'Scorch',
  'branch.sunflower.B.desc': 'Double damage, slower pace',
  'branch.fan.A.name': 'Long Wind',
  'branch.fan.A.desc': 'Blades fly farther',
  'branch.fan.B.name': 'Heavy Blade',
  'branch.fan.B.desc': 'Heavier blades, slower to fire',
  'branch.rocket.A.name': 'Chain Blast',
  'branch.rocket.A.desc': 'Blast radius +50%',
  'branch.rocket.B.name': 'Big Boom',
  'branch.rocket.B.desc': 'More damage, slower reload',

  // ---- monsters ----
  'monster.grunt': 'Little Ghost',
  'monster.runner': 'Black Cat',
  'monster.tank': 'Mummy',
  'monster.healer': 'Witch',
  'monster.bomber': 'Pumpkin Bomb',
  'monster.boss': 'Vampire Count',

  // ---- map obstacles ----
  'obstacle.chest': 'Candy Bucket',
  'obstacle.crate': 'Coffin',
  'obstacle.rock': 'Tombstone',

  // ---- levels ----
  'level.1': 'Green Meadow',
  'level.2': 'Twin Creek',
  'level.3': 'Treasure Garden',
  'level.4': 'Winding Valley',
  'level.5': 'Beast Lair',
};

export type TKey = keyof typeof en;
