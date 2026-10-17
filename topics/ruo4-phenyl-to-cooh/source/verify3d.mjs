// 3D 动画核验：逐个关键帧检查显式氢下的价键、电荷、Ru 氧化态与分子式（与 2D 分步图对照），
// 每次过渡进出场的原子组成、弯箭头引用的原子与键、几何质量（键长、非键碰撞、苯环平面、椅式、顺式加成）。
// 运行：deno run -A source/verify3d.mjs → ../verification-3d.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KF, SCENES } from './mech3d.js';
import { TOTAL, frame, makeCam } from './render3d.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = [], check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });
const VE = { C: 4, H: 1, O: 6, Ru: 8 };
const kk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const has = (K, a, b) => !!K.B[kk(a, b)] && K.B[kk(a, b)] !== 'h';
const nb = (K, id) => Object.keys(K.B).filter(k => K.B[k] !== 'h').map(k => k.split('|')).filter(([a, b]) => a === id || b === id).map(([a, b]) => [a === id ? b : a, K.B[kk(a, b)]]);
const hill = el => { const ks = Object.keys(el); const o = ks.includes('C') ? ['C', 'H', ...ks.filter(k => k !== 'C' && k !== 'H').sort()] : ks.sort(); return o.filter(k => el[k]).map(k => k + (el[k] > 1 ? el[k] : '')).join(''); };
function comps(K) {
  const seen = new Set(), out = [];
  for (const id in K.A) {
    if (seen.has(id)) continue;
    const st = [id], mem = [];
    seen.add(id);
    while (st.length) { const u = st.pop(); mem.push(u); for (const [v] of nb(K, u)) if (!seen.has(v)) { seen.add(v); st.push(v); } }
    const el = {}; let q = 0;
    mem.forEach(u => { el[K.A[u].el] = (el[K.A[u].el] || 0) + 1; q += K.A[u].chg || 0; });
    out.push({ mem, f: hill(el) + (q ? (q < 0 ? '-' : '+') : ''), el, q });
  }
  return out;
}

// ───────── 价键、电荷、Ru 氧化态 ─────────
const bad = [];
KF.forEach((K, i) => {
  for (const id in K.A) {
    const a = K.A[id], s = nb(K, id).reduce((t, x) => t + x[1], 0), q = a.chg || 0;
    if (a.el === 'C' && s !== 4) bad.push(`KF${i} ${id}：碳键级和 ${s}`);
    if (a.el === 'H' && s !== 1) bad.push(`KF${i} ${id}：氢键数 ${s}`);
    if (a.el === 'O' && s !== 2 + q) bad.push(`KF${i} ${id}：氧键数 ${s}，电荷 ${q}`);
    if (a.el === 'Ru') {
      if (s + q !== a.ox) bad.push(`KF${i} Ru：按键算 ${s + q}，标注 ${a.ox}`);
      if (nb(K, id).some(([v]) => K.A[v].el !== 'O')) bad.push(`KF${i} Ru 连了非氧原子`);
    }
  }
  comps(K).forEach(c => { const e = Object.entries(c.el).reduce((t, [k, n]) => t + VE[k] * n, 0) - c.q; if (e % 2) bad.push(`KF${i} ${c.f} 电子数为奇数`); });
});
check(`全部 ${KF.length} 个关键帧：显式氢下 C 四价、O 二价（带电荷相应增减）、H 一价；Ru 氧化态 = 键级和 + 形式电荷 = 标注值；无自由基`, bad.length === 0, bad.join('；') || '无问题');

// ───────── 物种：与 2D 分步图同一阶段的分子式逐一对照 ─────────
const want = [['C12H16', 'O4Ru'], ['C12H16', 'O4Ru'], ['C12H16O4Ru'], ['C12H16O2', 'O2Ru'], ['C12H16O2', 'O4Ru'], ['C12H16O6Ru'], ['C10H14O2', 'C2H2O2', 'O2Ru'], ['C10H14O2', 'O4Ru'], ['C10H14O6Ru'], ['C8H12O2', 'C2H2O2', 'O2Ru'], ['C8H14O7Ru'], ['C8H12O3', 'H2O4Ru'], ['C8H13O8Ru-'], ['C7H12O2', 'CO2', 'HO4Ru-'], ['C7H12O2'], ['C7H12O2']];
KF.forEach((K, i) => {
  const got = comps(K).map(c => c.f).sort(), w = want[i].slice().sort();
  check(`KF${i} 物种 = ${w.join(' + ')}`, JSON.stringify(got) === JSON.stringify(w), got.join(' + '));
});

