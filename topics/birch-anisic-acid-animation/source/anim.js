// 2D 机理动画：13 幕的关键帧数据 + 插值渲染。页面（app.js）和核验脚本（verify.mjs）共用；纯函数，不碰 DOM。
// 每一幕有三个关键帧：K0（试剂还在场外，透明）→ K1（试剂就位，此时画弯箭头）→ K2（键重排完成，副产物飘走并淡出）。
// 同一个原子在所有关键帧里用同一个 id，所以“这个 H 从 t-BuOH 跑到了 C4 上”是同一个对象在移动。
// build.mjs 内联进页面时会去掉行首的 export。

const INK = 'var(--ink)', MUT = 'var(--ink-faint)', RED = 'var(--arrow)', BLUE = 'var(--water)';
const R = v => Math.round(v * 10) / 10, R2 = v => Math.round(v * 100) / 100;
const P = (x, y) => ({ x: x, y: y });
const rad = g => g * Math.PI / 180;
const pol = (p, g, d) => P(p.x + d * Math.cos(rad(g)), p.y + d * Math.sin(rad(g)));
const mid = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2);
const tow = (a, b, d) => { const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1; return P(a.x + dx / n * d, a.y + dy / n * d); };
const add = (p, dx, dy) => P(p.x + dx, p.y + dy);
const lerp = (a, b, e) => a + (b - a) * e;
const clamp = v => Math.max(0, Math.min(1, v));
export const ease = e => e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
const it = s => '<tspan font-style="italic">' + s + '</tspan>';
const HW = { O: 5.4, H: 5.2 };
const L = 34, cx = 320, cy = 150, hh = L * Math.sqrt(3) / 2, CEN = P(cx, cy);
const RING = { c1: P(cx + hh, cy - L / 2), c2: P(cx, cy - L), c3: P(cx - hh, cy - L / 2), c4: P(cx - hh, cy + L / 2), c5: P(cx, cy + L), c6: P(cx + hh, cy + L / 2) };
export const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const cl = S => JSON.parse(JSON.stringify(S));

function bnd(S, a, b, o) { S.B[key(a, b)] = { a: a, b: b, o: o }; }
function unb(S, a, b) { delete S.B[key(a, b)]; }
function at(S, id, p, o) { S.A[id] = Object.assign({ x: p.x, y: p.y }, o || {}); return S.A[id]; }
function mv(S, id, p) { S.A[id].x = p.x; S.A[id].y = p.y; return S.A[id]; }
function ringB(S, dbl) { for (let i = 1; i <= 6; i++) { const j = i % 6 + 1; bnd(S, 'c' + i, 'c' + j, dbl.indexOf('' + i + j) > -1 || dbl.indexOf('' + j + i) > -1 ? 2 : 1); } }
function st(dbl, nums) {
  const S = { A: {}, B: {}, nums: nums || [1, 2] };
  for (const k in RING) S.A[k] = { x: RING[k].x, y: RING[k].y };
  S.A.c1.halo = 1; S.A.c2.halo = 1;
  ringB(S, dbl);
  return S;
}

// ───────── 绘图原语（颜色写在 style 里，跟随页面的浅色 / 深色变量） ─────────
function ln(a, b, col, w, dash, op) {
  if (op != null && op < 0.01) return '';
  return `<line x1="${R(a.x)}" y1="${R(a.y)}" x2="${R(b.x)}" y2="${R(b.y)}" style="stroke:${col};stroke-width:${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${op != null && op < 0.99 ? ` opacity="${R2(op)}"` : ''}/>`;
}
function tx(x, y, s, cls, anc, op, sty) {
  if (op != null && op < 0.01) return '';
  return `<text class="${cls}" x="${R(x)}" y="${R(y)}" text-anchor="${anc}" dominant-baseline="central"${op != null && op < 0.99 ? ` opacity="${R2(op)}"` : ''}${sty || ''}>${s}</text>`;
}
function dot(p, r, col, op) {
  if (op != null && op < 0.01) return '';
  return `<circle cx="${R(p.x)}" cy="${R(p.y)}" r="${r}" style="fill:${col}"${op != null && op < 0.99 ? ` opacity="${R2(op)}"` : ''}/>`;
}
function head(t, g, col, hl, hw) {
  const ux = Math.cos(rad(g)), uy = Math.sin(rad(g));
  const b = P(t.x - ux * hl * 0.7, t.y - uy * hl * 0.7), l = P(t.x - ux * hl - uy * hw, t.y - uy * hl + ux * hw), r = P(t.x - ux * hl + uy * hw, t.y - uy * hl - ux * hw);
  return `<polygon points="${R(t.x)},${R(t.y)} ${R(l.x)},${R(l.y)} ${R(b.x)},${R(b.y)} ${R(r.x)},${R(r.y)}" style="fill:${col}"/>`;
}
function chgSym(p, s, op) {
  if (op < 0.01) return '';
  let o = `<circle cx="${R(p.x)}" cy="${R(p.y)}" r="5.2" style="fill:none;stroke:${INK};stroke-width:1"/>` + ln(P(p.x - 2.7, p.y), P(p.x + 2.7, p.y), INK, 1.1);
  if (s === '+') o += ln(P(p.x, p.y - 2.7), P(p.x, p.y + 2.7), INK, 1.1);
  return op < 0.99 ? `<g opacity="${R2(op)}">${o}</g>` : o;
}

