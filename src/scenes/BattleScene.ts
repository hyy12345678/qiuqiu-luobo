import type { Scene } from '../core/SceneManager';
import type { SceneManager } from '../core/SceneManager';
import { bus } from '../core/EventBus';
import { settings, resetSettings } from '../core/settings';
import { Path } from '../battle/Path';
import { Grid } from '../battle/Grid';
import { Economy } from '../battle/Economy';
import { WaveManager } from '../battle/WaveManager';
import type { WaveDef } from '../battle/WaveManager';
import { Monster } from '../battle/entities/Monster';
import { Obstacle } from '../battle/entities/Obstacle';
import { Tower } from '../battle/entities/Tower';
import type { TowerContext } from '../battle/entities/Tower';
import { Bullet, FanBlade } from '../battle/entities/Bullet';
import type { CombatTarget } from '../battle/target';
import { Effects } from '../battle/effects';
import { applyBlast } from '../battle/explode';
import type { Blast } from '../battle/explode';
import { buildGround } from '../render/ground';
import { drawCarrot } from '../render/sprites';
import type { CarrotMood } from '../render/sprites';
import { roundRectPath } from '../render/decor';
import { DESIGN_W, DESIGN_H } from '../render/Renderer';
import { TOWER_TYPES, upgradeCost } from '../data/towers';
import type { TowerKind } from '../data/towers';
import { monsterById } from '../data/monsters';
import { OBSTACLES } from '../data/obstacles';
import { ALL_LEVELS, selection } from '../data/levels';
import { save } from '../save/SaveManager';
import { audio } from '../audio/AudioManager';

const BANNER_DUR = 1.9;
const HEAL_AMOUNT = 25;
const HEAL_RADIUS = 90;
const HEAL_INTERVAL = 2.5;

const TOWER_ICON: Record<TowerKind, string> = {
  bottle: '💧',
  frost: '❄️',
  multishot: '🏹',
  sunflower: '🌻',
  fan: '🌀',
  rocket: '🚀',
};

/** 战斗场景：读 selection.current 关卡配置，支持多路径 / 音效 / 存档 */
export class BattleScene implements Scene {
  readonly name = 'battle';

  private level = selection.current;
  private paths: Path[] = [];
  private carrotPos = { x: 0, y: 0 };
  private grid!: Grid;
  private economy!: Economy;
  private waves!: WaveManager;
  private monsters: Monster[] = [];
  private obstacles: Obstacle[] = [];
  private towers: Tower[] = [];
  private projectiles: Array<Bullet | FanBlade> = [];
  private fx = new Effects();
  private healCd = new Map<Monster, number>();

  private carrotHp = 10;
  private ended = false;
  private time = 0;
  private shake = 0;
  private bannerText = '';
  private bannerT = 99;
  private lastWaveSeen = 0;

  private selectedCell: { col: number; row: number } | null = null;
  /** 建造面板当前选中的塔种（决定射程预览与建造费用） */
  private buildKind: TowerKind = 'bottle';
  private buildOptionBtns = new Map<TowerKind, HTMLButtonElement>();
  private buildConfirmBtn: HTMLButtonElement | null = null;
  private selectedTower: Tower | null = null;
  private renderList: Monster[] = [];
  private offFns: Array<() => void> = [];

  // DOM refs
  private chipGold!: HTMLElement;
  private chipWave!: HTMLElement;
  private chipTip!: HTMLElement;
  private dockBar!: HTMLElement;
  private pauseEl: HTMLElement | null = null;
  private towerPanelRefresh: (() => void) | null = null;

  constructor(private scenes: SceneManager) {}

