// 3D 动画的时间轴与逐帧渲染：frame(τ, cam) → SVG 片段。纯函数，页面与核验脚本共用。
import { KF, SCENES } from './mech3d.js';

export const EL3 = {
  C: { r: 0.34, f: '#8d9197', s: '#5f6369' },
  H: { r: 0.21, f: '#f3f3f0', s: '#9b9b96' },
  O: { r: 0.34, f: '#e5484d', s: '#a32d2d' },
  Ru: { r: 0.5, f: '#248f8f', s: '#16605f' },
};
const HALO = { p: '#7f77dd', t: '#1d9e75' };
const ROM = { 4: 'IV', 6: 'VI', 8: 'VIII' };
const R1 = v => Math.round(v * 10) / 10;
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ───────── 时间轴：每一幕 = 准备（K0→K1）+ 弯箭头 + 变形（K1→K2）+ 停留 ─────────
export const TL = [];
let T0 = 0;
SCENES.forEach((s, i) => {
  const prep = s.k0 === s.k1 ? 0.3 : 1.6, arr = s.arrows.length ? 2.0 : 0, morph = s.k1 === s.k2 ? 0 : 1.7, hold = i === SCENES.length - 1 ? 3.5 : 1.1;
  TL.push({ i: i, t0: T0, prep: prep, arr: arr, morph: morph, hold: hold, t1: T0 + prep + arr + morph + hold });
  T0 += prep + arr + morph + hold;
});
export const TOTAL = T0;
export function sceneAt(tau) { for (const s of TL) if (tau < s.t1) return s; return TL[TL.length - 1]; }

// 某一时刻的“插值分子”：原子位置 / 不透明度、键的每一条线的不透明度
function mix(A, B, t, tParam) {
  const atoms = {};
  for (const id in A.A) {
    const a = A.A[id], b = B.A[id];
    if (b) atoms[id] = { el: a.el, p: lerp3(a.p, b.p, t), o: 1, halo: a.halo || b.halo, num: a.num || b.num, ox: t < 0.5 ? a.ox : b.ox, chg: t < 0.5 ? a.chg : b.chg };
    else { const v = (B.leave && B.leave[id]) || [0, 0, 0]; atoms[id] = { el: a.el, p: [a.p[0] + v[0] * t, a.p[1] + v[1] * t, a.p[2] + v[2] * t], o: 1 - t, halo: a.halo, num: a.num, ox: a.ox, chg: a.chg }; }
  }
  for (const id in B.A) {
    if (A.A[id]) continue;
    const b = B.A[id], v = (B.enter && B.enter[id]) || [0, 0, 0];
    atoms[id] = { el: b.el, p: [b.p[0] + v[0] * (1 - t), b.p[1] + v[1] * (1 - t), b.p[2] + v[2] * (1 - t)], o: t, halo: b.halo, num: b.num, ox: b.ox, chg: b.chg };
  }
  const keys = new Set([...Object.keys(A.B), ...Object.keys(B.B)]), bonds = [];
  for (const k of keys) {
    const [a, b] = k.split('|');
    if (!atoms[a] || !atoms[b]) continue;
    const oa = A.B[k] || 0, ob = B.B[k] || 0, w = Math.min(atoms[a].o, atoms[b].o);
    const one = lerp(oa && oa !== 'h' ? 1 : 0, ob && ob !== 'h' ? 1 : 0, tParam) * w;
    const two = lerp(oa === 2 ? 1 : 0, ob === 2 ? 1 : 0, tParam) * w;
    const hb = lerp(oa === 'h' ? 1 : 0, ob === 'h' ? 1 : 0, tParam) * w;
    bonds.push({ a: a, b: b, one: one, two: two, hb: hb });
  }
  return { atoms: atoms, bonds: bonds };
}
function mainCentre(K) {
  const ids = Object.keys(K.A).filter(id => K.A[id].el !== 'Ru' && !/^(q|p|r)/.test(id) || id === 'c1');
  const seen = new Set(['c1']), st = ['c1'];
  while (st.length) { const u = st.pop(); for (const k in K.B) { if (K.B[k] === 'h') continue; const [a, b] = k.split('|'); const v = a === u ? b : b === u ? a : null; if (v && !seen.has(v) && K.A[v] && K.A[v].el !== 'Ru') { seen.add(v); st.push(v); } } }
  let c = [0, 0, 0], n = 0;
  seen.forEach(id => { if (K.A[id] && K.A[id].el !== 'H') { c = [c[0] + K.A[id].p[0], c[1] + K.A[id].p[1], c[2] + K.A[id].p[2]]; n++; } });
  return ids.length ? [c[0] / n, c[1] / n, c[2] / n] : [0, 0, 0];
}

