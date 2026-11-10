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
  bottle: '#4fc3f7',
  frost: '#90dcff',
  multishot: '#8bc34a',
  sunflower: '#ffca28',
  fan: '#4db6ac',
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

  /** 太阳花：周期灼烧范围内所有目标，无弹道 */
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
    ctx.fillStyle = 'rgba(20,40,10,0.28)';
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
      case 'bottle': this.drawBottle(ctx, f); break;
      case 'frost': this.drawFrost(ctx); break;
      case 'multishot': this.drawMultishot(ctx); break;
      case 'sunflower': this.drawSunflower(ctx); break;
      case 'fan': this.drawFan(ctx); break;
      case 'rocket': this.drawRocket(ctx, f); break;
    }
    if (this.level >= 3) this.drawSparkles(ctx);
    ctx.restore();

    // 太阳花灼烧脉冲环
    if (this.pulseT > 0 && this.type.id === 'sunflower') {
      const k = 1 - this.pulseT;
      ctx.save();
      enterGround(ctx, x, y);
      ctx.strokeStyle = `rgba(255,200,60,${this.pulseT * 0.4})`;
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
    // 分支 B 的星光偏粉，分支 A 偏金
    ctx.fillStyle = this.branch?.key === 'B' ? '#ffc6e6' : '#fff6c2';
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

  private drawBottle(ctx: CanvasRenderingContext2D, f: number): void {
    const { x, y } = this;
    ctx.fillStyle = 'rgba(30,40,60,0.25)';
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
    ctx.fillStyle = 'rgba(214,238,250,0.92)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#5f8fa8';
    ctx.stroke();
    ctx.save();
    glassPath();
    ctx.clip();
    if (!this.waterGrad) {
      const water = ctx.createLinearGradient(0, y - 8, 0, y + 10);
      water.addColorStop(0, '#6fd0f5');
      water.addColorStop(1, '#2f96dd');
      this.waterGrad = water;
    }
    ctx.fillStyle = this.waterGrad;
    ctx.fillRect(x - 18, y - 6, 36, 18);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 16);
    ctx.quadraticCurveTo(x - 13, y - 8, x - 12, y - 2);
    ctx.stroke();
    ctx.fillStyle = '#b07a42';
    ctx.fillRect(x - 7, y - 45 - f * 2, 14, 10);
    ctx.strokeStyle = '#7c4a1e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 7, y - 45 - f * 2, 14, 10);
    drawTowerFace(ctx, x, y + 1, 10, this.curMood);
  }

  private drawFrost(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 冰晶底座
    ctx.fillStyle = '#d9f1ff';
    ctx.strokeStyle = '#7cc4f0';
    ctx.lineWidth = 2;
    for (const [dx, s] of [[-12, 9], [12, 7]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - s, y + 10);
      ctx.lineTo(x + dx, y + 10 - s * 1.6);
      ctx.lineTo(x + dx + s, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 光晕
    if (!this.glowGrad) {
      const glow = ctx.createRadialGradient(x, y - 22, 4, x, y - 22, 30);
      glow.addColorStop(0, 'rgba(160,220,255,0.55)');
      glow.addColorStop(1, 'rgba(160,220,255,0)');
      this.glowGrad = glow;
    }
    ctx.fillStyle = this.glowGrad;
    ctx.beginPath();
    ctx.arc(x, y - 22, 30, 0, TAU);
    ctx.fill();
    // 六角雪花晶体（缓转）
    ctx.save();
    ctx.translate(x, y - 22);
    ctx.rotate(this.spin * 0.35);
    ctx.strokeStyle = '#8fd0f5';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, -19);
      ctx.moveTo(0, -13);
      ctx.lineTo(-5, -17);
      ctx.moveTo(0, -13);
      ctx.lineTo(5, -17);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8f7ff';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5db4e8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // 脸画在雪花中心，不随雪花旋转
    drawTowerFace(ctx, x, y - 22, 9, this.curMood);
  }

  private drawMultishot(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 弓身
    ctx.strokeStyle = '#8a5c33';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - 14, 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // 弦
    ctx.strokeStyle = '#e8dcc8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(Math.PI * 1.15) * 22, y - 14 + Math.sin(Math.PI * 1.15) * 22);
    ctx.lineTo(x + Math.cos(Math.PI * 1.85) * 22, y - 14 + Math.sin(Math.PI * 1.85) * 22);
    ctx.stroke();
    // 三支搭好的箭
    for (const a of [-0.45, 0, 0.45]) {
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.rotate(a);
      ctx.strokeStyle = '#a9743f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -26);
      ctx.stroke();
      ctx.fillStyle = '#c9d4dc';
      ctx.beginPath();
      ctx.moveTo(0, -31);
      ctx.lineTo(-4, -23);
      ctx.lineTo(4, -23);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 握把做成圆木球，上面是脸
    ctx.fillStyle = '#6f4423';
    ctx.beginPath();
    ctx.arc(x, y - 2, 11, 0, TAU);
    ctx.fill();
    drawTowerFace(ctx, x, y - 2, 8, this.curMood);
  }

  private drawSunflower(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 常亮微光
    ctx.fillStyle = 'rgba(255,210,80,0.08)';
    ctx.beginPath();
    ctx.arc(x, y - 8, this.range, 0, TAU);
    ctx.fill();
    // 茎与叶
    ctx.strokeStyle = '#4c9e3a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.quadraticCurveTo(x + 3, y - 4, x, y - 14);
    ctx.stroke();
    ctx.fillStyle = '#63ba4b';
    for (const dx of [-10, 10]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + 2, 8, 3.6, dx > 0 ? 0.5 : -0.5, 0, TAU);
      ctx.fill();
    }
    // 花盘 + 花瓣
    ctx.fillStyle = '#ffb300';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + this.spin * 0.1;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 15, y - 24 + Math.sin(a) * 15, 6.5, 3.8, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(x, y - 24, 11.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e09112';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 笑脸
    drawTowerFace(ctx, x, y - 24, 7, this.curMood);
  }

  private drawFan(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    // 支架
    ctx.strokeStyle = '#54697d';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 10);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + 8, y + 10);
    ctx.stroke();
    // 外罩圈
    ctx.fillStyle = '#e8f4ee';
    ctx.beginPath();
    ctx.arc(x, y - 24, 19, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3f8f6a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 旋转叶片
    ctx.save();
    ctx.translate(x, y - 24);
    ctx.rotate(this.spin * 2);
    ctx.fillStyle = '#57b98a';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath();
      ctx.ellipse(9, 0, 9.5, 4.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 扇叶中心的圆盖上画脸，叶片从脸的外侧转过
    drawTowerFace(ctx, x, y - 24, 9, this.curMood);
  }

  private drawRocket(ctx: CanvasRenderingContext2D, f: number): void {
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
    // 弹体
    ctx.fillStyle = '#eceff1';
    roundRectLocal(ctx, -7, -44, 14, 34, 6);
    ctx.fill();
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // 鼻锥
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    ctx.moveTo(-7, -42);
    ctx.quadraticCurveTo(0, -56, 7, -42);
    ctx.closePath();
    ctx.fill();
    // 尾翼
    ctx.fillStyle = '#ef5350';
    for (const dx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dx * 7, -16);
      ctx.lineTo(dx * 14, -6);
      ctx.lineTo(dx * 7, -10);
      ctx.closePath();
      ctx.fill();
    }
    // 舷窗
    ctx.fillStyle = '#81d4fa';
    ctx.beginPath();
    ctx.arc(0, -32, 3.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#54697d';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 弹体中部画一张小脸
    drawTowerFace(ctx, 0, -20, 6, this.curMood);
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
