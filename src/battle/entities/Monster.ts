import { bus } from '../../core/EventBus';
import type { Path } from '../Path';
import { drawMonster } from '../../render/sprites';
import { roundRectPath } from '../../render/decor';
import type { MonsterType } from '../../data/monsters';
import type { CombatTarget } from '../target';

const TAU = Math.PI * 2;

/** 沿路径行进的怪物 */
export class Monster implements CombatTarget {
  readonly id: number;
  dist = 0;
  hp: number;
  readonly maxHp: number;
  dead = false;
  flash = 0;
  phase = Math.random() * TAU;
  /** 减速剩余时间 / 减速比率 */
  slowT = 0;
  slowRatio = 1;
  /** 受击硬直剩余时间（仅 type.hitStagger 存在时生效） */
  staggerT = 0;
  /** 当前帧位置（update 时刷新，供索敌与子弹使用） */
  pos = { x: 0, y: 0 };
  get radius(): number {
    return this.type.radius;
  }
  private static nextId = 1;

  constructor(
    private path: Path,
    public type: MonsterType,
    hpScale = 1,
  ) {
    this.id = Monster.nextId++;
    this.hp = this.maxHp = Math.round(type.hp * hpScale);
  }

  get angle(): number {
    return this.path.getPos(Math.min(this.dist, this.path.total)).angle;
  }

  update(dt: number): void {
    const slow = this.slowT > 0 ? this.slowRatio : 1;
    const stagger = this.staggerT > 0 && this.type.hitStagger ? this.type.hitStagger.speedMul : 1;
    const effSpeed = this.type.speed * slow * stagger;
    this.dist += effSpeed * dt;
    this.phase += dt * (this.slowT > 0 ? 5 : 9);
    if (this.flash > 0) this.flash -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.staggerT > 0) this.staggerT -= dt;
    this.pos = this.path.getPos(Math.min(this.dist, this.path.total));
    if (this.dist >= this.path.total && !this.dead) {
      this.dead = true;
      bus.emit('monster:escaped', { damage: this.type.damage });
    }
  }

  takeDamage(dmg: number): void {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dead = true;
      bus.emit('monster:killed', {
        bounty: this.type.bounty,
        x: this.pos.x,
        y: this.pos.y,
        radius: this.type.radius,
        blast: this.type.deathBlast,
      });
    } else if (this.type.hitStagger) {
      this.staggerT = this.type.hitStagger.dur;
    }
  }

  applySlow(ratio: number, dur: number): void {
    const resist = this.type.slowResist ?? 0;
    const effective = ratio + (1 - ratio) * resist; // 抗性往 1 方向折算
    this.slowRatio = Math.max(this.slowT > 0 ? this.slowRatio : 1, effective);
    this.slowT = Math.max(this.slowT, dur);
  }

  /** 医生怪的治疗目标接口：返回实际回复量 */
  heal(amount: number): number {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.staggerT > 0 && this.type.hitStagger) {
      // 硬直时沿脚底做轻微压扁，表现受击的沉重感
      const k = this.staggerT / this.type.hitStagger.dur;
      const sq = Math.sin(k * Math.PI) * 0.08;
      const { x, y } = this.pos;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 + sq, 1 - sq);
      ctx.translate(-x, -y);
      this.renderBody(ctx);
      ctx.restore();
    } else {
      this.renderBody(ctx);
    }
  }

  private renderBody(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.pos;
    const r = this.radius;
    drawMonster(ctx, x, y - 4, r, this.type.skin, this.phase, this.angle);

    // 受击白闪
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash / 0.12) * 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.5, r * 1.05, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 冰冻着色
    if (this.slowT > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#8fd4ff';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.45, r * 1.02, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 血条（掉血后才显示）
    if (this.hp < this.maxHp) {
      const pct = Math.max(0, this.hp / this.maxHp);
      const bw = r < 25 ? 36 : 48;
      const bx = x - bw / 2;
      const by = y - r * 2 - 8;
      roundRectPath(ctx, bx - 1, by - 1, bw + 2, 7, 3.5);
      ctx.fillStyle = 'rgba(20,14,6,0.7)';
      ctx.fill();
      ctx.fillStyle = pct > 0.5 ? '#58c94d' : pct > 0.25 ? '#ffcf3f' : '#ff5f4d';
      roundRectPath(ctx, bx, by, bw * pct, 5, 2.5);
      ctx.fill();
    }
  }
}
