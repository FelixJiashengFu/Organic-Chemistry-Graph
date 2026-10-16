// 关键帧核验：读取 anim.js 动画实际使用的全部关键帧（K0 试剂进场前 / K1 试剂就位 / K2 重排完成，
// 包括正在离场、已经透明的副产物），逐个原子检查价键与形式电荷，按电子数奇偶核对自由基，补齐隐含氢，
// 再核对每一幕的元素 / 电荷守恒、每幕之后的主物种、弯箭头根数与原子去向；最后在 0–13 之间每隔 0.01 渲染一次。
// 运行：deno run -A source/verify.mjs   （或 node source/verify.mjs）→ ../verification.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SC, N, A0, frame } from './anim.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

const GROUP = { Me: { C: 1, H: 3 }, Bu: { C: 4, H: 9 }, 't-Bu': { C: 4, H: 9 } };
const VE = { C: 4, H: 1, O: 6, Br: 7, Li: 1 };
const clean = s => (s || '').replace(/<[^>]+>/g, '').replace(/₂/g, '2').replace(/₃/g, '3');
function affix(s) {
  s = clean(s);
  if (!s) return { el: {}, n: 0 };
  if (GROUP[s]) return { el: { ...GROUP[s] }, n: 1 };
  const m = s.match(/^H(\d*)$/);
  if (m) { const k = m[1] ? +m[1] : 1; return { el: { H: k }, n: k }; }
  throw new Error('无法解析的标签片段：' + s);
}
function atomInfo(a) {
  if (!a.lab) return { main: 'C', el: { C: 1 }, n: 0 };
  const lab = clean(a.lab);
  if (GROUP[lab]) return { main: 'R', el: { ...GROUP[lab] }, n: 0 };
  if (!['O', 'H', 'Br', 'Li'].includes(lab)) throw new Error('未知原子标签：' + lab);
  const pre = affix(a.pre), suf = affix(a.suf), el = { [lab]: 1 };
  for (const x of [pre, suf]) for (const k in x.el) el[k] = (el[k] || 0) + x.el[k];
  return { main: lab, el, n: pre.n + suf.n };
}
const add = (A, B, k = 1) => { const r = { ...A }; for (const e in B) r[e] = (r[e] || 0) + k * B[e]; for (const e in r) if (!r[e]) delete r[e]; return r; };
function hill(el) {
  const keys = Object.keys(el).filter(k => el[k]);
  const order = keys.includes('C') ? ['C', 'H', ...keys.filter(k => k !== 'C' && k !== 'H').sort()] : keys.sort();
  return order.filter(k => el[k]).map(k => k + (el[k] > 1 ? el[k] : '')).join('');
}
const SUP = { 2: '²', 3: '³' };
const fmt = sp => hill(sp.el) + (sp.q ? (SUP[Math.abs(sp.q)] || '') + (sp.q > 0 ? '⁺' : '⁻') : '') + (sp.rad ? '（自由基）' : '');
function S(formula, q = 0) { const el = {}; for (const [, e, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) el[e] = (el[e] || 0) + (n ? +n : 1); return { el, q, rad: 0 }; }

// 分析一个关键帧：全部原子（含透明的离场原子）
function analyze(St) {
  const ids = Object.keys(St.A), info = {}, adj = {}, problems = [], hImp = {};
  const bonds = Object.values(St.B);
  ids.forEach(id => { info[id] = atomInfo(St.A[id]); adj[id] = []; });
  bonds.forEach(b => { if (!St.A[b.a] || !St.A[b.b]) problems.push(`键 ${b.a}–${b.b} 的端点不存在`); else if (b.o === 1 || b.o === 2) { adj[b.a].push([b.b, b.o]); adj[b.b].push([b.a, b.o]); } });
  ids.forEach(id => {
    const a = St.A[id], f = info[id], s = adj[id].reduce((t, x) => t + x[1], 0) + f.n;
    const q = a.chg === '+' ? 1 : a.chg === '-' ? -1 : 0, r = a.rad != null ? 1 : 0;
    if (f.main === 'C') { const h = 4 - s - (q ? 1 : 0) - r; if (h < 0) problems.push(`${id}：碳的键级和 ${s} 超过允许值`); hImp[id] = Math.max(0, h); }
    else if (f.main === 'O') { if (s !== 2 + q || r) problems.push(`${id}：氧的键数 ${s} 与电荷 ${q} 不符`); }
    else if (f.main === 'H') { if (!((s === 1 && !q) || (s === 0 && q === 1) || (s === 0 && !q && St.allowH === id)) || r) problems.push(`${id}：氢的键数 ${s}、电荷 ${q}`); }
    else if (f.main === 'Br') { if (!((s === 1 && !q) || (s === 0 && q === -1)) || r) problems.push(`${id}：溴的键数 ${s}`); }
    else if (f.main === 'R') { if (s !== 1 || q || r) problems.push(`${id}：烷基必须正好连一根单键`); }
  });
  const seen = new Set(), comps = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id], members = [];
    seen.add(id);
    while (stack.length) { const u = stack.pop(); members.push(u); for (const [v] of adj[u]) if (!seen.has(v)) { seen.add(v); stack.push(v); } }
    let el = {}, q = 0, rad = 0;
    for (const u of members) { el = add(el, info[u].el); if (hImp[u]) el = add(el, { H: hImp[u] }); q += St.A[u].chg === '+' ? 1 : St.A[u].chg === '-' ? -1 : 0; rad += St.A[u].rad != null ? 1 : 0; }
    const electrons = Object.entries(el).reduce((t, [e, n]) => t + VE[e] * n, 0) - q;
    comps.push({ members, el, q, rad, electrons });
  }
  const total = comps.reduce((acc, c) => ({ el: add(acc.el, c.el), q: acc.q + c.q }), { el: {}, q: 0 });
  const main = comps.find(c => c.members.includes('c1'));
  return { comps, main, total, problems, hImp };
}
const has = (St, a, b, o) => Object.values(St.B).some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (o == null || x.o === o));

