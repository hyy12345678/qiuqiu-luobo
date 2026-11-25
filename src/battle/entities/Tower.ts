import { DMG_MUL, RANGE_MUL, CD_MUL } from '../../data/towers';
import type { TowerType, BranchDef } from '../../data/towers';
import type { Monster } from './Monster';
import type { Obstacle } from './Obstacle';
import type { CombatTarget } from '../target';
import { Bullet, FanBlade } from './Bullet';
import { audio } from '../../audio/AudioManager';
import type { SfxName } from '../../audio/AudioManager';
import { enterGround, enterUpright } from '../../render/projection';
import { drawTowerArt, drawTowerPlinth, drawTowerGroundLight, towerAccent, candleFlameRgb } from '../../render/towerArt';
import type { TowerMood, TowerArtState } from '../../render/towerArt';

export interface TowerContext {
  monsters: Monster[];
  obstacles: Obstacle[];
  /** 溅射/穿透的候选集合（怪物+障碍） */
  allTargets: () => CombatTarget[];
  spawnBullet(b: Bullet | FanBlade): void;
  /** 子弹命中特效（爆炸烟等） */
  onBulletHit?: (x: number, y: number, style: string) => void;
}

const TAU = Math.PI * 2;

/** 塔身按等级放大（以脚下为锚点，脚始终踩在石台上） */
const TIER_SCALE = [1, 1.14, 1.3];
/** 待机动作的时长（秒） */
const IDLE_DUR = 0.6;

/** 塔：六种行为 × 三级成长。数值由类型配置乘以等级倍率表得出 */
export class Tower {
  level = 1;
  invested = 0;
  private cooldown = 0;
  /** 索敌结果的复用缓冲区，避免每次索敌新建数组 */
  private monsterBuf: Monster[] = [];
  private obstacleBuf: Obstacle[] = [];
  private fireAnim = 0;
  /** 造型动画时钟（秒），随机起点让同类塔不同步 */
  private t = Math.random() * 10;
  /** 朝目标的水平偏向 -1..1，平滑跟随射程内的怪 */
  private lean = 0;
  private pulseT = 0;
  /** 升级弹跳剩余量（1 → 0） */
  private popT = 0;
  /** 眨眼计时：倒计时到 0 时闭眼一次 */
  private blinkCd = 1 + Math.random() * 3;
  private blinkT = 0;
  /** 本帧绘制用的表情，render 开头刷新 */
  private curMood: TowerMood = 'happy';
  /** 待机动作：射程内没有怪时，每隔几秒做一次小跳或晃动 */
  private idleCd = 2 + Math.random() * 2;
  private idleT = 0;
  private idleKind: 'hop' | 'wiggle' = 'hop';

  constructor(
    public col: number,
    public row: number,
    public x: number,
    public y: number,
    public type: TowerType,
  ) {}

  /** Lv3 时选定的分支（Lv1、Lv2 为 null） */
  branch: BranchDef | null = null;

  get damage(): number {
    return this.type.damage * DMG_MUL[this.level - 1] * (this.branch?.dmgMul ?? 1);
  }
  get range(): number {
    return this.type.range * RANGE_MUL[this.level - 1] * (this.branch?.rangeMul ?? 1);
  }
  get cd(): number {
    return this.type.cooldown * CD_MUL[this.level - 1] * (this.branch?.cdMul ?? 1);
  }

  /** 升级时调用：塔身弹跳一次 */
  kickLevelUp(): void {
    this.popT = 1;
  }

  update(dt: number, ctx: TowerContext): void {
    if (this.fireAnim > 0) this.fireAnim = Math.max(0, this.fireAnim - dt * 4.5);
    if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - dt * 2.2);
    if (this.popT > 0) this.popT = Math.max(0, this.popT - dt * 2.5);
    this.blinkCd -= dt;
    if (this.blinkCd <= 0) {
      this.blinkT = 0.15;
      this.blinkCd = 2.5 + Math.random() * 2.5;
    }
    if (this.blinkT > 0) this.blinkT = Math.max(0, this.blinkT - dt);

