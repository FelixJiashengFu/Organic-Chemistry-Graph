// 浏览器验收：在真实的 Chromium 里打开 ../index.html，检查播放 / 暂停 / 下一步 / 重播 / 进度条 / 阶段标签 / 键盘，
// 滚到动画区时自动播放、减少动态效果时直接跳到结果、三种宽度无横向溢出、深色模式、脚本报错与网络请求（必须为零），
// 并生成 preview.png / preview-mobile.png 与 qa-browser.json。
// 运行：deno run -A source/qa-browser.mjs [--shots 目录]   （或 node …；需要 playwright-core 和本机 Chromium / Chrome / Edge）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

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

async function open(width, height, { colorScheme = 'light', reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${width}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${width}] pageerror: ${e.message}`));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) online.push(r.url()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__anim && document.querySelector('#maG').childElementCount > 0);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  return page;
}
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim());
const tau = page => page.evaluate(() => window.__anim.tau);
const arrows = page => page.$$eval('#maG path.arrow', l => l.length);
const scrub = (page, t) => page.$eval('#maR', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, t);

// ───────── 减少动态效果：按钮直接跳到每一幕的结果，便于逐项核对 ─────────
const rm = await open(1440, 900, { reducedMotion: 'reduce' });
check('阶段标签 4 个', (await rm.$$eval('#maPills .pill', l => l.length)) === 4);
check('初始：第 1 / 13 幕，标题“① 去质子化”，画出原料', (await txt(rm, '#maN')) === '第 1 / 13 幕' && (await txt(rm, '#maT')) === '① 去质子化' && (await rm.$$eval('#maG text', l => l.some(t => t.textContent === '邻甲氧基苯甲酸'))));
await rm.waitForTimeout(1200);
check('减少动态效果时不自动播放', (await tau(rm)) === 0, await tau(rm));
await rm.click('#maNext');
check('下一步：τ 直接到 1，标题仍是刚放完的“去质子化”', (await tau(rm)) === 1 && (await txt(rm, '#maT')) === '① 去质子化', `${await tau(rm)} ${await txt(rm, '#maT')}`);
await rm.click('#maNext');
check('再下一步：第 2 / 13 幕“第一次单电子转移”', (await txt(rm, '#maN')) === '第 2 / 13 幕' && (await txt(rm, '#maT')).includes('第一次单电子转移'));
await rm.click('#maPills .pill:nth-child(3)');
check('点“③ 脱羧与异构化”：放完第 11 幕“β-酮酸脱羧”', (await tau(rm)) === 11 && (await txt(rm, '#maT')).includes('脱羧') && (await txt(rm, '#maCond')) === 'H₃O⁺, Δ', `${await tau(rm)} ${await txt(rm, '#maT')}`);
await rm.click('#maRe');
check('重播本步：仍停在第 11 幕结束（τ = 11）', (await tau(rm)) === 11);
const expectArrows = [0, 0, 2, 0, 2, 3, 1, 3, 2, 2, 3, 4, 0];
const arrowRes = [];
for (let k = 0; k < 13; k++) { await scrub(rm, k + 0.555); arrowRes.push(await arrows(rm)); }
check('拖动进度条到每幕的箭头阶段：弯箭头数 = 0,0,2,0,2,3,1,3,2,2,3,4,0', arrowRes.join() === expectArrows.join(), arrowRes.join());
await scrub(rm, 0.3);
check('第 1 幕中途：红色 e⁻ 小球在飞', (await rm.$$eval('#maG g.electron', l => l.length)) === 1);
await scrub(rm, 13);
check('结尾：画成正丁基链，出现产物名', (await rm.$$eval('#maG text', l => l.some(t => t.textContent === '2-丁基环己-2-烯酮'))) && (await txt(rm, '#maT')).includes('产物'));
check('图例小弯箭头已画出', (await rm.$$eval('#maLeg path', l => l.length)) === 1);
check('目录锚点全部存在', await rm.$$eval('.toc a', l => l.every(a => !!document.querySelector(a.getAttribute('href')))));

// ───────── 正常动态：滚到动画区自动播放、暂停、下一步只放一幕、键盘 ─────────
const pg = await open(1440, 900);
check('页面打开、动画区还没进入视野时不播放', (await tau(pg)) === 0);
await pg.$eval('#stage', el => el.scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(1800);
const t1 = await tau(pg);
check('滚到动画区后自动开始播放', t1 > 0 && (await pg.evaluate(() => window.__anim.playing)), t1);
await pg.click('#maPlay');
const t2 = await tau(pg);
await pg.waitForTimeout(500);
check('点“暂停”后 τ 不再前进', (await tau(pg)) === t2 && !(await pg.evaluate(() => window.__anim.playing)), `${t2} → ${await tau(pg)}`);
await pg.evaluate(() => window.__anim.set(4));
await pg.selectOption('#maSp', '2');
await pg.click('#maNext');
await pg.waitForFunction(() => !window.__anim.playing, null, { timeout: 8000 });
check('2× 速度下“下一步”只放一幕，停在 τ = 5', (await tau(pg)) === 5, await tau(pg));
await pg.evaluate(() => document.activeElement && document.activeElement.blur()); // 让空格落到页面而不是刚点过的按钮上
await pg.keyboard.press('Space');
await pg.waitForTimeout(300);
check('空格开始播放', await pg.evaluate(() => window.__anim.playing));
await pg.keyboard.press('Space');

// ───────── 版式：三种宽度无横向溢出 ─────────
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = w === 1440 ? pg : await open(w, h, { reducedMotion: 'reduce' });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${w}px 页面无横向溢出`, over <= 0, `scrollWidth − innerWidth = ${over}`);
  if (w === 390) {
    const svgW = await p.$eval('.svgwrap svg', s => s.getBoundingClientRect().width);
    check('390px 时动画画布保持 ≥ 560px 宽（框内横向滚动）', svgW >= 559, Math.round(svgW));
    await p.evaluate(() => { window.__anim.set(10.555); const st = document.querySelector('#stage'); st.scrollIntoView(); document.querySelector('.svgwrap').scrollLeft = 120; });
    await p.screenshot({ path: path.join(root, 'preview-mobile.png') });
  }
}

