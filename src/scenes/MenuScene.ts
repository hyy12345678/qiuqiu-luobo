import type { Scene } from '../core/SceneManager';
import type { SceneManager } from '../core/SceneManager';
import { DESIGN_W, DESIGN_H } from '../render/Renderer';
import { drawCloud, drawFlower, drawTuft } from '../render/decor';
import { drawCarrot, drawMonster, MONSTER_SKINS } from '../render/sprites';
import { ALL_LEVELS, selection } from '../data/levels';
import { save } from '../save/SaveManager';
import { audio } from '../audio/AudioManager';

interface CloudDef {
  x: number;
  y: number;
  s: number;
  v: number;
  alpha: number;
}

/** 主菜单 / 选关界面：手绘场景 + 五关卡片（星级显示与解锁状态） */
export class MenuScene implements Scene {
  readonly name = 'menu';
  private t = 0;
  private clouds: CloudDef[] = [];

  constructor(private scenes: SceneManager) {}

  enter(): void {
    this.t = 0;
    this.clouds = [
      { x: 150, y: 95, s: 42, v: 12, alpha: 0.9 },
      { x: 520, y: 60, s: 30, v: 18, alpha: 0.75 },
      { x: 860, y: 130, s: 50, v: 9, alpha: 0.85 },
      { x: 1150, y: 70, s: 26, v: 22, alpha: 0.7 },
    ];

    const root = document.createElement('div');
    root.className = 'menu';
    root.innerHTML = `
      <h1>球球萝卜</h1>
      <p class="menu-sub">保卫萝卜式 H5 塔防 · 选择关卡开始冒险</p>
      <div class="lv-row"></div>
      <p class="tip menu-total"></p>
    `;
    const row = root.querySelector('.lv-row') as HTMLElement;
    for (const lv of ALL_LEVELS) {
      const card = document.createElement('button');
      card.className = 'lv-card';
      const unlocked = save.isUnlocked(lv.id);
      if (!unlocked) {
        card.disabled = true;
        card.innerHTML = `<span class="num">🔒</span><span class="nm">${lv.name}</span><span class="st">通关上一关解锁</span>`;
      } else {
        const stars = save.starOf(lv.id);
        card.innerHTML =
          `<span class="num">${lv.id}</span><span class="nm">${lv.name}</span>` +
          `<span class="st">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
        card.addEventListener('click', () => {
          selection.current = lv;
          audio.play('click');
          this.scenes.switchTo('battle');
        });
      }
      row.appendChild(card);
    }
    const totalStars = ALL_LEVELS.reduce((n, l) => n + save.starOf(l.id), 0);
    (root.querySelector('.menu-total') as HTMLElement).textContent =
      `已收集 ⭐${totalStars} / ${ALL_LEVELS.length * 3} · 首次进入请点一下屏幕开启声音`;

    // 右上角静音开关
    const mute = document.createElement('button');
    mute.className = 'btn btn-icon menu-mute';
    mute.textContent = save.muted ? '🔇' : '🔊';
    mute.addEventListener('click', () => {
      save.setMuted(!save.muted);
      mute.textContent = save.muted ? '🔇' : '🔊';
      if (!save.muted) audio.play('click');
    });
    root.appendChild(mute);

    this.scenes.uiRoot.appendChild(root);
  }

  exit(): void {}

  update(dt: number): void {
    this.t += dt;
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.s * 2 > DESIGN_W) c.x = -c.s * 2.5;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.t;

    // ---- 天空 ----
    const sky = ctx.createLinearGradient(0, 0, 0, DESIGN_H * 0.72);
    sky.addColorStop(0, '#8fdcff');
    sky.addColorStop(1, '#e6f8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // 太阳 + 缓转的光芒
    ctx.save();
    ctx.translate(1120, 105);
    ctx.rotate(t * 0.15);
    ctx.fillStyle = 'rgba(255,225,120,0.5)';
    for (let i = 0; i < 10; i++) {
      ctx.rotate((Math.PI * 2) / 10);
      ctx.beginPath();
      ctx.moveTo(0, -62);
      ctx.lineTo(13, -92);
      ctx.lineTo(-13, -92);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const sunGrad = ctx.createRadialGradient(1120, 105, 10, 1120, 105, 60);
    sunGrad.addColorStop(0, '#fff3b8');
    sunGrad.addColorStop(1, '#ffd94d');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(1120, 105, 55, 0, Math.PI * 2);
    ctx.fill();

    for (const c of this.clouds) drawCloud(ctx, c.x, c.y, c.s, c.alpha);

    // ---- 远山与草地 ----
    ctx.fillStyle = '#79c857';
    for (const [x, y, r] of [[180, 640, 330], [700, 680, 380], [1180, 650, 320]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const meadow = ctx.createLinearGradient(0, DESIGN_H * 0.62, 0, DESIGN_H);
    meadow.addColorStop(0, '#93da63');
    meadow.addColorStop(1, '#74bd45');
    ctx.fillStyle = meadow;
    ctx.fillRect(0, DESIGN_H * 0.66, DESIGN_W, DESIGN_H * 0.34);

    drawFlower(ctx, 130, 600, 8, '#ffffff', '#ffca28');
    drawFlower(ctx, 300, 655, 7, '#ff8fb1', '#ffffff');
    drawFlower(ctx, 1080, 620, 8, '#ffd54f', '#f57f17');
    drawFlower(ctx, 950, 668, 6, '#ffffff', '#ff7043');
    drawTuft(ctx, 220, 640, 12, '#5fae38');
    drawTuft(ctx, 420, 690, 14, '#71c046');
    drawTuft(ctx, 850, 645, 11, '#5fae38');
    drawTuft(ctx, 1180, 685, 13, '#71c046');

    // ---- 底部角色小剧场（缩小下移，给关卡卡片让位） ----
    const bob = Math.sin(t * 3) * 5;
    drawCarrot(ctx, DESIGN_W / 2, 600 + bob, 130, 'happy');
    drawMonster(ctx, DESIGN_W / 2 - 110, 615, 21, MONSTER_SKINS[0], t * 7, 0.35);
    drawMonster(ctx, DESIGN_W / 2 + 110, 618, 21, MONSTER_SKINS[2], t * 7 + Math.PI, -0.35);

    // 底部暗角收边
    const vig = ctx.createLinearGradient(0, DESIGN_H * 0.85, 0, DESIGN_H);
    vig.addColorStop(0, 'rgba(20,50,15,0)');
    vig.addColorStop(1, 'rgba(20,50,15,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, DESIGN_H * 0.85, DESIGN_W, DESIGN_H * 0.15);
  }
}
