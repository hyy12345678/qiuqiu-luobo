import { DESIGN_W, DESIGN_H, Renderer } from '../render/Renderer';
import { roundRectPath } from '../render/decor';
import { settings } from './settings';
import { bus } from './EventBus';

export class Game {
  /** 固定步长：60Hz */
  static readonly STEP = 1 / 60;
  /** 单帧最多补的步数，防止切后台回来后螺旋追赶 */
  private static readonly MAX_STEPS = 12;
  /** 用 ?debug 打开 FPS 标签（如 http://localhost:5173/?debug） */
  private static readonly SHOW_FPS =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

  private rafId = 0;
  private lastT = -1;
  private acc = 0;
  private fpsFrames = 0;
  private fpsTimeMs = 0;
  private fps = 0;

  constructor(private renderer: Renderer, private scenes: SceneManagerLike) {
    // 切后台时通知场景自动暂停（战斗防暴毙、省电）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) bus.emit('app:paused');
    });
  }

  start(): void {
    cancelAnimationFrame(this.rafId);
    this.lastT = -1;
    const loop = (t: number): void => {
      this.rafId = requestAnimationFrame(loop);
      this.tick(t);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private tick(t: number): void {
    if (this.lastT < 0) {
      this.lastT = t;
      return;
    }
    let dtMs = t - this.lastT;
    this.lastT = t;
    if (dtMs > 250) dtMs = 250;

    this.fpsFrames++;
    this.fpsTimeMs += dtMs;
    if (this.fpsTimeMs >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsTimeMs);
      this.fpsFrames = 0;
      this.fpsTimeMs = 0;
    }

    const scene = this.scenes.current;
    if (scene && !settings.paused) {
      this.acc += (dtMs / 1000) * settings.speed;
      let steps = 0;
      while (this.acc >= Game.STEP && steps < Game.MAX_STEPS) {
        scene.update(Game.STEP);
        this.acc -= Game.STEP;
        steps++;
      }
      if (steps === Game.MAX_STEPS && this.acc > Game.STEP) this.acc = 0;
    }

    const ctx = this.renderer.beginFrame();
    ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
    scene?.render(ctx);

    if (Game.SHOW_FPS) this.drawFpsBadge(ctx);
  }

  /** 调试用 FPS 标签：仅在 URL 带 ?debug 时显示，正式版本不出现 */
  private drawFpsBadge(ctx: CanvasRenderingContext2D): void {
    const label = `FPS ${this.fps}`;
    ctx.font = 'bold 16px system-ui, sans-serif';
    const lw = ctx.measureText(label).width;
    roundRectPath(ctx, 12, 10, lw + 22, 28, 14);
    ctx.fillStyle = 'rgba(20, 26, 18, 0.5)';
    ctx.fill();
    ctx.fillStyle = '#eaffea';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 23, 25);
    ctx.textBaseline = 'alphabetic';
  }
}

interface SceneManagerLike {
  current: { update(dt: number): void; render(ctx: CanvasRenderingContext2D): void } | null;
}