// ───────── 两个关键帧之间的插值 ─────────
const opOf = a => a ? (a.op == null ? 1 : a.op) : 0;
const sig = a => a && a.lab ? [a.pre || '', a.lab, a.suf || '', a.cls || 't', a.col || ''].join('|') : '';
const outA = p => Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
const angC = (a, p) => a.ca != null ? a.ca : (a.lab ? -45 : outA(p));
const dC = a => a.cd || (a.lab ? 12 : (a.halo ? 16 : 11));
// 离场的原子淡出得晚一点（看得清它往哪走），进场的原子出现得早一点
const fe = (oA, oB, e) => oB < oA ? oA + (oB - oA) * e * e * e : oA + (oB - oA) * (1 - Math.pow(1 - e, 3));
function label(g, a, op) {
  if (op < 0.01) return '';
  const hw = HW[a.lab] || 5.2, cls = a.cls || 't', sty = a.col ? ` style="fill:${a.col}"` : '';
  let t = tx(g.x, g.y, a.lab, cls, 'middle', op, sty);
  if (a.suf) t += tx(g.x + hw, g.y, a.suf, cls, 'start', op, sty);
  if (a.pre) t += tx(g.x - hw, g.y, a.pre, cls, 'end', op, sty);
  return t;
}
function lps(g, a, op) {
  let s = '';
  (a.lp || []).forEach(an => { const c = pol(g, an, 11), px = -Math.sin(rad(an)) * 2.6, py = Math.cos(rad(an)) * 2.6; s += dot(P(c.x + px, c.y + py), 1.4, INK, op) + dot(P(c.x - px, c.y - py), 1.4, INK, op); });
  return s;
}
function bondMix(G, ia, ib, oA, oB, e) {
  const A = G[ia], B = G[ib], m = Math.min(A.op, B.op);
  if (m < 0.01) return '';
  let p = P(A.x, A.y), q = P(B.x, B.y);
  if (A.lab) p = tow(P(A.x, A.y), B, A.clip);
  if (B.lab) q = tow(P(B.x, B.y), A, B.clip);
  const one = v => (v === 1 || v === 2) ? 1 : 0, two = v => v === 2 ? 1 : 0, hb = v => v === 'h' ? 1 : 0;
  // 断开的键前 40% 就消失，新键在后 55% 才出现：避免被拉长的键横穿画面
  const bf = (x, y) => x === y ? x : (x ? clamp(1 - e / 0.4) : clamp((e - 0.45) / 0.55));
  const f1 = bf(one(oA), one(oB)) * m, w2 = lerp(two(oA), two(oB), e), f2 = w2 * m, fh = bf(hb(oA), hb(oB)) * m;
  const dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  let nx = -uy, ny = ux, s = '';
  if (fh > 0.01) s += ln(p, q, MUT, 1.3, '2 3', fh);
  if (A.ring && B.ring) {
    const M = mid(p, q);
    if ((cx - M.x) * nx + (cy - M.y) * ny < 0) { nx = -nx; ny = -ny; }
    s += ln(p, q, INK, 1.5, '', f1);
    s += ln(P(p.x + nx * 5 + ux * 6, p.y + ny * 5 + uy * 6), P(q.x + nx * 5 - ux * 6, q.y + ny * 5 - uy * 6), INK, 1.5, '', f2);
  } else {
    const w = 2.6 * w2;
    s += ln(P(p.x - nx * w, p.y - ny * w), P(q.x - nx * w, q.y - ny * w), INK, 1.5, '', f1);
    s += ln(P(p.x + nx * w, p.y + ny * w), P(q.x + nx * w, q.y + ny * w), INK, 1.5, '', f2);
  }
  return s;
}
function atomMix(g, a, b, e) {
  let s = '';
  const oa = opOf(a), ob = opOf(b), sa = sig(a), sb = sig(b);
  if (sa && sa === sb) s += label(g, b, g.op);
  else { if (sa) s += label(g, a, oa * (1 - e)); if (sb) s += label(g, b, ob * e); }
  const ca = a && a.chg, cb = b && b.chg;
  if (ca && ca === cb) s += chgSym(pol(g, lerp(angC(a, g), angC(b, g), e), lerp(dC(a), dC(b), e)), ca, g.op);
  else { if (ca) s += chgSym(pol(g, angC(a, g), dC(a)), ca, oa * (1 - e)); if (cb) s += chgSym(pol(g, angC(b, g), dC(b)), cb, ob * e); }
  const ra = a && a.rad != null, rb = b && b.rad != null;
  if (ra && rb) s += dot(pol(g, b.rad, 15), 2.4, INK, g.op);
  else { if (ra) s += dot(pol(g, a.rad, 15), 2.4, INK, oa * (1 - e)); if (rb) s += dot(pol(g, b.rad, 15), 2.4, INK, ob * e); }
  const la = a && a.lp ? a.lp.join() : '', lb = b && b.lp ? b.lp.join() : '';
  if (la && la === lb) s += lps(g, b, g.op);
  else { if (la) s += lps(g, a, oa * (1 - e)); if (lb) s += lps(g, b, ob * e); }
  return s;
}
export function render(SA, SB, e) {
  const ids = Object.keys(Object.assign({}, SA.A, SB.A)), G = {};
  ids.forEach(id => {
    const a = SA.A[id], b = SB.A[id], p = a || b, q = b || a;
    G[id] = { x: lerp(p.x, q.x, e), y: lerp(p.y, q.y, e), op: fe(opOf(a), opOf(b), e), ring: /^c[1-6]$/.test(id),
      lab: !!((a && a.lab) || (b && b.lab)), clip: Math.max(a && a.lab ? (a.clip || 8.5) : 0, b && b.lab ? (b.clip || 8.5) : 0) };
  });
  let s = `<circle class="c-purple" cx="${R(G.c1.x)}" cy="${R(G.c1.y)}" r="10.5" stroke-width="0.5"/><circle class="c-teal" cx="${R(G.c2.x)}" cy="${R(G.c2.y)}" r="10.5" stroke-width="0.5"/>`;
  [1, 2, 3, 4, 5, 6].forEach(n => {
    const o = lerp(SA.nums.indexOf(n) > -1 ? 1 : 0, SB.nums.indexOf(n) > -1 ? 1 : 0, e);
    if (o < 0.02) return;
    const a = G['c' + n], t = tx(cx + (a.x - cx) * 0.5, cy + (a.y - cy) * 0.5, n, 'ts', 'middle', o);
    s += n === 1 ? `<g class="c-purple">${t}</g>` : n === 2 ? `<g class="c-teal">${t}</g>` : t;
  });
  Object.keys(Object.assign({}, SA.B, SB.B)).forEach(k => {
    const ba = SA.B[k], bb = SB.B[k], b0 = ba || bb;
    s += bondMix(G, b0.a, b0.b, ba ? ba.o : 0, bb ? bb.o : 0, e);
  });
  ids.forEach(id => { s += atomMix(G[id], SA.A[id], SB.A[id], e); });
  return s;
}

