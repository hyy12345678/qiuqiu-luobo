import type { CombatTarget } from '../target';
import { enterUpright } from '../../render/projection';

export type BulletStyle = 'drop' | 'arrow' | 'ice' | 'rocket';

export interface BulletOpts {
  x: number;
  y: number;
  target: CombatTarget;
  damage: number;
  style?: BulletStyle;
  speed?: number;
  /** 命中附带减速（冰冻星） */
  slow?: { ratio: number; dur: number };
  /** 命中范围溅射（火箭） */
  splash?: { radius: number; damage: number };
  /** 溅射候选集合（场景提供） */
  targets?: () => CombatTarget[];
  /** 命中特效回调（场景提供） */
  onHit?: (x: number, y: number, style: BulletStyle) => void;
}

const STYLE_SPEED: Record<BulletStyle, number> = {
  drop: 430,
  arrow: 540,
  ice: 380,
  rocket: 330,
};

/** 追踪弹：飞向目标当前位置；目标死亡则按最后坐标直飞消散 */
export class Bullet {
  dead = false;
  private lastX: number;
  private lastY: number;
  private speed: number;
  private style: BulletStyle;

  constructor(private o: BulletOpts) {
    this.speed = o.speed ?? STYLE_SPEED[o.style ?? 'drop'];
    this.style = o.style ?? 'drop';
    this.lastX = o.target.pos.x;
    this.lastY = o.target.pos.y;
  }

  update(dt: number): void {
    const t = this.o.target;
    if (!t.dead) {
      this.lastX = t.pos.x;
      this.lastY = t.pos.y - t.radius * 0.4;
    }
    const dx = this.lastX - this.o.x;
    const dy = this.lastY - this.o.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step + 4) {
      if (!t.dead) {
        t.takeDamage(this.o.damage);
        if (this.o.slow?.ratio && t.applySlow) t.applySlow(this.o.slow.ratio, this.o.slow.dur);
      }
      // 溅射：以落点为中心波及周围（含障碍物）
      if (this.o.splash && this.o.targets) {
        for (const s of this.o.targets()) {
          if (s === t || s.dead) continue;
          if (Math.hypot(s.pos.x - this.lastX, s.pos.y - this.lastY) <= this.o.splash.radius) {
            s.takeDamage(this.o.splash.damage);
          }
        }
      }
      this.o.onHit?.(this.lastX, this.lastY, this.style);
      this.dead = true;
      return;
    }
    this.o.x += (dx / d) * step;
    this.o.y += (dy / d) * step;
  }

  get x(): number {
    return this.o.x;
  }

  get y(): number {
    return this.o.y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    enterUpright(ctx, this.o.x, this.o.y);
    this.drawAt(ctx);
    ctx.restore();
  }

  private drawAt(ctx: CanvasRenderingContext2D): void {
    const dx = this.lastX - this.o.x;
    const dy = this.lastY - this.o.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;

    switch (this.style) {
      case 'arrow': {
        ctx.strokeStyle = '#7a4b1e';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.o.x - ux * 9, this.o.y - uy * 9);
        ctx.lineTo(this.o.x + ux * 6, this.o.y + uy * 6);
        ctx.stroke();
        ctx.fillStyle = '#c9d4dc';
        ctx.beginPath();
        ctx.arc(this.o.x + ux * 8, this.o.y + uy * 8, 3.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ice': {
        ctx.save();
        ctx.translate(this.o.x, this.o.y);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = '#bfe9ff';
        ctx.strokeStyle = '#5db4e8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-8, 0);
        ctx.lineTo(0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'rocket': {
        // 尾焰
        ctx.strokeStyle = `rgba(255,${140 + Math.random() * 60},40,0.75)`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.o.x, this.o.y);
        ctx.lineTo(this.o.x - ux * 16, this.o.y - uy * 16);
        ctx.stroke();
        // 弹体
        ctx.save();
        ctx.translate(this.o.x, this.o.y);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = '#4a5560';
        roundRectPathLocal(ctx, -9, -4.5, 15, 9, 4);
        ctx.fill();
        ctx.fillStyle = '#ff7043';
        ctx.beginPath();
        ctx.moveTo(6, -4.5);
        ctx.lineTo(12, 0);
        ctx.lineTo(6, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      default: {
        // 水滴
        ctx.strokeStyle = 'rgba(120,200,255,0.45)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.o.x, this.o.y);
        ctx.lineTo(this.o.x - ux * 13, this.o.y - uy * 13);
        ctx.stroke();
        const grad = ctx.createRadialGradient(this.o.x - 2, this.o.y - 2, 1, this.o.x, this.o.y, 6);
        grad.addColorStop(0, '#d6f2ff');
        grad.addColorStop(1, '#3aa7e8');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.o.x, this.o.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function roundRectPathLocal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 风扇塔的穿透风刃：直线飞行，路径上每个目标只吃一次伤害 */
export class FanBlade {
  dead = false;
  private hitSet = new Set<CombatTarget>();
  private travelled = 0;
  private spin = Math.random() * Math.PI;

  constructor(
    public x: number,
    public y: number,
    private angle: number,
    private maxDist: number,
    private damage: number,
    private targets: () => CombatTarget[],
    private onHit?: (x: number, y: number) => void,
  ) {}

  update(dt: number): void {
    const speed = 480;
    const step = speed * dt;
    this.x += Math.cos(this.angle) * step;
    this.y += Math.sin(this.angle) * step;
    this.travelled += step;
    this.spin += dt * 26;
    for (const t of this.targets()) {
      if (t.dead || this.hitSet.has(t)) continue;
      if (Math.hypot(t.pos.x - this.x, t.pos.y - this.y) <= t.radius + 14) {
        this.hitSet.add(t);
        t.takeDamage(this.damage);
      }
    }
    if (this.travelled >= this.maxDist) {
      this.dead = true;
      this.onHit?.(this.x, this.y);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    enterUpright(ctx, this.x, this.y);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    // 三叶风刃
    ctx.fillStyle = 'rgba(160, 230, 190, 0.85)';
    ctx.strokeStyle = '#3f8f6a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.ellipse(10, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#2f6e52';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
