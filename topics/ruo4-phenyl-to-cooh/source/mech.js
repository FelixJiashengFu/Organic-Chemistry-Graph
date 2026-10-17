// RuO₄ 把环己基苯的苯环“拆”成 COOH：手写的 2D 结构式绘制引擎 + 11 帧数据。
// 页面（app.js）和核验脚本（verify.mjs）共用同一份数据；纯函数，不碰 DOM。
// build.mjs 内联进页面时会去掉行首的 export。

export const REG = { on: false, list: [] }; // verify.mjs 打开后，每次 draw(m) 都把分子记下来

const INK = 'var(--ink)', MUT = 'var(--ink-faint)', RED = 'var(--arrow)';
let L = 30;
const R = v => Math.round(v * 10) / 10;
const P = (x, y) => ({ x: x, y: y });
const rad = g => g * Math.PI / 180;
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const pol = (p, g, d) => P(p.x + d * Math.cos(rad(g)), p.y + d * Math.sin(rad(g)));
const mid = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2);
const tow = (a, b, d) => { const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1; return P(a.x + dx / n * d, a.y + dy / n * d); };
const HW = { O: 5.4, H: 5.2, Ru: 9.4 };
const ROMAN = { 4: 'IV', 6: 'VI', 8: 'VIII' };

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
  const g = ang(c, p2);
  const e = P(p2.x - Math.cos(rad(g)) * 5, p2.y - Math.sin(rad(g)) * 5);
  return `<path class="arrow" d="M${R(p0.x)} ${R(p0.y)} Q${R(c.x)} ${R(c.y)} ${R(e.x)} ${R(e.y)}" style="fill:none;stroke:${RED};stroke-width:1.4" stroke-linecap="round"/>` + head(p2, g, RED, 7.5, 3.4);
}

