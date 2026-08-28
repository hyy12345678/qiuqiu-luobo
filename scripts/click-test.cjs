const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// 用法: node scripts/click-test.cjs [url]  默认测本地 dist/index.html
const URL = process.argv[2] || 'file://' + require('path').resolve(__dirname, '../dist/index.html');

// 视口 1280x720 => renderer.scale=1 => 设计坐标 == CSS 坐标
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(500);

  // 进入战斗：点第一个关卡卡（level1 已解锁）
  const card = await page.$('.lv-card');
  if (!card) { console.log('FAIL: 找不到关卡卡片'); await browser.close(); process.exit(1); }
  await card.click();
  await sleep(500);

  const inBattle = await page.evaluate(() => !!document.querySelector('.build-bar'));
  console.log(inBattle ? 'PASS: 进入战斗场景' : 'FAIL: 未进入战斗场景');

  // 读取初始金币
  const goldBefore = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip')].map(c => c.textContent);
    const g = chips.find(t => t && t.includes('🪙'));
    return g ? parseInt(g.replace(/[^0-9]/g, ''), 10) : null;
  });
  console.log('初始金币:', goldBefore);

  // 点击可建造格 (col0,row7) => 设计中心 (40,600)
  await page.mouse.click(40, 600);
  await sleep(300);

  // 建造栏是否可见（hidden=false 且有建造按钮）
  const panelState = await page.evaluate(() => {
    const bar = document.querySelector('.build-bar');
    if (!bar) return { exists: false };
    const visible = !bar.hidden && getComputedStyle(bar).display !== 'none';
    const btn = bar.querySelector('button');
    return { exists: true, visible, btnText: btn ? btn.textContent : null };
  });
  console.log('点击草地后建造栏:', JSON.stringify(panelState));
  console.log(panelState.visible ? 'PASS: 点击草地弹出建造面板' : 'FAIL: 点击草地无反应（bug 未修复）');

  let built = false;
  if (panelState.visible) {
    // 点建造按钮
    await page.evaluate(() => {
      const bar = document.querySelector('.build-bar');
      const btn = bar && bar.querySelector('button');
      if (btn) btn.click();
    });
    await sleep(300);
    const goldAfter = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.chip')].map(c => c.textContent);
      const g = chips.find(t => t && t.includes('🪙'));
      return g ? parseInt(g.replace(/[^0-9]/g, ''), 10) : null;
    });
    built = goldBefore != null && goldAfter != null && goldAfter < goldBefore;
    console.log('建塔后金币:', goldAfter, built ? 'PASS: 成功建塔并扣币' : 'FAIL: 建塔未扣币');
  }

  // 负例：点击路面格子不应弹面板。路面拐点 (3,1) 中心 (280,120)
  await page.evaluate(() => { const b=document.querySelector('.build-bar'); if(b){b.hidden=true;} });
  await sleep(100);
  await page.mouse.click(280, 120);
  await sleep(200);
  const roadPanel = await page.evaluate(() => {
    const bar = document.querySelector('.build-bar');
    return bar ? (!bar.hidden && getComputedStyle(bar).display !== 'none') : false;
  });
  console.log(roadPanel ? 'FAIL: 点路面也弹面板（可建造判定异常）' : 'PASS: 点路面不弹面板');

  if (errors.length) console.log('运行时错误:\n' + errors.join('\n'));
  else console.log('无 JS 运行时错误');

  await browser.close();
  const ok = inBattle && panelState.visible && built && !roadPanel && errors.length === 0;
  console.log('\n==== 总判定:', ok ? 'ALL PASS ✅' : 'HAS FAILURE ❌', '====');
  process.exit(ok ? 0 : 1);
})();
