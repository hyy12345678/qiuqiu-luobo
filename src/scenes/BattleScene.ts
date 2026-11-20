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
import { buildGround, tiltGround } from '../render/ground';
import type { GroundBuild } from '../render/ground';
import { drawPumpkin } from '../render/sprites';
import type { PumpkinMood, MonsterSkin } from '../render/sprites';
import { roundRectPath } from '../render/decor';
import { DESIGN_W, DESIGN_H } from '../render/Renderer';
import {
  WORLD_PAD,
  enterGround,
  enterUpright,
  hitUpright,
  projectX,
  projectY,
  unprojectX,
  unprojectY,
} from '../render/projection';
import type { SpriteBox } from '../render/projection';
import { TOWER_TYPES, upgradeCost } from '../data/towers';
import type { TowerKind, BranchDef } from '../data/towers';
import { BRANCHES } from '../data/towers';
import { monsterById } from '../data/monsters';
import { OBSTACLES } from '../data/obstacles';
import { ALL_LEVELS, selection } from '../data/levels';
import { save } from '../save/SaveManager';
import { audio } from '../audio/AudioManager';
// 参数名 t 常用于塔对象，所以翻译函数统一用 tr 引用
import { t as tr, getLang } from '../i18n';

const BANNER_DUR = 1.9;

/** 大招：每杀一只怪攒 5 点，满 100 可释放 */
const SKILL_MAX = 100;
const SKILL_PER_KILL = 5;
/** 冰霜大风：速度乘以 0.15，持续 3 秒 */
const SKILL_SLOW_RATIO = 0.15;
const SKILL_SLOW_DUR = 3;

/** 可参与深度排序的绘制对象（塔、道具、怪物、南瓜） */
interface Depthed {
  readonly depthY: number;
  render(ctx: CanvasRenderingContext2D): void;
}

/** 直立物体在屏幕上的点击包围盒（相对脚下锚点，单位为设计像素，未缩放） */
const TOWER_HIT: SpriteBox = { left: -40, right: 40, top: -76, bottom: 24 };
const OBSTACLE_HIT: SpriteBox = { left: -36, right: 36, top: -50, bottom: 30 };
/** 格子高亮的四个角（相对格子中心） */
const CELL_CORNERS: ReadonlyArray<readonly [number, number]> = [[-34, -34], [34, -34], [34, 34], [-34, 34]];

/** 原地删除不满足 keep 的元素，保持数组引用不变且不分配新数组 */
function compactInPlace<T>(arr: T[], keep: (x: T) => boolean): void {
  let n = 0;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    if (keep(x)) arr[n++] = x;
  }
  arr.length = n;
}
const HEAL_AMOUNT = 25;
const HEAL_RADIUS = 90;
const HEAL_INTERVAL = 2.5;

const TOWER_ICON: Record<TowerKind, string> = {
  bottle: '🧪',
  frost: '🕸️',
  multishot: '🦇',
  sunflower: '🕯️',
  fan: '🧹',
  rocket: '🎃',
};

/** 战斗场景：读 selection.current 关卡配置，支持多路径 / 音效 / 存档 */
export class BattleScene implements Scene {
  readonly name = 'battle';

  private level = selection.current;
  private paths: Path[] = [];
  private pumpkinPos = { x: 0, y: 0 };
  private grid!: Grid;
  private economy!: Economy;
  private waves!: WaveManager;
  private monsters: Monster[] = [];
  private obstacles: Obstacle[] = [];
  private towers: Tower[] = [];
  private projectiles: Array<Bullet | FanBlade> = [];
  private fx = new Effects();
  private healCd = new Map<Monster, number>();

  private pumpkinHp = 10;
  private ended = false;
  private time = 0;
  private shake = 0;
  /** 大招能量：击杀攒能量，满 100 可释放 */
  private energy = 0;
  /** 大招释放时的屏幕蓝光（1 → 0） */
  private skillFlash = 0;
  private skillBtn: HTMLButtonElement | null = null;
  private bannerText = '';
  private bannerT = 99;
  private lastWaveSeen = 0;

