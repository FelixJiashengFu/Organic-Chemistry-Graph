// 浏览器验收：在真实的 Chromium 里打开 ../index.html。2D 分步图逐帧核对标题与弯箭头数；3D 动画核对播放 / 暂停、逐幕、
// 时间轴、拖动旋转、键盘、滚动到视野才自动播放、减少动态效果时不自动播放；三种宽度下无横向溢出、深色模式、
// 脚本报错与网络请求（必须为零）；生成 preview.png / preview-mobile.png 与 qa-browser.json。
// 运行：deno run -A source/qa-browser.mjs [--shots 目录]   （或 node …；需要 playwright-core 和本机 Chromium / Chrome / Edge）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { FRAMES } from './mech.js';
import { SCENES } from './mech3d.js';
import { TL } from './render3d.js';

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

async function open(width, height, colorScheme = 'light', reducedMotion = 'no-preference') {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${width}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${width}] pageerror: ${e.message}`));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) online.push(r.url()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__mech && window.__anim3 && document.querySelector('#mxG').childElementCount > 0 && document.querySelector('#s3G').childElementCount > 0);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  return page;
}
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());

// ───────── 2D 分步图 ─────────
const page = await open(1440, 900);
check('2D：阶段标签 6 个、进度点 11 个', (await page.$$eval('#mxPills .pill', l => l.length)) === 6 && (await page.$$eval('#mxDots .dot', l => l.length)) === 11);
const arrowsExpected = [0, 0, 3, 3, 0, 3, 3, 3, 3, 0, 0];
for (let k = 0; k < FRAMES.length; k++) {
  if (k > 0) await page.click('#mxNext');
  const t = await txt(page, '#mxT'), n = await page.$$eval('#mxG path.arrow', l => l.length), c = await txt(page, '#mxCount');
  check(`2D 第 ${k + 1} 帧：标题、弯箭头 ${arrowsExpected[k]} 根、计数`, t === strip(FRAMES[k].t) && n === arrowsExpected[k] && c === `${k + 1} / 11`, `${t}｜箭头 ${n}｜${c}`);
}
await page.click('#mxNext');
check('2D：最后一帧之后回到第 1 帧', (await txt(page, '#mxCount')) === '1 / 11');
await page.click('#mxPills .pill:nth-child(4)');
check('2D：点“②③ 再断两根 C=C”跳到第 6 帧并高亮', (await txt(page, '#mxCount')) === '6 / 11' && (await page.$eval('#mxPills .pill:nth-child(4)', b => b.classList.contains('on'))));
await page.keyboard.press('ArrowRight');
check('2D：键盘 → 翻到第 7 帧', (await txt(page, '#mxCount')) === '7 / 11');
check('2D：图例小弯箭头已画出', (await page.$$eval('#mxLeg path', l => l.length)) === 1);

// ───────── 3D 动画 ─────────
check('3D：首屏在视野外时不自动播放', !(await page.evaluate(() => window.__anim3.playing)));
await page.$eval('#anim-sec', el => el.scrollIntoView());
await page.waitForTimeout(700);
check('3D：滚动到动画区后自动播放', await page.evaluate(() => window.__anim3.playing && window.__anim3.tau > 0.05), await page.evaluate(() => window.__anim3.tau.toFixed(2)));
await page.click('#s3P');
const tPause = await page.evaluate(() => window.__anim3.tau);
await page.waitForTimeout(300);
check('3D：点“暂停”后时间不再前进', !(await page.evaluate(() => window.__anim3.playing)) && Math.abs((await page.evaluate(() => window.__anim3.tau)) - tPause) < 1e-6);
check(`3D：进度点 ${SCENES.length} 个`, (await page.$$eval('#s3D .dot', l => l.length)) === SCENES.length);
for (let i = 0; i < SCENES.length; i++) {
  const s = TL[i];
  await page.evaluate(t => { window.__anim3.tau = t; }, s.t0 + s.prep + s.arr * 0.98);
  const t = await txt(page, '#s3T'), n = await page.$$eval('#s3G polyline.ar3', l => l.length), c = await txt(page, '#s3N');
  check(`3D 第 ${i + 1} 幕：标题、弯箭头 ${SCENES[i].arrows.length} 根、计数`, t === SCENES[i].t && n === SCENES[i].arrows.length && c === `${i + 1} / ${SCENES.length}`, `${t}｜箭头 ${n}｜${c}`);
}
await page.evaluate(() => window.__anim3.go(2, false));
await page.click('#s3F');
check('3D：“下一幕”跳到第 4 幕并播放', (await txt(page, '#s3N')) === `4 / ${SCENES.length}` && (await page.evaluate(() => window.__anim3.playing)));
await page.click('#s3P');
await page.$eval('#s3R', el => { el.value = '20'; el.dispatchEvent(new Event('input')); });
check('3D：拖动时间轴到 20 s，画面跟着跳', Math.abs((await page.evaluate(() => window.__anim3.tau)) - 20) < 0.01);
const box = await (await page.$('#s3S')).boundingBox();
const v0 = await page.evaluate(() => window.__anim3.view);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 6 });
await page.mouse.up();
const v1 = await page.evaluate(() => window.__anim3.view);
check('3D：拖动画面可以旋转（偏航、俯仰角都改变）', v1[0] !== v0[0] && v1[1] !== v0[1], `${v0.map(x => x.toFixed(2))} → ${v1.map(x => x.toFixed(2))}`);
await page.click('#s3V');
check('3D：“复位视角”回到默认视角', JSON.stringify(await page.evaluate(() => window.__anim3.view)) === JSON.stringify([-0.6, 0.42]));
await page.focus('#s3S');
const before = await txt(page, '#s3N');
await page.keyboard.press('ArrowRight');
check('3D：聚焦画面后按 → 切到下一幕（不影响 2D 分步图）', (await txt(page, '#s3N')) !== before && (await txt(page, '#mxCount')) === '7 / 11', `${before} → ${await txt(page, '#s3N')}`);
await page.keyboard.press(' ');
await page.click('[data-sp="2"]');
check('3D：速度按钮可切换（2× 高亮）', await page.$eval('[data-sp="2"]', b => b.classList.contains('on')));
const tocOk = await page.$$eval('.toc a', l => l.every(a => !!document.querySelector(a.getAttribute('href'))));
check('目录锚点全部存在', tocOk);
check('术语表 ≥ 35 条', (await page.$$eval('#glossary tbody tr', l => l.length)) >= 35, await page.$$eval('#glossary tbody tr', l => l.length));
check('来源一节有指向题目原图的链接', !!(await page.$('#sources a[href="./source/problem.png"]')));

// ───────── 减少动态效果 ─────────
const rm = await open(1440, 900, 'light', 'reduce');
await rm.$eval('#anim-sec', el => el.scrollIntoView());
await rm.waitForTimeout(600);
check('系统开启“减少动态效果”时，3D 不自动播放', !(await rm.evaluate(() => window.__anim3.playing)));

// ───────── 版式：三种宽度无横向溢出 ─────────
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = w === 1440 ? page : await open(w, h);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${w}px 页面无横向溢出`, over <= 0, `scrollWidth − innerWidth = ${over}`);
  if (w === 390) {
    const svgW = await p.$eval('#lab .svgwrap svg', s => s.getBoundingClientRect().width);
    check('390px 时 2D 结构图保持 ≥ 560px 宽（框内横向滚动）', svgW >= 559, Math.round(svgW));
    await p.evaluate(() => window.__mech.show(2));
    await p.$eval('#lab-sec', el => el.scrollIntoView());
    await p.screenshot({ path: path.join(root, 'preview-mobile.png'), clip: { x: 0, y: 0, width: 390, height: 844 } });
  }
}