// ───────── 弯箭头（逐步画出，箭头上有一对“电子”在走）与单电子小球 ─────────
function bm(S, a, b, k) {
  const A = S.A[a], B = S.A[b];
  let p = P(A.x, A.y), q = P(B.x, B.y);
  if (A.lab) p = tow(P(A.x, A.y), B, A.clip || 8.5);
  if (B.lab) q = tow(P(B.x, B.y), A, B.clip || 8.5);
  const M = mid(p, q);
  if (!k) return M;
  const dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy);
  return P(M.x - dy / n * k, M.y + dx / n * k);
}
const cpos = (S, id) => { const a = S.A[id]; return pol(a, angC(a, a), dC(a)); };
const qb = (a, c, b, t) => { const u = 1 - t; return P(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y); };
function curve(sp) {
  const p0 = sp[0], p2 = sp[1], bend = sp[2], dx = p2.x - p0.x, dy = p2.y - p0.y, d = Math.hypot(dx, dy) || 1;
  const c = P((p0.x + p2.x) / 2 + dy / d * bend, (p0.y + p2.y) / 2 - dx / d * bend);
  const g = Math.atan2(p2.y - c.y, p2.x - c.x) * 180 / Math.PI, e = P(p2.x - Math.cos(rad(g)) * 5, p2.y - Math.sin(rad(g)) * 5);
  let len = 0, pr = p0;
  for (let i = 1; i <= 24; i++) { const pt = qb(p0, c, e, i / 24); len += Math.hypot(pt.x - pr.x, pt.y - pr.y); pr = pt; }
  return { p0: p0, c: c, e: e, p2: p2, g: g, len: len + 1 };
}
function arrowSVG(C, p, op) {
  if (p <= 0 || op < 0.01) return '';
  let s = `<path class="arrow" d="M${R(C.p0.x)} ${R(C.p0.y)} Q${R(C.c.x)} ${R(C.c.y)} ${R(C.e.x)} ${R(C.e.y)}" style="fill:none;stroke:${RED};stroke-width:1.5" stroke-linecap="round" stroke-dasharray="${R(C.len)} ${R(C.len)}" stroke-dashoffset="${R(C.len * (1 - p))}"/>`;
  if (p > 0.8) s += `<g opacity="${R2(clamp((p - 0.8) / 0.2))}">${head(C.p2, C.g, RED, 7.5, 3.4)}</g>`;
  if (p < 1) {
    const t = qb(C.p0, C.c, C.e, p), t2 = qb(C.p0, C.c, C.e, Math.min(1, p + 0.03)), an = Math.atan2(t2.y - t.y, t2.x - t.x) || 0, ox = -Math.sin(an) * 2.4, oy = Math.cos(an) * 2.4;
    s += dot(P(t.x + ox, t.y + oy), 1.9, RED) + dot(P(t.x - ox, t.y - oy), 1.9, RED);
  }
  return op < 0.99 ? `<g opacity="${R2(op)}">${s}</g>` : s;
}
function token(from, to, p) {
  if (p <= 0 || p >= 1) return '';
  const c = P((from.x + to.x) / 2, Math.min(from.y, to.y) - 45), t = qb(from, c, to, ease(p)), op = p > 0.8 ? (1 - p) / 0.2 : 1;
  return `<g class="electron" opacity="${R2(op)}"><circle cx="${R(t.x)}" cy="${R(t.y)}" r="8.5" style="fill:${RED}"/>${tx(t.x, t.y, 'e⁻', 'ts', 'middle', null, ' style="fill:#fff"')}</g>`;
}
export function legendArrow() { return arrowSVG(curve([P(3, 12), P(25, 10), 9]), 1, 1); }