  private selectedCell: { col: number; row: number } | null = null;
  /** 建造面板当前选中的塔种（决定射程预览与建造费用） */
  private buildKind: TowerKind = 'bottle';
  private buildOptionBtns = new Map<TowerKind, HTMLButtonElement>();
  private buildConfirmBtn: HTMLButtonElement | null = null;
  private selectedTower: Tower | null = null;
  /** 统一深度排序列表（塔、道具、怪物、南瓜），每帧复用 */
  private depthList: Depthed[] = [];
  /** 南瓜作为深度列表中的一项，depthY 在 enter 时设定 */
  private pumpkinView = { depthY: 0, render: (ctx: CanvasRenderingContext2D): void => this.renderPumpkin(ctx) };
  /** 怪物 + 障碍物的合并列表（每帧复用，只能同步使用，不要保存引用） */
  private targetBuf: CombatTarget[] = [];
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
    this.pumpkinPos = { x: end.x + 4, y: end.y - 10 };
    this.pumpkinView.depthY = this.pumpkinPos.y;
    this.energy = 0;
    this.skillFlash = 0;
    this.grid = new Grid(this.paths.map((p) => p.points), this.pumpkinPos);
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
    this.pumpkinHp = this.level.pumpkinHp;
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
      bus.on<{ bounty: number; x: number; y: number; radius: number; skin: MonsterSkin; blast?: Blast }>('monster:killed', (p) => {
        this.economy.add(p.bounty);
        this.energy = Math.min(SKILL_MAX, this.energy + SKILL_PER_KILL);
        this.fx.floatText(p.x, p.y - p.radius * 1.6, `+${p.bounty}`);
        this.fx.ghost(p.x, p.y - 4, p.radius, p.skin);
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
        this.pumpkinHp -= p.damage;
        this.shake = 0.55;
        this.fx.floatText(this.pumpkinPos.x, this.pumpkinPos.y - 78, `-${p.damage}`, '#ff6b57');
        this.fx.poof(this.pumpkinPos.x, this.pumpkinPos.y - 20, 16, '#ffb347');
        audio.play('bite');
        this.refreshHud();
        if (this.pumpkinHp <= 0 && !this.ended) this.showResult(false);
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
    chipLevel.textContent = `${this.level.id}️⃣ ${tr(this.level.name)}`;

    this.chipGold = document.createElement('span');
    this.chipGold.className = 'chip';
    this.chipTip = document.createElement('span');
    this.chipTip.className = 'chip chip-tip';
    this.chipTip.textContent = tr('hud.tip');
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
    // 大招按钮：能量满时才能点
    this.skillBtn = document.createElement('button');
    this.skillBtn.className = 'btn btn-icon';
    this.skillBtn.addEventListener('click', () => this.useSkill());

    hud.append(spacer, this.skillBtn, btnSpeed, btnMute, pauseBtn);
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
      const btn = this.dockButton(`${TOWER_ICON[kind]} ${tr(type.name)} ${type.cost}`, 'btn-tower');
      btn.title = tr('build.tooltip', { desc: tr(type.desc), range: type.range });
      btn.addEventListener('click', () => {
        this.buildKind = kind;
        audio.play('click');
        this.refreshBuildPanel();
      });
      this.buildOptionBtns.set(kind, btn);
    }

    this.buildConfirmBtn = this.dockButton('', '');
    this.buildConfirmBtn.addEventListener('click', () => this.buildAtSelected());
    const cancelBtn = this.dockButton(tr('build.cancel'), 'btn-cancel');
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
    this.buildConfirmBtn.textContent = tr('build.confirm', { cost: type.cost });
    this.buildConfirmBtn.disabled = !this.economy.canAfford(type.cost);
  }

  /** 塔面板标题：名字、等级，选了分支则带上分支名 */
  private towerTitle(t: Tower): string {
    const title = tr('tower.title', { name: tr(t.type.name), lv: t.level });
    return t.branch ? `${title} · ${tr(t.branch.name)}` : title;
  }

  /** 升级：Lv1→2 直接升；Lv2→3 必须传入分支 */
  private upgradeTower(t: Tower, branch: BranchDef | null): void {
    if (t.level >= 3) return;
    if (t.level === 2 && !branch) return;
    const c = upgradeCost(t.type, t.level);
    if (!this.economy.spend(c)) return;
    t.invested += c;
    if (branch) t.branch = branch;
    t.level += 1;
    t.kickLevelUp();
    this.fx.poof(t.x, t.y - 20, 18, '#fff3c4');
    audio.play('upgrade');
    this.refreshHud();
    this.openTowerPanel(t);
  }

