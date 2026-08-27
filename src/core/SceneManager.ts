/** 场景接口：一个场景 = 一块 canvas 绘制内容 + 可选的 DOM UI 层 */
export interface Scene {
  readonly name: string;
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onTap?(x: number, y: number): void;
}

export class SceneManager {
  current: Scene | null = null;
  private scenes = new Map<string, Scene>();

  constructor(public uiRoot: HTMLElement) {}

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  switchTo(name: string): void {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`未知场景: ${name}`);
    if (this.current === next) return;
    this.current?.exit();
    this.uiRoot.innerHTML = '';
    this.current = next;
    next.enter();
  }

  /** 重开当前场景（再玩一局） */
  reloadCurrent(): void {
    if (!this.current) return;
    this.current.exit();
    this.uiRoot.innerHTML = '';
    this.current.enter();
  }
}