check('共 13 幕', N === 13 && SC.length === 13, N);
// 第 1 幕离场的是一个中性 H 原子（½ H₂），单独放行
SC[0].K2.allowH = 'ha';

// ───────── 每个关键帧：价键、电子奇偶 ─────────
const bad = [];
let nStates = 0;
SC.forEach((sc, k) => ['K0', 'K1', 'K2'].forEach(K => {
  nStates++;
  const a = analyze(sc[K]);
  a.problems.forEach(p => bad.push(`第 ${k + 1} 幕 ${K}：${p}`));
  a.comps.forEach(c => { if ((c.electrons % 2 === 1) !== (c.rad % 2 === 1) && !(c.members.length === 1 && c.members[0] === sc[K].allowH)) bad.push(`第 ${k + 1} 幕 ${K}：分量 ${c.members.join(',')} 电子数 ${c.electrons}、单电子 ${c.rad}`); });
}));
check(`${nStates} 个关键帧里每个原子的价键与形式电荷都合理；闭壳层物种电子数为偶数、自由基为奇数`, bad.length === 0, bad.join('；') || '无问题');

// ───────── 守恒：K0 = K1（试剂只是移动），K1 + e⁻ = K2 + 只写在标签里离开的 H⁺ ─────────
SC.forEach((sc, k) => {
  const a0 = analyze(sc.K0).total, a1 = analyze(sc.K1).total, a2 = analyze(sc.K2).total;
  check(`第 ${k + 1} 幕：试剂进场前后原子与电荷不变`, hill(a0.el) === hill(a1.el) && a0.q === a1.q, `${hill(a0.el)} ${a0.q} / ${hill(a1.el)} ${a1.q}`);
  const e = sc.e || 0, lost = sc.lost ? S(sc.lost[0], sc.lost[1]) : { el: {}, q: 0 };
  const right = { el: add(a2.el, lost.el), q: a2.q + lost.q };
  check(`第 ${k + 1} 幕：${e ? `加入 ${e} 个电子，` : ''}${sc.lost ? '算上离开的 H⁺，' : ''}重排前后元素与电荷守恒`, hill(a1.el) === hill(right.el) && a1.q - e === right.q, `左 ${hill(a1.el)} 电荷 ${a1.q}${e ? ' + e⁻' : ''}　右 ${hill(right.el)} 电荷 ${right.q}`);
});