  private openTowerPanel(t: Tower): void {
    this.dockBar.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'chip';
    name.textContent = this.towerTitle(t);
    const upBtn = this.dockButton('', '');
    upBtn.addEventListener('click', () => this.upgradeTower(t, null));
    // Lv2 升 Lv3 时，用两个分支按钮代替普通升级按钮
    const branchBtns = BRANCHES[t.type.id].map((def) => {
      const b = this.dockButton('', 'btn-branch');
      b.addEventListener('click', () => this.upgradeTower(t, def));
      return b;
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
    this.dockBar.append(name, upBtn, ...branchBtns, sellBtn, closeBtn);
    this.dockBar.hidden = false;
    this.refreshHud();

    const refresh = (): void => {
      name.textContent = this.towerTitle(t);
      const branchStage = t.level === 2;
      const cost = t.level < 3 ? upgradeCost(t.type, t.level) : 0;
      upBtn.style.display = branchStage ? 'none' : '';
      branchBtns.forEach((b, i) => {
        const def = BRANCHES[t.type.id][i];
        b.style.display = branchStage ? '' : 'none';
        b.innerHTML = tr('tower.branch', { name: tr(def.name), cost, desc: tr(def.desc) });
        b.disabled = !this.economy.canAfford(cost);
      });
      if (t.level >= 3) {
        upBtn.textContent = tr('tower.maxed');
        upBtn.disabled = true;
      } else if (!branchStage) {
        upBtn.textContent = tr('tower.upgrade', { cost });
        upBtn.disabled = !this.economy.canAfford(cost);
      }
      sellBtn.textContent = tr('tower.sell', { n: Math.floor(t.invested * 0.7) });
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
      this.bannerText = tr('banner.wave', { n: this.waves.currentWave, total: this.waves.total });
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

    compactInPlace(this.monsters, (m) => {
      if (m.dead) this.healCd.delete(m);
      return !m.dead;
    });

    // 塔开火
    const ctx: TowerContext = {
      monsters: this.monsters,
      obstacles: this.obstacles,
      // 返回共享缓冲区：调用方只能同步遍历，不能保存引用
      allTargets: (): CombatTarget[] => {
        const buf = this.targetBuf;
        buf.length = 0;
        for (const m of this.monsters) buf.push(m);
        for (const o of this.obstacles) buf.push(o);
        return buf;
      },
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
    compactInPlace(this.projectiles, (p) => !p.dead);

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
    compactInPlace(this.obstacles, (o) => !o.dead);

    this.fx.update(dt);
    if (this.skillFlash > 0) this.skillFlash = Math.max(0, this.skillFlash - dt * 1.5);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.4);
    if (this.bannerT < BANNER_DUR) this.bannerT += dt;

    this.refreshWaveChip();

    if (this.waves.finished && this.monsters.length === 0) this.showResult(true);
  }

  // ---------------- 渲染 ----------------

  render(ctx: CanvasRenderingContext2D): void {
    const ground = this.groundData();
    ctx.drawImage(ground.canvas, 0, 0, DESIGN_W, DESIGN_H);

    if (this.selectedCell) {
      const c = this.grid.cellCenter(this.selectedCell.col, this.selectedCell.row);
      const pulse = 0.55 + Math.sin(this.time * 6) * 0.25;
      // 格子高亮：四个角分别投影，画成斜面上的梯形
      ctx.beginPath();
      for (let i = 0; i < CELL_CORNERS.length; i++) {
        const wx = c.x + CELL_CORNERS[i][0];
        const wy = c.y + CELL_CORNERS[i][1];
        if (i === 0) ctx.moveTo(projectX(wx, wy), projectY(wy));
        else ctx.lineTo(projectX(wx, wy), projectY(wy));
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.1 + pulse * 0.08})`;
      ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();

      // 射程预览：地面上的圆在斜视角下是椭圆
      ctx.save();
      enterGround(ctx, c.x, c.y);
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

    // 复用数组按脚下 y 统一排序，塔、道具、怪物、南瓜互相遮挡正确
    const list = this.depthList;
    list.length = 0;
    for (const o of this.obstacles) list.push(o);
    for (const t of this.towers) list.push(t);
    for (const m of this.monsters) list.push(m);
    for (const p of ground.props) list.push(p);
    list.push(this.pumpkinView);
    list.sort((a, b) => a.depthY - b.depthY);
    for (const e of list) e.render(ctx);

    if (this.selectedTower) this.selectedTower.renderRange(ctx);
    for (const p of this.projectiles) p.render(ctx);
    this.fx.render(ctx);

    if (this.skillFlash > 0) {
      ctx.fillStyle = `rgba(190,235,255,${this.skillFlash * 0.35})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
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

  /** 南瓜：受击时整体抖动，血量阶段决定表情 */
  private renderPumpkin(ctx: CanvasRenderingContext2D): void {
    if (this.pumpkinHp <= 0) return;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.sin(this.time * 72) * 7 * this.shake, Math.cos(this.time * 61) * 5 * this.shake);
    }
    enterUpright(ctx, this.pumpkinPos.x, this.pumpkinPos.y);
    const mood: PumpkinMood = this.pumpkinHp > 6 ? 'happy' : this.pumpkinHp > 3 ? 'worried' : 'hurt';
    drawPumpkin(ctx, this.pumpkinPos.x, this.pumpkinPos.y, 108, mood);
    this.drawPumpkinHpBar(ctx);
    ctx.restore();
  }

  private drawPumpkinHpBar(ctx: CanvasRenderingContext2D): void {
    const pct = Math.max(0, this.pumpkinHp / this.level.pumpkinHp);
    const w = 84;
    const x = this.pumpkinPos.x - w / 2;
    const y = this.pumpkinPos.y - 96;
    ctx.fillStyle = 'rgba(20,14,6,0.55)';
    roundRectPath(ctx, x - 2, y - 2, w + 4, 13, 6.5);
    ctx.fill();
    ctx.fillStyle = pct > 0.6 ? '#58c94d' : pct > 0.3 ? '#ffcf3f' : '#ff5f4d';
    roundRectPath(ctx, x, y, w * pct, 9, 4.5);
    ctx.fill();
  }

  // ---------------- 交互 ----------------

  /** (sx, sy) 为屏幕上的设计坐标（Input 已换算） */
  onTap(sx: number, sy: number): void {
    if (this.ended || settings.paused) return;
    // 空地格子：屏幕点反投影到平面坐标后按格子判定
    const wy = unprojectY(sy);
    const cell = this.grid.worldToCell(unprojectX(sx, wy), wy);
    // 直立的塔与道具：优先按屏幕包围盒判定（塔顶的屏幕位置可能落在上一行的格子里）
    const towerHere =
      this.towers.find((t) => hitUpright(t.x, t.depthY, sx, sy, TOWER_HIT)) ??
      this.towers.find((t) => !!cell && t.col === cell.col && t.row === cell.row);
    if (towerHere) {
      this.selectedCell = null;
      this.selectedTower = towerHere;
      this.openTowerPanel(towerHere);
      return;
    }
    const obstacleHere =
      this.obstacles.find((o) => hitUpright(o.pos.x, o.depthY, sx, sy, OBSTACLE_HIT)) ??
      this.obstacles.find((o) => !!cell && o.col === cell.col && o.row === cell.row);
    if (!cell) {
      this.clearSelection();
      return;
    }
    if (obstacleHere) {
      const info = OBSTACLES[obstacleHere.kind];
      this.fx.floatText(
        obstacleHere.pos.x,
        obstacleHere.pos.y - 52,
        tr('obstacle.smash', { name: tr(info.name), reward: info.reward }),
        '#ffe9a8',
      );
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
    this.fx.floatText(DESIGN_W / 2, 110, tr('call.early', { n: bonus }), '#ffd54f', true);
    audio.play('coin');
    this.refreshHud();
  }

  /** 大招：全场怪物减速 85%，持续 3 秒，屏幕泛蓝光 */
  private useSkill(): void {
    if (this.ended || settings.paused || this.energy < SKILL_MAX) return;
    this.energy = 0;
    for (const m of this.monsters) {
      if (!m.dead) m.applySlow(SKILL_SLOW_RATIO, SKILL_SLOW_DUR);
    }
    this.skillFlash = 1;
    this.fx.floatText(DESIGN_W / 2, 200, tr('skill.frost'), '#bfe9ff', true);
    audio.play('upgrade');
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
    title.textContent = tr('pause.title');
    const row = document.createElement('div');
    row.className = 'row';

    const resume = document.createElement('button');
    resume.className = 'btn btn-green';
    resume.textContent = tr('pause.resume');
    resume.addEventListener('click', () => {
      audio.play('click');
      settings.paused = false;
      overlay.remove();
      this.pauseEl = null;
    });
    const restart = document.createElement('button');
    restart.className = 'btn btn-cancel';
    restart.textContent = tr('pause.restart');
    restart.addEventListener('click', () => this.scenes.reloadCurrent());
    const menu = document.createElement('button');
    menu.className = 'btn btn-cancel';
    menu.textContent = tr('pause.menu');
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
    this.refreshSkillBtn();
    this.towerPanelRefresh?.();
    if (!this.dockBar.hidden && this.selectedCell) this.refreshBuildPanel();
  }

  private refreshSkillBtn(): void {
    if (!this.skillBtn) return;
    const ready = this.energy >= SKILL_MAX;
    this.skillBtn.textContent = ready ? tr('hud.skillReady') : tr('hud.skill', { p: Math.floor(this.energy) });
    this.skillBtn.disabled = !ready || this.ended;
  }

  private refreshWaveChip(): void {
    const w = this.waves;
    if (w.finished) {
      this.chipWave.textContent = tr('hud.allSpawned');
      this.chipWave.classList.remove('call-ready');
    } else if (w.spawning) {
      this.chipWave.textContent = tr('hud.waveProgress', { n: w.currentWave, total: w.total });
      this.chipWave.classList.remove('call-ready');
    } else {
      const s = Math.max(1, Math.ceil(w.countdown));
      this.chipWave.textContent =
        w.currentWave === 0 ? tr('hud.firstWave', { s }) : tr('hud.nextWave', { s });
      this.chipWave.classList.add('call-ready');
    }
  }

  private showResult(win: boolean): void {
    this.ended = true;
    this.clearSelection();
    audio.play(win ? 'win' : 'lose');

    const stars = this.pumpkinHp >= 8 ? 3 : this.pumpkinHp >= 4 ? 2 : 1;
    if (win) save.recordStars(this.level.id, stars);

    const next = ALL_LEVELS.find((l) => l.id === this.level.id + 1);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const title = document.createElement('h2');
    title.textContent = win ? tr('result.win') : tr('result.lose');
    if (win) {
      const starRow = document.createElement('div');
      starRow.className = 'stars';
      starRow.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      panel.appendChild(starRow);
    }
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = win
      ? tr('result.hp', { hp: this.pumpkinHp, max: this.level.pumpkinHp })
      : tr('result.wave', { n: Math.max(1, this.waves.currentWave) });
    const row = document.createElement('div');
    row.className = 'row';
    const again = document.createElement('button');
    again.className = 'btn btn-green';
    again.textContent = tr('result.again');
    again.addEventListener('click', () => this.scenes.reloadCurrent());
    const menu = document.createElement('button');
    menu.className = 'btn btn-cancel';
    menu.textContent = tr('result.menu');
    menu.addEventListener('click', () => this.scenes.switchTo('menu'));
    row.append(again, menu);

    panel.append(title, sub, row);
    if (win && next && save.isUnlocked(next.id)) {
      const nextBtn = this.dockButton(tr('result.next', { name: tr(next.name) }), '');
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

  // 静态地图缓存（按语言 + 关卡区分：地图上的木牌文字随语言变化，重开局复用）
  private groundCaches = new Map<string, GroundBuild>();
  private groundData(): GroundBuild {
    const key = `${getLang()}:${this.level.id}`;
    let data = this.groundCaches.get(key);
    if (!data) {
      const built = buildGround(this.paths.map((p) => p.points), this.pumpkinPos, 20260826 + this.level.id, WORLD_PAD);
      data = { canvas: tiltGround(built.canvas, WORLD_PAD), props: built.props };
      this.groundCaches.set(key, data);
    }
    return data;
  }
}