// ───────── 分子对象：A = 原子（坐标、标签、电荷……），B = 键 ─────────
function mol() { return { A: {}, B: [], nums: [] }; }
function at(m, id, p, o) { m.A[id] = Object.assign({ x: p.x, y: p.y }, o || {}); return m.A[id]; }
function bd(m, a, b, o, c) { m.B.push({ a: a, b: b, o: o || 1, c: c }); }
const clipOf = a => a.clip || (a.lab === 'Ru' ? 11.5 : a.lab ? 8.5 : 0);
function ends(m, b) {
  const A = m.A[b.a], B = m.A[b.b];
  let p = P(A.x, A.y), q = P(B.x, B.y);
  if (A.lab) p = tow(P(A.x, A.y), B, clipOf(A));
  if (B.lab) q = tow(P(B.x, B.y), A, clipOf(B));
  return [p, q];
}
// 键的中点；k ≠ 0 时向键的左侧（前进方向）平移 k
function bm(m, a, b, k) {
  const e = ends(m, { a: a, b: b }), M = mid(e[0], e[1]);
  if (!k) return M;
  const dx = e[1].x - e[0].x, dy = e[1].y - e[0].y, n = Math.hypot(dx, dy);
  return P(M.x + dy / n * k, M.y - dx / n * k);
}
function bondSVG(m, b) {
  const e = ends(m, b), p = e[0], q = e[1];
  if (b.o === 'h') return ln(p, q, MUT, 1.3, '2 3');
  if (b.o !== 2) return ln(p, q);
  const dx = q.x - p.x, dy = q.y - p.y, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
  let nx = -uy, ny = ux;
  if (b.c) { // 环键：第二条线画在环内侧
    const M = mid(p, q);
    if ((b.c.x - M.x) * nx + (b.c.y - M.y) * ny < 0) { nx = -nx; ny = -ny; }
    return ln(p, q) + ln(P(p.x + nx * 5 + ux * 5.5, p.y + ny * 5 + uy * 5.5), P(q.x + nx * 5 - ux * 5.5, q.y + ny * 5 - uy * 5.5));
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
const cpos = (m, id) => { const a = m.A[id]; return pol(a, a.ca != null ? a.ca : -45, a.cd || 12); };
function atomSVG(m, id) {
  const a = m.A[id];
  let s = '';
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
  if (a.chg) s += chg(cpos(m, id), a.chg);
  if (a.ox && a.oxs !== false) { const q = pol(a, a.oxa != null ? a.oxa : -40, a.oxd || 16); s += tx(q.x, q.y, ROMAN[a.ox], 'tox'); }
  return s;
}
function draw(m) {
  if (REG.on) REG.list.push(m);
  let s = '';
  const hr = Math.max(8, L * 0.31);
  for (const id in m.A) { const a = m.A[id]; if (a.halo) s += `<circle class="c-${a.halo}" cx="${R(a.x)}" cy="${R(a.y)}" r="${R(hr)}" stroke-width="0.5"/>`; }
  m.nums.forEach(([id, n, c]) => {
    const a = m.A[id];
    if (!a) return;
    const p = P(c.x + (a.x - c.x) * 0.52, c.y + (a.y - c.y) * 0.52), t = tx(p.x, p.y, n, 'ts');
    s += n === 1 ? `<g class="c-purple">${t}</g>` : n === 6 ? `<g class="c-teal">${t}</g>` : t;
  });
  m.B.forEach(b => { s += bondSVG(m, b); });
  for (const id in m.A) s += atomSVG(m, id);
  return s;
}
function rx(x1, x2, y, top, bot) {
  let s = ln(P(x1, y), P(x2 - 5, y), INK, 1.3) + head(P(x2, y), 0, INK, 9, 4);
  const xm = (x1 + x2) / 2;
  (top || []).forEach((t, i, A) => { s += tx(xm, y - 12 - (A.length - 1 - i) * 16, t, 'ts'); });
  (bot || []).forEach((t, i) => { s += tx(xm, y + 13 + i * 16, t, 'ts'); });
  return s;
}
// 弯箭头：O–Ru 键的电子回到 Ru 上（s = ±1 选键的哪一侧）
function ruArr(m, o, s) {
  const A = m.A, r = A.ru;
  return arr(bm(m, o, 'ru', s * 3.5), pol(r, ang(r, A[o]) + s * 62, 14), s * 10);
}
function box(x, y, w, h, dash) { return `<rect x="${R(x)}" y="${R(y)}" width="${R(w)}" height="${R(h)}" rx="6" style="fill:none;stroke:${MUT};stroke-width:0.8"${dash === false ? '' : ' stroke-dasharray="3 3"'}/>`; }
function tag(x, y, s) { return tx(x, y, s, 'tag'); }

// ───────── 片段构建 ─────────
// 六边形：ids[k] 放在 a0 + 60k 方向；dbl / skip 用键的序号 k（ids[k]–ids[k+1]）
function hexa(m, ids, c, a0, dbl, skip) {
  ids.forEach((id, k) => { if (id && !m.A[id]) at(m, id, pol(c, a0 + 60 * k, L)); });
  for (let k = 0; k < 6; k++) {
    if ((skip || []).includes(k)) continue;
    const a = ids[k], b = ids[(k + 1) % 6];
    if (a && b) bd(m, a, b, (dbl || []).includes(k) ? 2 : 1, c);
  }
}
const ARO = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
// 原苯环的碳：c1（ipso，紫）在 180°，顺时针编号；c6（青）在 120°
function arene(m, c, dbl, skip, ids, nums, a0) {
  hexa(m, ids || ARO, c, a0 == null ? 180 : a0, dbl, skip);
  if (m.A.c1) m.A.c1.halo = 'purple';
  if (m.A.c6) m.A.c6.halo = 'teal';
  if (nums !== false) (ids || ARO).forEach((id, k) => { if (id) m.nums.push([id, k + 1, c]); });
}
// 环己基：y1 连在 from 上，方向 g
function cyhex(m, from, g) {
  const y1 = pol(m.A[from], g, L), c = pol(y1, g, L);
  hexa(m, ['y1', 'y2', 'y3', 'y4', 'y5', 'y6'], c, g + 180, [], []);
  bd(m, from, 'y1');
}
// 在 A–B 边外侧并一个正五边形，返回 [与 B 相邻, 顶点, 与 A 相邻]
function pent(A, B, away) {
  const d0 = ang(A, B), len = Math.hypot(B.x - A.x, B.y - A.y);
  const mk = s => { const p1 = pol(B, d0 + s * 72, len), p2 = pol(p1, d0 + s * 144, len), p3 = pol(p2, d0 + s * 216, len); return [p1, p2, p3]; };
  const a = mk(1), b = mk(-1), far = q => Math.hypot(q[1].x - away.x, q[1].y - away.y);
  return far(a) > far(b) ? a : b;
}
// [3+2] 环状钌酸酯（ox = 6）或正在靠近的 RuO₄（ox = 8，整体沿外法线平移 gap）
// ids = [ca 上的 O, cb 上的 O, Ru, 氧代, 氧代]
const RL = () => 1.12 * L; // Ru–O 键画长一些，Ru 标签才不挤
function ruCycle(m, ca, cb, away, ids, ox, gap, oxa) {
  const A = m.A[ca], B = m.A[cb], M = mid(A, B), g = ang(away, M);
  let pa, pb, pr;
  if (ox === 8) { // 正在靠近的 RuO₄：两个 O 分别对准两个碳
    const sp = p => P(M.x + (p.x - M.x) * 1.25, M.y + (p.y - M.y) * 1.25);
    pa = pol(sp(A), g, gap); pb = pol(sp(B), g, gap); pr = pol(mid(pa, pb), g, 0.95 * L);
  } else {
    const q = pent(A, B, away).map(p => P(M.x + (p.x - M.x) * 1.2, M.y + (p.y - M.y) * 1.2));
    pb = q[0]; pr = q[1]; pa = q[2];
  }
  at(m, ids[0], pa, { lab: 'O' });
  at(m, ids[1], pb, { lab: 'O' });
  at(m, ids[2], pr, { lab: 'Ru', ox: ox, oxa: oxa != null ? oxa : g, oxd: 18 });
  const sp = ox === 8 ? 62 : 50;
  at(m, ids[3], pol(pr, g - sp, RL()), { lab: 'O' });
  at(m, ids[4], pol(pr, g + sp, RL()), { lab: 'O' });
  const o = ox === 8 ? 2 : 1;
  bd(m, ids[2], ids[0], o); bd(m, ids[2], ids[1], o); bd(m, ids[2], ids[3], 2); bd(m, ids[2], ids[4], 2);
  if (ox !== 8) { bd(m, ca, ids[0]); bd(m, cb, ids[1]); }
}
function ruO4(m, c, rot, oxa) {
  at(m, 'ru', c, { lab: 'Ru', ox: 8, oxa: oxa != null ? oxa : rot, oxd: 17 });
  [45, 135, 225, 315].forEach((g, k) => { at(m, 'r' + k, pol(c, rot + g, RL()), { lab: 'O' }); bd(m, 'ru', 'r' + k, 2); });
}
function ruO2(m, c) {
  at(m, 'ru', c, { lab: 'Ru', ox: 4, oxa: -90, oxd: 15 });
  at(m, 'r0', pol(c, 180, RL()), { lab: 'O' }); at(m, 'r1', pol(c, 0, RL()), { lab: 'O' });
  bd(m, 'ru', 'r0', 2); bd(m, 'ru', 'r1', 2);
}
// Ru(VI)：H₂RuO₄ = Ru(=O)₂(OH)₂；anion = true 时一个 OH 换成 O⁻（HRuO₄⁻）
function ruVI(m, c, anion) {
  at(m, 'ru', c, { lab: 'Ru', ox: 6, oxa: 180, oxd: 18 });
  at(m, 'r0', pol(c, -55, RL()), { lab: 'O' }); at(m, 'r1', pol(c, -125, RL()), { lab: 'O' });
  at(m, 'r2', pol(c, 55, RL()), { lab: 'O', suf: 'H' });
  at(m, 'r3', pol(c, 125, RL()), anion ? { lab: 'O', chg: '-', ca: 180, cd: 12 } : { lab: 'O', pre: 'H' });
  bd(m, 'ru', 'r0', 2); bd(m, 'ru', 'r1', 2); bd(m, 'ru', 'r2'); bd(m, 'ru', 'r3');
}
function co2(m, c, ids) {
  ids = ids || ['k', 'ka', 'kb'];
  at(m, ids[0], c); at(m, ids[1], pol(c, 180, 0.95 * L), { lab: 'O' }); at(m, ids[2], pol(c, 0, 0.95 * L), { lab: 'O' });
  bd(m, ids[0], ids[1], 2); bd(m, ids[0], ids[2], 2);
}
// 乙二醛 / 草酸：ids = [ca, cb, ca 上的 O, cb 上的 O]，acid = true 时再各加一个 OH
function c2(m, p, ids, acid) {
  at(m, ids[0], p); at(m, ids[1], pol(p, -30, L));
  at(m, ids[2], pol(p, 90, L), { lab: 'O' }); at(m, ids[3], pol(m.A[ids[1]], -90, L), { lab: 'O' });
  bd(m, ids[0], ids[1]); bd(m, ids[0], ids[2], 2); bd(m, ids[1], ids[3], 2);
  if (acid) {
    at(m, ids[0] + 'h', pol(p, 210, L), { lab: 'O', pre: 'H' }); bd(m, ids[0], ids[0] + 'h');
    at(m, ids[1] + 'h', pol(m.A[ids[1]], 30, L), { lab: 'O', suf: 'H' }); bd(m, ids[1], ids[1] + 'h');
  }
}
// 环己甲酸（最终产物）：C1 = 羧基碳
function acid(m, p, ids) {
  ids = ids || ['ow', 'o1'];
  at(m, 'c1', p, { halo: 'purple' }); cyhex(m, 'c1', 180);
  at(m, ids[0], pol(p, -60, L), { lab: 'O' }); at(m, ids[1], pol(p, 60, L), { lab: 'O', suf: 'H' });
  bd(m, 'c1', ids[0], 2); bd(m, 'c1', ids[1]);
}

export const STAGES = [['总览', 0], ['催化剂', 1], ['① 去芳构化与开环', 2], ['②③ 再断两根 C=C', 5], ['④⑤ 变成 COOH', 7], ['小分子与记账', 9]];
export const DY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
export const FRAMES = [];

FRAMES.push({ st: 0, t: '总览：苯环被拆光，只留下连环己基的那个碳',
  c: '紫色圈 = 原苯环的 C1（ipso，连着环己基），青色圈 = C6。RuO₄ 把苯环一根一根 C=C 切断：C1 最后成为 COOH 的碳，其余 5 个环碳全部变成 CO₂；环己基始终不动。',
  d: () => {
    L = 24; let s = '', m;
    m = mol(); arene(m, P(136, 84), [0, 2, 4], [], null, false); cyhex(m, 'c1', 180); s += draw(m);
    s += rx(178, 330, 84, ['RuCl₃（催化量）, NaIO₄'], ['MeCN, CCl₄（+ H₂O）, 24 h']);
    m = mol(); acid(m, P(422, 84)); s += draw(m);
    s += tx(458, 84, '+ 5 CO₂', 't', 'start') + tx(528, 84, '94%', 't', 'start');
    s += tx(340, 160, 'C₁₂H₁₆ + 14 NaIO₄ → C₇H₁₂O₂ + 5 CO₂ + 2 H₂O + 14 NaIO₃', 'teq');
    s += tx(340, 186, '6 个环碳：C1 0 → +3（羧基），C2–C6 各 −1 → +4（CO₂），合计失去 28 个电子', 'ts');
    s += tx(340, 208, '每个 IO₄⁻ → IO₃⁻ 接受 2 个电子，所以至少要 14 当量 NaIO₄；Ru 只需催化量', 'ts');
    return s;
  } });

FRAMES.push({ st: 1, t: '催化剂：RuCl₃ 只是前体，真正干活的是 RuO₄',
  c: 'NaIO₄ 先把 Ru(III) 氧化成 Ru(VIII) 的 RuO₄（四面体，黄色，易溶于 CCl₄）。RuO₄ 在有机相里氧化底物、自己被还原；低价 Ru 回到水相 / 界面，再被 NaIO₄ 氧化回 RuO₄。MeCN 是 Sharpless 1981 年改进的关键：它与低价 Ru 配位，不让反应中生成的羧酸把 Ru 锁成不溶物而失活。',
  d: () => {
    L = 30; let s = '', m;
    s += tx(62, 76, 'RuCl₃', 't') + tx(62, 98, 'Ru(III)', 'ts');
    s += rx(96, 186, 86, ['NaIO₄'], ['H₂O']);
    m = mol(); ruO4(m, P(238, 86), 0, 90); s += draw(m);
    s += tx(238, 140, 'RuO₄', 't');
    s += tx(178, 186, '2 RuCl₃ + 5 NaIO₄ + 3 H₂O → 2 RuO₄ + 5 NaIO₃ + 6 HCl', 'teq');
    s += tx(178, 208, 'Ru(III) → Ru(VIII)：每个 Ru 失去 5 个电子', 'ts');
    s += box(352, 30, 296, 62, false) + box(352, 120, 296, 62, false);
    s += tx(368, 50, '水相 H₂O', 'th', 'start') + tx(368, 72, 'NaIO₄ → NaIO₃：把低价 Ru 氧化回 RuO₄', 'ts', 'start');
    s += tx(368, 140, '有机相 CCl₄ + MeCN', 'th', 'start') + tx(368, 162, 'RuO₄ 氧化环己基苯，自身被还原', 'ts', 'start');
    s += ln(P(470, 95), P(470, 112), INK, 1.2) + head(P(470, 117), 90, INK, 8, 3.6) + tx(478, 106, 'RuO₄', 'ts', 'start');
    s += ln(P(560, 117), P(560, 100), INK, 1.2) + head(P(560, 95), -90, INK, 8, 3.6) + tx(568, 106, 'Ru(IV)/Ru(VI)', 'ts', 'start');
    s += tx(500, 206, 'MeCN：配位低价 Ru，防止 Ru–羧酸盐沉淀失活', 'ts');
    return s;
  } });

FRAMES.push({ st: 2, t: '① RuO₄ 对苯环的 C3=C4 做 [3+2] 环加成，芳香性被打破',
  c: 'RuO₄ 是强亲电的氧化剂，可以像对普通烯烃那样，对苯环的一根 C=C 做 [3+2] 环加成（cycloaddition），生成五元环状钌(VI)酸酯。三根箭头：C3=C4 的 π 电子进攻一个 O；这个 O 原来与 Ru 之间的 π 电子回到 Ru 上；另一个 Ru=O 的 π 电子去和 C3 成键。Ru 从 VIII 价降到 VI 价，苯环变成环己二烯。这里画成进攻离环己基较远的一侧。',
  d: () => {
    L = 30; let s = '', m;
    const B = P(180, 136);
    m = mol(); arene(m, B, [0, 2, 4]); cyhex(m, 'c1', 180);
    ruCycle(m, 'c3', 'c4', B, ['oa', 'ob', 'ru', 'oc', 'od'], 8, 1.3 * L);
    s += draw(m);
    const A = m.A;
    s += arr(bm(m, 'c3', 'c4', -4), P(A.c4.x + (A.ob.x - A.c4.x) * 0.55, A.c4.y + (A.ob.y - A.c4.y) * 0.55), -12);
    s += ruArr(m, 'ob', 1);
    s += arr(bm(m, 'ru', 'oa', 4), P(A.oa.x + (A.c3.x - A.oa.x) * 0.45, A.oa.y + (A.c3.y - A.oa.y) * 0.45), 12);
    s += rx(320, 382, 136, ['[3+2]'], ['去芳构化', '2 e⁻']);
    const B2 = P(510, 136);
    m = mol(); arene(m, B2, [0, 4]); cyhex(m, 'c1', 180);
    ruCycle(m, 'c3', 'c4', B2, ['oa', 'ob', 'ru', 'oc', 'od'], 6);
    s += draw(m);
    s += tx(510, 206, '环状钌(VI)酸酯（cyclic ruthenate ester）', 'ts');
    return s;
  } });

FRAMES.push({ st: 2, t: '① 钌酸酯碎裂：C3–C4 断开，苯环变成二烯二醛',
  c: '同样的三根箭头再走一遍，只是这次流动的是 C3–C4 的 σ 键：C3–C4 键的电子变成 C4=O；O–Ru 键的电子回到 Ru 上；另一根 Ru–O 键的电子变成 C3=O。两端各成为一个醛基，Ru 再得 2 个电子降到 Ru(IV)（RuO₂）。环被打开，剩下的 C1=C2、C5=C6 仍保持原来的顺式。',
  d: () => {
    L = 30; let s = '', m;
    const B = P(180, 136);
    m = mol(); arene(m, B, [0, 4]); cyhex(m, 'c1', 180);
    ruCycle(m, 'c3', 'c4', B, ['oa', 'ob', 'ru', 'oc', 'od'], 6);
    s += draw(m);
    const A = m.A;
    s += arr(bm(m, 'c3', 'c4', 3), bm(m, 'c4', 'ob', 3.5), 12);
    s += ruArr(m, 'ob', 1);
    s += arr(bm(m, 'ru', 'oa', 3.5), bm(m, 'oa', 'c3', 3.5), 10);
    s += rx(318, 376, 136, ['碎裂'], ['2 e⁻']);
    const B2 = P(498, 136);
    m = mol(); arene(m, B2, [0, 4], [2]); cyhex(m, 'c1', 180);
    at(m, 'oa', pol(m.A.c3, -60, L), { lab: 'O' }); bd(m, 'c3', 'oa', 2);
    at(m, 'ob', pol(m.A.c4, 0, L), { lab: 'O' }); bd(m, 'c4', 'ob', 2);
    s += draw(m);
    m = mol(); ruO2(m, P(616, 76)); s += draw(m);
    s += tx(616, 104, 'RuO₂', 'ts');
    s += tx(498, 206, '开环二烯二醛（两根 C=C 保持环内顺式）', 'ts');
    return s;
  } });

FRAMES.push({ st: 2, t: '催化循环：RuO₂ 被 NaIO₄ 氧化回 RuO₄',
  c: '断一根 C=C，一个 RuO₄ 共接受 4 个电子（VIII → VI → IV）。RuO₂ 再被 2 个 IO₄⁻ 氧化回 RuO₄，所以 Ru 只要催化量，NaIO₄ 才是按化学计量消耗的终端氧化剂（terminal oxidant）。后面醛氧化、脱羧这两类 2 电子步骤只把 Ru 降到 VI 价，1 个 IO₄⁻ 就能再生。',
  d: () => {
    let s = '';
    const node = (x, y, w, t1, t2) => box(x, y, w, 54, false) + tx(x + w / 2, y + 19, t1, 'th') + tx(x + w / 2, y + 38, t2, 'ts');
    s += node(40, 42, 150, 'RuO₄', 'Ru(VIII)') + node(265, 42, 150, '环状钌酸酯', 'Ru(VI)') + node(490, 42, 150, 'RuO₂', 'Ru(IV)');
    s += rx(194, 261, 69, ['+ C=C'], ['[3+2]，2 e⁻']);
    s += rx(419, 486, 69, ['C–C 断裂'], ['2 C=O，2 e⁻']);
    s += `<path d="M565 100 V150 H115 V104" style="fill:none;stroke:${INK};stroke-width:1.3"/>` + head(P(115, 100), -90, INK, 9, 4);
    s += tx(340, 136, '2 NaIO₄ → 2 NaIO₃（水相，回收 4 e⁻）', 'ts');
    s += tx(340, 186, 'RuO₂ + 2 NaIO₄ → RuO₄ + 2 NaIO₃', 'teq');
    s += tx(340, 210, '2 电子步骤（醛 → 酸、氧化脱羧）：Ru(VIII) → Ru(VI)，H₂RuO₄ + NaIO₄ → RuO₄ + NaIO₃ + H₂O', 'ts');
    return s;
  } });

FRAMES.push({ st: 3, t: '② 第二根：C1=C2 被切断，C1 变成酮',
  c: '剩下的两根 C=C 里，C1=C2 连着环己基（三取代、电子更富），更容易被亲电的 RuO₄ 进攻。先同样 [3+2] 成酯（这里直接画出酯；分子转了 60° 好放下 Ru），再碎裂：C1 变成酮羰基，C2–C3 作为乙二醛（glyoxal）离开。到这一步，C1 的命运已经定了：一边连环己基，一边是 C=O。',
  d: () => {
    L = 28; let s = '', m;
    const B = P(214, 146);
    m = mol(); arene(m, B, [4], [2], null, true, 240); cyhex(m, 'c1', 186);
    at(m, 'oa', pol(m.A.c3, 0, L), { lab: 'O' }); bd(m, 'c3', 'oa', 2);
    at(m, 'ob', pol(m.A.c4, 60, L), { lab: 'O' }); bd(m, 'c4', 'ob', 2);
    ruCycle(m, 'c1', 'c2', B, ['o1', 'o2', 'ru', 'oc', 'od'], 6);
    s += draw(m);
    const A = m.A;
    s += arr(bm(m, 'c1', 'c2', -3), bm(m, 'c2', 'o2', -3.5), -12);
    s += ruArr(m, 'o2', -1);
    s += arr(bm(m, 'ru', 'o1', -3.5), bm(m, 'o1', 'c1', -3.5), -10);
    s += rx(310, 368, 136, ['碎裂'], ['[3+2] 同 ①', '共 4 e⁻']);
    const B2 = P(500, 128);
    m = mol(); arene(m, B2, [4], [], ['c1', null, null, 'c4', 'c5', 'c6']); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(m.A.c1, -60, L), { lab: 'O' }); bd(m, 'c1', 'o1', 2);
    at(m, 'ob', pol(m.A.c4, 0, L), { lab: 'O' }); bd(m, 'c4', 'ob', 2);
    s += draw(m);
    m = mol(); c2(m, P(606, 150), ['c2', 'c3', 'o2', 'oa']); m.nums.push(['c2', 2, P(590, 124)], ['c3', 3, P(645, 160)]); s += draw(m);
    s += tx(618, 204, '乙二醛', 'ts') + tx(470, 204, '+ RuO₂', 'ts');
    return s;
  } });

FRAMES.push({ st: 3, t: '③ 第三根：C5=C6 被切断，得到 α-酮醛',
  c: '最后一根 C=C 重复同样的两步：[3+2] 成酯、碎裂。C4–C5 也以乙二醛离开；剩下 环己基–C(=O)–CHO，一个 α-酮醛。原 C6（青）现在是醛基碳，仍连在 C1 上。',
  d: () => {
    L = 28; let s = '', m;
    const B = P(206, 92);
    m = mol(); arene(m, B, [], [], ['c1', null, null, 'c4', 'c5', 'c6']); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(m.A.c1, -60, L), { lab: 'O' }); bd(m, 'c1', 'o1', 2);
    at(m, 'ob', pol(m.A.c4, 0, L), { lab: 'O' }); bd(m, 'c4', 'ob', 2);
    ruCycle(m, 'c5', 'c6', B, ['o5', 'o6', 'ru', 'oc', 'od'], 6);
    s += draw(m);
    const A = m.A;
    s += arr(bm(m, 'c5', 'c6', 3), bm(m, 'c6', 'o6', 3.5), 12);
    s += ruArr(m, 'o6', 1);
    s += arr(bm(m, 'ru', 'o5', 3.5), bm(m, 'o5', 'c5', 3.5), 10);
    s += rx(300, 358, 112, ['碎裂'], ['[3+2] 同 ①', '共 4 e⁻']);
    const B2 = P(480, 100);
    m = mol(); arene(m, B2, [], [], ['c1', null, null, null, null, 'c6']); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(m.A.c1, -60, L), { lab: 'O' }); bd(m, 'c1', 'o1', 2);
    at(m, 'o6', pol(m.A.c6, 0, L), { lab: 'O' }); bd(m, 'c6', 'o6', 2);
    s += draw(m);
    s += tx(466, 166, 'α-酮醛', 'ts');
    m = mol(); c2(m, P(588, 128), ['c4', 'c5', 'ob', 'o5']); m.nums.push(['c4', 4, P(572, 102)], ['c5', 5, P(627, 138)]); s += draw(m);
    s += tx(600, 182, '乙二醛', 'ts') + tx(329, 204, '+ RuO₂', 'ts');
    return s;
  } });