// ───────── 每幕之后的主物种（含 C1 的连通分量） ─────────
const after = [['C8H7O3', -1], ['C8H7O3', -2, 1], ['C8H8O3', -1, 1], ['C8H8O3', -2], ['C8H8O3', -2], ['C12H17O3', -1], ['C12H18O3', 0], ['C12H19O3', 1], ['C12H20O4', 0], ['C11H16O3', 0], ['C10H16O', 0], ['C10H16O', 0], ['C10H16O', 0]];
const m0 = analyze(SC[0].K0).main;
check('开场主物种 = C8H8O3（邻甲氧基苯甲酸）', hill(m0.el) === 'C8H8O3' && m0.q === 0, fmt(m0));
SC.forEach((sc, k) => {
  const m = analyze(sc.K2).main, w = after[k];
  check(`第 ${k + 1} 幕之后 = ${fmt({ el: S(w[0]).el, q: w[1], rad: w[2] })}`, m && hill(m.el) === w[0] && m.q === w[1] && (m.rad > 0) === !!w[2], m ? fmt(m) : '无');
});
const mk9 = analyze(SC[9].K1).main;
check('第 10 幕试剂就位时：OMe 已质子化，C12H21O4⁺', hill(mk9.el) === 'C12H21O4' && mk9.q === 1, fmt(mk9));
check('第 5 幕（共振）前后 σ 骨架相同、分子式与电荷相同', (() => {
  const sig = St => Object.values(St.B).filter(b => b.o === 1 || b.o === 2).map(b => [b.a, b.b].sort().join('-')).sort().join(' ');
  const x = analyze(SC[4].K1).main, y = analyze(SC[4].K2).main;
  return sig(SC[4].K1) === sig(SC[4].K2) && hill(x.el) === hill(y.el) && x.q === y.q;
})());

// ───────── 弯箭头与单电子 ─────────
const arrowsExpected = [0, 0, 2, 0, 2, 3, 1, 3, 2, 2, 3, 4, 0];
SC.forEach((sc, k) => check(`第 ${k + 1} 幕弯箭头 ${arrowsExpected[k]} 根`, (sc.arrows ? sc.arrows(sc.K1).length : 0) === arrowsExpected[k]));
check('单电子小球出现在第 1、2、4 幕，各加 1 个电子', SC.map((s, k) => s.elec ? k : -1).filter(k => k >= 0).join() === '0,1,3' && [0, 1, 3].every(k => SC[k].e === 1));
check('全程弯箭头共 22 根', arrowsExpected.reduce((a, b) => a + b, 0) === 22);

