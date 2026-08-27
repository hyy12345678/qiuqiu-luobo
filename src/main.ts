import { Renderer } from './render/Renderer';
import { Game } from './core/Game';
import { SceneManager } from './core/SceneManager';
import { Input } from './core/Input';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { audio } from './audio/AudioManager';

function main(): void {
  const stage = document.getElementById('stage') as HTMLElement;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;

  // 移动端浏览器要求手势后才能出声；每次手势都尝试恢复（iOS 锁屏后回来）
  window.addEventListener('pointerdown', () => audio.unlock());
  // 切后台停 BGM 定时器（后台定时器会被节流导致旋律错拍），回前台续上
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopBgm();
    else audio.unlock();
  });

  const renderer = new Renderer(stage, canvas);
  const scenes = new SceneManager(uiRoot);
  const input = new Input(canvas, () => renderer.scale);

  scenes.register(new MenuScene(scenes));
  scenes.register(new BattleScene(scenes));
  scenes.switchTo('menu');

  // canvas 上的点击统一换算成设计坐标后交给当前场景
  input.onTap((x, y) => scenes.current?.onTap?.(x, y));

  const game = new Game(renderer, scenes);
  game.start();
}

main();