FRAMES.push({ st: 4, t: '④ 醛被氧化成羧酸：得到 α-酮酸',
  c: '醛在水里先形成水合物（hydrate，偕二醇），水合物的一个 O–H 加到 RuO₄ 的 Ru=O 上，成为钌(VIII)酸酯。接着经五元环：Ru=O 的 π 电子去夺取 C6 上的 H，C–H 键的电子形成 C=O，O–Ru 键的电子留给 Ru。醛变成羧酸，Ru(VIII) → Ru(VI)。',
  d: () => {
    L = 28; let s = '', m;
    const S = 1.3 * L;
    m = mol();
    const c1 = at(m, 'c1', P(166, 152), { halo: 'purple' }); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(c1, 90, L), { lab: 'O' }); bd(m, 'c1', 'o1', 2);
    const c6 = at(m, 'c6', pol(c1, -30, L), { halo: 'teal' }); bd(m, 'c1', 'c6');
    const oe = at(m, 'oe', pol(c6, 18, S), { lab: 'O' });
    const ru = at(m, 'ru', pol(oe, -54, S), { lab: 'Ru', ox: 8, oxs: false });
    const ox = at(m, 'ox', pol(ru, -126, S), { lab: 'O' });
    at(m, 'h6', pol(ox, 162, S), { lab: 'H', clip: 7.5 });
    at(m, 'o6', pol(c6, 80, L), { lab: 'O', suf: 'H' });
    at(m, 'rp', pol(ru, -60, RL()), { lab: 'O' });
    at(m, 'rq', pol(ru, 5, RL()), { lab: 'O' });
    at(m, 'rh', pol(ru, 65, RL()), { lab: 'O', suf: 'H' });
    bd(m, 'c6', 'oe'); bd(m, 'oe', 'ru'); bd(m, 'ru', 'ox', 2); bd(m, 'c6', 'h6'); bd(m, 'c6', 'o6');
    bd(m, 'ru', 'rp', 2); bd(m, 'ru', 'rq', 2); bd(m, 'ru', 'rh'); bd(m, 'h6', 'ox', 'h');
    s += draw(m);
    const A = m.A;
    s += arr(bm(m, 'ru', 'ox', -3.5), pol(A.h6, 0, 9), -14);
    s += arr(bm(m, 'c6', 'h6', 3), bm(m, 'c6', 'oe', -3), 10);
    s += ruArr(m, 'oe', 1);
    s += tx(190, 218, '醛水合物的钌(VIII)酸酯', 'ts');
    s += rx(316, 374, 136, ['−H₂RuO₄'], ['2 e⁻']);
    m = mol();
    const d1 = at(m, 'c1', P(486, 146), { halo: 'purple' }); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(d1, 90, L), { lab: 'O' }); bd(m, 'c1', 'o1', 2);
    const d6 = at(m, 'c6', pol(d1, -30, L), { halo: 'teal' }); bd(m, 'c1', 'c6');
    at(m, 'oe', pol(d6, -90, L), { lab: 'O' }); bd(m, 'c6', 'oe', 2);
    at(m, 'o6', pol(d6, 30, L), { lab: 'O', suf: 'H' }); bd(m, 'c6', 'o6');
    s += draw(m);
    s += tx(470, 218, 'α-酮酸', 'ts');
    m = mol(); ruVI(m, P(620, 136)); s += draw(m);
    s += tx(620, 190, 'H₂RuO₄', 'ts');
    return s;
  } });