// ───────── 深色模式 ─────────
const dark = await open(1440, 900, 'dark');
const fill = await dark.$eval('#mxG text.t', el => getComputedStyle(el).fill);
check('深色模式下结构式标签为浅色', /rgb\((2[0-9]{2}), (2[0-9]{2}), (2[0-9]{2})\)/.test(fill), fill);
await dark.evaluate(() => { window.__anim3.go(0, false); window.__anim3.tau = 3.4; });
await dark.$eval('#anim-sec', el => el.scrollIntoView());
await dark.screenshot({ path: path.join(shotsDir, 'dark-3d-cycloaddition.png') });

// ───────── 预览图与截图 ─────────
await page.setViewportSize({ width: 1200, height: 760 });
await page.evaluate(() => { window.__mech.show(2); document.querySelector('#lab-sec').scrollIntoView(); });
await page.screenshot({ path: path.join(root, 'preview.png') });
for (const k of [0, 2, 3, 5, 7, 8, 10]) {
  await page.evaluate(i => window.__mech.show(i), k);
  await (await page.$('#lab')).screenshot({ path: path.join(shotsDir, `frame-${String(k + 1).padStart(2, '0')}.png`) });
}
for (const i of [0, 2, 6, 7, 8]) {
  const s = TL[i];
  await page.evaluate(t => { window.__anim3.tau = t; }, s.t0 + s.prep + s.arr * 0.98);
  await (await page.$('#anim')).screenshot({ path: path.join(shotsDir, `scene-${i + 1}.png`) });
}

check('无脚本报错', errors.length === 0, errors.join(' | '));
check('零网络请求（页面完全离线）', online.length === 0, online.join(' | '));
await browser.close();

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'ruo4-phenyl-to-cooh', engine, generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(root, 'qa-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过（${engine}）`);
if (passed !== checks.length) process.exit(1);