// ───────── 原子去向 ─────────
const F = SC[12].K2, Fa = analyze(F);
check('产物：C2 与“蓝色 O”（来自水的 ow）成双键', has(F, 'c2', 'ow', 2) && clean(F.A.ow.lab) === 'O' && !!F.A.ow.col);
check('“蓝色 O”第一次出现时是一分子水（H₂O）', SC[8].K0.A.ow && clean(SC[8].K0.A.ow.pre) === 'H2' && !SC.slice(0, 8).some(s => s.K2.A.ow));
check('原来 OMe 的氧（o2）在第 10 幕随 MeOH 离开：与 Me、H 相连，与 C2 断开', has(SC[9].K2, 'o2', 'me', 1) && has(SC[9].K2, 'o2', 'hm', 1) && !has(SC[9].K2, 'c2', 'o2') && SC[9].K2.A.o2.op === 0 && !SC[10].K1.A.o2);
check('羧基碳（cc）在第 11 幕以 O=C=O 离开', has(SC[10].K2, 'cc', 'oa', 2) && has(SC[10].K2, 'cc', 'ob', 2) && !has(SC[10].K2, 'c1', 'cc') && SC[10].K2.A.cc.op === 0);
check('脱羧前 H 转向酮氧，H···O 闭合六元环', has(SC[10].K1, 'ow', 'ha', 'h') && has(SC[10].K1, 'oa', 'ha', 1) && has(SC[10].K1, 'cc', 'oa', 1) && has(SC[10].K1, 'c1', 'cc', 1) && has(SC[10].K1, 'c2', 'ow', 2));
check('新加的 3 个 H 留在产物上：C4（th）、C3（h3）、C5（h5）', has(F, 'c4', 'th', 1) && has(F, 'c3', 'h3', 1) && has(F, 'c5', 'h5', 1));
check('产物 C3、C4、C5 都是 CH₂（一个画出、一个隐含），C6 是 =CH–', Fa.hImp.c3 === 1 && Fa.hImp.c4 === 1 && Fa.hImp.c5 === 1 && Fa.hImp.c6 === 1);
check('产物：C1=C6 与 C2=O 共轭（α,β-不饱和酮）', has(F, 'c1', 'c6', 2) && has(F, 'c1', 'c2', 1) && has(F, 'c2', 'ow', 2));
check('产物：C1 连正丁基直链', has(F, 'c1', 'k0', 1) && has(F, 'k0', 'k1', 1) && has(F, 'k1', 'k2', 1) && has(F, 'k2', 'k3', 1) && Fa.hImp.k3 === 3 && Fa.hImp.k0 === 2);
check('丁基先以 SN2 连到 C1（第 6 幕），Br 以 Br⁻ 离开', has(SC[5].K2, 'c1', 'bu', 1) && !has(SC[5].K2, 'bu', 'br') && SC[5].K2.A.br.chg === '-' && SC[5].K2.A.br.op === 0);

// ───────── 渲染：0–13 每隔 0.01 画一次 ─────────
let renderBad = [], arrowBad = [];
for (let i = 0; i <= N * 100; i++) {
  const t = i / 100;
  try { const f = frame(t); if (!f.svg || /NaN|undefined/.test(f.svg)) renderBad.push(t); } catch (err) { renderBad.push(t + ' ' + err.message); }
}
check(`τ 从 0 到 ${N} 每隔 0.01 渲染一次（${N * 100 + 1} 帧），没有异常、NaN 或 undefined`, renderBad.length === 0, renderBad.slice(0, 8).join(', '));
SC.forEach((sc, k) => { const f = frame(k + 0.555), n = (f.svg.match(/class="arrow"/g) || []).length; if (n !== arrowsExpected[k]) arrowBad.push(`第 ${k + 1} 幕 ${n}`); });
check('每幕箭头阶段结束时（u = 0.555），画面上的弯箭头数与上表一致', arrowBad.length === 0, arrowBad.join('；'));
check('整数 τ = n 显示第 n 幕刚播完的画面（标题不跳到下一幕）', frame(11).k === 10 && frame(11).u === 1 && frame(0).k === 0 && frame(13).k === 12);
check('进场阶段 A0 = 0.16', A0 === 0.16);
const appSrc = fs.readFileSync(path.join(here, 'app.js'), 'utf8'), dur = +(appSrc.match(/const DUR = ([\d.]+)/) || [])[1];
check('1× 速度全程约 1 分钟（页面文字）', dur * N > 50 && dur * N < 70, `${N} 幕 × ${dur} s = ${Math.round(dur * N)} s`);

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'birch-anisic-acid-animation', generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(here, '..', 'verification.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过`);
if (passed !== checks.length) process.exit(1);