FRAMES.push({ st: 4, t: '⑤ α-酮酸氧化脱羧：C6 以 CO₂ 离开',
  c: 'α-酮酸的酮羰基同样先水合，一个 OH 与 RuO₄ 成酯。羧酸根推电子放出 CO₂；C1–C6 键的电子转到 C1 上形成 C=O；O–Ru 键断裂，电子交给 Ru。C6（青）变成 CO₂，C1（紫）成为环己甲酸的羧基碳。',
  d: () => {
    L = 30; let s = '', m;
    m = mol();
    const c1 = at(m, 'c1', P(196, 156), { halo: 'purple' }); cyhex(m, 'c1', 180);
    at(m, 'o1', pol(c1, 90, L), { lab: 'O', suf: 'H' }); bd(m, 'c1', 'o1');
    const ow = at(m, 'ow', pol(c1, -90, L), { lab: 'O' }); bd(m, 'c1', 'ow');
    const ru = at(m, 'ru', pol(ow, -90, RL()), { lab: 'Ru', ox: 8, oxs: false });
    bd(m, 'ow', 'ru');
    at(m, 'rp', pol(ru, 168, RL()), { lab: 'O' });
    at(m, 'rq', pol(ru, 232, RL()), { lab: 'O' });
    at(m, 'rr', pol(ru, 308, RL()), { lab: 'O' });
    at(m, 'rh', pol(ru, 12, RL()), { lab: 'O', suf: 'H' });
    bd(m, 'ru', 'rp', 2); bd(m, 'ru', 'rq', 2); bd(m, 'ru', 'rr', 2); bd(m, 'ru', 'rh');
    const c6 = at(m, 'c6', pol(c1, 0, L), { halo: 'teal' }); bd(m, 'c1', 'c6');
    at(m, 'oe', pol(c6, -60, L), { lab: 'O' }); bd(m, 'c6', 'oe', 2);
    at(m, 'o6', pol(c6, 60, L), { lab: 'O', chg: '-', ca: 10, cd: 12, lp: [110] }); bd(m, 'c6', 'o6');
    s += draw(m);
    const A = m.A;
    s += arr(pol(A.o6, 110, 13), bm(m, 'c6', 'o6', 3.5), -10);
    s += arr(bm(m, 'c1', 'c6', 3), bm(m, 'c1', 'ow', -3), 12);
    s += ruArr(m, 'ow', 1);
    s += tx(190, 222, '酮水合物的钌(VIII)酸酯', 'ts');
    s += rx(316, 376, 146, ['−CO₂'], ['2 e⁻']);
    m = mol(); acid(m, P(476, 146)); s += draw(m);
    s += tx(456, 204, '环己甲酸', 'ts');
    m = mol(); co2(m, P(590, 86), ['c6', 'oe', 'o6']); m.A.c6.halo = 'teal'; s += draw(m);
    m = mol(); ruVI(m, P(616, 164), true); s += draw(m);
    return s;
  } });