// 某一时刻的完整状态：用于渲染，也给核验脚本 / 浏览器验收检查
export function stateAt(tau) {
  tau = Math.max(0, Math.min(TOTAL - 1e-6, tau));
  const seg = sceneAt(tau), sc = SCENES[seg.i];
  let u = tau - seg.t0, A, B, t, arrowP = 0, arrowFade = 1, phase;
  if (u < seg.prep) { A = KF[sc.k0]; B = KF[sc.k1]; t = ease(u / seg.prep); phase = 'prep'; }
  else if ((u -= seg.prep) < seg.arr) { A = B = KF[sc.k1]; t = 1; arrowP = u / seg.arr; phase = 'arrows'; }
  else if ((u -= seg.arr) < seg.morph) { A = KF[sc.k1]; B = KF[sc.k2]; t = ease(u / seg.morph); arrowP = 1; arrowFade = 1 - Math.min(1, u / seg.morph * 1.6); phase = 'morph'; }
  else { A = B = KF[sc.k2]; t = 1; arrowP = 1; arrowFade = 0; phase = 'hold'; }
  const m = mix(A, B, t, phase === 'morph' ? Math.min(1, t * 1.15) : t);
  let cs = [0, 0, 0], cw = 0;
  for (const id in m.atoms) { const a = m.atoms[id]; if (a.el === 'H') continue; const k = a.o * a.o; cs = [cs[0] + a.p[0] * k, cs[1] + a.p[1] * k, cs[2] + a.p[2] * k]; cw += k; }
  const centre = cw ? [cs[0] / cw, cs[1] / cw, cs[2] / cw] : [0, 0, 0];
  const tagO = phase === 'prep' ? Math.sin(Math.PI * Math.min(1, (tau - seg.t0) / seg.prep)) : phase === 'arrows' && seg.prep ? Math.max(0, 1 - (tau - seg.t0 - seg.prep) / 0.6) : 0;
  return { seg: seg, sc: sc, phase: phase, m: m, centre: centre, arrowP: sc.arrows.length ? arrowP : 0, arrowFade: arrowFade, tags: (KF[sc.k1].tags || []).map(x => [x[0], x[1], tagO]) };
}

