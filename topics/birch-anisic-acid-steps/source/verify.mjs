// 结构与守恒核验：读取 mech.js 每一帧真正画出的分子（原子、键、电荷、单电子），
// 逐个原子检查价键与形式电荷，按电子数奇偶核对自由基，补齐隐含氢算分子式，
// 再核对每一帧的元素 / 电荷守恒、三个阶段的配平总式，以及页面上的结构判断。
// 运行：deno run -A source/verify.mjs   （或 node source/verify.mjs）→ ../verification.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAMES, REG } from './mech.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

// ───────── 标签解析：标签里写出的 H 和基团都算作与该原子相连 ─────────
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
// 声明的小分子 / 离子（画面上没有画出的副产物或试剂）
function S(formula, q = 0) {
  const el = {};
  for (const [, e, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) el[e] = (el[e] || 0) + (n ? +n : 1);
  return { el, q, rad: 0 };
}
const E = { el: {}, q: -1, rad: 0 }; // 一个电子

// ───────── 分析一个分子对象：价键、隐含氢、连通分量 ─────────
function analyze(m) {
  const ids = Object.keys(m.A), info = {}, adj = {}, problems = [], hImp = {};
  ids.forEach(id => { info[id] = atomInfo(m.A[id]); adj[id] = []; });
  m.B.forEach(b => { if (b.o === 1 || b.o === 2) { adj[b.a].push([b.b, b.o]); adj[b.b].push([b.a, b.o]); } });
  ids.forEach(id => {
    const a = m.A[id], f = info[id], s = adj[id].reduce((t, x) => t + x[1], 0) + f.n;
    const q = a.chg === '+' ? 1 : a.chg === '-' ? -1 : 0, r = a.rad != null ? 1 : 0;
    if (f.main === 'C') {
      const h = 4 - s - (q ? 1 : 0) - r;
      if (h < 0) problems.push(`${id}：碳的键级和 ${s} 超过允许值`);
      hImp[id] = Math.max(0, h);
    } else if (f.main === 'O') { if (s !== 2 + q || r) problems.push(`${id}：氧的键数 ${s} 与电荷 ${q} 不符`); }
    else if (f.main === 'H') { if (!((s === 1 && !q) || (s === 0 && q === 1)) || r) problems.push(`${id}：氢的键数 ${s}`); }
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
    for (const u of members) {
      el = add(el, info[u].el);
      if (hImp[u]) el = add(el, { H: hImp[u] });
      q += m.A[u].chg === '+' ? 1 : m.A[u].chg === '-' ? -1 : 0;
      rad += m.A[u].rad != null ? 1 : 0;
    }
    const electrons = Object.entries(el).reduce((t, [e, n]) => t + VE[e] * n, 0) - q;
    comps.push({ members, el, q, rad, electrons });
  }
  const main = comps.find(c => c.members.includes('c1'));
  const others = comps.filter(c => c !== main);
  return { comps, main, others, problems, hImp, adj, info };
}
const sumSp = list => list.reduce((acc, sp) => ({ el: add(acc.el, sp.el), q: acc.q + sp.q }), { el: {}, q: 0 });
const same = (a, b) => hill(a.el) === hill(b.el) && a.q === b.q;
function balance(name, left, right) {
  const L = sumSp(left), Rr = sumSp(right);
  check(name, same(L, Rr), `左 ${hill(L.el)} 电荷 ${L.q}　右 ${hill(Rr.el)} 电荷 ${Rr.q}`);
}

// ───────── 逐帧运行 mech.js，收集画出的分子 ─────────
const frames = FRAMES.map((f, i) => {
  REG.on = true; REG.list = [];
  const svg = f.d();
  const mols = REG.list.slice();
  REG.on = false;
  return { i, svg, mols, an: mols.map(analyze), arrows: (svg.match(/class="arrow"/g) || []).length };
});

check('共 11 帧', frames.length === 11, frames.length);
const arrowsExpected = [0, 0, 2, 0, 3, 3, 2, 2, 3, 4, 0];
frames.forEach(fr => check(`第 ${fr.i + 1} 帧弯箭头数 = ${arrowsExpected[fr.i]}`, fr.arrows === arrowsExpected[fr.i], fr.arrows));

// 每个画出的原子都要价键合理、电子数奇偶与单电子一致
let nAtoms = 0, bad = [];
frames.forEach(fr => fr.an.forEach((a, k) => {
  nAtoms += Object.keys(fr.mols[k].A).length;
  a.problems.forEach(p => bad.push(`第 ${fr.i + 1} 帧分子 ${k + 1}：${p}`));
  a.comps.forEach(c => { if ((c.electrons % 2 === 1) !== (c.rad % 2 === 1)) bad.push(`第 ${fr.i + 1} 帧分子 ${k + 1}：电子数 ${c.electrons} 与单电子数 ${c.rad} 不一致`); });
}));
check(`全部 ${nAtoms} 个画出的原子价键与形式电荷合理；闭壳层物种电子数为偶数、自由基为奇数`, bad.length === 0, bad.join('；') || '无问题');

// ───────── 每帧主物种（含 C1 的那个连通分量）的分子式、电荷、自由基 ─────────
const expect = [
  [['C8H8O3', 0], ['C12H18O3', 0], ['C11H16O3', 0], ['C10H16O', 0], ['C10H16O', 0]],
  [['C8H8O3', 0], ['C8H7O3', -1], ['C8H7O3', -2, 1]],
  [['C8H7O3', -2, 1], ['C8H8O3', -1, 1]],
  [['C8H8O3', -1, 1], ['C8H8O3', -2], ['C8H8O3', -2]],
  [['C8H8O3', -2], ['C12H18O3', 0]],
  [['C12H18O3', 0], ['C12H19O3', 1]],
  [['C12H19O3', 1], ['C12H20O4', 0]],
  [['C12H21O4', 1], ['C11H16O3', 0]],
  [['C11H16O3', 0], ['C10H16O', 0]],
  [['C10H16O', 0], ['C10H16O', 0]],
  [['C8H8O3', 0], ['C10H16O', 0]],
];
frames.forEach(fr => {
  const ex = expect[fr.i];
  check(`第 ${fr.i + 1} 帧画了 ${ex.length} 个主物种`, fr.an.length === ex.length, fr.an.length);
  fr.an.forEach((a, k) => {
    const want = ex[k];
    if (!want) return;
    const got = a.main, ok = got && hill(got.el) === want[0] && got.q === want[1] && (got.rad > 0) === !!want[2];
    check(`第 ${fr.i + 1} 帧物种 ${k + 1} = ${fmt({ el: S(want[0]).el, q: want[1], rad: want[2] })}`, ok, got ? fmt(got) : '没有含 C1 的分量');
  });
});

// 画面上同时画出的试剂分量
const reag = (fi, k) => frames[fi].an[k].others.map(c => ({ el: c.el, q: c.q, rad: c.rad }));
const r2 = reag(2, 0), r4 = reag(4, 0), r5 = reag(5, 0), r6 = reag(6, 0), r9 = reag(9, 0);
check('第 3 帧试剂 = t-BuOH（C4H10O）', r2.length === 1 && same(r2[0], S('C4H10O')), r2.map(fmt).join(', '));
check('第 5 帧试剂 = n-BuBr（C4H9Br）', r4.length === 1 && same(r4[0], S('C4H9Br')), r4.map(fmt).join(', '));
check('第 6 帧试剂 = H₃O⁺', r5.length === 1 && same(r5[0], S('H3O', 1)), r5.map(fmt).join(', '));
check('第 7 帧试剂 = H₂O', r6.length === 1 && same(r6[0], S('H2O')), r6.map(fmt).join(', '));
check('第 10 帧试剂 = H₃O⁺', r9.length === 1 && same(r9[0], S('H3O', 1)), r9.map(fmt).join(', '));

// ───────── 每一步的元素与电荷守恒（未画出的副产物在这里声明） ─────────
const M = (fi, k) => { const c = frames[fi].an[k].main; return { el: c.el, q: c.q }; };
const ALL = (fi, k) => frames[fi].an[k].comps.map(c => ({ el: c.el, q: c.q }));
balance('第 2 帧 a：ArCOOH + e⁻ → ArCOO⁻ + ½ H₂', [M(1, 0), E], [M(1, 1), S('H')]);
balance('第 2 帧 b：ArCOO⁻ + e⁻ → 自由基负离子', [M(1, 1), E], [M(1, 2)]);
balance('第 3 帧：自由基负离子 + t-BuOH → 自由基 + t-BuO⁻', ALL(2, 0), [M(2, 1), S('C4H9O', -1)]);
balance('第 4 帧 a：自由基 + e⁻ → C1 碳负离子', [M(3, 0), E], [M(3, 1)]);
balance('第 5 帧：烯二醇盐 + n-BuBr + H⁺（后处理）→ 酸 + Br⁻', [...ALL(4, 0), S('H', 1)], [M(4, 1), S('Br', -1)]);
balance('第 6 帧：烯醇醚 + H₃O⁺ → 氧鎓离子 + H₂O', ALL(5, 0), [M(5, 1), S('H2O')]);
balance('第 7 帧：氧鎓离子 + H₂O → 半缩酮 + H⁺', ALL(6, 0), [M(6, 1), S('H', 1)]);
balance('第 8 帧：质子化半缩酮 → β-酮酸 + MeOH + H⁺', ALL(7, 0), [M(7, 1), S('CH4O'), S('H', 1)]);
balance('第 9 帧：β-酮酸 → 二烯醇 + CO₂', ALL(8, 0), [M(8, 1), S('CO2')]);
balance('第 10 帧：二烯醇 + H₃O⁺ → 烯酮 + H₃O⁺', ALL(9, 0), [M(9, 1), S('H3O', 1)]);
// 三个阶段的配平总式（与页面 03 节一致）
const stage1L = [M(0, 0), S('Li'), S('Li'), S('Li'), S('C4H10O'), S('C4H9Br'), S('H3O', 1)];
const stage1R = [M(0, 1), S('Li', 1), S('Li', 1), S('Li', 1), S('C4H9O', -1), S('Br', -1), S('H'), S('H2O')];
balance('① C₈H₈O₃ + 3 Li + t-BuOH + n-BuBr + H₃O⁺ → C₁₂H₁₈O₃ + 3 Li⁺ + t-BuO⁻ + Br⁻ + ½ H₂ + H₂O', stage1L, stage1R);
balance('② C₁₂H₁₈O₃ + H₂O → C₁₁H₁₆O₃ + CH₃OH', [M(0, 1), S('H2O')], [M(0, 2), S('CH4O')]);
balance('③ C₁₁H₁₆O₃ → C₁₀H₁₆O + CO₂', [M(0, 2)], [M(0, 3), S('CO2')]);
check('二烯醇与烯酮分子式相同（互变异构体）', same(M(0, 3), M(0, 4)), `${hill(M(0, 3).el)} / ${hill(M(0, 4).el)}`);

// ───────── 结构判断 ─────────
const bondsOf = m => m.B.filter(b => b.o === 1 || b.o === 2);
const dbl = m => bondsOf(m).filter(b => b.o === 2);
const nb = (m, id) => bondsOf(m).filter(b => b.a === id || b.b === id).map(b => (b.a === id ? b.b : b.a));
const has = (m, a, b, o) => m.B.some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (o == null || x.o === o));
const ccDbl = m => dbl(m).filter(b => !m.A[b.a].lab && !m.A[b.b].lab);
const conj = (m, b1, b2) => [b1.a, b1.b].some(u => [b2.a, b2.b].some(v => u !== v && has(m, u, v, 1)));
const label = (m, id) => clean(m.A[id] && m.A[id].lab);

const birch = frames[0].mols[1], keto = frames[0].mols[2], dienol = frames[0].mols[3], prod = frames[0].mols[4];
const bd2 = ccDbl(birch);
check('Birch 产物：环上两个 C=C 是 C2=C3 与 C5=C6', bd2.length === 2 && has(birch, 'c2', 'c3', 2) && has(birch, 'c5', 'c6', 2), bd2.map(b => b.a + '=' + b.b).join(', '));
check('Birch 产物：两个 C=C 不共轭（1,4-二烯）', bd2.length === 2 && !conj(birch, bd2[0], bd2[1]));
check('Birch 产物：OMe 连在 C=C 的碳 C2 上（烯醇醚）', label(birch, 'o2') === 'O' && has(birch, 'c2', 'o2', 1) && has(birch, 'o2', 'me', 1) && has(birch, 'c2', 'c3', 2));
check('Birch 产物：C1 是季碳（4 个非氢取代基）', nb(birch, 'c1').length === 4 && analyze(birch).hImp.c1 === 0, nb(birch, 'c1').join(','));
check('Birch 产物：C4 是 CH₂（sp³，两个 H 来自原环 H + 质子化）', analyze(birch).hImp.c4 === 2);
check('β-酮酸：羧基碳连在 C1 上，C1 的邻位 C2 是酮羰基（β 关系）', has(keto, 'c1', 'cc', 1) && has(keto, 'c1', 'c2', 1) && has(keto, 'c2', 'o2', 2) && has(keto, 'cc', 'ob', 2));
check('β-酮酸：剩下的 C=C 是孤立的 C5=C6', ccDbl(keto).length === 1 && has(keto, 'c5', 'c6', 2));
const dd = ccDbl(dienol);
check('二烯醇：C1=C2 与 C5=C6 通过 C1–C6 共轭', dd.length === 2 && has(dienol, 'c1', 'c2', 2) && has(dienol, 'c5', 'c6', 2) && conj(dienol, dd[0], dd[1]));
check('二烯醇：OH 在 C2 上（烯醇）', has(dienol, 'c2', 'o2', 1) && clean(dienol.A.o2.suf) === 'H');
check('烯酮：C=O 在 C2，C=C 在 C1=C6，二者共轭（α,β-不饱和酮）', has(prod, 'c2', 'o2', 2) && has(prod, 'c1', 'c6', 2) && has(prod, 'c1', 'c2', 1) && ccDbl(prod).length === 1);
const pa = analyze(prod);
check('烯酮：C1 连的是正丁基（CH₂CH₂CH₂CH₃ 直链）', has(prod, 'c1', 'k0', 1) && has(prod, 'k0', 'k1', 1) && has(prod, 'k1', 'k2', 1) && has(prod, 'k2', 'k3', 1) && pa.hImp.k0 === 2 && pa.hImp.k1 === 2 && pa.hImp.k2 === 2 && pa.hImp.k3 === 3);
check('烯酮：C3、C4、C5 都是 CH₂，C6 是 =CH–', pa.hImp.c3 === 2 && pa.hImp.c4 === 2 && pa.hImp.c5 === 2 && pa.hImp.c6 === 1);
// 原子去向（第 11 帧：原料 vs 产物，同一套编号）
const sm11 = frames[10].mols[0], pr11 = frames[10].mols[1];
check('原子去向：原料 C1 连 COOH，产物 C1 连丁基链', has(sm11, 'c1', 'cc', 1) && has(pr11, 'c1', 'k0', 1));
check('原子去向：原料 C2 连 OMe，产物 C2 是羰基碳', has(sm11, 'c2', 'o2', 1) && has(sm11, 'o2', 'me', 1) && has(pr11, 'c2', 'o2', 2));
// 机理细节
const ra = frames[1].mols[2];
check('自由基负离子：单电子在 C1、负电荷在 C4，二者互为对位', ra.A.c1.rad != null && ra.A.c4.chg === '-' && !has(ra, 'c1', 'c4') );
check('C4 质子化后 C4 有两个 H（一个画出、一个隐含）', analyze(frames[2].mols[1]).hImp.c4 === 1 && has(frames[2].mols[1], 'c4', 'h4', 1));
const ca = frames[3].mols[1], en = frames[3].mols[2];
const sigma = m => bondsOf(m).map(b => [b.a, b.b].sort().join('-')).sort().join(' ');
check('碳负离子 ↔ 烯二醇盐：σ 骨架完全相同，只差 π 键与电荷（共振式）', sigma(ca) === sigma(en) && same(M(3, 1), M(3, 2)));
check('烯二醇盐：C1=C(O⁻)₂', has(en, 'c1', 'cc', 2) && en.A.oa.chg === '-' && en.A.ob.chg === '-');
const ts = frames[8].mols[0];
check('脱羧过渡态：H–O–C(=O)–C1–C2=O 与 H···O 闭合成六元环', has(ts, 'oa', 'ha', 1) && has(ts, 'cc', 'oa', 1) && has(ts, 'c1', 'cc', 1) && has(ts, 'c1', 'c2', 1) && has(ts, 'c2', 'o2', 2) && ts.B.some(b => b.o === 'h' && [b.a, b.b].sort().join() === 'ha,o2'));
const oxo = frames[5].mols[1];
check('氧鎓离子：C2=O⁺–Me，H 加在 C3', has(oxo, 'c2', 'o2', 2) && oxo.A.o2.chg === '+' && has(oxo, 'c3', 'h3', 1));
const hk = frames[6].mols[1];
check('半缩酮：C2 同时连 OH 与 OMe，且为 sp³', has(hk, 'c2', 'o2', 1) && has(hk, 'c2', 'om', 1) && clean(hk.A.om.pre) === 'Me' && clean(hk.A.o2.suf) === 'H' && !ccDbl(hk).some(b => b.a === 'c2' || b.b === 'c2'));
const fin = frames[9].mols[1];
check('最后一步：H 加在 C5，C5 变成 CH₂', has(fin, 'c5', 'h5', 1) && analyze(fin).hImp.c5 === 1);

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'birch-anisic-acid-steps', generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(here, '..', 'verification.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过`);
if (passed !== checks.length) process.exit(1);
