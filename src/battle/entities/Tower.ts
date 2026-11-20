import { DMG_MUL, RANGE_MUL, CD_MUL } from '../../data/towers';
import type { TowerType, BranchDef } from '../../data/towers';
import type { Monster } from './Monster';
import type { Obstacle } from './Obstacle';
import type { CombatTarget } from '../target';
import { Bullet, FanBlade } from './Bullet';
import { audio } from '../../audio/AudioManager';
import type { SfxName } from '../../audio/AudioManager';
import { enterGround, enterUpright } from '../../render/projection';
import { drawTowerFace } from '../../render/sprites';
import type { TowerMood } from '../../render/sprites';

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

/** 三个等级的石台配色：木台 → 青铜台 → 金台 */
const BASE_PALETTE: ReadonlyArray<{ outer: string; mid: string; inner: string; rim: string | null }> = [
  { outer: '#8a5c33', mid: '#c59a63', inner: '#dcc08e', rim: null },
  { outer: '#5f6b73', mid: '#9aa6ad', inner: '#d7dee2', rim: '#c9a24a' },
  { outer: '#9a6b14', mid: '#e0b33a', inner: '#fff0a8', rim: '#ffd54f' },
];
/** 塔身按等级放大（以脚下为锚点，脚始终踩在石台上） */
const TIER_SCALE = [1, 1.14, 1.3];
/** 待机动作的时长（秒） */
const IDLE_DUR = 0.6;
/** 每种塔的属性色，用于 Lv2 起的地面光晕 */
const ACCENT: Record<string, string> = {
  bottle: '#9dff6b',
  frost: '#b388ff',
  multishot: '#8e6cc8',
  sunflower: '#ff9800',
  fan: '#66bb6a',
  rocket: '#ff7043',
};

/** 塔：六种行为 × 三级成长。数值由类型配置乘以等级倍率表得出 */
export class Tower {
  level = 1;
  invested = 0;
  private cooldown = 0;
  /** 索敌结果的复用缓冲区，避免每次索敌新建数组 */
  private monsterBuf: Monster[] = [];
  private obstacleBuf: Obstacle[] = [];
  /** 静态渐变缓存（塔位置固定，每帧重建渐变对象没有必要） */
  private waterGrad: CanvasGradient | null = null;
  private glowGrad: CanvasGradient | null = null;
  private fireAnim = 0;
  private spin = Math.random() * TAU;
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
  /** 等级光晕的渐变缓存，等级变化时重建 */
  private tierGlow: CanvasGradient | null = null;
  private tierGlowLevel = 0;

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
    for (const m of ctx.monsters) {
      if (!m.dead && Math.hypot(m.pos.x - this.x, m.pos.y - this.y) <= this.range) {
        engaged = true;
        break;
      }
    }
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
    this.spin += dt * (5 + this.fireAnim * 18);

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
          x: this.x, y: this.y - 46, target: primary,
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
          x: this.x, y: this.y - 46, target: primary,
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

    // 地面部分：石台与等级小金点
    ctx.save();
    enterGround(ctx, x, y + 12);
    // 接触阴影：塔脚贴地的一圈暗部，让塔“立”在地上
    ctx.fillStyle = 'rgba(20,10,30,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 40, 14, 0, 0, TAU);
    ctx.fill();
    // 等级光晕：Lv2 起在地面铺一圈属性色
    if (this.level >= 2) {
      if (this.tierGlowLevel !== this.level || !this.tierGlow) {
        const alpha = this.level >= 3 ? 0.55 : 0.35;
        const glow = ctx.createRadialGradient(x, y + 14, 6, x, y + 14, 60);
        glow.addColorStop(0, withAlpha(ACCENT[this.type.id] ?? '#ffffff', alpha));
        glow.addColorStop(1, withAlpha(ACCENT[this.type.id] ?? '#ffffff', 0));
        this.tierGlow = glow;
        this.tierGlowLevel = this.level;
      }
      ctx.fillStyle = this.tierGlow;
      ctx.beginPath();
      ctx.arc(x, y + 14, 60, 0, TAU);
      ctx.fill();
    }