// ───────── 投影与绘制 ─────────
export function makeCam(yaw, pitch, S, cx, cy) { return { yaw: yaw, pitch: pitch, S: S || 34, cx: cx || 340, cy: cy || 175, D: 24 }; }
function proj(cam, p, c) {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const f = cam.D / (cam.D - z2);
  return [cam.cx + x1 * cam.S * f, cam.cy - y2 * cam.S * f, z2, f];
}
function refPoint(m, r) {
  const A = m.atoms;
  if (r[0] === 'a') return A[r[1]] && A[r[1]].p;
  if (!A[r[1]] || !A[r[2]]) return null;
  return lerp3(A[r[1]].p, A[r[2]].p, 0.5);
}
function arrowSVG(cam, c, m, spec, prog, fade) {
  const p0r = refPoint(m, spec[0]), p2r = refPoint(m, spec[1]);
  if (!p0r || !p2r || prog <= 0 || fade <= 0) return '';
  let p0 = proj(cam, p0r, c), p2 = proj(cam, p2r, c);
  if (spec[1][0] === 'a') { const a = m.atoms[spec[1][1]], rr = EL3[a.el].r * cam.S * p2[3] + 4, dx = p0[0] - p2[0], dy = p0[1] - p2[1], d = Math.hypot(dx, dy) || 1; p2 = [p2[0] + dx / d * rr, p2[1] + dy / d * rr]; }
  if (spec[0][0] === 'a') { const a = m.atoms[spec[0][1]], rr = EL3[a.el].r * cam.S * p0[3] + 7, dx = p2[0] - p0[0], dy = p2[1] - p0[1], d = Math.hypot(dx, dy) || 1; p0 = [p0[0] + dx / d * rr, p0[1] + dy / d * rr]; }
  const dx = p2[0] - p0[0], dy = p2[1] - p0[1], d = Math.max(Math.hypot(dx, dy), 18);
  const k = spec[2] * Math.max(d, 30);
  const ctl = [(p0[0] + p2[0]) / 2 + dy / d * k, (p0[1] + p2[1]) / 2 - dx / d * k];
  const pt = s => [(1 - s) * (1 - s) * p0[0] + 2 * (1 - s) * s * ctl[0] + s * s * p2[0], (1 - s) * (1 - s) * p0[1] + 2 * (1 - s) * s * ctl[1] + s * s * p2[1]];
  const n = Math.max(2, Math.round(16 * prog)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(pt(prog * i / n));
  let s = `<polyline class="ar3" points="${pts.map(q => R1(q[0]) + ',' + R1(q[1])).join(' ')}" style="fill:none;stroke:#e24b4a;stroke-width:2;opacity:${R1(fade * 10) / 10}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (prog > 0.97) {
    const e = pts[pts.length - 1], b = pt(prog * 0.9), g = Math.atan2(e[1] - b[1], e[0] - b[0]);
    const hl = 9, hw = 4.2, l = [e[0] - Math.cos(g) * hl - Math.sin(g) * hw, e[1] - Math.sin(g) * hl + Math.cos(g) * hw], r = [e[0] - Math.cos(g) * hl + Math.sin(g) * hw, e[1] - Math.sin(g) * hl - Math.cos(g) * hw];
    s += `<polygon points="${R1(e[0])},${R1(e[1])} ${R1(l[0])},${R1(l[1])} ${R1(r[0])},${R1(r[1])}" style="fill:#e24b4a;opacity:${R1(fade * 10) / 10}"/>`;
  }
  return s;
}
export function frame(tau, cam) {
  const st = stateAt(tau), m = st.m, c = st.centre, P = {}, items = [];
  for (const id in m.atoms) P[id] = proj(cam, m.atoms[id].p, c);
  const bw = 0.13 * cam.S;
  for (const b of m.bonds) {
    const A = P[b.a], B = P[b.b], ea = m.atoms[b.a].el, eb = m.atoms[b.b].el;
    const f = (A[3] + B[3]) / 2, w = bw * f, dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], z = (A[2] + B[2]) / 2 - 0.02;
    const line = (o, off, op, wd) => {
      if (op < 0.02) return '';
      const a = [A[0] + nx * off, A[1] + ny * off], mm = [M[0] + nx * off, M[1] + ny * off], bb = [B[0] + nx * off, B[1] + ny * off];
      return `<line x1="${R1(a[0])}" y1="${R1(a[1])}" x2="${R1(mm[0])}" y2="${R1(mm[1])}" style="stroke:${EL3[ea].s};stroke-width:${R1(wd)};opacity:${R1(op * 10) / 10}" stroke-linecap="round"/>` +
        `<line x1="${R1(mm[0])}" y1="${R1(mm[1])}" x2="${R1(bb[0])}" y2="${R1(bb[1])}" style="stroke:${EL3[eb].s};stroke-width:${R1(wd)};opacity:${R1(op * 10) / 10}" stroke-linecap="round"/>`;
    };
    let s = '';
    if (b.two > 0.02) { s += line(1, -w * 0.75, b.one, w * 0.62) + line(2, w * 0.75, b.two, w * 0.62); if (b.one - b.two > 0.02) s += line(1, 0, (b.one - b.two), w * 0.62); }
    else s += line(1, 0, b.one, w);
    if (b.hb > 0.02) s += `<line x1="${R1(A[0])}" y1="${R1(A[1])}" x2="${R1(B[0])}" y2="${R1(B[1])}" style="stroke:#8a8a86;stroke-width:1.3;opacity:${R1(b.hb * 10) / 10}" stroke-dasharray="3 3"/>`;
    if (s) items.push([z, s]);
  }
  for (const id in m.atoms) {
    const a = m.atoms[id], p = P[id], e = EL3[a.el], r = e.r * cam.S * p[3];
    if (a.o < 0.02) continue;
    let s = `<g style="opacity:${R1(a.o * 10) / 10}">`;
    if (a.halo) s += `<circle cx="${R1(p[0])}" cy="${R1(p[1])}" r="${R1(r + 4)}" style="fill:none;stroke:${HALO[a.halo]};stroke-width:2.2"/>`;
    s += `<circle cx="${R1(p[0])}" cy="${R1(p[1])}" r="${R1(r)}" style="fill:${e.f};stroke:${e.s};stroke-width:0.8"/>`;
    s += `<circle cx="${R1(p[0] - r * 0.33)}" cy="${R1(p[1] - r * 0.36)}" r="${R1(r * 0.3)}" style="fill:#ffffff;opacity:0.45"/>`;
    if (a.el === 'Ru') s += `<text x="${R1(p[0])}" y="${R1(p[1])}" text-anchor="middle" dominant-baseline="central" style="font-size:11px;fill:#ffffff;font-weight:500">Ru</text>`;
    s += '</g>';
    items.push([p[2], s]);
  }
  items.sort((x, y) => x[0] - y[0]);
  let over = '';
  for (const id in m.atoms) {
    const a = m.atoms[id], p = P[id], r = EL3[a.el].r * cam.S * p[3];
    if (a.o < 0.3) continue;
    if (a.num) over += `<text class="ts" x="${R1(p[0] + r + 3)}" y="${R1(p[1] - r - 3)}" style="opacity:${R1(a.o * 10) / 10}">${a.num}</text>`;
    if (a.ox) over += `<text class="ts" x="${R1(p[0] + r + 2)}" y="${R1(p[1] + r + 6)}" style="opacity:${R1(a.o * 10) / 10}">${ROM[a.ox]}</text>`;
    if (a.chg) { const q = [p[0] + r + 6, p[1] - r - 2]; over += `<g style="opacity:${R1(a.o * 10) / 10}"><circle cx="${R1(q[0])}" cy="${R1(q[1])}" r="5.5" style="fill:none;stroke:#e24b4a;stroke-width:1.1"/><line x1="${R1(q[0] - 2.8)}" y1="${R1(q[1])}" x2="${R1(q[0] + 2.8)}" y2="${R1(q[1])}" style="stroke:#e24b4a;stroke-width:1.2"/></g>`; }
  }
  st.sc.arrows.forEach((spec, i) => {
    const n = st.sc.arrows.length, s0 = i / (n + 1), prog = Math.max(0, Math.min(1, (st.arrowP - s0) / (1.6 / (n + 1))));
    over += arrowSVG(cam, c, m, spec, prog, st.arrowFade);
  });
  for (const [id, text, o] of st.tags) {
    if (o < 0.03 || !m.atoms[id]) continue;
    const p = P[id];
    over += `<text class="ts" x="${R1(p[0])}" y="${R1(p[1] - 34)}" text-anchor="middle" style="opacity:${R1(o * 10) / 10}">${text}</text>`;
  }
  return { svg: items.map(x => x[1]).join('') + over, st: st };
}