// ───────── 13 幕 ─────────
const LI = P(cx - 175, cy), LI2 = add(LI, 14, 0);
export const SC = [];
let K0, K1, K2;

const S0 = st(['12', '34', '56']);
at(S0, 'o2', pol(RING.c2, -90, L), { lab: 'O' }); at(S0, 'me', pol(S0.A.o2, -30, L), { lab: 'Me', clip: 12 });
bnd(S0, 'c2', 'o2', 1); bnd(S0, 'o2', 'me', 1);
at(S0, 'cc', pol(RING.c1, -30, L)); at(S0, 'oa', pol(S0.A.cc, -90, L), { lab: 'O' }); at(S0, 'ob', pol(S0.A.cc, 30, L), { lab: 'O' });
at(S0, 'ha', pol(S0.A.oa, -30, 26), { lab: 'H', clip: 7 });
bnd(S0, 'c1', 'cc', 1); bnd(S0, 'cc', 'oa', 1); bnd(S0, 'cc', 'ob', 2); bnd(S0, 'oa', 'ha', 1);

K2 = cl(S0); mv(K2, 'ha', pol(S0.A.oa, -30, 70)).op = 0; unb(K2, 'oa', 'ha'); K2.A.oa.chg = '-';
const S1 = cl(K2); delete S1.A.ha;
SC.push({ stg: 0, t: '去质子化', c: 'Li 先把 COOH 上的 H 还原成 ½ H₂，生成羧酸锂；之后加入的电子才进入苯环。', K0: S0, K1: S0, K2: K2, e: 1,
  elec: S => [LI2, P(S.A.ha.x, S.A.ha.y)],
  notes: [{ p: LI, t: 'Li', a: 0.03, b: 0.9, cls: 't' }, { p: pol(S0.A.oa, -30, 62), t: '½ H₂', a: 0.62, b: 0.97 }, { p: P(cx, 228), t: '邻甲氧基苯甲酸', a: 0, b: 0.5 }] });

const S2 = cl(S1); ringB(S2, ['23', '56']); S2.A.c1.rad = 30; S2.A.c4.chg = '-'; S2.nums = [1, 2, 4];
SC.push({ stg: 0, t: '第一次单电子转移', c: '溶剂化电子进入苯环，形成自由基负离子；吸电子的羧基让负电荷与单电子集中在 C1 和 C4（对位）。', K0: S1, K1: S1, K2: S2, e: 1,
  elec: () => [LI2, CEN], notes: [{ p: LI, t: 'Li', a: 0.03, b: 0.9, cls: 't' }] });