  enter(): void {
    resetSettings();
    this.level = selection.current;

    // ---- 状态重置 ----
    this.paths = this.level.paths.map((cells) => new Path(cells));
    const end = this.paths[0].points[this.paths[0].points.length - 1];
    this.carrotPos = { x: end.x + 4, y: end.y - 10 };
    this.grid = new Grid(this.paths.map((p) => p.points), this.carrotPos);
    this.economy = new Economy(this.level.startGold);
    this.waves = new WaveManager(this.level.waves as WaveDef[], (typeId, hpScale, pathIdx) => {
      const m = new Monster(this.paths[pathIdx] ?? this.paths[0], monsterById(typeId), hpScale);
      this.monsters.push(m);
      if (typeId === 'healer') this.healCd.set(m, HEAL_INTERVAL);
    });
    this.monsters = [];
    this.obstacles = this.level.obstacles.map(
      (s) => new Obstacle(s.col, s.row, s.type, OBSTACLES[s.type].hp, this.grid.cellCenter(s.col, s.row)),
    );
    this.towers = [];
    this.projectiles = [];
    this.healCd.clear();
    this.carrotHp = this.level.carrotHp;
    this.ended = false;
    this.selectedCell = null;
    this.selectedTower = null;
    this.shake = 0;
    this.bannerT = 99;
    this.lastWaveSeen = 0;
    this.fx = new Effects();
    this.pauseEl = null;

    // ---- 事件订阅 ----
    this.offFns.push(
      bus.on<{ bounty: number; x: number; y: number; radius: number; blast?: Blast }>('monster:killed', (p) => {
        this.economy.add(p.bounty);
        this.fx.floatText(p.x, p.y - p.radius * 1.6, `+${p.bounty}`);
        this.fx.poof(p.x, p.y - p.radius * 0.5);
        audio.play('die');
        audio.play('coin');
        if (p.blast) {
          // 爆爆虫死亡爆炸：波及周围怪物，被炸死的怪物会再次进入本回调（连锁）
          applyBlast(p.x, p.y, p.blast, this.monsters);
          this.fx.poof(p.x, p.y, 34, '#ff8a4c');
          this.shake = Math.max(this.shake, 0.2);
          audio.play('explode');
        }
        this.refreshHud();
      }),
      bus.on<{ damage: number }>('monster:escaped', (p) => {
        this.carrotHp -= p.damage;
        this.shake = 0.55;
        this.fx.floatText(this.carrotPos.x, this.carrotPos.y - 78, `-${p.damage}`, '#ff6b57');
        this.fx.poof(this.carrotPos.x, this.carrotPos.y - 20, 16, '#a5d6a7');
        audio.play('bite');
        this.refreshHud();
        if (this.carrotHp <= 0 && !this.ended) this.showResult(false);
      }),
      // 切后台自动弹出暂停菜单（防误操作与无谓掉血）
      bus.on('app:paused', (): void => {
        if (!this.ended) this.openPauseMenu();
      }),
    );

    this.buildHud();
    this.refreshHud();
  }

  exit(): void {
    for (const off of this.offFns) off();
    this.offFns = [];
    resetSettings();
  }

  // ---------------- HUD ----------------

  private buildHud(): void {
    const root = this.scenes.uiRoot;

    const chipLevel = document.createElement('span');
    chipLevel.className = 'chip';
    chipLevel.textContent = `${this.level.id}️⃣ ${this.level.name}`;

    this.chipGold = document.createElement('span');
    this.chipGold.className = 'chip';
    this.chipTip = document.createElement('span');
    this.chipTip.className = 'chip chip-tip';
    this.chipTip.textContent = '👆 点击草地空位建塔！';
    this.chipWave = document.createElement('span');
    this.chipWave.className = 'chip';
    this.chipWave.addEventListener('click', () => this.tryCallNext());

    const btnSpeed = document.createElement('button');
    btnSpeed.className = 'btn btn-icon';
    btnSpeed.textContent = '⏩ 1x';
    btnSpeed.addEventListener('click', () => {
      settings.speed = settings.speed === 1 ? 2 : 1;
      btnSpeed.textContent = `⏩ ${settings.speed}x`;
      audio.play('click');
    });

    const btnMute = document.createElement('button');
    btnMute.className = 'btn btn-icon';
    btnMute.textContent = save.muted ? '🔇' : '🔊';
    btnMute.addEventListener('click', () => {
      save.setMuted(!save.muted);
      btnMute.textContent = save.muted ? '🔇' : '🔊';
      if (!save.muted) audio.play('click');
    });

    // 防误触：战斗中不提供「直接退出」，返回菜单统一走暂停面板
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn btn-icon';
    pauseBtn.textContent = '⏸';
    pauseBtn.addEventListener('click', () => {
      audio.play('click');
      this.openPauseMenu();
    });

    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.append(chipLevel, this.chipGold, this.chipWave, this.chipTip);
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    hud.append(spacer, btnSpeed, btnMute, pauseBtn);
    root.appendChild(hud);

    // 底部操作栏（建造面板 / 塔面板共用）
    this.dockBar = document.createElement('div');
    this.dockBar.className = 'build-bar';
    this.dockBar.hidden = true;
    root.appendChild(this.dockBar);
  }