FRAMES.push({ st: 5, t: '⑥ 两分子乙二醛的去向：草酸，再到 CO₂',
  c: '乙二醛的两个醛基各按 ④ 的方式被氧化成羧酸，得到草酸；草酸再被 RuO₄ 氧化成两分子 CO₂。两分子乙二醛（C2/C3、C4/C5）给出 4 个 CO₂，加上 ⑤ 放出的 C6，5 个环碳全部变成 CO₂。',
  d: () => {
    L = 26; let s = '', m;
    m = mol(); c2(m, P(70, 92), ['ga', 'gb', 'gc', 'gd']); s += draw(m);
    s += tx(84, 140, '乙二醛 ×2', 'ts');
    s += rx(140, 250, 98, ['2 RuO₄, 2 H₂O'], ['−2 H₂RuO₄', '4 e⁻（每分子）']);
    m = mol(); c2(m, P(300, 92), ['ga', 'gb', 'gc', 'gd'], true); s += draw(m);
    s += tx(313, 140, '草酸 ×2', 'ts');
    s += rx(380, 476, 98, ['RuO₄'], ['−H₂RuO₄', '2 e⁻（每分子）']);
    m = mol(); co2(m, P(530, 80), ['ga', 'gc', 'gch']); s += draw(m);
    m = mol(); co2(m, P(530, 116), ['gb', 'gd', 'gbh']); s += draw(m);
    s += tx(590, 98, '×2', 't', 'start');
    s += tx(340, 186, 'OHC–CHO + 2 RuO₄ + 2 H₂O → HOOC–COOH + 2 H₂RuO₄；HOOC–COOH + RuO₄ → 2 CO₂ + H₂RuO₄', 'ts');
    s += tx(340, 210, '所有 Ru(VI)、Ru(IV) 都由 NaIO₄ 重新氧化成 RuO₄', 'ts');
    return s;
  } });

