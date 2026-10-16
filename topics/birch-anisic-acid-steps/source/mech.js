// 分步机理：手写的 2D 结构式绘制引擎 + 11 帧数据。
// 页面（app.js）和核验脚本（verify.mjs）共用同一份数据；纯函数，不碰 DOM。
// build.mjs 内联进页面时会去掉行首的 export。

export const REG = { on: false, list: [] }; // verify.mjs 打开后，每次 draw(m) 都把分子记下来

const INK = 'var(--ink)', MUT = 'var(--ink-faint)', RED = 'var(--arrow)';
let L = 34;
const R = v => Math.round(v * 10) / 10;
const P = (x, y) => ({ x: x, y: y });
const rad = g => g * Math.PI / 180;
const pol = (p, g, d) => P(p.x + d * Math.cos(rad(g)), p.y + d * Math.sin(rad(g)));
const mid = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2);
const tow = (a, b, d) => { const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1; return P(a.x + dx / n * d, a.y + dy / n * d); };
const HW = { O: 5.4, H: 5.2, B: 4.8 };
const it = s => '<tspan font-style="italic">' + s + '</tspan>';

function ln(a, b, col, w, dash) {
  return `<line x1="${R(a.x)}" y1="${R(a.y)}" x2="${R(b.x)}" y2="${R(b.y)}" style="stroke:${col || INK};stroke-width:${w || 1.5}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}
function tx(x, y, s, cls, anc) {
  return `<text class="${cls || 't'}" x="${R(x)}" y="${R(y)}" text-anchor="${anc || 'middle'}" dominant-baseline="central">${s}</text>`;
}
function head(t, g, col, hl, hw) {
  const ux = Math.cos(rad(g)), uy = Math.sin(rad(g));
  const b = P(t.x - ux * hl * 0.7, t.y - uy * hl * 0.7), l = P(t.x - ux * hl - uy * hw, t.y - uy * hl + ux * hw), r = P(t.x - ux * hl + uy * hw, t.y - uy * hl - ux * hw);
  return `<polygon points="${R(t.x)},${R(t.y)} ${R(l.x)},${R(l.y)} ${R(b.x)},${R(b.y)} ${R(r.x)},${R(r.y)}" style="fill:${col}"/>`;
}
// 弯箭头：二次贝塞尔，bend > 0 时向前进方向的左侧鼓出
function arr(p0, p2, bend) {
  const dx = p2.x - p0.x, dy = p2.y - p0.y, d = Math.hypot(dx, dy) || 1;
  const c = P((p0.x + p2.x) / 2 + dy / d * bend, (p0.y + p2.y) / 2 - dx / d * bend);
  const g = Math.atan2(p2.y - c.y, p2.x - c.x) * 180 / Math.PI;
  const e = P(p2.x - Math.cos(rad(g)) * 5, p2.y - Math.sin(rad(g)) * 5);
  return `<path class="arrow" d="M${R(p0.x)} ${R(p0.y)} Q${R(c.x)} ${R(c.y)} ${R(e.x)} ${R(e.y)}" style="fill:none;stroke:${RED};stroke-width:1.4" stroke-linecap="round"/>` + head(p2, g, RED, 7.5, 3.4);
}
function Mol(cx, cy, dbl, nums) {
  const m = { A: {}, B: [], c: P(cx, cy), nums: nums || [1, 2] };
  const h = L * Math.sqrt(3) / 2, off = [[h, -L / 2], [0, -L], [-h, -L / 2], [-h, L / 2], [0, L], [h, L / 2]];
  off.forEach((o, i) => { m.A['c' + (i + 1)] = { x: cx + o[0], y: cy + o[1] }; });
  m.A.c1.halo = 'purple'; m.A.c2.halo = 'teal';
  const D = dbl || [];
  for (let i = 1; i <= 6; i++) {
    const j = i % 6 + 1;
    m.B.push({ a: 'c' + i, b: 'c' + j, o: (D.indexOf('' + i + j) > -1 || D.indexOf('' + j + i) > -1) ? 2 : 1, ring: true });
  }
  return m;
}
function at(m, id, p, o) { m.A[id] = Object.assign({ x: p.x, y: p.y }, o || {}); return m.A[id]; }
function bd(m, a, b, o) { m.B.push({ a: a, b: b, o: o || 1 }); }
function ends(m, b) {
  const A = m.A[b.a], B = m.A[b.b];
  let p = P(A.x, A.y), q = P(B.x, B.y);
  if (A.lab) p = tow(P(A.x, A.y), B, A.clip || 8.5);
  if (B.lab) q = tow(P(B.x, B.y), A, B.clip || 8.5);
  return [p, q];
}
function bm(m, a, b, k) {
  const e = ends(m, { a: a, b: b }), M = mid(e[0], e[1]);
  if (!k) return M;
  const dx = e[1].x - e[0].x, dy = e[1].y - e[0].y, n = Math.hypot(dx, dy);
  return P(M.x - dy / n * k, M.y + dx / n * k);
}
function bondSVG(m, b) {
  const e = ends(m, b), p = e[0], q = e[1];
  if (b.o === 'h') return ln(p, q, MUT, 1.3, '2 3');
  if (b.o !== 2) return ln(p, q);
  const dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
  let nx = -uy, ny = ux;
  if (b.ring) {
    const M = mid(p, q);
    if ((m.c.x - M.x) * nx + (m.c.y - M.y) * ny < 0) { nx = -nx; ny = -ny; }
    return ln(p, q) + ln(P(p.x + nx * 5 + ux * 6, p.y + ny * 5 + uy * 6), P(q.x + nx * 5 - ux * 6, q.y + ny * 5 - uy * 6));
  }
  const o = 2.6;
  return ln(P(p.x + nx * o, p.y + ny * o), P(q.x + nx * o, q.y + ny * o)) + ln(P(p.x - nx * o, p.y - ny * o), P(q.x - nx * o, q.y - ny * o));
}
function chg(p, s) {
  let o = `<circle cx="${R(p.x)}" cy="${R(p.y)}" r="5.2" style="fill:none;stroke:${INK};stroke-width:1"/>` + ln(P(p.x - 2.7, p.y), P(p.x + 2.7, p.y), INK, 1.1);
  if (s === '+') o += ln(P(p.x, p.y - 2.7), P(p.x, p.y + 2.7), INK, 1.1);
  return o;
}
function dot(p, r) { return `<circle cx="${R(p.x)}" cy="${R(p.y)}" r="${r}" style="fill:${INK}"/>`; }
function atomSVG(m, id) {
  const a = m.A[id];
  let s = '';
  const out = Math.atan2(a.y - m.c.y, a.x - m.c.x) * 180 / Math.PI;
  if (a.lab) {
    const hw = HW[a.lab] || 5.2;
    s += tx(a.x, a.y, a.lab);
    if (a.suf) s += tx(a.x + hw, a.y, a.suf, 't', 'start');
    if (a.pre) s += tx(a.x - hw, a.y, a.pre, 't', 'end');
  }
  (a.lp || []).forEach(g => {
    const c = pol(a, g, a.lab ? 11 : 8), px = -Math.sin(rad(g)) * 2.6, py = Math.cos(rad(g)) * 2.6;
    s += dot(P(c.x + px, c.y + py), 1.4) + dot(P(c.x - px, c.y - py), 1.4);
  });
  if (a.chg) s += chg(pol(a, a.ca != null ? a.ca : (a.lab ? -45 : out), a.cd || (a.lab ? 12 : (a.halo ? 16 : 11))), a.chg);
  if (a.rad != null) s += dot(pol(a, a.rad, a.halo ? 15 : 9), 2.4);
  return s;
}
function draw(m) {
  if (REG.on) REG.list.push(m);
  let s = '';
  const hr = Math.max(8, L * 0.31);
  for (const id in m.A) { const a = m.A[id]; if (a.halo) s += `<circle class="c-${a.halo}" cx="${R(a.x)}" cy="${R(a.y)}" r="${R(hr)}" stroke-width="0.5"/>`; }
  m.nums.forEach(n => {
    const a = m.A['c' + n], p = P(m.c.x + (a.x - m.c.x) * 0.5, m.c.y + (a.y - m.c.y) * 0.5), t = tx(p.x, p.y, n, 'ts');
    s += n === 1 ? `<g class="c-purple">${t}</g>` : n === 2 ? `<g class="c-teal">${t}</g>` : t;
  });
  m.B.forEach(b => { s += bondSVG(m, b); });
  for (const id in m.A) s += atomSVG(m, id);
  return s;
}
function OMe(m, ox) {
  const o = at(m, 'o2', pol(m.A.c2, -90, L), { lab: 'O' });
  at(m, 'me', pol(o, -30, L), { lab: 'Me', clip: 12 });
  bd(m, 'c2', 'o2', ox ? 2 : 1); bd(m, 'o2', 'me');
  if (ox) { o.chg = '+'; o.ca = -145; }
  return o;
}
function ket(m) { const o = at(m, 'o2', pol(m.A.c2, -90, L), { lab: 'O' }); bd(m, 'c2', 'o2', 2); return o; }
function enol(m) { const o = at(m, 'o2', pol(m.A.c2, -90, L), { lab: 'O', suf: 'H' }); bd(m, 'c2', 'o2'); return o; }
function hemi(m, prot) {
  const oh = at(m, 'o2', pol(m.A.c2, -50, L), { lab: 'O', suf: 'H' }), om = at(m, 'om', pol(m.A.c2, -130, L), { lab: 'O', pre: 'Me' });
  bd(m, 'c2', 'o2'); bd(m, 'c2', 'om');
  if (prot) { om.chg = '+'; om.ca = -30; at(m, 'hm', pol(om, -90, 24), { lab: 'H', clip: 7.5 }); bd(m, 'om', 'hm'); }
  return { oh: oh, om: om };
}
function CO2(m, kind) {
  const cc = at(m, 'cc', pol(m.A.c1, -30, L)), oa = at(m, 'oa', pol(cc, -90, L), { lab: 'O' }), ob = at(m, 'ob', pol(cc, 30, L), { lab: 'O' });
  const ene = kind === 'ene';
  bd(m, 'c1', 'cc', ene ? 2 : 1); bd(m, 'cc', 'oa'); bd(m, 'cc', 'ob', ene ? 1 : 2);
  if (kind === 'acid') oa.suf = 'H';
  if (kind === 'anion' || ene) oa.chg = '-';
  if (ene) ob.chg = '-';
  if (kind === 'ts') { at(m, 'ha', pol(oa, -150, L), { lab: 'H', clip: 7.5 }); bd(m, 'oa', 'ha'); }
  return { cc: cc, oa: oa, ob: ob };
}
function Bu(m, g) { const b = at(m, 'bu', pol(m.A.c1, g, L), { lab: 'Bu', clip: 12 }); bd(m, 'c1', 'bu'); return b; }
function chain(m) { let prev = 'c1'; [-30, 30, -30, 30].forEach((g, i) => { at(m, 'k' + i, pol(m.A[prev], g, L)); bd(m, prev, 'k' + i); prev = 'k' + i; }); }
function rx(x1, x2, y, top, bot) {
  let s = ln(P(x1, y), P(x2 - 5, y), INK, 1.3) + head(P(x2, y), 0, INK, 9, 4);
  const xm = (x1 + x2) / 2;
  (top || []).forEach((t, i, A) => { s += tx(xm, y - 12 - (A.length - 1 - i) * 16, t, 'ts'); });
  (bot || []).forEach((t, i) => { s += tx(xm, y + 13 + i * 16, t, 'ts'); });
  return s;
}
function res(x1, x2, y) { return ln(P(x1 + 5, y), P(x2 - 5, y), INK, 1.3) + head(P(x2, y), 0, INK, 9, 4) + head(P(x1, y), 180, INK, 9, 4); }
function box(x, y, w, h) { return `<rect x="${R(x)}" y="${R(y)}" width="${R(w)}" height="${R(h)}" rx="6" style="fill:none;stroke:${MUT};stroke-width:0.8" stroke-dasharray="3 3"/>`; }
// 弯箭头的起点：带电荷原子的电荷符号位置
const cpos = (m, id) => { const a = m.A[id], out = Math.atan2(a.y - m.c.y, a.x - m.c.x) * 180 / Math.PI; return pol(a, a.ca != null ? a.ca : (a.lab ? -45 : out), a.cd || (a.lab ? 12 : (a.halo ? 16 : 11))); };

export const STAGES = [['总览', 0], ['① Birch 还原–烷基化', 1], ['② 烯醇醚水解', 5], ['③ 脱羧与异构化', 8], ['回顾', 10]];
export const DY = [0, 9, 5, 9, 15, 11, 11, -3, -7, -2, 5];
export const FRAMES = [];
FRAMES.push({ st: 0, t: '路线总览：三步把芳环变成环己烯酮',
  c: '紫色圈 = 原 C1（连 COOH），青色圈 = 原 C2（连 OMe）。COOH 决定 Birch 还原的位置、提供烷基化位点，最后以 CO₂ 离去；OMe 在还原后变成烯醇醚，是一个“伪装的酮”。',
  d: () => {
    L = 26; let s = '', m;
    m = Mol(95, 84, ['12', '34', '56'], []); OMe(m); CO2(m, 'acid'); s += draw(m);
    s += rx(180, 265, 84, ['① Li, NH₃(l)', it('n') + '-BuBr'], ['Birch 还原–烷基化']);
    m = Mol(315, 84, ['23', '56'], []); OMe(m); CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    s += rx(400, 480, 84, ['② H₃O⁺'], ['烯醇醚水解']);
    m = Mol(530, 84, ['56'], []); ket(m); CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    s += `<path d="M530 117 V132 H40 V196 H112" style="fill:none;stroke:${INK};stroke-width:1.3"/>` + head(P(120, 196), 0, INK, 9, 4);
    s += tx(80, 184, '③ Δ, −CO₂', 'ts') + tx(80, 209, '脱羧', 'ts');
    m = Mol(185, 196, ['12', '56'], []); enol(m); Bu(m, -30); s += draw(m);
    s += rx(262, 345, 196, ['H⁺'], ['双键异构化']);
    m = Mol(400, 196, ['61'], []); ket(m); chain(m); s += draw(m);
    s += tx(532, 183, '2-丁基环己-2-烯酮', 'ts', 'start');
    return s;
  } });
FRAMES.push({ st: 1, t: '① 去质子化与第一次单电子转移',
  c: 'Li 先把 COOH 变成羧酸锂（放出 H₂）；随后溶剂化电子进入苯环，得到自由基负离子。羧基吸电子，使负电荷与单电子集中在 C1（ipso）和 C4（对位）。',
  d: () => {
    L = 32; let s = '', m;
    m = Mol(75, 135, ['12', '34', '56']); OMe(m); CO2(m, 'acid'); s += draw(m);
    s += rx(176, 248, 135, ['Li, NH₃(l)'], ['−½ H₂']);
    m = Mol(300, 135, ['12', '34', '56']); OMe(m); CO2(m, 'anion'); s += draw(m);
    s += rx(400, 468, 135, ['+ e⁻'], ['溶剂化电子']);
    m = Mol(525, 135, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'anion'); m.A.c1.rad = 30; m.A.c4.chg = '-'; s += draw(m);
    return s;
  } });
FRAMES.push({ st: 1, t: '① C4 质子化',
  c: '<i>t</i>-BuOH（或 NH₃）把质子交给电荷密度最高的 C4（羧基的对位），得到环己二烯基自由基；C1 上的单电子与羧酸根共轭而被稳定。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(232, 130, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'anion'); m.A.c1.rad = 30; m.A.c4.chg = '-';
    const H = at(m, 'hx', pol(m.A.c4, 150, 50), { lab: 'H', clip: 7.5 }), O = at(m, 'ox', pol(H, 180, 44), { lab: 'O', pre: it('t') + '-Bu' });
    bd(m, 'ox', 'hx'); s += draw(m);
    const q = cpos(m, 'c4');
    s += arr(tow(q, H, 6.5), tow(H, q, 8), -6) + arr(bm(m, 'ox', 'hx'), pol(O, 60, 11), 10);
    s += rx(345, 415, 130, [it('t') + '-BuOH'], ['C4 质子化']);
    m = Mol(495, 130, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'anion'); m.A.c1.rad = 30;
    at(m, 'h4', pol(m.A.c4, 150, L), { lab: 'H', clip: 7.5 }); bd(m, 'c4', 'h4'); s += draw(m);
    return s;
  } });
FRAMES.push({ st: 1, t: '① 第二次电子转移：烯二醇双负离子',
  c: '再得一个电子，C1 成为碳负离子；它与羧酸根共轭，可写成烯二醇盐（双负离子）。普通 Birch 还原在这里会把 C1 质子化，而本题把它留给亲电试剂。',
  d: () => {
    L = 32; let s = '', m;
    m = Mol(80, 135, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'anion'); m.A.c1.rad = 30; s += draw(m);
    s += rx(180, 245, 135, ['+ e⁻'], []);
    m = Mol(300, 135, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'anion'); m.A.c1.chg = '-'; m.A.c1.ca = 30; s += draw(m);
    s += res(402, 452, 135);
    m = Mol(512, 135, ['23', '56'], [1, 2, 4]); OMe(m); CO2(m, 'ene'); s += draw(m);
    return s;
  } });
FRAMES.push({ st: 1, t: '① C1 烷基化：构建季碳',
  c: '烯二醇盐的 C1 以 S<sub>N</sub>2 方式进攻 <i>n</i>-BuBr，形成同时连着 Bu 和 COOH 的季碳。酸化后得到 1,4-二烯：C2=C3 上连着 OMe，即烯醇醚；C5=C6 是孤立双键。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(180, 130, ['23', '56'], [1, 2, 4]); OMe(m); const g = CO2(m, 'ene'); g.oa.lp = [180];
    const b = at(m, 'bx', pol(m.A.c1, 62, 54), { lab: 'Bu', clip: 12 }), br = at(m, 'br', pol(b, 0, 46), { lab: 'Br', clip: 9.5 });
    bd(m, 'bx', 'br'); s += draw(m);
    s += arr(pol(g.oa, 163, 12.5), bm(m, 'cc', 'oa', -3), -7);
    const p1 = bm(m, 'c1', 'cc');
    s += arr(p1, tow(b, p1, 11), 12);
    s += arr(bm(m, 'bx', 'br'), pol(br, -120, 9.5), 7);
    s += rx(335, 405, 130, ['S<tspan dy="3" font-size="11">N</tspan><tspan dy="-3">2</tspan>'], ['再酸化']);
    m = Mol(490, 130, ['23', '56'], [1, 2]); OMe(m); CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    s += tx(474, 62, '烯醇醚', 'ts', 'end');
    return s;
  } });
FRAMES.push({ st: 2, t: '② 烯醇醚在 C3 质子化',
  c: '烯醇醚是富电子烯烃：H⁺ 加到 β-碳 C3，C2 上的正电荷被 OMe 的孤对电子稳定为氧鎓离子（oxocarbenium）。孤立的 C5=C6 不参与。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(232, 135, ['23', '56'], [1, 2, 3]); const o = OMe(m); o.lp = [180]; CO2(m, 'acid'); Bu(m, 30);
    const H = at(m, 'hx', pol(m.A.c3, -150, 46), { lab: 'H', clip: 7.5 }), O = at(m, 'ox', pol(H, 180, 42), { lab: 'O', pre: 'H₂', chg: '+', ca: -60 });
    bd(m, 'ox', 'hx'); s += draw(m);
    s += arr(pol(o, 163, 12.5), bm(m, 'c2', 'o2', -3), -7);
    const pm = mid(m.A.c2, m.A.c3);
    s += arr(pm, tow(H, pm, 8), -12);
    s += arr(bm(m, 'ox', 'hx'), pol(O, 50, 11), 10);
    s += rx(345, 415, 135, ['H₃O⁺'], ['C3 质子化']);
    m = Mol(500, 135, ['56'], [1, 2, 3]); OMe(m, true); CO2(m, 'acid'); Bu(m, 30);
    at(m, 'h3', pol(m.A.c3, -150, L), { lab: 'H', clip: 7.5 }); bd(m, 'c3', 'h3'); s += draw(m);
    return s;
  } });
FRAMES.push({ st: 2, t: '② 水进攻，生成半缩酮',
  c: '水加到氧鎓离子的 C2 上，再失去 H⁺ 得到半缩酮。注意：最终产物里的羰基氧来自水，而不是原来的 OMe。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(222, 135, ['56'], [1, 2, 3]); const o = OMe(m, true); CO2(m, 'acid'); Bu(m, 30);
    const W = at(m, 'w', P(m.A.c2.x - 60, m.A.c2.y - 20), { lab: 'O', pre: 'H₂', lp: [0] });
    s += draw(m);
    const w0 = pol(W, 0, 13);
    s += arr(w0, tow(m.A.c2, w0, 6), -8);
    s += arr(bm(m, 'c2', 'o2', 2.6), pol(o, 35, 10), -6);
    s += rx(345, 415, 135, ['H₂O'], ['−H⁺']);
    m = Mol(500, 135, ['56'], [1, 2, 3]); hemi(m); CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    return s;
  } });
FRAMES.push({ st: 2, t: '② 失去 MeOH，得到 β-酮酸',
  c: 'OMe 质子化后以 MeOH 离去，C2 变成酮羰基。新羰基恰好位于 COOH 的 β 位——这就是 β-酮酸，受热即可脱羧。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(222, 135, ['56'], [1, 2, 3]); const g = hemi(m, true); g.oh.lp = [180]; CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    s += arr(pol(g.oh, 168, 12.5), bm(m, 'c2', 'o2', -2.5), -7);
    s += arr(bm(m, 'c2', 'om'), pol(g.om, 125, 10), 7);
    s += rx(345, 415, 135, ['−MeOH'], ['−H⁺']);
    m = Mol(500, 135, ['56'], [1, 2]); ket(m); CO2(m, 'acid'); Bu(m, 30); s += draw(m);
    s += tx(500, 190, 'β-酮酸', 'ts');
    return s;
  } });
FRAMES.push({ st: 3, t: '③ β-酮酸脱羧：六元环过渡态',
  c: '羧基的 H 与酮羰基氧构成六元环，三对电子协同移动：放出 CO₂，同时生成烯醇。由于 C5=C6 还在，这里得到的是共轭二烯醇。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(215, 140, ['56'], [1, 2]); ket(m); CO2(m, 'ts'); Bu(m, 30); bd(m, 'ha', 'o2', 'h');
    s += draw(m);
    s += arr(bm(m, 'oa', 'ha'), bm(m, 'cc', 'oa', 3), 10);
    s += arr(bm(m, 'c1', 'cc'), bm(m, 'c1', 'c2'), -14);
    s += arr(bm(m, 'c2', 'o2', 2.6), bm(m, 'o2', 'ha'), -8);
    s += rx(340, 410, 140, ['Δ'], ['六元环 TS']);
    m = Mol(480, 140, ['12', '56'], [1, 2]); enol(m); Bu(m, -30); s += draw(m);
    s += tx(565, 140, '+ CO₂', 't', 'start');
    s += tx(480, 194, '共轭二烯醇', 'ts');
    return s;
  } });
FRAMES.push({ st: 3, t: '③ 互变异构：双键移入共轭位置',
  c: '二烯醇在末端 C5 质子化，C=C 移到 C1=C6 与 C=O 共轭，得到热力学更稳定的 2-丁基环己-2-烯酮。若先在 C1 质子化会得到 β,γ-不饱和酮，它在酸中仍会平衡到共轭产物。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(212, 118, ['12', '56'], [2, 5, 6]); const o = enol(m); o.lp = [180]; Bu(m, -30);
    const H = at(m, 'hx', pol(m.A.c5, 125, 40), { lab: 'H', clip: 7.5 }), O = at(m, 'ox', pol(H, 180, 42), { lab: 'O', pre: 'H₂', chg: '+', ca: -60 });
    bd(m, 'ox', 'hx'); s += draw(m);
    s += arr(pol(o, 163, 12.5), bm(m, 'c2', 'o2', -3), -7);
    s += arr(tow(bm(m, 'c1', 'c2'), m.c, 2.5), tow(bm(m, 'c1', 'c6'), m.c, 3), -10);
    const pm = bm(m, 'c5', 'c6');
    s += arr(pm, tow(H, pm, 8), 16);
    s += arr(bm(m, 'ox', 'hx'), pol(O, 50, 11), 10);
    s += rx(338, 408, 118, ['H₃O⁺'], ['C5 质子化']);
    m = Mol(470, 118, ['61'], [1, 2, 5]); ket(m); chain(m);
    at(m, 'h5', pol(m.A.c5, 90, 30), { lab: 'H', clip: 7.5 }); bd(m, 'c5', 'h5'); s += draw(m);
    s += tx(565, 150, '2-丁基环己-2-烯酮', 'ts');
    return s;
  } });
FRAMES.push({ st: 4, t: '回顾：原子记账',
  c: 'C1 用 COOH 换来了 Bu；C2 的 OMe 换成来自水的 C=O；C4、C3、C5 分别在 ①、②、③ 中各得到一个 H。Birch 一步共消耗 2 个电子（来自 Li）。',
  d: () => {
    L = 34; let s = '', m;
    m = Mol(160, 132, ['12', '34', '56'], [1, 2, 3, 4, 5, 6]); OMe(m); CO2(m, 'acid'); s += draw(m);
    s += box(149, 37, 54, 35) + box(207, 54, 53, 72);
    s += tx(233, 44, '→ CO₂', 'ts') + tx(143, 55, 'MeOH ←', 'ts', 'end');
    s += rx(295, 380, 132, ['①②③'], []);
    m = Mol(470, 132, ['61'], [1, 2, 3, 4, 5, 6]); ket(m); chain(m); s += draw(m);
    s += box(460, 55, 20, 18) + box(519, 89, 108, 35);
    s += tx(454, 64, '来自 H₂O', 'ts', 'end') + tx(573, 78, '来自 ' + it('n') + '-BuBr', 'ts');
    s += tx(427, 88, '+H ②', 'ts', 'end') + tx(427, 142, '+H ①', 'ts', 'end') + tx(470, 184, '+H ③', 'ts');
    return s;
  } });

// 页面图例里的小弯箭头
export function legendArrow() { return arr(P(3, 12), P(25, 10), 9); }