  private dockButton(label: string, cls: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `btn ${cls}`;
    b.textContent = label;
    return b;
  }

  /** 建造面板：列出本关已解锁的塔种，点选后显示射程预览，再点建造 */
  private openBuildPanel(): void {
    this.dockBar.innerHTML = '';
    this.buildKind = 'bottle';
    this.buildOptionBtns.clear();

    for (const kind of this.level.unlockedTowers) {
      const type = TOWER_TYPES[kind];
      const btn = this.dockButton(`${TOWER_ICON[kind]} ${type.name} ${type.cost}`, 'btn-tower');
      btn.title = `${type.desc}｜射程 ${type.range}`;
      btn.addEventListener('click', () => {
        this.buildKind = kind;
        audio.play('click');
        this.refreshBuildPanel();
      });
      this.buildOptionBtns.set(kind, btn);
    }

    this.buildConfirmBtn = this.dockButton('', '');
    this.buildConfirmBtn.addEventListener('click', () => this.buildAtSelected());
    const cancelBtn = this.dockButton('取消', 'btn-cancel');
    cancelBtn.addEventListener('click', () => this.clearSelection());
    this.dockBar.append(...this.buildOptionBtns.values(), this.buildConfirmBtn, cancelBtn);
    this.dockBar.hidden = false;
    this.refreshBuildPanel();
    this.refreshHud();
  }

  /** 同步建造面板：选中态、确认按钮文字与可负担状态 */
  private refreshBuildPanel(): void {
    for (const [kind, btn] of this.buildOptionBtns) {
      btn.classList.toggle('active', kind === this.buildKind);
    }
    if (!this.buildConfirmBtn) return;
    const type = TOWER_TYPES[this.buildKind];
    this.buildConfirmBtn.textContent = `✔ 建造（${type.cost}）`;
    this.buildConfirmBtn.disabled = !this.economy.canAfford(type.cost);
  }

  private openTowerPanel(t: Tower): void {
    this.dockBar.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'chip';
    name.textContent = `${t.type.name} Lv${t.level}`;
    const upBtn = this.dockButton('', '');
    upBtn.addEventListener('click', () => {
      if (t.level >= 3) return;
      const c = upgradeCost(t.type, t.level);
      if (!this.economy.spend(c)) return;
      t.invested += c;
      t.level += 1;
      this.fx.poof(t.x, t.y - 20, 18, '#fff3c4');
      audio.play('upgrade');
      this.refreshHud();
      this.openTowerPanel(t);
    });
    const sellBtn = this.dockButton('', 'btn-cancel');
    sellBtn.addEventListener('click', () => {
      const refund = Math.floor(t.invested * 0.7);
      this.economy.add(refund);
      this.towers = this.towers.filter((x) => x !== t);
      this.fx.poof(t.x, t.y, 24, '#ffe082');
      this.fx.floatText(t.x, t.y - 40, `+${refund}`);
      audio.play('sell');
      this.selectedTower = null;
      this.dockBar.hidden = true;
      this.refreshHud();
    });
    const closeBtn = this.dockButton('✖', 'btn-cancel');
    closeBtn.addEventListener('click', () => this.clearSelection());
    this.dockBar.append(name, upBtn, sellBtn, closeBtn);
    this.dockBar.hidden = false;
    this.refreshHud();

    const refresh = (): void => {
      if (t.level >= 3) {
        upBtn.textContent = '已满级 ⭐';
        upBtn.disabled = true;
      } else {
        upBtn.textContent = `⬆️ 升级（${upgradeCost(t.type, t.level)}）`;
        upBtn.disabled = !this.economy.canAfford(upgradeCost(t.type, t.level));
      }
      sellBtn.textContent = `💰 出售 +${Math.floor(t.invested * 0.7)}`;
    };
    this.towerPanelRefresh = refresh;
    refresh();
  }

  // ---------------- 更新 ----------------