// ───────── 深色模式 ─────────
const dk = await open(1440, 900, { colorScheme: 'dark', reducedMotion: 'reduce' });
const fill = await dk.$eval('#maG text.t', el => getComputedStyle(el).fill);
check('深色模式下原子标签为浅色', /rgb\((2[0-9]{2}), (2[0-9]{2}), (2[0-9]{2})\)/.test(fill), fill);
await dk.evaluate(() => { window.__anim.set(8.555); document.querySelector('#stage').scrollIntoView(); });
await dk.screenshot({ path: path.join(shotsDir, 'dark-water-attack.png') });

// ───────── 预览图与抽帧 ─────────
await pg.evaluate(() => window.__anim.set(10.555));
await pg.setViewportSize({ width: 1200, height: 760 });
await pg.$eval('#stage', el => el.scrollIntoView({ block: 'start' }));
await pg.screenshot({ path: path.join(root, 'preview.png') });
const stage = await pg.$('#stage');
for (const t of [0.3, 2.555, 2.75, 5.555, 5.75, 8.555, 9.555, 10.555, 10.75, 11.555, 11.75, 13]) {
  await pg.evaluate(v => window.__anim.set(v), t);
  await stage.screenshot({ path: path.join(shotsDir, `tau-${t.toFixed(3)}.png`) });
}

check('无脚本报错', errors.length === 0, errors.join(' | '));
check('零网络请求（页面完全离线）', online.length === 0, online.join(' | '));
await browser.close();

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'birch-anisic-acid-animation', engine, generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(root, 'qa-browser.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过（${engine}）`);
if (passed !== checks.length) process.exit(1);