FRAMES.push({ st: 5, t: '回顾：原子与电子记账',
  c: 'C1 自始至终连着环己基，从芳香碳（氧化态 0）变成羧基碳（+3）；C2–C6 依次断成乙二醛 / α-酮酸碎片，最后都是 CO₂（+4）。三次 C=C 断裂各 4 e⁻，醛 → 酸、脱羧、乙二醛 → 草酸、草酸 → CO₂ 合计 16 e⁻，总共 28 e⁻ = 14 NaIO₄。',
  d: () => {
    L = 26; let s = '', m;
    m = mol(); arene(m, P(160, 84), [0, 2, 4]); cyhex(m, 'c1', 180); s += draw(m);
    s += rx(214, 300, 84, ['RuO₄ / NaIO₄'], []);
    m = mol(); acid(m, P(392, 84)); s += draw(m);
    s += tx(430, 84, '+ 5 CO₂', 't', 'start') + tx(498, 84, '（C2–C6）', 'ts', 'start');
    const rows = [['①②③ 三次 C=C 断裂', '3 × 4 e⁻ = 12 e⁻'], ['④ α-酮醛 → α-酮酸', '2 e⁻'], ['⑤ 氧化脱羧（C6 → CO₂）', '2 e⁻'], ['⑥ 2 乙二醛 → 2 草酸 → 4 CO₂', '8 e⁻ + 4 e⁻']];
    rows.forEach((r, i) => { s += tx(150, 146 + i * 18, r[0], 'ts', 'start') + tx(470, 146 + i * 18, r[1], 'ts', 'end'); });
    s += ln(P(150, 213), P(470, 213), MUT, 0.8);
    s += tx(150, 226, '合计 28 e⁻ = 14 NaIO₄', 'th', 'start');
    return s;
  } });

// 页面图例里的小弯箭头
export function legendArrow() { return arr(P(3, 12), P(25, 10), 9); }