const thR = pol(RING.c4, 150, 50), TB = it('t') + '-Bu';
K0 = cl(S2); at(K0, 'th', add(thR, -40, 10), { lab: 'H', clip: 7.5, op: 0 }); at(K0, 'tb', add(thR, -84, 10), { lab: 'O', pre: TB, op: 0 }); bnd(K0, 'tb', 'th', 1);
K1 = cl(S2); at(K1, 'th', thR, { lab: 'H', clip: 7.5 }); at(K1, 'tb', add(thR, -44, 0), { lab: 'O', pre: TB }); bnd(K1, 'tb', 'th', 1);
const S3 = cl(S2); delete S3.A.c4.chg; at(S3, 'th', pol(RING.c4, 150, 28), { lab: 'H', cls: 'ts', clip: 6.5 }); bnd(S3, 'c4', 'th', 1);
K2 = cl(S3); at(K2, 'tb', add(thR, -84, 0), { lab: 'O', pre: TB, chg: '-', op: 0 });
SC.push({ stg: 0, t: 'C4 质子化', c: '<i>t</i>-BuOH 把 H⁺ 交给电荷密度最高的 C4（羧基对位），得到环己二烯基自由基。灰色 H 表示新加上的 H。', K0: K0, K1: K1, K2: K2,
  arrows: S => { const q = cpos(S, 'c4'); return [[tow(q, S.A.th, 6.5), tow(S.A.th, q, 8), -6], [bm(S, 'tb', 'th'), pol(S.A.tb, 60, 11), 10]]; } });

const S4 = cl(S3); delete S4.A.c1.rad; S4.A.c1.chg = '-'; S4.A.c1.ca = 30;
SC.push({ stg: 0, t: '第二次单电子转移', c: 'C1 再得到一个电子，变成碳负离子。', K0: S3, K1: S3, K2: S4, e: 1,
  elec: () => [LI2, pol(RING.c1, 30, 16)], notes: [{ p: LI, t: 'Li', a: 0.03, b: 0.9, cls: 't' }] });

const S5 = cl(S4); delete S5.A.c1.chg; delete S5.A.c1.ca; bnd(S5, 'c1', 'cc', 2); bnd(S5, 'cc', 'ob', 1); S5.A.ob.chg = '-'; S5.A.ob.ca = 60;
SC.push({ stg: 0, t: '共振：烯二醇盐', c: 'C1 的负电荷离域到羧基氧上，这个双负离子是烯二醇盐，C1 就是它的亲核位点。（共振不是反应，只是同一物种的两种写法。）', K0: S4, K1: S4, K2: S5, res: true,
  arrows: S => { const q = cpos(S, 'c1'); return [[pol(q, 0, 6), bm(S, 'c1', 'cc', 3), -6], [bm(S, 'cc', 'ob', 2.6), pol(S.A.ob, 135, 10), -7]]; } });

const buR = pol(RING.c1, 62, 54), brR = add(buR, 46, 0);
K0 = cl(S5); at(K0, 'bu', add(buR, 35, 25), { lab: 'Bu', clip: 12, op: 0 }); at(K0, 'br', add(brR, 35, 25), { lab: 'Br', clip: 9.5, op: 0 }); bnd(K0, 'bu', 'br', 1);
K1 = cl(S5); at(K1, 'bu', buR, { lab: 'Bu', clip: 12 }); at(K1, 'br', brR, { lab: 'Br', clip: 9.5 }); bnd(K1, 'bu', 'br', 1); K1.A.ob.lp = [-20];
const S6 = cl(S5); delete S6.A.ob.chg; delete S6.A.ob.ca; bnd(S6, 'c1', 'cc', 1); bnd(S6, 'cc', 'ob', 2); at(S6, 'bu', pol(RING.c1, 30, L), { lab: 'Bu', clip: 12 }); bnd(S6, 'c1', 'bu', 1);
K2 = cl(S6); at(K2, 'br', add(brR, 50, 12), { lab: 'Br', clip: 9.5, chg: '-', op: 0 });
SC.push({ stg: 0, t: 'C1 烷基化（S<sub>N</sub>2）', c: 'C1 进攻 <i>n</i>-BuBr 的碳，Br⁻ 离去，形成同时连着 Bu 和羧基的季碳。', K0: K0, K1: K1, K2: K2,
  arrows: S => { const p1 = bm(S, 'c1', 'cc'); return [[pol(S.A.ob, -20, 12.5), bm(S, 'cc', 'ob', -3), -8], [p1, tow(S.A.bu, p1, 12), 12], [bm(S, 'bu', 'br'), pol(S.A.br, -120, 9.5), 7]]; } });

