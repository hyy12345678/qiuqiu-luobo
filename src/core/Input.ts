/** 把 canvas 上的指针事件换算为设计坐标，并识别出「点击」（tap） */
export class Input {
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private handlers: Array<(x: number, y: number) => void> = [];

  constructor(canvas: HTMLCanvasElement, getScale: () => number) {
    canvas.addEventListener('pointerdown', (e) => {
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downT = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (moved > 12 || performance.now() - this.downT > 600) return;
      const rect = canvas.getBoundingClientRect();
      const s = getScale() || 1;
      const x = (e.clientX - rect.left) / s;
      const y = (e.clientY - rect.top) / s;
      for (const h of this.handlers) h(x, y);
    });
  }

  onTap(handler: (x: number, y: number) => void): void {
    this.handlers.push(handler);
  }
}