  update(dt: number): void {
    if (this.ended || settings.paused) return;
    this.time += dt;

    this.waves.update(dt);
    if (this.waves.currentWave > this.lastWaveSeen) {
      this.lastWaveSeen = this.waves.currentWave;
      this.bannerText = `第 ${this.waves.currentWave} / ${this.waves.total} 波`;
      this.bannerT = 0;
      audio.play('wave');
    }

    for (const m of this.monsters) m.update(dt);

    // 医生怪治疗光环
    for (const m of this.monsters) {
      if (m.dead || m.type.id !== 'healer') continue;
      const left = (this.healCd.get(m) ?? 0) - dt;
      if (left <= 0) {
        this.healCd.set(m, HEAL_INTERVAL);
        let healedSomeone = false;
        for (const ally of this.monsters) {
          if (ally === m || ally.dead || ally.hp >= ally.maxHp) continue;
          if (Math.hypot(ally.pos.x - m.pos.x, ally.pos.y - m.pos.y) > HEAL_RADIUS) continue;
          const healed = ally.heal(HEAL_AMOUNT);
          if (healed > 0) {
            healedSomeone = true;
            this.fx.floatText(ally.pos.x, ally.pos.y - ally.radius * 2, `+${healed}`, '#7ed67e');
          }
        }
        if (healedSomeone) {
          this.fx.poof(m.pos.x, m.pos.y - 10, 16, '#d8f5d0');
          audio.play('heal');
        }
      } else {
        this.healCd.set(m, left);
      }
    }

    this.monsters = this.monsters.filter((m) => {
      if (m.dead) this.healCd.delete(m);
      return !m.dead;
    });

    // 塔开火
    const ctx: TowerContext = {
      monsters: this.monsters,
      obstacles: this.obstacles,
      allTargets: (): CombatTarget[] => [...this.monsters, ...this.obstacles],
      spawnBullet: (b): void => {
        this.projectiles.push(b);
      },
      onBulletHit: (x, y, style): void => {
        if (style === 'rocket') {
          this.fx.poof(x, y, 30, '#ffb74d');
          this.shake = Math.max(this.shake, 0.18);
          audio.play('explode');
        } else if (style === 'ice') {
          this.fx.poof(x, y, 13, '#bfe9ff');
        } else if (style === 'fan') {
          this.fx.poof(x, y, 12, '#cdeede');
        }
      },
    };
    for (const t of this.towers) t.update(dt, ctx);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // 障碍物：受击闪光衰减 + 打碎奖励
    for (const o of this.obstacles) {
      if (o.flash > 0) o.flash -= dt;
      if (o.dead) {
        const reward = OBSTACLES[o.kind].reward;
        this.economy.add(reward);
        this.fx.floatText(o.pos.x, o.pos.y - 40, `+${reward}`, '#ffd54f');
        this.fx.poof(o.pos.x, o.pos.y - 6, 26, o.kind === 'rock' ? '#cfd6dd' : '#ffe082');
        audio.play('explode');
        audio.play('coin');
      }
    }
    this.obstacles = this.obstacles.filter((o) => !o.dead);

    this.fx.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.4);
    if (this.bannerT < BANNER_DUR) this.bannerT += dt;

    this.refreshWaveChip();