const haR = pol(S6.A.oa, -30, 42);
K0 = cl(S6); at(K0, 'ha', pol(S6.A.oa, -30, 80), { lab: 'H', clip: 7, chg: '+', op: 0 });
K1 = cl(S6); at(K1, 'ha', haR, { lab: 'H', clip: 7, chg: '+' });
const S7 = cl(S6); delete S7.A.oa.chg; at(S7, 'ha', pol(S6.A.oa, -30, 26), { lab: 'H', clip: 7 }); bnd(S7, 'oa', 'ha', 1);
SC.push({ stg: 0, t: '酸化后处理', c: '羧酸根质子化，得到 Birch 还原–烷基化产物。C2=C3 上连着 OMe，这就是烯醇醚。', K0: K0, K1: K1, K2: S7,
  arrows: S => { const q = cpos(S, 'oa'); return [[tow(q, S.A.ha, 6.5), tow(S.A.ha, q, 8), -6]]; } });

const h3R = pol(RING.c3, -150, 46);
K0 = cl(S7); at(K0, 'h3', add(h3R, -40, -15), { lab: 'H', clip: 7.5, op: 0 }); at(K0, 'w3', add(h3R, -82, -15), { lab: 'O', pre: 'H₂', chg: '+', ca: -60, op: 0 }); bnd(K0, 'w3', 'h3', 1);
K1 = cl(S7); at(K1, 'h3', h3R, { lab: 'H', clip: 7.5 }); at(K1, 'w3', add(h3R, -42, 0), { lab: 'O', pre: 'H₂', chg: '+', ca: -60 }); bnd(K1, 'w3', 'h3', 1); K1.A.o2.lp = [180];
const S8 = cl(S7); ringB(S8, ['56']); bnd(S8, 'c2', 'o2', 2); S8.A.o2.chg = '+'; S8.A.o2.ca = -145; at(S8, 'h3', pol(RING.c3, -150, 28), { lab: 'H', cls: 'ts', clip: 6.5 }); bnd(S8, 'c3', 'h3', 1); S8.nums = [1, 2, 3];
K2 = cl(S8); at(K2, 'w3', add(h3R, -82, -8), { lab: 'O', pre: 'H₂', op: 0 });
SC.push({ stg: 1, t: '烯醇醚在 C3 质子化', c: 'H⁺ 加到 β-碳 C3；C2 上的正电荷由 OMe 的孤对电子稳定，形成氧鎓离子。孤立的 C5=C6 不参与。', K0: K0, K1: K1, K2: K2,
  arrows: S => { const pm = mid(S.A.c2, S.A.c3); return [[pol(S.A.o2, 163, 12.5), bm(S, 'c2', 'o2', -3), -7], [pm, tow(S.A.h3, pm, 8), -12], [bm(S, 'w3', 'h3'), pol(S.A.w3, 50, 11), 10]]; } });

const owR = add(RING.c2, -64, -26);
K0 = cl(S8); at(K0, 'ow', add(owR, -36, -26), { lab: 'O', pre: 'H₂', col: BLUE, op: 0 });
K1 = cl(S8); at(K1, 'ow', owR, { lab: 'O', pre: 'H₂', col: BLUE, lp: [0] });
const S9 = cl(S8); bnd(S9, 'c2', 'o2', 1); delete S9.A.o2.chg; delete S9.A.o2.ca; mv(S9, 'o2', pol(RING.c2, -50, L)); mv(S9, 'me', pol(S9.A.o2, -60, 32));
at(S9, 'ow', pol(RING.c2, -130, L), { lab: 'O', pre: 'H', col: BLUE }); bnd(S9, 'c2', 'ow', 1);
SC.push({ stg: 1, t: '水进攻 C2', c: '水加到 C2 上，再失去 H⁺，得到半缩酮。蓝色的 O 来自水，后面会变成产物的羰基氧。', K0: K0, K1: K1, K2: S9, lost: ['H', 1],
  arrows: S => { const w0 = pol(S.A.ow, 0, 13); return [[w0, tow(S.A.c2, w0, 6), -8], [bm(S, 'c2', 'o2', 2.6), pol(S.A.o2, 35, 10), -6]]; },
  notes: [{ p: add(pol(RING.c2, -130, L), -24, -22), t: '−H⁺', a: 0.7, b: 0.97 }] });