    // 石台（公共底座）：配色与金属边随等级变化
    const pal = BASE_PALETTE[this.level - 1];
    ctx.fillStyle = pal.outer;
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 35, 14, 0, 0, TAU);
    ctx.fill();
    if (pal.rim) {
      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 18, 35, 14, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = pal.mid;
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 31, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.inner;
    ctx.beginPath();
    ctx.ellipse(x, y + 11.5, 25, 8, 0, 0, TAU);
    ctx.fill();

    // 等级小金点
    for (let i = 0; i < this.level; i++) {
      const px = x - (this.level - 1) * 5 + i * 10;
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(px, y + 26, 3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a9741a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

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
    ctx.translate(-x, -(y + 12));

    switch (this.type.id) {
      case 'bottle': this.drawPotion(ctx, f); break;
      case 'frost': this.drawWeb(ctx); break;
      case 'multishot': this.drawBatBow(ctx); break;
      case 'sunflower': this.drawCandle(ctx, f); break;
      case 'fan': this.drawBroom(ctx); break;
      case 'rocket': this.drawPumpkinCannon(ctx, f); break;
    }
    if (this.level >= 3) this.drawSparkles(ctx);
    ctx.restore();

    // 烛火塔灼烧脉冲环
    if (this.pulseT > 0 && this.type.id === 'sunflower') {
      const k = 1 - this.pulseT;
      ctx.save();
      enterGround(ctx, x, y);
      ctx.strokeStyle = `rgba(255,150,30,${this.pulseT * 0.45})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, this.range * k, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Lv3 专属：三颗星光绕塔身缓慢旋转并闪烁 */
  private drawSparkles(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 分支 B 的星光偏紫，分支 A 偏金
    ctx.fillStyle = this.branch?.key === 'B' ? '#e0c8ff' : '#fff6c2';
    for (let i = 0; i < 3; i++) {
      const a = this.spin * 0.6 + (i / 3) * TAU;
      const px = x + Math.cos(a) * 28;
      const py = y - 30 + Math.sin(a) * 10;
      const r = 3 + Math.sin(this.spin * 2 + i) * 1;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fill();
    }
  }

  // ---- 六塔造型 ----

  /** 药剂塔：绿色药水瓶，瓶塞是骷髅小头，水里冒泡 */
  private drawPotion(ctx: CanvasRenderingContext2D, f: number): void {
    const { x, y } = this;
    ctx.fillStyle = 'rgba(20,10,30,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 15, 4, 0, 0, TAU);
    ctx.fill();
    const glassPath = (): void => {
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 36);
      ctx.lineTo(x - 6, y - 24);
      ctx.quadraticCurveTo(x - 17, y - 19, x - 17, y - 6);
      ctx.quadraticCurveTo(x - 17, y + 10, x, y + 10);
      ctx.quadraticCurveTo(x + 17, y + 10, x + 17, y - 6);
      ctx.quadraticCurveTo(x + 17, y - 19, x + 6, y - 24);
      ctx.lineTo(x + 6, y - 36);
      ctx.closePath();
    };
    glassPath();
    ctx.fillStyle = 'rgba(228,255,216,0.92)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#3d7a3a';
    ctx.stroke();
    ctx.save();
    glassPath();
    ctx.clip();
    if (!this.waterGrad) {
      const water = ctx.createLinearGradient(0, y - 8, 0, y + 10);
      water.addColorStop(0, '#b6ff7a');
      water.addColorStop(1, '#2e9e3a');
      this.waterGrad = water;
    }
    ctx.fillStyle = this.waterGrad;
    ctx.fillRect(x - 18, y - 6, 36, 18);
    // 冒泡：三个气泡缓慢上浮
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [bx, by, br, ph] of [[-6, 0, 2.2, 0], [4, 4, 1.6, 2], [0, -4, 1.8, 4]] as const) {
      const bob = ((this.spin * 3 + ph) % 6) - 3;
      ctx.beginPath();
      ctx.arc(x + bx, y + by - bob, br, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 16);
    ctx.quadraticCurveTo(x - 13, y - 8, x - 12, y - 2);
    ctx.stroke();
    // 瓶塞：黑色木塞加白色骷髅小头
    ctx.fillStyle = '#2d2433';
    ctx.fillRect(x - 7, y - 45 - f * 2, 14, 10);
    ctx.strokeStyle = '#110b17';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 7, y - 45 - f * 2, 14, 10);
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.arc(x, y - 48 - f * 2, 5, 0, TAU);
    ctx.fill();
    drawTowerFace(ctx, x, y + 1, 10, this.curMood);
  }

  /** 蜘蛛网塔：紫色蛛网缓转，顶上挂着一只小蜘蛛 */
  private drawWeb(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    const cx = x;
    const cy = y - 22;
    // 紫色光晕
    if (!this.glowGrad) {
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 32);
      glow.addColorStop(0, 'rgba(179,136,255,0.55)');
      glow.addColorStop(1, 'rgba(179,136,255,0)');
      this.glowGrad = glow;
    }
    ctx.fillStyle = this.glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, TAU);
    ctx.fill();

    // 蜘蛛丝 + 小蜘蛛（吊在网的上方）
    ctx.strokeStyle = 'rgba(235,230,250,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, y - 56);
    ctx.lineTo(cx, cy - 20);
    ctx.stroke();
    const bob = Math.sin(this.spin * 1.5) * 1.5;
    ctx.fillStyle = '#2d2433';
    ctx.beginPath();
    ctx.ellipse(cx, y - 52 + bob, 4.5, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2d2433';
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      for (const dy of [-3, 1, 4]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 3, y - 52 + bob + dy);
        ctx.lineTo(cx + s * 9, y - 52 + bob + dy + (dy - 1) * 0.6);
        ctx.stroke();
      }
    }

    // 蛛网：径向丝 + 同心环
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.spin * 0.12);
    ctx.strokeStyle = 'rgba(240,236,255,0.92)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.stroke();
    }
    for (const r of [7, 13, 19]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // 网心：深紫底衬一张脸
    ctx.fillStyle = 'rgba(45,27,78,0.88)';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, TAU);
    ctx.fill();
    drawTowerFace(ctx, cx, cy, 8, this.curMood);
  }

  /** 蝙蝠箭塔：黑紫色的弓，三支搭好的箭，弓上方停着一只会扇翅膀的蝙蝠 */
  private drawBatBow(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 弓身
    ctx.strokeStyle = '#2d2433';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - 14, 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // 弦
    ctx.strokeStyle = '#c9b8e8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(Math.PI * 1.15) * 22, y - 14 + Math.sin(Math.PI * 1.15) * 22);
    ctx.lineTo(x + Math.cos(Math.PI * 1.85) * 22, y - 14 + Math.sin(Math.PI * 1.85) * 22);
    ctx.stroke();
    // 三支搭好的箭：骨白箭杆，紫色箭头
    for (const a of [-0.45, 0, 0.45]) {
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.rotate(a);
      ctx.strokeStyle = '#e8dcc8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -26);
      ctx.stroke();
      ctx.fillStyle = '#8e6cc8';
      ctx.beginPath();
      ctx.moveTo(0, -31);
      ctx.lineTo(-4, -23);
      ctx.lineTo(4, -23);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 握把：黑色圆球上是脸
    ctx.fillStyle = '#2d2433';
    ctx.beginPath();
    ctx.arc(x, y - 2, 11, 0, TAU);
    ctx.fill();
    drawTowerFace(ctx, x, y - 2, 8, this.curMood);

    // 蝙蝠：翅膀随 spin 扇动，眼睛是两个小黄点
    const flap = Math.sin(this.spin * 4) * 3;
    const by = y - 52;
    ctx.fillStyle = '#2d2433';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 3, by);
      ctx.quadraticCurveTo(x + side * 10, by - 12, x + side * 17, by - 4 + flap);
      ctx.quadraticCurveTo(x + side * 11, by - 2, x + side * 6, by + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, by, 4.5, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd54f';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * 1.6, by - 1, 0.9, 0, TAU);
      ctx.fill();
    }
  }

  /** 烛火塔：白蜡烛，火焰跳动；蜡烛身上是脸 */
  private drawCandle(ctx: CanvasRenderingContext2D, f: number): void {
    const { x, y } = this;
    // 常亮的暖光圈（范围即灼烧范围）
    ctx.fillStyle = 'rgba(255,150,30,0.07)';
    ctx.beginPath();
    ctx.arc(x, y - 8, this.range, 0, TAU);
    ctx.fill();
    // 烛台底座
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 15, 4.5, 0, 0, TAU);
    ctx.fill();
    // 蜡烛身：略带滴蜡的白色圆角条
    ctx.fillStyle = '#fff3d6';
    ctx.strokeStyle = '#c9a66b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 20);
    ctx.lineTo(x - 9, y + 8);
    ctx.quadraticCurveTo(x, y + 12, x + 9, y + 8);
    ctx.lineTo(x + 9, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.ellipse(x + 6, y - 14, 2.5, 5, 0, 0, TAU);
    ctx.fill();
    // 灯芯
    ctx.strokeStyle = '#2d2433';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y - 24);
    ctx.stroke();
    // 火焰：外层橙、内层黄，随 spin 摇曳，开火时变大
    const flick = Math.sin(this.spin * 3) * 1.5;
    const s = 1 + f * 0.25;
    const flame = (color: string, scale: number): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - 24 - 16 * scale * s + flick);
      ctx.quadraticCurveTo(x + 9 * scale * s, y - 30, x + 6 * scale * s, y - 24);
      ctx.quadraticCurveTo(x, y - 20, x - 6 * scale * s, y - 24);
      ctx.quadraticCurveTo(x - 9 * scale * s, y - 30, x, y - 24 - 16 * scale * s + flick);
      ctx.closePath();
      ctx.fill();
    };
    flame('#ff9800', 1);
    flame('#ffe066', 0.55);
    // 脸画在蜡烛身上
    drawTowerFace(ctx, x, y - 6, 8, this.curMood);
  }

  /** 女巫扫帚：扫帚柄斜插，草编的扫帚头随风摆动，握把处有紫色的绳扣和一顶尖帽 */
  private drawBroom(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 扫帚柄
    ctx.strokeStyle = '#8a5c33';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 50);
    ctx.lineTo(x - 4, y - 6);
    ctx.stroke();
    // 尖帽（扫帚柄顶端）
    ctx.fillStyle = '#2d2433';
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 56);
    ctx.lineTo(x + 18, y - 46);
    ctx.lineTo(x + 14, y - 47);
    ctx.lineTo(x + 2, y - 44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 49);
    ctx.lineTo(x + 14, y - 58);
    ctx.lineTo(x + 20, y - 46);
    ctx.closePath();
    ctx.fill();
    // 扫帚头：草编，随 spin 轻摆
    ctx.save();
    ctx.translate(x - 4, y - 6);
    ctx.rotate(Math.sin(this.spin * 1.2) * 0.08);
    ctx.fillStyle = '#e7c46a';
    ctx.strokeStyle = '#b8912e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-12, 16);
    ctx.quadraticCurveTo(-2, 22, 8, 16);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const k of [-4, -1, 2]) {
      ctx.beginPath();
      ctx.moveTo(k * 0.5, 1);
      ctx.lineTo(k * 2.5 - 4, 15);
      ctx.stroke();
    }
    ctx.restore();
    // 绳扣：紫色圆环，上面是脸
    ctx.fillStyle = '#6b4fa0';
    ctx.beginPath();
    ctx.arc(x + 3, y - 28, 9, 0, TAU);
    ctx.fill();
    drawTowerFace(ctx, x + 3, y - 28, 6, this.curMood);
  }

  /** 南瓜炮：黑色炮管，炮口上方是一颗橙色南瓜，发射时南瓜后坐 */
  private drawPumpkinCannon(ctx: CanvasRenderingContext2D, f: number): void {
    const { x, y } = this;
    const jump = f * 5;
    // 发射时尾部喷焰
    if (f > 0.25) {
      ctx.fillStyle = `rgba(255,${120 + f * 100},50,${f * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 4);
      ctx.lineTo(x, y + 10 + f * 8);
      ctx.lineTo(x + 6, y - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y - jump);
    // 炮管（黑色圆角）与炮口
    ctx.fillStyle = '#2d2433';
    roundRectLocal(ctx, -7, -30, 14, 24, 4);
    ctx.fill();
    ctx.strokeStyle = '#110b17';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#4a3d5c';
    ctx.beginPath();
    ctx.ellipse(0, -30, 8, 3, 0, 0, TAU);
    ctx.fill();
    // 南瓜：渐变橙色球体 + 棱线 + 棕色南瓜蒂
    const grad = ctx.createRadialGradient(-5, -50, 3, 0, -44, 18);
    grad.addColorStop(0, '#ffb347');
    grad.addColorStop(1, '#e8620c');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#a4430a';
    ctx.lineWidth = 1.5;
    for (const dx of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.ellipse(dx * 0.6, -44, 10, 15, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#5b3a1a';
    ctx.fillRect(-2.5, -62, 5, 8);
    // 南瓜脸
    drawTowerFace(ctx, 0, -44, 8, this.curMood);
    ctx.restore();
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

function roundRectLocal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** '#rrggbb' → 'rgba(r,g,b,a)' */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
