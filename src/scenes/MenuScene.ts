import type { Scene } from '../core/SceneManager';
import type { SceneManager } from '../core/SceneManager';
import { DESIGN_W, DESIGN_H } from '../render/Renderer';
import { drawCloud, drawFlower, drawTuft } from '../render/decor';
import { drawPumpkin, drawMonster, MONSTER_SKINS } from '../render/sprites';
import { ALL_LEVELS, selection } from '../data/levels';
import { save } from '../save/SaveManager';
import { audio } from '../audio/AudioManager';
import { t, getLang, setLang } from '../i18n';
import type { Lang } from '../i18n';

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
      <h1>${t('app.title')}</h1>
      <p class="menu-sub">${t('menu.subtitle')}</p>
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
        card.innerHTML = `<span class="num">🔒</span><span class="nm">${t(lv.name)}</span><span class="st">${t('menu.locked', { n: lv.id - 1 })}</span>`;
      } else {
        const stars = save.starOf(lv.id);
        card.innerHTML =
          `<span class="num">${lv.id}</span><span class="nm">${t(lv.name)}</span>` +
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
      t('menu.stars', { n: totalStars, max: ALL_LEVELS.length * 3 });

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

    // 语言切换：按钮显示当前语言名，点击切到另一种语言并重绘菜单
    const lang = document.createElement('button');
    lang.className = 'btn btn-icon menu-lang';
    lang.textContent = t('lang.name');
    lang.addEventListener('click', () => {
      const next: Lang = getLang() === 'en' ? 'zh' : 'en';
      audio.play('click');
      setLang(next);
      this.scenes.reloadCurrent();
    });
    root.appendChild(lang);

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
    sky.addColorStop(0, '#1d1238');
    sky.addColorStop(0.6, '#4a2a5e');
    sky.addColorStop(1, '#e8783a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // 月亮 + 缓慢闪烁的星星
    const moonGlow = ctx.createRadialGradient(1120, 105, 40, 1120, 105, 130);
    moonGlow.addColorStop(0, 'rgba(255,240,190,0.35)');
    moonGlow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(1120, 105, 130, 0, Math.PI * 2);
    ctx.fill();
    const moonGrad = ctx.createRadialGradient(1110, 95, 10, 1120, 105, 60);
    moonGrad.addColorStop(0, '#fffbe8');
    moonGrad.addColorStop(1, '#f2e3a8');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(1120, 105, 55, 0, Math.PI * 2);
    ctx.fill();
    for (const [sx, sy, sr] of [[240, 70, 2], [420, 150, 1.6], [640, 40, 2.2], [880, 170, 1.4], [1020, 40, 1.8]]) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + sx);
      ctx.fillStyle = `rgba(255,250,220,${0.4 + tw * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const c of this.clouds) drawCloud(ctx, c.x, c.y, c.s, c.alpha);

    // ---- 远山（剪影）与草地 ----
    ctx.fillStyle = '#2a1d3d';
    for (const [x, y, r] of [[180, 640, 330], [700, 680, 380], [1180, 650, 320]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const meadow = ctx.createLinearGradient(0, DESIGN_H * 0.62, 0, DESIGN_H);
    meadow.addColorStop(0, '#3e5230');
    meadow.addColorStop(1, '#25331d');
    ctx.fillStyle = meadow;
    ctx.fillRect(0, DESIGN_H * 0.66, DESIGN_W, DESIGN_H * 0.34);

    drawFlower(ctx, 130, 600, 8, '#b388ff', '#fff176');
    drawFlower(ctx, 300, 655, 7, '#ff9f43', '#fff3e0');
    drawFlower(ctx, 1080, 620, 8, '#ffb74d', '#5d2a00');
    drawFlower(ctx, 950, 668, 6, '#b388ff', '#fff176');
    drawTuft(ctx, 220, 640, 12, '#4a6b2c');
    drawTuft(ctx, 420, 690, 14, '#56793a');
    drawTuft(ctx, 850, 645, 11, '#4a6b2c');
    drawTuft(ctx, 1180, 685, 13, '#56793a');

    // ---- 底部角色小剧场（缩小下移，给关卡卡片让位） ----
    const bob = Math.sin(t * 3) * 5;
    drawPumpkin(ctx, DESIGN_W / 2, 600 + bob, 130, 'happy');
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