const hmR = pol(S9.A.o2, -140, 26);
K0 = cl(S9); at(K0, 'hm', add(hmR, -6, -36), { lab: 'H', clip: 7, chg: '+', op: 0 });
K1 = cl(S9); at(K1, 'hm', hmR, { lab: 'H', clip: 7 }); bnd(K1, 'o2', 'hm', 1); K1.A.o2.chg = '+'; K1.A.o2.ca = -10; K1.A.ow.lp = [-40];
const S10 = cl(S9); delete S10.A.o2; delete S10.A.me; unb(S10, 'c2', 'o2'); unb(S10, 'o2', 'me');
mv(S10, 'ow', pol(RING.c2, -90, L)); delete S10.A.ow.pre; bnd(S10, 'c2', 'ow', 2);
K2 = cl(S10); at(K2, 'o2', add(S9.A.o2, 0, -50), { lab: 'O', op: 0 }); at(K2, 'me', add(S9.A.me, 0, -50), { lab: 'Me', clip: 12, op: 0 }); at(K2, 'hm', add(hmR, 0, -50), { lab: 'H', clip: 7, op: 0 }); bnd(K2, 'o2', 'me', 1); bnd(K2, 'o2', 'hm', 1);
SC.push({ stg: 1, t: '失去 MeOH', c: 'OMe 先被质子化，再以 MeOH 离去；留下来的是蓝色的水氧，形成酮羰基。产物是 β-酮酸。', K0: K0, K1: K1, K2: K2, lost: ['H', 1],
  arrows: S => [[pol(S.A.ow, -40, 12.5), bm(S, 'c2', 'ow', 3), 7], [bm(S, 'c2', 'o2', 3), pol(S.A.o2, 60, 10), -7]],
  notes: [{ p: add(S9.A.o2, 42, -48), t: 'MeOH', a: 0.62, b: 0.97 }, { p: add(pol(RING.c2, -130, L), -24, -22), t: '−H⁺', a: 0.7, b: 0.97 }] });

K1 = cl(S10); mv(K1, 'ha', pol(S10.A.oa, -150, L)); bnd(K1, 'ow', 'ha', 'h');
const S11 = cl(S10); mv(S11, 'ha', pol(S10.A.ow, -30, 26)); bnd(S11, 'ow', 'ha', 1); unb(S11, 'oa', 'ha'); bnd(S11, 'c2', 'ow', 1); ringB(S11, ['12', '56']);
delete S11.A.cc; delete S11.A.oa; delete S11.A.ob; unb(S11, 'c1', 'cc'); unb(S11, 'cc', 'oa'); unb(S11, 'cc', 'ob'); mv(S11, 'bu', pol(RING.c1, -30, L));
K2 = cl(S11); at(K2, 'cc', P(cx + 190, 100), { op: 0 }); at(K2, 'oa', P(cx + 160, 100), { lab: 'O', op: 0 }); at(K2, 'ob', P(cx + 220, 100), { lab: 'O', op: 0 }); bnd(K2, 'cc', 'oa', 2); bnd(K2, 'cc', 'ob', 2);
SC.push({ stg: 2, t: 'β-酮酸脱羧', c: 'COOH 的 H 转向酮羰基氧，形成六元环过渡态；三对电子协同移动，放出 CO₂，同时生成共轭二烯醇。', K0: S10, K1: K1, K2: K2,
  arrows: S => [[bm(S, 'oa', 'ha'), bm(S, 'cc', 'oa', 3), 10], [bm(S, 'c1', 'cc'), bm(S, 'c1', 'c2'), -14], [bm(S, 'c2', 'ow', 2.6), bm(S, 'ow', 'ha'), -8]],
  notes: [{ p: P(cx + 190, 78), t: 'CO₂', a: 0.66, b: 0.97, cls: 't' }] });

