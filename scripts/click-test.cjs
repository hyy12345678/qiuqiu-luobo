const puppeteer = require('puppeteer-core');

// Chrome 可执行文件：优先读取 CHROME_PATH 环境变量，否则按系统使用常见安装路径
const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}[process.platform];
const CHROME = process.env.CHROME_PATH || DEFAULT_CHROME;
if (!CHROME || !require('fs').existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME || '(未知平台)'}\n请设置环境变量 CHROME_PATH 指向 Chrome 可执行文件。`);
  process.exit(2);
}
// 用法: node scripts/click-test.cjs [url]  默认测本地 dist/index.html
const URL = process.argv[2] || 'file://' + require('path').resolve(__dirname, '../dist/index.html');
const SAVE_KEY = 'qqlb-save-v1';

// 视口 1280x720 => renderer.scale=1 => 设计坐标 == CSS 坐标
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 与 src/render/projection.ts 保持一致的伪 3D 投影：把平面设计坐标换算成屏幕上要点击的位置。
// 页面加 ?flat 时投影为恒等变换，本函数结果需同步改为 (x, y)。
function proj(x, y) {
  const s = 0.7 + 0.3 * (y / 720);
  return [640 + (x - 640) * s, 216 + 0.7 * y];
}

function attachErrors(page, list) {
  page.on('pageerror', e => list.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') list.push('console: ' + m.text()); });
}

async function readGold(page) {
  return page.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip')].map(c => c.textContent);
    const g = chips.find(t => t && t.includes('🪙'));
    return g ? parseInt(g.replace(/[^0-9]/g, ''), 10) : null;
  });
}

async function towerLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll('.build-bar .btn-tower')].map(b => b.textContent));
}

async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle((sel, t) => {
    return [...document.querySelectorAll(sel)].find(b => b.textContent.includes(t)) || null;
  }, selector, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click(); // 真实指针事件，验证按钮没有被遮罩挡住
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,720'],
  });

  // ---------- 场景一：全新存档，第 1 关只能建药剂塔 ----------
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument((key) => {
    localStorage.setItem(key, JSON.stringify({ stars: {}, muted: false, lang: 'zh' }));
  }, SAVE_KEY);
  const errors = [];
  attachErrors(page, errors);

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(500);

  const card = await page.$('.lv-card');
  if (!card) { console.log('FAIL: 找不到关卡卡片'); await browser.close(); process.exit(1); }
  await card.click();
  await sleep(500);

  const inBattle = await page.evaluate(() => !!document.querySelector('.build-bar'));
  console.log(inBattle ? 'PASS: 进入战斗场景' : 'FAIL: 未进入战斗场景');

  const goldBefore = await readGold(page);
  console.log('初始金币:', goldBefore);

  // 点击可建造格 (col0,row7) => 设计中心 (40,600)，屏幕位置经投影换算
  await page.mouse.click(...proj(40, 600));
  await sleep(300);

  const panelState = await page.evaluate(() => {
    const bar = document.querySelector('.build-bar');
    if (!bar) return { exists: false };
    const visible = !bar.hidden && getComputedStyle(bar).display !== 'none';
    return { exists: true, visible };
  });
  console.log('点击草地后建造栏:', JSON.stringify(panelState));
  console.log(panelState.visible ? 'PASS: 点击草地弹出建造面板' : 'FAIL: 点击草地无反应');

  const labels1 = await towerLabels(page);
  const onlyBottle = labels1.length === 1 && labels1[0].includes('药剂塔');
  console.log('第 1 关可选塔:', JSON.stringify(labels1));
  console.log(onlyBottle ? 'PASS: 第 1 关只显示药剂塔' : 'FAIL: 第 1 关可选塔不是仅药剂塔');

  let built = false;
  if (panelState.visible) {
    const clicked = await clickByText(page, '.build-bar button', '✔ 建造');
    await sleep(300);
    const goldAfter = await readGold(page);
    built = clicked && goldBefore != null && goldAfter != null && goldAfter === goldBefore - 100;
    console.log('建塔后金币:', goldAfter, built ? 'PASS: 成功建塔并扣币' : 'FAIL: 建塔未扣币');
  }

  // 负例：点击路面格子不应弹面板。路面拐点 (3,1) 中心 (280,120)
  await page.evaluate(() => { const b = document.querySelector('.build-bar'); if (b) b.hidden = true; });
  await sleep(100);
  await page.mouse.click(...proj(280, 120));
  await sleep(200);
  const roadPanel = await page.evaluate(() => {
    const bar = document.querySelector('.build-bar');
    return bar ? (!bar.hidden && getComputedStyle(bar).display !== 'none') : false;
  });
  console.log(roadPanel ? 'FAIL: 点路面也弹面板（可建造判定异常）' : 'PASS: 点路面不弹面板');

  // ---------- 场景二：已通关第 1 关，第 2 关解锁蜘蛛网与多重箭 ----------
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1280, height: 720 });
  const errors2 = [];
  attachErrors(page2, errors2);
  await page2.evaluateOnNewDocument((key) => {
    localStorage.setItem(key, JSON.stringify({ stars: { 1: 1 }, muted: true, lang: 'zh' }));
  }, SAVE_KEY);
  await page2.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(500);

  const cards2 = await page2.$$('.lv-card');
  const lv2Unlocked = cards2.length >= 2 && !(await page2.evaluate(el => el.disabled, cards2[1]));
  console.log(lv2Unlocked ? 'PASS: 通关第 1 关后第 2 关已解锁' : 'FAIL: 第 2 关仍锁定');
  let frostBuilt = false;
  if (lv2Unlocked) {
    await cards2[1].click();
    await sleep(500);
    await page2.mouse.click(...proj(40, 680)); // (0,8) 第 2 关可建、无障碍
    await sleep(300);

    const labels2 = await towerLabels(page2);
    const hasFrost = labels2.some(t => t.includes('蜘蛛网'));
    const noLocked = !labels2.some(t => t.includes('南瓜炮') || t.includes('烛火塔') || t.includes('女巫扫帚'));
    console.log('第 2 关可选塔:', JSON.stringify(labels2));
    console.log(hasFrost && noLocked ? 'PASS: 第 2 关显示蜘蛛网且未解锁的塔不可见' : 'FAIL: 第 2 关塔种列表不正确');

    const goldBefore2 = await readGold(page2);
    const selected = await clickByText(page2, '.build-bar button', '蜘蛛网');
    await sleep(150);
    const confirmText = await page2.evaluate(() => {
      const b = [...document.querySelectorAll('.build-bar button')].find(x => x.textContent.startsWith('✔ 建造'));
      return b ? b.textContent : null;
    });
    console.log('选中蜘蛛网后确认按钮:', confirmText);
    const confirmed = await clickByText(page2, '.build-bar button', '✔ 建造');
    await sleep(300);
    const goldAfter2 = await readGold(page2);
    frostBuilt = selected && confirmed && confirmText && confirmText.includes('140') &&
      goldBefore2 != null && goldAfter2 === goldBefore2 - 140;
    console.log('建蜘蛛网后金币:', goldAfter2, frostBuilt ? 'PASS: 选择蜘蛛网并建造，扣 140' : 'FAIL: 蜘蛛网建造失败或扣费错误');
  }

  if (errors.length) console.log('运行时错误（场景一）:\n' + errors.join('\n'));
  if (errors2.length) console.log('运行时错误（场景二）:\n' + errors2.join('\n'));
  if (!errors.length && !errors2.length) console.log('无 JS 运行时错误');

  await browser.close();
  const ok = inBattle && panelState.visible && onlyBottle && built && !roadPanel &&
    lv2Unlocked && frostBuilt && errors.length === 0 && errors2.length === 0;
  console.log('\n==== 总判定:', ok ? 'ALL PASS ✅' : 'HAS FAILURE ❌', '====');
  process.exit(ok ? 0 : 1);
})();
