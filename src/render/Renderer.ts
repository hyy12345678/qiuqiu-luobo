export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/**
 * 负责把 1280×720 的设计分辨率等比缩放居中到窗口（letterbox），
 * 并处理高分屏清晰度。所有游戏代码只使用设计坐标。
 */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  /** 设计坐标 → 屏幕 CSS 像素的缩放比 */
  scale = 1;
  readonly width = DESIGN_W;
  readonly height = DESIGN_H;
  private dpr = 1;

  constructor(private stage: HTMLElement, private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private resize(): void {
    const vw = window.innerWidth || DESIGN_W;
    const vh = window.innerHeight || DESIGN_H;
    this.scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    const cssW = Math.max(1, Math.floor(DESIGN_W * this.scale));
    const cssH = Math.max(1, Math.floor(DESIGN_H * this.scale));
    // 封顶 2x：控制低端机填充率，卡通画风肉眼无差
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // stage 尺寸决定 DOM UI 层的位置；UI 用 em 布局跟随缩放
    this.stage.style.width = `${cssW}px`;
    this.stage.style.height = `${cssH}px`;
    this.stage.style.fontSize = `${(16 * this.scale).toFixed(2)}px`;

    // 物理像素按 dpr 放大，避免高分屏发虚
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
  }

  /** 每帧绘制前调用：建立设计坐标 → 设备像素的变换 */
  beginFrame(): CanvasRenderingContext2D {
    const k = this.scale * this.dpr;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    return this.ctx;
  }
}