const h5R = pol(RING.c5, 125, 40);
K0 = cl(S11); at(K0, 'h5', add(h5R, -40, 10), { lab: 'H', clip: 7.5, op: 0 }); at(K0, 'w5', add(h5R, -82, 10), { lab: 'O', pre: 'H₂', chg: '+', ca: -60, op: 0 }); bnd(K0, 'w5', 'h5', 1);
K1 = cl(S11); at(K1, 'h5', h5R, { lab: 'H', clip: 7.5 }); at(K1, 'w5', add(h5R, -42, 0), { lab: 'O', pre: 'H₂', chg: '+', ca: -60 }); bnd(K1, 'w5', 'h5', 1); K1.A.ow.lp = [180]; K1.nums = [2, 5, 6];
const S12 = cl(S11); delete S12.A.ha; unb(S12, 'ow', 'ha'); bnd(S12, 'c2', 'ow', 2); ringB(S12, ['16']); at(S12, 'h5', pol(RING.c5, 90, 28), { lab: 'H', cls: 'ts', clip: 6.5 }); bnd(S12, 'c5', 'h5', 1); S12.nums = [1, 2, 5];
K2 = cl(S12); at(K2, 'w5', add(h5R, -82, 6), { lab: 'O', pre: 'H₂', op: 0 }); at(K2, 'ha', add(S11.A.ha, 30, -30), { lab: 'H', clip: 7, chg: '+', op: 0 });
SC.push({ stg: 2, t: '互变异构', c: '二烯醇在末端 C5 质子化，O–H 失去 H⁺，双键移到 C1=C6，与 C=O 共轭，得到热力学更稳定的烯酮。', K0: K0, K1: K1, K2: K2,
  arrows: S => { const pm = bm(S, 'c5', 'c6'); return [[pol(S.A.ow, 163, 12.5), bm(S, 'c2', 'ow', -3), -7], [tow(bm(S, 'c1', 'c2'), CEN, 2.5), tow(bm(S, 'c1', 'c6'), CEN, 3), -10], [pm, tow(S.A.h5, pm, 8), 16], [bm(S, 'w5', 'h5'), pol(S.A.w5, 50, 11), 10]]; },
  notes: [{ p: add(S11.A.ha, 40, -18), t: '−H⁺', a: 0.66, b: 0.97 }] });

// 改画成键线式只是换一种表示：Bu 标签这个“原子”直接删掉（渲染时自动淡出），由四个链碳顶替，原子数不变
const S13 = cl(S12); delete S13.A.bu; unb(S13, 'c1', 'bu');
let pv = 'c1';
[-30, 30, -30, 30].forEach((g, i) => { at(S13, 'k' + i, pol(S13.A[pv], g, L)); bnd(S13, pv, 'k' + i, 1); pv = 'k' + i; });
SC.push({ stg: 3, t: '产物：2-丁基环己-2-烯酮', c: 'C1 用 COOH 换来了 Bu，C2 的 OMe 换成了来自水的 C=O；C4、C3、C5 各多了一个 H，分别来自 ①、②、③。', K0: S12, K1: S12, K2: S13, redraw: true,
  notes: [{ p: P(cx + 95, 200), t: '2-丁基环己-2-烯酮', a: 0.55, b: 2, cls: 't' }] });

export const STG = [
  { tag: '①', name: 'Birch 还原–烷基化', cond: 'Li, NH₃(l), −78 °C → <i>n</i>-BuBr → H₃O⁺', s: 0 },
  { tag: '②', name: '烯醇醚水解', cond: 'H₃O⁺', s: 7 },
  { tag: '③', name: '脱羧与异构化', cond: 'H₃O⁺, Δ', s: 10 },
  { tag: '', name: '产物', cond: '', s: 12 }];
export const N = SC.length, A0 = 0.16, A1 = 0.56, M1 = 0.9;

// τ ∈ [0, N]：第 k 幕占 [k, k+1]。u < A0 试剂进场；A0–A1 画弯箭头 / 电子飞入；A1–M1 键重排；M1–1 停顿。
// 停在整数 τ = n（n > 0）时算作第 n−1 幕刚放完（u = 1），标题仍是刚看完的那一幕。
export function frame(tau) {
  const n = Math.round(tau), k = Math.min(N - 1, tau > 0 && Math.abs(tau - n) < 1e-9 ? n - 1 : Math.floor(tau)), u = Math.min(1, tau - k), sc = SC[k];
  let s;
  if (u < A0) s = render(sc.K0, sc.K1, ease(u / A0));
  else if (u < A1) s = render(sc.K1, sc.K1, 1);
  else s = render(sc.K1, sc.K2, ease(clamp((u - A1) / (M1 - A1))));
  const aop = u < A1 ? 1 : clamp(1 - (u - A1) / 0.1);
  if (sc.arrows && aop > 0.01) sc.arrows(sc.K1).forEach((a, i) => { s += arrowSVG(curve(a), clamp((u - A0 - i * 0.07) / 0.2), aop); });
  if (sc.elec) { const ep = sc.elec(sc.K1); s += token(ep[0], ep[1], clamp((u - A0) / (A1 - A0 - 0.04))); }
  (sc.notes || []).forEach(n => { const o = Math.min(n.a <= 0 ? 1 : clamp((u - n.a) / 0.06), n.b >= 1 ? 1 : clamp((n.b - u) / 0.06)); if (o > 0.01) s += tx(n.p.x, n.p.y, n.t, n.cls || 'ts', 'middle', o); });
  return { k: k, u: u, svg: s };
}