    if (this.waves.finished && this.monsters.length === 0) this.showResult(true);
  }

  // ---------------- 渲染 ----------------

  render(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.groundCanvas(), 0, 0, DESIGN_W, DESIGN_H);

    if (this.selectedCell) {
      const c = this.grid.cellCenter(this.selectedCell.col, this.selectedCell.row);
      const pulse = 0.55 + Math.sin(this.time * 6) * 0.25;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + pulse * 0.08})`;
      ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
      ctx.lineWidth = 4;
      roundRectPath(ctx, c.x - 34, c.y - 34, 68, 68, 12);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.fillStyle = 'rgba(120,210,255,0.10)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, TOWER_TYPES[this.buildKind].range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.sin(this.time * 72) * 7 * this.shake, Math.cos(this.time * 61) * 5 * this.shake);
    }
    if (this.carrotHp > 0) {
      const mood: CarrotMood = this.carrotHp > 6 ? 'happy' : this.carrotHp > 3 ? 'worried' : 'hurt';
      drawCarrot(ctx, this.carrotPos.x, this.carrotPos.y, 108, mood);
      this.drawCarrotHpBar(ctx);
    }
    ctx.restore();

    for (const o of [...this.obstacles].sort((a, b) => a.pos.y - b.pos.y)) o.render(ctx);
    for (const t of this.towers) t.render(ctx);
    if (this.selectedTower) this.selectedTower.renderRange(ctx);

    // 复用数组避免每帧分配（低端机 GC 压力）
    const list = this.renderList;
    list.length = 0;
    for (const m of this.monsters) list.push(m);
    list.sort((a, b) => a.pos.y - b.pos.y);
    for (const m of list) m.render(ctx);
    for (const p of this.projectiles) p.render(ctx);
    this.fx.render(ctx);

    if (this.bannerT < BANNER_DUR) this.drawBanner(ctx);
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const k = this.bannerT / BANNER_DUR;
    let alpha = 1;
    if (k < 0.15) alpha = k / 0.15;
    else if (k > 0.8) alpha = (1 - k) / 0.2;
    const scale = k < 0.15 ? 0.7 + (k / 0.15) * 0.3 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(DESIGN_W / 2, 300);
    ctx.scale(scale, scale);
    ctx.font = 'bold 58px system-ui, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4a2e14';
    ctx.strokeText(this.bannerText, 0, 0);
    ctx.fillStyle = '#ffe9c7';
    ctx.fillText(this.bannerText, 0, 0);
    ctx.restore();
  }

  private drawCarrotHpBar(ctx: CanvasRenderingContext2D): void {
    const pct = Math.max(0, this.carrotHp / this.level.carrotHp);
    const w = 84;
    const x = this.carrotPos.x - w / 2;
    const y = this.carrotPos.y - 96;
    ctx.fillStyle = 'rgba(20,14,6,0.55)';
    roundRectPath(ctx, x - 2, y - 2, w + 4, 13, 6.5);
    ctx.fill();
    ctx.fillStyle = pct > 0.6 ? '#58c94d' : pct > 0.3 ? '#ffcf3f' : '#ff5f4d';
    roundRectPath(ctx, x, y, w * pct, 9, 4.5);
    ctx.fill();
  }

  // ---------------- 交互 ----------------

  onTap(x: number, y: number): void {
    if (this.ended || settings.paused) return;
    const cell = this.grid.worldToCell(x, y);
    if (!cell) {
      this.clearSelection();
      return;
    }
    const towerHere = this.towers.find((t) => t.col === cell.col && t.row === cell.row);
    if (towerHere) {
      this.selectedCell = null;
      this.selectedTower = towerHere;
      this.openTowerPanel(towerHere);
      return;
    }
    const obstacleHere = this.obstacles.find((o) => o.col === cell.col && o.row === cell.row);
    if (obstacleHere) {
      const info = OBSTACLES[obstacleHere.kind];
      this.fx.floatText(obstacleHere.pos.x, obstacleHere.pos.y - 52, `${info.name} · 打碎得 ${info.reward}🪙`, '#ffe9a8');
      this.clearSelection();
      return;
    }
    if (this.grid.isBuildable(cell.col, cell.row)) {
      this.selectedTower = null;
      this.selectedCell = cell;
      this.openBuildPanel();
    } else {
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.selectedCell = null;
    this.selectedTower = null;
    this.towerPanelRefresh = null;
    this.dockBar.hidden = true;
  }

  private buildAtSelected(): void {
    if (!this.selectedCell) return;
    const type = TOWER_TYPES[this.buildKind];
    if (!this.level.unlockedTowers.includes(this.buildKind)) return;
    if (!this.economy.spend(type.cost)) return;
    const c = this.grid.cellCenter(this.selectedCell.col, this.selectedCell.row);
    const tower = new Tower(this.selectedCell.col, this.selectedCell.row, c.x, c.y, type);
    tower.invested = type.cost;
    this.towers.push(tower);
    this.fx.poof(c.x, c.y + 8, 22, '#e8d9b8');
    audio.play('build');
    this.chipTip.remove();
    this.clearSelection();
    this.refreshHud();
  }

  private tryCallNext(): void {
    if (this.ended || settings.paused) return;
    const remaining = this.waves.tryCallNext();
    if (remaining == null) return;
    const bonus = Math.ceil(Math.min(remaining, 6) * 10);
    this.economy.add(bonus);
    this.fx.floatText(DESIGN_W / 2, 110, `提前召唤 +${bonus}`, '#ffd54f');
    audio.play('coin');
    this.refreshHud();
  }

  // ---------------- 暂停 ----------------

  private openPauseMenu(): void {
    if (this.ended || this.pauseEl) return;
    settings.paused = true;
    this.clearSelection();

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const title = document.createElement('h2');
    title.textContent = '暂停中 ⏸';
    const row = document.createElement('div');
    row.className = 'row';

    const resume = document.createElement('button');
    resume.className = 'btn btn-green';
    resume.textContent = '▶ 继续';
    resume.addEventListener('click', () => {
      audio.play('click');
      settings.paused = false;
      overlay.remove();
      this.pauseEl = null;
    });
    const restart = document.createElement('button');
    restart.className = 'btn btn-cancel';
    restart.textContent = '再来一局';
    restart.addEventListener('click', () => this.scenes.reloadCurrent());
    const menu = document.createElement('button');
    menu.className = 'btn btn-cancel';
    menu.textContent = '返回菜单';
    menu.addEventListener('click', () => this.scenes.switchTo('menu'));

    row.append(resume, restart, menu);
    panel.append(title, row);
    overlay.appendChild(panel);
    this.scenes.uiRoot.appendChild(overlay);
    this.pauseEl = overlay;
  }

  // ---------------- HUD 刷新与结算 ----------------

  private refreshHud(): void {
    this.chipGold.textContent = `🪙 ${this.economy.gold}`;
    this.towerPanelRefresh?.();
    if (!this.dockBar.hidden && this.selectedCell) this.refreshBuildPanel();
  }

  private refreshWaveChip(): void {
    const w = this.waves;
    if (w.finished) {
      this.chipWave.textContent = '🎉 全部波次来袭完毕';
      this.chipWave.classList.remove('call-ready');
    } else if (w.spawning) {
      this.chipWave.textContent = `⚔️ 第 ${w.currentWave} / ${w.total} 波`;
      this.chipWave.classList.remove('call-ready');
    } else {
      const s = Math.max(1, Math.ceil(w.countdown));
      this.chipWave.textContent =
        w.currentWave === 0
          ? `⏳ ${s}s 后第一波 · 点击提前！`
          : `⏳ 下一波 ${s}s · 点击提前！`;
      this.chipWave.classList.add('call-ready');
    }
  }

  private showResult(win: boolean): void {
    this.ended = true;
    this.clearSelection();
    audio.play(win ? 'win' : 'lose');

    const stars = this.carrotHp >= 8 ? 3 : this.carrotHp >= 4 ? 2 : 1;
    if (win) save.recordStars(this.level.id, stars);

    const next = ALL_LEVELS.find((l) => l.id === this.level.id + 1);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const title = document.createElement('h2');
    title.textContent = win ? '胜利！🎉' : '萝卜被吃掉了… 😿';
    if (win) {
      const starRow = document.createElement('div');
      starRow.className = 'stars';
      starRow.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      panel.appendChild(starRow);
    }
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = win
      ? `剩余萝卜血量 ${this.carrotHp} / ${this.level.carrotHp}`
      : `坚守到了第 ${Math.max(1, this.waves.currentWave)} 波`;
    const row = document.createElement('div');
    row.className = 'row';
    const again = document.createElement('button');
    again.className = 'btn btn-green';
    again.textContent = '再来一局';
    again.addEventListener('click', () => this.scenes.reloadCurrent());
    const menu = document.createElement('button');
    menu.className = 'btn btn-cancel';
    menu.textContent = '返回菜单';
    menu.addEventListener('click', () => this.scenes.switchTo('menu'));
    row.append(again, menu);

    panel.append(title, sub, row);
    if (win && next && save.isUnlocked(next.id)) {
      const nextBtn = this.dockButton(`下一关 ▶ ${next.name}`, '');
      nextBtn.addEventListener('click', () => {
        selection.current = next;
        this.scenes.reloadCurrent();
      });
      const row2 = document.createElement('div');
      row2.className = 'row';
      row2.appendChild(nextBtn);
      panel.appendChild(row2);
    }
    overlay.appendChild(panel);
    this.scenes.uiRoot.appendChild(overlay);
  }

  // 静态地图缓存（按关卡区分，重开局复用）
  private groundCaches = new Map<number, HTMLCanvasElement>();
  private groundCanvas(): HTMLCanvasElement {
    let cv = this.groundCaches.get(this.level.id);
    if (!cv) {
      cv = buildGround(this.paths.map((p) => p.points), this.carrotPos, 20260826 + this.level.id);
      this.groundCaches.set(this.level.id, cv);
    }
    return cv;
  }
}
