// 浏览器验收：在真实的 Chromium 里打开 ../index.html，逐帧翻页核对标题与弯箭头数，检查阶段标签、键盘翻页、
// 三种宽度下的横向溢出、浅色 / 深色、脚本报错与网络请求（必须为零），并生成 preview.png / preview-mobile.png 与 qa-browser.json。
// 运行：deno run -A source/qa-browser.mjs [--shots 目录]   （或 node …；需要 playwright-core 和本机 Chromium / Chrome / Edge）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { FRAMES } from './mech.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const shotsDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : path.join(root, 'qa');
fs.mkdirSync(shotsDir, { recursive: true });

async function launch() {
  const home = process.env.LOCALAPPDATA || '';
  const pw = path.join(home, 'ms-playwright');
  const candidates = [
    process.env.CHROMIUM_PATH,
    ...(fs.existsSync(pw) ? fs.readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell-')).map(d => path.join(pw, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')) : []),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(p => p && fs.existsSync(p));
  for (const executablePath of candidates) { try { return [await chromium.launch({ executablePath }), path.basename(executablePath)]; } catch { /* 换下一个 */ } }
  for (const channel of ['msedge', 'chrome']) { try { return [await chromium.launch({ channel }), channel]; } catch { /* 换下一个 */ } }
  return [await chromium.launch(), 'playwright 默认'];
}

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });
const [browser, engine] = await launch();
const errors = [], online = [];
const strip = s => s.replace(/<[^>]+>/g, '');

async function open(width, height, colorScheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${width}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${width}] pageerror: ${e.message}`));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) online.push(r.url()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__mech && document.querySelector('#mxG').childElementCount > 0);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  return page;
}
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());
const arrows = page => page.$$eval('#mxG path.arrow', l => l.length);

// ───────── 功能 ─────────
const page = await open(1440, 900);
check('阶段标签 5 个、进度点 11 个', (await page.$$eval('#mxPills .pill', l => l.length)) === 5 && (await page.$$eval('#mxDots .dot', l => l.length)) === 11);
const arrowsExpected = [0, 0, 2, 0, 3, 3, 2, 2, 3, 4, 0];
for (let k = 0; k < FRAMES.length; k++) {
  if (k > 0) await page.click('#mxNext');
  const t = await txt(page, '#mxT'), n = await arrows(page), c = await txt(page, '#mxCount');
  const shapes = await page.$$eval('#mxG *', l => l.length);
  check(`第 ${k + 1} 帧：标题、弯箭头 ${arrowsExpected[k]} 根、计数`, t === strip(FRAMES[k].t) && n === arrowsExpected[k] && c === `${k + 1} / 11` && shapes > 40, `${t}｜箭头 ${n}｜${c}｜图元 ${shapes}`);
}
await page.click('#mxNext');
check('最后一帧之后回到第 1 帧', (await txt(page, '#mxCount')) === '1 / 11');
await page.click('#mxPrev');
check('第 1 帧按“上一步”跳到最后一帧', (await txt(page, '#mxCount')) === '11 / 11');
await page.click('#mxPills .pill:nth-child(3)');
check('点“② 烯醇醚水解”跳到第 6 帧，该标签高亮', (await txt(page, '#mxCount')) === '6 / 11' && (await page.$eval('#mxPills .pill:nth-child(3)', b => b.classList.contains('on'))));
await page.keyboard.press('ArrowRight');
check('键盘 → 翻到第 7 帧', (await txt(page, '#mxCount')) === '7 / 11');
await page.keyboard.press('ArrowLeft');
check('键盘 ← 回到第 6 帧', (await txt(page, '#mxCount')) === '6 / 11');
await page.click('#mxDots .dot:nth-child(9)');
check('点第 9 个进度点跳到脱羧帧', (await txt(page, '#mxT')).includes('脱羧') && (await arrows(page)) === 3);
check('图例小弯箭头已画出', (await page.$$eval('#mxLeg path', l => l.length)) === 1);
const tocOk = await page.$$eval('.toc a', l => l.every(a => !!document.querySelector(a.getAttribute('href'))));
check('目录锚点全部存在', tocOk);
check('术语表 ≥ 35 条', (await page.$$eval('#glossary tbody tr', l => l.length)) >= 35, await page.$$eval('#glossary tbody tr', l => l.length));

// ───────── 版式：三种宽度无横向溢出 ─────────
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = w === 1440 ? page : await open(w, h);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${w}px 页面无横向溢出`, over <= 0, `scrollWidth − innerWidth = ${over}`);
  if (w === 390) {
    const svgW = await p.$eval('.svgwrap svg', s => s.getBoundingClientRect().width);
    check('390px 时结构图保持 ≥ 560px 宽（在框内横向滚动，字不会缩到看不清）', svgW >= 559, Math.round(svgW));
    await p.evaluate(() => window.__mech.show(8));
    await p.screenshot({ path: path.join(root, 'preview-mobile.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
  }
}

// ───────── 深色模式：文字颜色跟随主题 ─────────
const dark = await open(1440, 900, 'dark');
const fill = await dark.$eval('#mxG text.t', el => getComputedStyle(el).fill);
check('深色模式下原子标签为浅色', /rgb\((2[0-9]{2}), (2[0-9]{2}), (2[0-9]{2})\)/.test(fill), fill);
await dark.evaluate(() => window.__mech.show(8));
await dark.$eval('#lab-sec', el => el.scrollIntoView());
await dark.screenshot({ path: path.join(shotsDir, 'dark-decarboxylation.png') });

// ───────── 预览图 ─────────
await page.setViewportSize({ width: 1200, height: 760 });
await page.evaluate(() => { window.__mech.show(0); document.querySelector('#lab-sec').scrollIntoView(); });
await page.screenshot({ path: path.join(root, 'preview.png') });
for (const k of [0, 2, 4, 5, 8, 9, 10]) {
  await page.evaluate(i => window.__mech.show(i), k);
  const box = await page.$('#lab');
  await box.screenshot({ path: path.join(shotsDir, `frame-${String(k + 1).padStart(2, '0')}.png`) });
}

check('无脚本报错', errors.length === 0, errors.join(' | '));
check('零网络请求（页面完全离线）', online.length === 0, online.join(' | '));
await browser.close();

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'birch-anisic-acid-steps', engine, generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(root, 'qa-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过（${engine}）`);
if (passed !== checks.length) process.exit(1);
