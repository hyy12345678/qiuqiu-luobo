import { save } from '../save/SaveManager';
import { en } from './en';
import type { TKey } from './en';
import { zh } from './zh';

export type { TKey } from './en';
export type Lang = 'en' | 'zh';

/** 支持的语言。默认英文，选择结果存在 localStorage（见 SaveManager）。 */
export const LANGS: readonly Lang[] = ['en', 'zh'];
export const DEFAULT_LANG: Lang = 'en';

const dicts: Record<Lang, Record<TKey, string>> = { en, zh };

export function getLang(): Lang {
  return save.lang;
}

/** 切换语言并刷新 HTML 静态文字（调用方负责重绘当前场景） */
export function setLang(lang: Lang): void {
  save.setLang(lang);
  applyStaticText();
}

/**
 * 取当前语言的文案。vars 中的 {name} 占位符会被替换。
 * 例：t('hud.skill', { p: 40 }) → "✨ Ultimate 40%"
 */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s = dicts[getLang()][key];
  if (vars) {
    for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  }
  return s;
}

/**
 * 更新页面里不由 canvas 或场景绘制的文字：<title>、description、
 * 带 data-i18n（纯文本）或 data-i18n-html（允许 <br> 等标签）的节点。
 */
export function applyStaticText(): void {
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  document.title = t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as TKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml as TKey);
  });
}
