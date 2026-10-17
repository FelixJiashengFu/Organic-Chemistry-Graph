// 结构与守恒核验：读取 mech.js 每一帧真正画出的分子（原子、键、电荷），
// 逐个原子检查价键与形式电荷，补齐隐含氢算分子式；核对每一步的元素 / 电荷守恒、
// Ru 的氧化态、碳的氧化态变化（= 页面上写的电子数），以及页面上的结构判断。
// 运行：deno run -A source/verify.mjs   （或 node source/verify.mjs）→ ../verification.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAMES, REG } from './mech.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });

const VE = { C: 4, H: 1, O: 6, Ru: 8 };
const clean = s => (s || '').replace(/<[^>]+>/g, '');
function affix(s) {
  s = clean(s);
  if (!s) return { el: {}, n: 0 };
  const m = s.match(/^H(\d*)$/);
  if (m) { const k = m[1] ? +m[1] : 1; return { el: { H: k }, n: k }; }
  throw new Error('无法解析的标签片段：' + s);
}
function atomInfo(a) {
  if (!a.lab) return { main: 'C', el: { C: 1 }, n: 0 };
  const lab = clean(a.lab);
  if (!['O', 'H', 'Ru'].includes(lab)) throw new Error('未知原子标签：' + lab);
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
const fq = (f, q) => f + (q ? (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-') : '');
function S(formula, q = 0) {
  const el = {};
  for (const [, e, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) el[e] = (el[e] || 0) + (n ? +n : 1);
  return { el, q };
}
const chgOf = a => a.chg === '+' ? 1 : a.chg === '-' ? -1 : 0;

// ───────── 分析一个分子对象：价键、隐含氢、氧化态、连通分量 ─────────
function analyze(m) {
  const ids = Object.keys(m.A), info = {}, adj = {}, problems = [], hImp = {}, ox = {};
  ids.forEach(id => { info[id] = atomInfo(m.A[id]); adj[id] = []; });
  m.B.forEach(b => { if (b.o === 1 || b.o === 2) { adj[b.a].push([b.b, b.o]); adj[b.b].push([b.a, b.o]); } });
  const label = id => info[id].main;
  ids.forEach(id => {
    const a = m.A[id], f = info[id], s = adj[id].reduce((t, x) => t + x[1], 0) + f.n, q = chgOf(a);
    if (f.main === 'C') {
      const h = 4 - s - (q ? 1 : 0);
      if (h < 0) problems.push(`${id}：碳的键级和 ${s} 超过 4`);
      hImp[id] = Math.max(0, h);
      if (adj[id].some(([v]) => label(v) === 'Ru')) problems.push(`${id}：C–Ru 键不应出现`);
      const nO = adj[id].filter(([v]) => label(v) === 'O').reduce((t, x) => t + x[1], 0);
      const nH = hImp[id] + adj[id].filter(([v]) => label(v) === 'H').length;
      ox[id] = nO - nH + q;
    } else if (f.main === 'O') { if (s !== 2 + q) problems.push(`${id}：氧的键数 ${s} 与电荷 ${q} 不符`); }
    else if (f.main === 'H') { if (s !== 1 || q) problems.push(`${id}：氢的键数 ${s}`); }
    else if (f.main === 'Ru') {
      if (adj[id].some(([v]) => label(v) !== 'O')) problems.push(`${id}：Ru 只应与 O 成键`);
      ox[id] = s + q; // Ru 只连 O：氧化态 = 键级和 + 形式电荷
      if (ox[id] !== a.ox) problems.push(`${id}：按键算出 Ru(${ox[id]})，页面标的是 ${a.ox}`);
      if (8 - ox[id] < 0) problems.push(`${id}：Ru 的 d 电子数为负`);
    }
  });
  const seen = new Set(), comps = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id], members = [];
    seen.add(id);
    while (stack.length) { const u = stack.pop(); members.push(u); for (const [v] of adj[u]) if (!seen.has(v)) { seen.add(v); stack.push(v); } }
    let el = {}, q = 0, oxC = 0, oxRu = 0;
    for (const u of members) {
      el = add(el, info[u].el);
      if (hImp[u]) el = add(el, { H: hImp[u] });
      q += chgOf(m.A[u]);
      if (info[u].main === 'C') oxC += ox[u];
      if (info[u].main === 'Ru') oxRu += ox[u];
    }
    const electrons = Object.entries(el).reduce((t, [e, n]) => t + VE[e] * n, 0) - q;
    comps.push({ members, el, q, oxC, oxRu, electrons, f: fq(hill(el), q) });
  }
  return { comps, problems, hImp, adj, info, ox };
}
const sumSp = list => list.reduce((acc, sp) => ({ el: add(acc.el, sp.el), q: acc.q + sp.q }), { el: {}, q: 0 });
const same = (a, b) => hill(a.el) === hill(b.el) && a.q === b.q;
function balance(name, left, right) {
  const Lh = sumSp(left), Rh = sumSp(right);
  check(name, same(Lh, Rh), `左 ${hill(Lh.el)} 电荷 ${Lh.q}　右 ${hill(Rh.el)} 电荷 ${Rh.q}`);
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
const arrowsExpected = [0, 0, 3, 3, 0, 3, 3, 3, 3, 0, 0];
frames.forEach(fr => check(`第 ${fr.i + 1} 帧弯箭头数 = ${arrowsExpected[fr.i]}`, fr.arrows === arrowsExpected[fr.i], fr.arrows));

let nAtoms = 0;
const bad = [];
frames.forEach(fr => fr.an.forEach((a, k) => {
  nAtoms += Object.keys(fr.mols[k].A).length;
  a.problems.forEach(p => bad.push(`第 ${fr.i + 1} 帧分子 ${k + 1}：${p}`));
  a.comps.forEach(c => { if (c.electrons % 2) bad.push(`第 ${fr.i + 1} 帧分子 ${k + 1}：${c.f} 的电子数为奇数`); });
}));
check(`全部 ${nAtoms} 个画出的原子价键与形式电荷合理，Ru 氧化态与页面标注一致，所有物种电子数为偶数（无自由基）`, bad.length === 0, bad.join('；') || '无问题');

// ───────── 每帧画出的物种（分子式 + 电荷），按分子对象逐个列出 ─────────
const expect = [
  [['C12H16'], ['C7H12O2']],
  [['O4Ru']],
  [['C12H16', 'O4Ru'], ['C12H16O4Ru']],
  [['C12H16O4Ru'], ['C12H16O2'], ['O2Ru']],
  [],
  [['C12H16O6Ru'], ['C10H14O2'], ['C2H2O2']],
  [['C10H14O6Ru'], ['C8H12O2'], ['C2H2O2']],
  [['C8H14O7Ru'], ['C8H12O3'], ['H2O4Ru']],
  [['C8H13O8Ru-'], ['C7H12O2'], ['CO2'], ['HO4Ru-']],
  [['C2H2O2'], ['C2H2O4'], ['CO2'], ['CO2']],
  [['C12H16'], ['C7H12O2']],
];
frames.forEach(fr => {
  const ex = expect[fr.i];
  const got = fr.an.map(a => a.comps.map(c => c.f).sort());
  const want = ex.map(x => x.slice().sort());
  check(`第 ${fr.i + 1} 帧物种：${want.map(x => x.join(' + ')).join(' │ ') || '（无结构）'}`, JSON.stringify(got) === JSON.stringify(want), got.map(x => x.join(' + ')).join(' │ '));
});

// ───────── 每一步的元素与电荷守恒（未画出的试剂 / 副产物在这里声明） ─────────
const C = (fi, k, j = 0) => { const c = frames[fi].an[k].comps[j]; return { el: c.el, q: c.q }; };
const ALL = (fi, k) => frames[fi].an[k].comps.map(c => ({ el: c.el, q: c.q }));
const RuO4 = S('O4Ru'), RuO2 = S('O2Ru'), H2O = S('H2O'), Hp = S('H', 1);
balance('第 3 帧：C₁₂H₁₆ + RuO₄ → 环状钌(VI)酸酯', ALL(2, 0), [C(2, 1)]);
balance('第 4 帧：钌酸酯 → 二烯二醛 + RuO₂', [C(3, 0)], [C(3, 1), C(3, 2)]);
balance('第 6 帧（成酯）：二烯二醛 + RuO₄ → C1–C2 钌酸酯', [C(3, 1), RuO4], [C(5, 0)]);
balance('第 6 帧（碎裂）：钌酸酯 → 酮烯醛 + 乙二醛 + RuO₂', [C(5, 0)], [C(5, 1), C(5, 2), RuO2]);
balance('第 7 帧（成酯）：酮烯醛 + RuO₄ → C5–C6 钌酸酯', [C(5, 1), RuO4], [C(6, 0)]);
balance('第 7 帧（碎裂）：钌酸酯 → α-酮醛 + 乙二醛 + RuO₂', [C(6, 0)], [C(6, 1), C(6, 2), RuO2]);
balance('第 8 帧（成酯）：α-酮醛 + H₂O + RuO₄ → 水合物钌(VIII)酸酯', [C(6, 1), H2O, RuO4], [C(7, 0)]);
balance('第 8 帧（消除）：→ α-酮酸 + H₂RuO₄', [C(7, 0)], [C(7, 1), C(7, 2)]);
balance('第 9 帧（成酯）：α-酮酸 + H₂O + RuO₄ − H⁺ → 酮水合物钌(VIII)酸酯（羧酸根）', [C(7, 1), H2O, RuO4], [C(8, 0), Hp]);
balance('第 9 帧（碎裂）：→ 环己甲酸 + CO₂ + HRuO₄⁻', [C(8, 0)], [C(8, 1), C(8, 2), C(8, 3)]);
balance('第 10 帧：OHC–CHO + 2 RuO₄ + 2 H₂O → HOOC–COOH + 2 H₂RuO₄', [C(9, 0), RuO4, RuO4, H2O, H2O], [C(9, 1), S('H2O4Ru'), S('H2O4Ru')]);
balance('第 10 帧：HOOC–COOH + RuO₄ → 2 CO₂ + H₂RuO₄', [C(9, 1), RuO4], [C(9, 2), C(9, 3), S('H2O4Ru')]);
// 页面上写出的方程式
const nx = (sp, n) => Array(n).fill(sp);
balance('总式：C₁₂H₁₆ + 14 NaIO₄ → C₇H₁₂O₂ + 5 CO₂ + 2 H₂O + 14 NaIO₃', [C(0, 0), ...nx(S('NaIO4'), 14)], [C(0, 1), ...nx(C(8, 2), 5), H2O, H2O, ...nx(S('NaIO3'), 14)]);
balance('催化剂活化：2 RuCl₃ + 5 NaIO₄ + 3 H₂O → 2 RuO₄ + 5 NaIO₃ + 6 HCl', [S('RuCl3'), S('RuCl3'), ...nx(S('NaIO4'), 5), ...nx(H2O, 3)], [C(1, 0), C(1, 0), ...nx(S('NaIO3'), 5), ...nx(S('HCl'), 6)]);
balance('再生：RuO₂ + 2 NaIO₄ → RuO₄ + 2 NaIO₃', [RuO2, S('NaIO4'), S('NaIO4')], [RuO4, S('NaIO3'), S('NaIO3')]);
balance('再生：H₂RuO₄ + NaIO₄ → RuO₄ + NaIO₃ + H₂O', [C(7, 2), S('NaIO4')], [RuO4, S('NaIO3'), H2O]);

// ───────── 电子记账：碳的氧化态之和的变化 = 页面上写的电子数；Ru 价态变化与之相抵 ─────────
const oxC = (fi, k, j = 0) => frames[fi].an[k].comps[j].oxC;
const oxRu = (fi, k, j = 0) => frames[fi].an[k].comps[j].oxRu;
const e = (name, val, want) => check(`${name} = ${want} e⁻`, val === want, val);
const sub0 = frames[2].an[0].comps.find(c => c.el.C), ru0 = frames[2].an[0].comps.find(c => c.el.Ru && !c.el.C);
e('① 环加成：酯的碳氧化态 − 苯的碳氧化态', oxC(2, 1) - sub0.oxC, 2);
check('① 环加成：Ru VIII → VI（得 2 e⁻）', ru0.oxRu === 8 && oxRu(2, 1) === 6, `${ru0.oxRu} → ${oxRu(2, 1)}`);
e('① 碎裂：二烯二醛 − 酯', oxC(3, 1) - oxC(3, 0), 2);
check('① 碎裂：Ru VI → IV', oxRu(3, 0) === 6 && oxRu(3, 2) === 4, `${oxRu(3, 0)} → ${oxRu(3, 2)}`);
e('② C1=C2 断裂（成酯 + 碎裂）：产物 − 二烯二醛', oxC(5, 1) + oxC(5, 2) - oxC(3, 1), 4);
e('② 其中碎裂一步：产物 − 酯', oxC(5, 1) + oxC(5, 2) - oxC(5, 0), 2);
e('③ C5=C6 断裂（成酯 + 碎裂）：产物 − 酮烯醛', oxC(6, 1) + oxC(6, 2) - oxC(5, 1), 4);
e('④ 醛 → 酸：α-酮酸 − α-酮醛', oxC(7, 1) - oxC(6, 1), 2);
check('④ Ru VIII → VI', oxRu(7, 0) === 8 && oxRu(7, 2) === 6, `${oxRu(7, 0)} → ${oxRu(7, 2)}`);
e('⑤ 氧化脱羧：（环己甲酸 + CO₂）− α-酮酸', oxC(8, 1) + oxC(8, 2) - oxC(7, 1), 2);
check('⑤ Ru VIII → VI', oxRu(8, 0) === 8 && oxRu(8, 3) === 6, `${oxRu(8, 0)} → ${oxRu(8, 3)}`);
e('⑥ 乙二醛 → 草酸（每分子）', oxC(9, 1) - oxC(9, 0), 4);
e('⑥ 草酸 → 2 CO₂（每分子）', oxC(9, 2) + oxC(9, 3) - oxC(9, 1), 2);
const total = (oxC(0, 1) + 5 * oxC(8, 2)) - oxC(0, 0);
e('全程：（环己甲酸 + 5 CO₂）− 环己基苯', total, 28);
e('分步之和：3 × 4 + 2 + 2 + 2 × (4 + 2)', 3 * 4 + 2 + 2 + 2 * (4 + 2), 28);
check('28 e⁻ ÷ 2 e⁻（IO₄⁻ → IO₃⁻）= 14 当量 NaIO₄', total / 2 === 14, total / 2);

// ───────── 结构判断 ─────────
const bondsOf = m => m.B.filter(b => b.o === 1 || b.o === 2);
const has = (m, a, b, o) => m.B.some(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (o == null || x.o === o));
const ccDbl = m => bondsOf(m).filter(b => b.o === 2 && !m.A[b.a].lab && !m.A[b.b].lab);
const allMols = frames.flatMap(fr => fr.mols.map((m, k) => ({ fr: fr.i, m, a: fr.an[k] })));
const withC1 = allMols.filter(x => x.m.A.c1);
check('C1 在每一帧都连着环己基（C1–y1 键从不断开）', withC1.every(x => has(x.m, 'c1', 'y1', 1)), withC1.length + ' 个结构');
check('C1 在每一帧都不带 H（从 ipso 碳到羧基碳，从未被质子化或还原）', withC1.every(x => x.a.hImp.c1 === 0));
const sub = frames[0].mols[0];
check('原料：苯环 Kekulé 式三根 C=C（C1=C2、C3=C4、C5=C6），C1 连环己基', ccDbl(sub).length === 3 && has(sub, 'c1', 'c2', 2) && has(sub, 'c3', 'c4', 2) && has(sub, 'c5', 'c6', 2));
const est = frames[2].mols[1];
check('① 酯：C3、C4 各连一个 O，O–Ru–O 与 C3–C4 闭合成五元环', has(est, 'c3', 'oa', 1) && has(est, 'c4', 'ob', 1) && has(est, 'oa', 'ru', 1) && has(est, 'ob', 'ru', 1) && has(est, 'c3', 'c4', 1));
check('① 酯：C3、C4 变成 sp³，各剩一个 H；环上还剩 C1=C2、C5=C6', frames[2].an[1].hImp.c3 === 1 && frames[2].an[1].hImp.c4 === 1 && ccDbl(est).length === 2);
const dial = frames[3].mols[1];
check('① 开环：C3–C4 键不再存在，C3、C4 各成为醛基（C=O，带一个 H）', !has(dial, 'c3', 'c4') && has(dial, 'c3', 'oa', 2) && has(dial, 'c4', 'ob', 2) && frames[3].an[1].hImp.c3 === 1 && frames[3].an[1].hImp.c4 === 1);
check('① 开环：二烯二醛保留 C1=C2、C5=C6，且 C2–C3、C4–C5 共轭', has(dial, 'c1', 'c2', 2) && has(dial, 'c5', 'c6', 2) && has(dial, 'c2', 'c3', 1) && has(dial, 'c4', 'c5', 1));
check('① 原子去向：酯里 C3、C4 上的 O（oa、ob）就是醛基的 O', est.A.oa && dial.A.oa && est.A.ob && dial.A.ob);
const ke = frames[5].mols[1];
check('② C1 成为酮羰基（连环己基、C6 和 =O）', has(ke, 'c1', 'o1', 2) && has(ke, 'c1', 'y1', 1) && has(ke, 'c1', 'c6', 1) && !ke.A.c2);
check('② C2、C3 以乙二醛离开（两个醛基碳直接相连）', has(frames[5].mols[2], 'c2', 'c3', 1) && has(frames[5].mols[2], 'c2', 'o2', 2) && has(frames[5].mols[2], 'c3', 'oa', 2));
const kald = frames[6].mols[1];
check('③ 剩下的是 α-酮醛：C1(=O)–C6H=O', has(kald, 'c1', 'o1', 2) && has(kald, 'c1', 'c6', 1) && has(kald, 'c6', 'o6', 2) && frames[6].an[1].hImp.c6 === 1 && ccDbl(kald).length === 0);
check('③ C4、C5 以乙二醛离开', has(frames[6].mols[2], 'c4', 'c5', 1));
const hyd = frames[7].mols[0];
check('④ 酯：C6 同时连 H、OH 和 O–Ru（醛水合物的钌酸酯）', has(hyd, 'c6', 'h6', 1) && has(hyd, 'c6', 'o6', 1) && has(hyd, 'c6', 'oe', 1) && has(hyd, 'oe', 'ru', 1) && frames[7].an[0].hImp.c6 === 0);
check('④ 被夺走的 H 与接受它的 Ru=O 之间画了虚线（五元环过渡态 H–C–O–Ru=O）', hyd.B.some(b => b.o === 'h' && [b.a, b.b].sort().join() === 'h6,ox') && has(hyd, 'ru', 'ox', 2));
const kac = frames[7].mols[1];
check('④ 产物 α-酮酸：C6 是 COOH，C1 仍是酮', has(kac, 'c6', 'oe', 2) && has(kac, 'c6', 'o6', 1) && kac.A.o6.suf === 'H' && has(kac, 'c1', 'o1', 2));
const dc = frames[8].mols[0];
check('⑤ 酯：C1 连 OH 与 O–Ru，C6 是羧酸根（C1–C6 断开时 CO₂ 从 C6 离开）', has(dc, 'c1', 'o1', 1) && has(dc, 'c1', 'ow', 1) && has(dc, 'ow', 'ru', 1) && has(dc, 'c6', 'oe', 2) && dc.A.o6.chg === '-');
const fin = frames[8].mols[1];
check('最终产物：C1 是羧基碳（C1=O 与 C1–OH），只连环己基一个碳', has(fin, 'c1', 'ow', 2) && has(fin, 'c1', 'o1', 1) && fin.A.o1.suf === 'H' && bondsOf(fin).filter(b => b.a === 'c1' || b.b === 'c1').length === 3);
check('最终产物与总览、回顾两帧画的是同一个结构（C₇H₁₂O₂）', frames[0].an[1].comps[0].f === 'C7H12O2' && frames[10].an[1].comps[0].f === 'C7H12O2' && frames[8].an[1].comps[0].f === 'C7H12O2');
check('C6 最后在 CO₂ 里（青色圈画在 CO₂ 的碳上）', frames[8].mols[2].A.c6 && frames[8].mols[2].A.c6.halo === 'teal');
check('环己基六个碳在每一帧都是 C6H11（不被氧化）', allMols.filter(x => x.m.A.y1).every(x => ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'].every(id => x.a.ox[id] === (id === 'y1' ? -1 : -2))));

const passed = checks.filter(c => c.ok).length;
const out = { topic: 'ruo4-phenyl-to-cooh', generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks };
fs.writeFileSync(path.join(here, '..', 'verification.json'), JSON.stringify(out, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过`);
if (passed !== checks.length) process.exit(1);
