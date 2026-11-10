import type { CombatTarget } from '../target';
import type { ObstacleKind } from '../../data/obstacles';
import { drawChest, drawCrate, drawRock } from '../../render/sprites';
import { enterUpright } from '../../render/projection';

const TAU = Math.PI * 2;

/** 地图道具障碍：占建造位，可被塔打碎换金币 */
export class Obstacle implements CombatTarget {
  hp: number;
  readonly maxHp: number;
  dead = false;
  flash = 0;
  radius = 28;
  pos: { x: number; y: number };

  constructor(
    public col: number,
    public row: number,
    public kind: ObstacleKind,
    hp: number,
    cellCenter: { x: number; y: number },
  ) {
    this.hp = this.maxHp = hp;
    this.pos = cellCenter;
  }

  takeDamage(dmg: number): void {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) this.dead = true;
  }

  get depthY(): number {
    return this.pos.y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    enterUpright(ctx, this.pos.x, this.pos.y);
    this.drawSprite(ctx);
    ctx.restore();
  }

  private drawSprite(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.pos;
    if (this.kind === 'chest') drawChest(ctx, x, y);
    else if (this.kind === 'crate') drawCrate(ctx, x, y);
    else drawRock(ctx, x, y);

    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash / 0.12) * 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y - 6, 32, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.hp < this.maxHp) {
      const pct = Math.max(0, this.hp / this.maxHp);
      const bw = 44;
      const bx = x - bw / 2;
      const by = y - 44;
      ctx.fillStyle = 'rgba(20,14,6,0.7)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
      ctx.fillStyle = '#ffc94d';
      ctx.fillRect(bx, by, bw * pct, 6);
    }
  }
}