// ───────── 过渡：离场 / 进场的原子组成，且每个都有飞入 / 飞出方向 ─────────
const formulaOf = (K, ids) => { const el = {}; ids.forEach(id => { el[K.A[id].el] = (el[K.A[id].el] || 0) + 1; }); return hill(el); };
const trans = { 4: ['', 'O2', '2 个 O（来自 2 IO₄⁻）'], 7: ['C2H2O2', 'O2', '乙二醛离开；2 个 O 进来'], 10: ['C2H2O2', 'H2O3', '乙二醛离开；2 个 O + 1 H₂O 进来'], 12: ['H3O', 'H2O2', 'H₂O + H⁺ 离开；1 个 O + 1 H₂O 进来'], 14: ['CHO6Ru', '', 'CO₂ + HRuO₄⁻ 离开'] };
for (let i = 1; i < KF.length; i++) {
  const A = KF[i - 1], B = KF[i];
  const gone = Object.keys(A.A).filter(id => !B.A[id]), came = Object.keys(B.A).filter(id => !A.A[id]);
  const t = trans[i], g = gone.length ? formulaOf(A, gone) : '', c = came.length ? formulaOf(B, came) : '';
  const ok = (t ? g === t[0] && c === t[1] : !gone.length && !came.length) && gone.every(id => B.leave[id]) && came.every(id => B.enter[id]);
  check(`KF${i - 1}→KF${i}：${t ? t[2] : '原子不增不减'}`, ok, `离场 ${g || '无'}（${gone.join(',')}）进场 ${c || '无'}（${came.join(',')}）`);
}

// ───────── 弯箭头 ─────────
const arrBad = [];
let nArr = 0;
SCENES.forEach((s, i) => s.arrows.forEach(([p0, p2]) => {
  nArr++;
  const K = KF[s.k1], K2 = KF[s.k2];
  for (const r of [p0, p2]) for (const id of r.slice(1)) if (!K.A[id]) arrBad.push(`幕${i + 1} 缺原子 ${id}`);
  if (p0[0] === 'b' && !has(K, p0[1], p0[2])) arrBad.push(`幕${i + 1} 起点键 ${p0[1]}–${p0[2]} 不存在`);
  if (p2[0] === 'm' && has(K, p2[1], p2[2])) arrBad.push(`幕${i + 1} 新键 ${p2[1]}–${p2[2]} 已存在`);
  if (p2[0] === 'm' && !has(K2, p2[1], p2[2])) arrBad.push(`幕${i + 1} 新键 ${p2[1]}–${p2[2]} 在产物里没有形成`);
  if (p2[0] === 'b' && !has(K2, p2[1], p2[2])) arrBad.push(`幕${i + 1} 终点键 ${p2[1]}–${p2[2]} 在产物里不存在`);
}));
check(`${nArr} 根弯箭头：引用的原子都在场，起点键存在，箭头指向的新键在产物里确实形成`, arrBad.length === 0, arrBad.join('；') || '无问题');

