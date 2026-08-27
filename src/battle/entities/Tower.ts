import { DMG_MUL, RANGE_MUL, CD_MUL } from '../../data/towers';
import type { TowerType } from '../../data/towers';
import type { Monster } from './Monster';
import type { Obstacle } from './Obstacle';
import type { CombatTarget } from '../target';
import { Bullet, FanBlade } from './Bullet';
import { audio } from '../../audio/AudioManager';
import type { SfxName } from '../../audio/AudioManager';

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

/** 塔：六种行为 × 三级成长。数值由类型配置乘以等级倍率表得出 */
export class Tower {
  level = 1;
  invested = 0;
  private cooldown = 0;
  private fireAnim = 0;
  private spin = Math.random() * TAU;
  private pulseT = 0;

  constructor(
    public col: number,
    public row: number,
    public x: number,
    public y: number,
    public type: TowerType,
  ) {}

  get damage(): number {
    return this.type.damage * DMG_MUL[this.level - 1];
  }
  get range(): number {
    return this.type.range * RANGE_MUL[this.level - 1];
  }
  get cd(): number {
    return this.type.cooldown * CD_MUL[this.level - 1];
  }

  update(dt: number, ctx: TowerContext): void {
    if (this.fireAnim > 0) this.fireAnim = Math.max(0, this.fireAnim - dt * 4.5);
    if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - dt * 2.2);
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
          slow: { ratio: 0.6, dur: 2 },
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play('shoot_ice');
        break;
      case 'multishot':
        for (const t of combined.slice(0, 3)) {
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
          splash: { radius: 62 + this.level * 8, damage: this.damage * 0.7 },
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play(SHOOT_SFX.rocket);
        break;
      default:
        this.fire(ctx, new Bullet({
          x: this.x, y: this.y - 46, target: primary,
          damage: this.damage, style: 'drop',
          targets: ctx.allTargets, onHit: ctx.onBulletHit,
        }));
        audio.play(SHOOT_SFX.bottle);
    }
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

  /** 射程内走得最远优先 */
  private monstersInRange(monsters: Monster[]): Monster[] {
    const inRange = monsters.filter((m) => {
      if (m.dead) return false;
      return Math.hypot(m.pos.x - this.x, m.pos.y - this.y) <= this.range;
    });
    inRange.sort((a, b) => b.dist - a.dist);
    return inRange;
  }

  /** 没怪时打最近的道具 */
  private obstaclesInRange(obstacles: Obstacle[]): Obstacle[] {
    const inRange = obstacles.filter((o) => {
      if (o.dead) return false;
      return Math.hypot(o.pos.x - this.x, o.pos.y - this.y) <= this.range;
    });
    inRange.sort((a, b) => Math.hypot(a.pos.x - this.x, a.pos.y - this.y) - Math.hypot(b.pos.x - this.x, b.pos.y - this.y));
    return inRange;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    const f = this.fireAnim;

    // 石台（公共底座）
    ctx.fillStyle = '#8a5c33';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 35, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c59a63';
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 31, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dcc08e';
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

    ctx.save();
    ctx.translate(x, y + 12);
    ctx.scale(1 + f * 0.06, 1 - f * 0.09);
    ctx.translate(-x, -(y + 12));

    switch (this.type.id) {
      case 'bottle': this.drawBottle(ctx, f); break;
      case 'frost': this.drawFrost(ctx); break;
      case 'multishot': this.drawMultishot(ctx); break;
      case 'sunflower': this.drawSunflower(ctx); break;
      case 'fan': this.drawFan(ctx); break;
      case 'rocket': this.drawRocket(ctx, f); break;
    }
    ctx.restore();

    // 太阳花灼烧脉冲环
    if (this.pulseT > 0 && this.type.id === 'sunflower') {
      const k = 1 - this.pulseT;
      ctx.strokeStyle = `rgba(255,200,60,${this.pulseT * 0.4})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, this.range * k, 0, TAU);
      ctx.stroke();
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
    const water = ctx.createLinearGradient(0, y - 8, 0, y + 10);
    water.addColorStop(0, '#6fd0f5');
    water.addColorStop(1, '#2f96dd');
    ctx.fillStyle = water;
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
    ctx.fillStyle = '#173a52';
    ctx.beginPath();
    ctx.arc(x - 5.5, y, 1.9, 0, TAU);
    ctx.arc(x + 5.5, y, 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#173a52';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y + 3.5, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
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
    const glow = ctx.createRadialGradient(x, y - 22, 4, x, y - 22, 30);
    glow.addColorStop(0, 'rgba(160,220,255,0.55)');
    glow.addColorStop(1, 'rgba(160,220,255,0)');
    ctx.fillStyle = glow;
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
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5db4e8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
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
    // 握把
    ctx.fillStyle = '#6f4423';
    roundRectLocal(ctx, x - 5, y - 12, 10, 22, 4);
    ctx.fill();
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
    ctx.fillStyle = '#7a4a10';
    ctx.beginPath();
    ctx.arc(x - 4, y - 26, 1.7, 0, TAU);
    ctx.arc(x + 4, y - 26, 1.7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#7a4a10';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y - 23, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
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
    ctx.fillStyle = '#2f6e52';
    ctx.beginPath();
    ctx.arc(x, y - 24, 4.5, 0, TAU);
    ctx.fill();
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
    ctx.restore();
  }

  renderRange(ctx: CanvasRenderingContext2D): void {
    ctx.save();
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