    // 待机：射程内有活着的怪就停下待机计时，否则每隔 4 到 8 秒做一次小动作
    let engaged = false;
    let leanTarget = 0;
    for (const m of ctx.monsters) {
      if (!m.dead && Math.hypot(m.pos.x - this.x, m.pos.y - this.y) <= this.range) {
        engaged = true;
        leanTarget = Math.max(-1, Math.min(1, (m.pos.x - this.x) / (this.range * 0.6)));
        break;
      }
    }
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 6);
    if (engaged) {
      this.idleT = 0;
      this.idleCd = 2 + Math.random() * 2;
    } else {
      this.idleCd -= dt;
      if (this.idleCd <= 0 && this.idleT <= 0) {
        this.idleT = IDLE_DUR;
        this.idleKind = Math.random() < 0.5 ? 'hop' : 'wiggle';
        this.idleCd = 4 + Math.random() * 4;
      }
    }
    if (this.idleT > 0) this.idleT = Math.max(0, this.idleT - dt);
    this.t += dt;

    if (this.type.id === 'sunflower') {
      this.updateSunflower(dt, ctx);
      return;
    }

    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    const mlist = this.monstersInRange(ctx.monsters);
    const olist = this.obstaclesInRange(ctx.obstacles);
    // 怪物优先；没怪才打道具
    const combined: CombatTarget[] = mlist.length > 0 ? mlist : olist;
    if (combined.length === 0) return;

    const primary = combined[0];
    const SHOOT_SFX: Record<string, SfxName> = {
      bottle: 'shoot_drop',
      frost: 'shoot_ice',
      rocket: 'shoot_rocket',
    };
    switch (this.type.id) {
      case 'frost':
        this.fire(ctx, new Bullet({
          x: this.x, y: this.y - 30, target: primary,
          damage: this.damage, style: 'ice',
          slow: this.branch?.slow ?? { ratio: 0.6, dur: 2 },
          splash: this.branchSplash(),
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play('shoot_ice');
        break;
      case 'multishot':
        for (const t of combined.slice(0, this.branch?.extraTargets ?? 3)) {
          ctx.spawnBullet(new Bullet({
            x: this.x, y: this.y - 40, target: t,
            damage: this.damage, style: 'arrow',
            targets: ctx.allTargets, onHit: ctx.onBulletHit,
          }));
        }
        this.fireAnim = 1;
        this.cooldown = this.cd;
        audio.play('shoot_arrow');
        break;
      case 'fan': {
        const angle = Math.atan2(primary.pos.y - this.y, primary.pos.x - this.x);
        ctx.spawnBullet(new FanBlade(
          this.x, this.y - 34, angle,
          this.range * 1.35, this.damage,
          ctx.allTargets,
          (hx, hy) => ctx.onBulletHit?.(hx, hy, 'fan'),
        ));
        this.fireAnim = 1;
        this.cooldown = this.cd;
        audio.play('shoot_fan');
        break;
      }
      case 'rocket':
        this.fire(ctx, new Bullet({
          x: this.x, y: this.y - 50, target: primary,
          damage: this.damage, style: 'rocket',
          splash: { radius: (62 + this.level * 8) * (this.branch?.splashRadiusMul ?? 1), damage: this.damage * 0.7 },
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play(SHOOT_SFX.rocket);
        break;
      default:
        this.fire(ctx, new Bullet({
          x: this.x, y: this.y - 32, target: primary,
          damage: this.damage, style: 'drop',
          splash: this.branchSplash(),
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play(SHOOT_SFX.bottle);
    }
  }

  /** 分支带来的命中溅射（没有该分支时为 undefined） */
  private branchSplash(): { radius: number; damage: number } | undefined {
    const s = this.branch?.splash;
    return s ? { radius: s.radius, damage: this.damage * s.ratio } : undefined;
  }

  private fire(ctx: TowerContext, b: Bullet): void {
    ctx.spawnBullet(b);
    this.fireAnim = 1;
    this.cooldown = this.cd;
  }

  /** 烛火塔：周期灼烧范围内所有目标，无弹道 */
  private updateSunflower(dt: number, ctx: TowerContext): void {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    let burned = false;
    for (const m of ctx.monsters) {
      if (!m.dead && Math.hypot(m.pos.x - this.x, m.pos.y - this.y) <= this.range) {
        m.takeDamage(this.damage);
        burned = true;
      }
    }
    for (const o of ctx.obstacles) {
      if (!o.dead && Math.hypot(o.pos.x - this.x, o.pos.y - this.y) <= this.range) {
        o.takeDamage(this.damage);
        burned = true;
      }
    }
    if (burned) {
      this.cooldown = this.cd;
      this.pulseT = 1;
    }
  }

  /** 射程内走得最远优先（结果写入本塔的复用缓冲区） */
  private monstersInRange(monsters: Monster[]): Monster[] {
    const buf = this.monsterBuf;
    buf.length = 0;
    for (const m of monsters) {
      if (!m.dead && Math.hypot(m.pos.x - this.x, m.pos.y - this.y) <= this.range) buf.push(m);
    }
    buf.sort((a, b) => b.dist - a.dist);
    return buf;
  }

  /** 没怪时打最近的道具（结果写入本塔的复用缓冲区） */
  private obstaclesInRange(obstacles: Obstacle[]): Obstacle[] {
    const buf = this.obstacleBuf;
    buf.length = 0;
    for (const o of obstacles) {
      if (!o.dead && Math.hypot(o.pos.x - this.x, o.pos.y - this.y) <= this.range) buf.push(o);
    }
    buf.sort((a, b) => Math.hypot(a.pos.x - this.x, a.pos.y - this.y) - Math.hypot(b.pos.x - this.x, b.pos.y - this.y));
    return buf;
  }

  /** 深度排序用：塔身脚下的世界 y（石台中心略低于格子中心） */
  get depthY(): number {
    return this.y + 12;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    const f = this.fireAnim;
    // 表情：眨眼优先，其次开火兴奋，平时开心
    this.curMood = this.blinkT > 0 ? 'blink' : f > 0.3 ? 'excited' : 'happy';
    const branch = this.branch?.key ?? null;
    const accent = towerAccent(this.type.id, branch);

    // 地面部分：阴影、等级光晕、墓石塔座、等级宝石
    ctx.save();
    enterGround(ctx, x, y + 12);
    ctx.translate(x, y);
    // 烛火塔：常亮的灼烧范围（贴地的暖色圈）
    if (this.type.id === 'sunflower') {
      const rgb = candleFlameRgb(branch);
      ctx.fillStyle = `rgba(${rgb},0.05)`;
      ctx.strokeStyle = `rgba(${rgb},0.12)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.range, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    const art: TowerArtState = {
      level: this.level,
      branch,
      fire: f,
      t: this.t,
      mood: this.curMood,
      lean: this.lean,
      pulse: this.pulseT,
    };
    drawTowerPlinth(ctx, this.level, accent, this.t);
    drawTowerGroundLight(ctx, this.type.id, art);
    ctx.restore();

    // 直立部分：塔身按远近整体缩放
    ctx.save();
    enterUpright(ctx, x, y + 12);
    // 待机动作：小跳（向上弹 7px）或左右晃（±0.12 弧度），两者都是 0.6 秒的半个正弦
    const p = this.idleT > 0 ? 1 - this.idleT / IDLE_DUR : 0;
    const hop = this.idleT > 0 && this.idleKind === 'hop' ? Math.sin(p * Math.PI) * 7 : 0;
    const tilt = this.idleT > 0 && this.idleKind === 'wiggle' ? Math.sin(p * Math.PI * 2) * 0.12 : 0;
    ctx.translate(0, -hop);
    ctx.translate(x, y + 12);
    ctx.rotate(tilt);
    const tier = TIER_SCALE[this.level - 1] * (1 + this.popT * 0.22);
    ctx.scale(tier * (1 + f * 0.06), tier * (1 - f * 0.09));
    ctx.translate(0, -12);
    drawTowerArt(ctx, this.type.id, art);
    ctx.restore();

    // 烛火塔灼烧脉冲环
    if (this.pulseT > 0 && this.type.id === 'sunflower') {
      const k = 1 - this.pulseT;
      ctx.save();
      enterGround(ctx, x, y);
      ctx.strokeStyle = `rgba(${candleFlameRgb(branch)},${this.pulseT * 0.5})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, this.range * k, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderRange(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    enterGround(ctx, this.x, this.y);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