// ───────── 几何质量 ─────────
const sub = (a, b) => a.map((x, i) => x - b[i]), crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const dist = (K, a, b) => Math.hypot(...sub(K.A[a].p, K.A[b].p));
const T = { CC1: 1.53, CC2: 1.34, CH1: 1.09, CO1: 1.42, CO2: 1.21, HO1: 0.97, ORu1: 1.96, ORu2: 1.71 };
let worst = 0, ww = '', clash = 9, cw = '';
KF.forEach((K, i) => {
  for (const k in K.B) {
    if (K.B[k] === 'h') continue;
    const [a, b] = k.split('|'), e = [K.A[a].el, K.A[b].el].sort().join('') + K.B[k];
    let t = T[e];
    if (i < 2 && /^c\d\|c\d$/.test(k)) t = 1.39;
    if (e === 'CO2' && nb(K, K.A[a].el === 'C' ? a : b).filter(x => x[1] === 2).length === 2) t = 1.17;
    const dv = Math.abs(dist(K, a, b) - t) / t;
    if (dv > worst) { worst = dv; ww = `KF${i} ${k} ${dist(K, a, b).toFixed(2)} Å`; }
  }
  const ids = Object.keys(K.A);
  for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
    const a = ids[x], b = ids[y];
    if (has(K, a, b) || nb(K, a).some(([v]) => has(K, v, b)) || K.B[kk(a, b)] === 'h') continue;
    const d = dist(K, a, b), lim = K.A[a].el === 'H' || K.A[b].el === 'H' ? 1.75 : 2.3;
    if (d / lim < clash) { clash = d / lim; cw = `KF${i} ${a}···${b} ${d.toFixed(2)} Å`; }
  }
});
check('所有关键帧的键长与目标值相差 < 8%', worst < 0.08, `最大偏差 ${(worst * 100).toFixed(1)}%（${ww}）`);
check('非键原子不相撞（重原子 ≥ 2.3 Å，含 H ≥ 1.75 Å；1-3 关系除外）', clash >= 1, `最近 ${cw}`);
const K0 = KF[0], P0 = id => K0.A[id].p, nR = nrm(crs(sub(P0('c2'), P0('c1')), sub(P0('c6'), P0('c1'))));
const flat = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'h2', 'h3', 'h4', 'h5', 'h6'].map(id => dot(sub(P0(id), P0('c1')), nR));
check('起始苯环（连同环上 H）是平面：偏离平面 < 0.1 Å（示意几何）', flat.every(v => Math.abs(v) < 0.1), flat.map(v => v.toFixed(3)).join(','));
const tors = (K, a, b, c, d) => { const p = id => K.A[id].p, b1 = sub(p(b), p(a)), b2 = sub(p(c), p(b)), b3 = sub(p(d), p(c)), n1 = crs(b1, b2), n2 = crs(b2, b3); return Math.atan2(dot(crs(n1, n2), nrm(b2)), dot(n1, n2)) * 180 / Math.PI; };
const y = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'];
const chair = KF.map(K => y.map((_, k) => tors(K, y[k], y[(k + 1) % 6], y[(k + 2) % 6], y[(k + 3) % 6])));
check('环己基全程保持椅式：六个环内二面角为 ±(55 ± 12)°，且正负交替', chair.every(t => t.every((v, k) => Math.abs(Math.abs(v) - 55) < 12 && Math.sign(v) === -Math.sign(t[(k + 1) % 6]))), chair[0].map(v => v.toFixed(0)).join(','));
const E = KF[2], side = (id, ref) => Math.sign(dot(sub(E.A[id].p, E.A[ref].p), nR));
check('① 两个新 C–O 键在苯环同一面（顺式加成），C3、C4 上的 H 被推到另一面', side('q1', 'c3') === side('q2', 'c4') && side('h3', 'c3') === -side('q1', 'c3') && side('h4', 'c4') === -side('q2', 'c4'));
check('① RuO₄ 从苯环平面上方靠近，两个 O 对准 C3、C4（O···C ≈ 2.75 Å）', Math.abs(dist(KF[1], 'q1', 'c3') - 2.75) < 0.3 && Math.abs(dist(KF[1], 'q2', 'c4') - 2.75) < 0.3 && dot(sub(KF[1].A.ru.p, KF[1].A.c3.p), nR) > 1.5, `${dist(KF[1], 'q1', 'c3').toFixed(2)} / ${dist(KF[1], 'q2', 'c4').toFixed(2)} Å`);
check('② RuO₄ 从另一面（下方）靠近 C1=C2', dot(sub(KF[4].A.ru.p, KF[4].A.c1.p), nR) < -1.5);
check('C1 全程连着环己基 y1、不带 H；最后是羧基碳（C1=O 与 C1–OH）', KF.every(K => has(K, 'c1', 'y1') && !nb(K, 'c1').some(([v]) => K.A[v].el === 'H')) && KF[15].B[kk('c1', 'ow2')] === 2 && KF[15].B[kk('c1', 'q3')] === 1 && has(KF[15], 'hw3', 'q3'));
check('C6 最后在 CO₂ 里（KF13：C6 两个 C=O）', KF[13].B[kk('c6', 'ow')] === 2 && KF[13].B[kk('c6', 'p2')] === 2);

// ───────── 渲染：全程逐帧跑一遍 ─────────
let nanBad = 0, frames = 0;
const cam = makeCam(-0.6, 0.42, 36, 340, 180);
for (let t = 0; t < TOTAL; t += 0.05) { const f = frame(t, cam); frames++; if (/NaN|undefined/.test(f.svg)) nanBad++; }
check(`全程 ${TOTAL.toFixed(1)} s 每 0.05 s 渲染一帧（${frames} 帧），无 NaN / undefined`, nanBad === 0, nanBad);

const passed = checks.filter(c => c.ok).length;
fs.writeFileSync(path.join(here, '..', 'verification-3d.json'), JSON.stringify({ topic: 'ruo4-phenyl-to-cooh', generated: new Date().toISOString().slice(0, 10), passed, total: checks.length, checks }, null, 2) + '\n');
for (const c of checks) if (!c.ok) console.log('✗', c.name, '—', c.detail);
console.log(`${passed} / ${checks.length} 项通过`);
if (passed !== checks.length) process.exit(1);
