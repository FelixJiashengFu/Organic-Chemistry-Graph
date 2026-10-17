// 3D 动画的关键帧：每一幕只写拓扑（谁连谁、几重键、电荷、Ru 氧化态），
// 坐标由下面的小型几何松弛（键长 / 键角 / sp² 平面 / 双键共面 / 非键排斥）从上一帧推出来。
// 原子 id 全程不变；页面（app3d.js）与核验脚本（verify3d.mjs）共用这一份数据。

// ───────── 向量 ─────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return sc(a, 1 / l); };
const DEG = Math.PI / 180;

// ───────── 分子状态 ─────────
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
function St() { return { A: {}, B: {}, R: [], enter: {}, leave: {}, tags: [] }; }
function atom(S, id, el, p, o) { S.A[id] = Object.assign({ el: el, p: p.slice() }, o || {}); return S.A[id]; }
function bond(S, a, b, o) { const k = key(a, b); if (!o) delete S.B[k]; else S.B[k] = o; }
function nbrs(S, id) { const r = []; for (const k in S.B) { const [a, b] = k.split('|'); if (S.B[k] === 'h') continue; if (a === id) r.push(b); else if (b === id) r.push(a); } return r; }
function comp(S, id) { const seen = new Set([id]), st = [id]; while (st.length) { const u = st.pop(); for (const v of nbrs(S, u)) if (!seen.has(v)) { seen.add(v); st.push(v); } } return [...seen]; }
function cen(S, ids) { let c = [0, 0, 0]; ids.forEach(id => { c = add(c, S.A[id].p); }); return sc(c, 1 / ids.length); }
function move(S, ids, v) { ids.forEach(id => { S.A[id].p = add(S.A[id].p, v); }); }
function drop(S, ids, v) { // 离场：从下一帧删掉，并记下飞走的方向
  const out = {};
  ids.forEach(id => { out[id] = v; delete S.A[id]; });
  for (const k in S.B) { const [a, b] = k.split('|'); if (!S.A[a] || !S.A[b]) delete S.B[k]; }
  return out;
}
function snap(S) {
  const A = {};
  for (const id in S.A) A[id] = Object.assign({}, S.A[id], { p: S.A[id].p.slice() });
  return { A: A, B: Object.assign({}, S.B), enter: S.enter, leave: S.leave, tags: S.tags, R: S.R.slice() };
}

// ───────── 几何松弛（position-based：逐条约束投影） ─────────
function blen(S, a, b, o, aro) {
  const e = [S.A[a].el, S.A[b].el].sort().join('');
  if (aro) return 1.39;
  if (e === 'CC') return o === 2 ? 1.34 : 1.53;
  if (e === 'CH') return 1.09;
  if (e === 'CO') {
    const c = S.A[a].el === 'C' ? a : b;
    const nd = nbrs(S, c).filter(x => S.B[key(c, x)] === 2).length;
    return o === 2 ? (nd === 2 ? 1.17 : 1.21) : 1.42;
  }
  if (e === 'HO') return 0.97;
  if (e === 'ORu') return o === 2 ? 1.71 : 1.96;
  return 1.5;
}
function theta(S, id, n) {
  const el = S.A[id].el;
  if (el === 'C') return n >= 4 ? 109.47 : n === 3 ? 120 : 180;
  if (el === 'O') return nbrs(S, id).some(x => S.A[x].el === 'Ru') ? 118 : 108;
  return null;
}
export function relax(S, iters) {
  const ids = Object.keys(S.A), I = {};
  ids.forEach((id, i) => { I[id] = i; });
  const P = ids.map(id => S.A[id].p.slice()), N = ids.map(id => nbrs(S, id));
  const cons = [], pl = [], tor = [], near = new Set(), pk = (i, j) => (i < j ? i * 1000 + j : j * 1000 + i);
  for (const k in S.B) {
    const o = S.B[k]; if (o === 'h') continue;
    const [a, b] = k.split('|');
    cons.push([I[a], I[b], blen(S, a, b, o, S.aro && S.aro.has(k)), 1]);
    near.add(pk(I[a], I[b]));
  }
  ids.forEach((id, i) => {
    const nb = N[i];
    for (let x = 0; x < nb.length; x++) for (let y = x + 1; y < nb.length; y++) {
      const j = I[nb[x]], k = I[nb[y]];
      near.add(pk(j, k));
      if (S.A[id].el === 'Ru') { cons.push([j, k, 2.62, 0.5, 'min']); continue; }
      const t = theta(S, id, nb.length);
      if (t == null) continue;
      const d1 = blen(S, id, nb[x], S.B[key(id, nb[x])], S.aro && S.aro.has(key(id, nb[x]))), d2 = blen(S, id, nb[y], S.B[key(id, nb[y])], S.aro && S.aro.has(key(id, nb[y])));
      cons.push([j, k, Math.sqrt(d1 * d1 + d2 * d2 - 2 * d1 * d2 * Math.cos(t * DEG)), 0.45]);
    }
    if (S.A[id].el === 'C' && nb.length === 3) pl.push([i, I[nb[0]], I[nb[1]], I[nb[2]]]);
  });
  for (const k in S.B) {
    if (S.B[k] !== 2) continue;
    const [a, b] = k.split('|');
    if (S.A[a].el !== 'C' || S.A[b].el !== 'C' || (S.aro && S.aro.has(k))) continue;
    N[I[a]].filter(x => x !== b).forEach(x => N[I[b]].filter(y => y !== a).forEach(y => tor.push([I[x], I[a], I[b], I[y]])));
  }
  S.R.forEach(([a, b, d]) => { if (I[a] != null && I[b] != null) { cons.push([I[a], I[b], d, 0.6]); near.add(pk(I[a], I[b])); } });
  const rep = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (near.has(pk(i, j))) continue;
    const hi = S.A[ids[i]].el === 'H', hj = S.A[ids[j]].el === 'H';
    rep.push([i, j, hi && hj ? 1.95 : hi || hj ? 2.35 : 2.75]);
  }
  const fix = S.fix || new Set();
  const mv = (i, v) => { if (!fix.has(ids[i])) P[i] = add(P[i], v); };
  for (let it = 0; it < (iters || 500); it++) {
    for (const [i, j, d0, k, mode] of cons) {
      const v = sub(P[j], P[i]), d = len(v) || 1e-6;
      if (mode === 'min' && d >= d0) continue;
      const c = sc(v, ((d - d0) / d) * 0.5 * k);
      mv(i, c); mv(j, sc(c, -1));
    }
    for (const [i, j, k, l] of pl) {
      const n = nrm(crs(sub(P[k], P[j]), sub(P[l], P[j]))), dd = dot(sub(P[i], P[j]), n);
      mv(i, sc(n, -dd * 0.6)); [j, k, l].forEach(q => mv(q, sc(n, dd * 0.2)));
    }
    for (const [x, a, b, y] of tor) {
      const n = nrm(crs(sub(P[a], P[x]), sub(P[b], P[x]))), dd = dot(sub(P[y], P[a]), n);
      mv(y, sc(n, -dd * 0.3)); [x, a, b].forEach(q => mv(q, sc(n, dd * 0.1)));
    }
    if (it % 2 === 0) for (const [i, j, d0] of rep) {
      const v = sub(P[j], P[i]), d = len(v) || 1e-6;
      if (d >= d0) continue;
      const c = sc(v, ((d - d0) / d) * 0.25);
      mv(i, c); mv(j, sc(c, -1));
    }
  }
  ids.forEach((id, i) => { S.A[id].p = P[i]; });
}

// ───────── 起始结构：椅式环己基 + 平面苯环 + 四面体 RuO₄ ─────────
function tetraPair(X, A, B) { // sp³ 原子 X（已有邻居 A、B）上另外两个方向
  const b = nrm(add(nrm(sub(X, A)), nrm(sub(X, B)))), n = nrm(crs(sub(A, X), sub(B, X)));
  const ca = Math.cos(54.75 * DEG), sa = Math.sin(54.75 * DEG);
  return [nrm(add(sc(b, ca), sc(n, sa))), nrm(sub(sc(b, ca), sc(n, sa)))];
}
function start() {
  const S = St();
  // 环己基：局部坐标的椅式，再转到 y1 的平伏键沿 +x
  const r = 1.446, h = 0.25, loc = [];
  for (let k = 0; k < 6; k++) loc.push([r * Math.cos(k * 60 * DEG), r * Math.sin(k * 60 * DEG), k % 2 ? -h : h]);
  const dirs = loc.map((X, k) => tetraPair(X, loc[(k + 5) % 6], loc[(k + 1) % 6]));
  const ax = dirs.map((d, k) => (Math.abs(d[0][2]) > Math.abs(d[1][2]) ? [d[0], d[1]] : [d[1], d[0]])); // [轴向, 平伏]
  const e = ax[0][1], Xs = e, Ws = nrm(sub([0, 0, 1], sc(e, e[2]))), Ys = crs(Ws, Xs);
  const Xt = [1, 0, 0], Wt = [0, 0.94, 0.34], Yt = crs(Wt, Xt);
  const map = p => add(add(sc(Xt, dot(p, Xs)), sc(Yt, dot(p, Ys))), sc(Wt, dot(p, Ws)));
  const o0 = map(loc[0]);
  const T = p => sub(map(p), o0);
  for (let k = 0; k < 6; k++) {
    const id = 'y' + (k + 1);
    atom(S, id, 'C', T(loc[k]));
    const [da, de] = ax[k].map(d => sub(map(d), map([0, 0, 0])));
    if (k === 0) atom(S, 'hy1', 'H', add(S.A.y1.p, sc(nrm(da), 1.09)));
    else { atom(S, 'hy' + (k + 1) + 'a', 'H', add(S.A[id].p, sc(nrm(da), 1.09))); atom(S, 'hy' + (k + 1) + 'b', 'H', add(S.A[id].p, sc(nrm(de), 1.09))); }
  }
  for (let k = 0; k < 6; k++) bond(S, 'y' + (k + 1), 'y' + ((k + 1) % 6 + 1), 1);
  bond(S, 'y1', 'hy1', 1);
  for (let k = 2; k <= 6; k++) { bond(S, 'y' + k, 'hy' + k + 'a', 1); bond(S, 'y' + k, 'hy' + k + 'b', 1); }
  // 苯环：xy 平面，c1 连 y1
  const B = [1.53 + 1.39, 0, 0], ang = [180, 120, 60, 0, -60, -120];
  ang.forEach((g, k) => {
    const u = [Math.cos(g * DEG), Math.sin(g * DEG), 0];
    atom(S, 'c' + (k + 1), 'C', add(B, sc(u, 1.39)), k === 0 ? { halo: 'p', num: 1 } : k === 5 ? { halo: 't', num: 6 } : { num: k + 1 });
    if (k > 0) atom(S, 'h' + (k + 1), 'H', add(B, sc(u, 1.39 + 1.08)));
  });
  const kek = [2, 1, 2, 1, 2, 1];
  S.aro = new Set();
  for (let k = 0; k < 6; k++) { const a = 'c' + (k + 1), b = 'c' + ((k + 1) % 6 + 1); bond(S, a, b, kek[k]); S.aro.add(key(a, b)); }
  for (let k = 2; k <= 6; k++) bond(S, 'c' + k, 'h' + k, 1);
  bond(S, 'c1', 'y1', 1);
  relax(S, 2000);
  // 摆正：c1→c4 沿 +x，苯环法线朝 +y（苯环平躺，RuO₄ 从上方或下方落到环面上）
  const C1 = S.A.c1.p, u = nrm(sub(S.A.c4.p, C1));
  let n = nrm(crs(sub(S.A.c2.p, C1), sub(S.A.c6.p, C1)));
  n = nrm(sub(n, sc(u, dot(n, u))));
  const w = crs(u, n), O0 = sc(add(S.A.c1.p, S.A.c4.p), 0.5);
  for (const id in S.A) { const q = sub(S.A[id].p, O0); S.A[id].p = [dot(q, u), dot(q, n), dot(q, w)]; }
  // RuO₄：Ru(VIII)，四个 Ru=O，先放在右上方远处
  const R0 = [5.4, 4.2, -1.2];
  atom(S, 'ru', 'Ru', R0, { ox: 8 });
  [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].forEach((d, k) => { const id = ['q1', 'q2', 'q3', 'q4'][k]; atom(S, id, 'O', add(R0, sc(nrm(d), 1.71))); bond(S, 'ru', id, 2); });
  relax(S, 200);
  return S;
}

// 把 RuO₄（ru + 四个 O）整体搬到 a=b 键的一侧，并用两条“预备”约束让两个 O 分别对准 a、b
function present(S, oa, ob, a, b, side) {
  const g = ['ru', ...nbrs(S, 'ru')], M = sc(add(S.A[a].p, S.A[b].p), 0.5);
  const others = nbrs(S, a).filter(x => x !== b && S.A[x].el === 'C');
  let n = nrm(crs(sub(S.A[b].p, S.A[a].p), sub(S.A[others[0]].p, S.A[a].p)));
  if (dot(n, side) < 0) n = sc(n, -1);
  move(S, g, sub(add(M, sc(n, 3.0)), S.A.ru.p));
  S.R = [[oa, a, 2.75], [ob, b, 2.75]];
  relax(S, 700);
}
// [3+2]：a=b + Ru(=Oa)(=Ob) → 环状钌(VI)酸酯
function cyclo(S, oa, ob, a, b) {
  S.R = []; S.aro = null;
  bond(S, a, b, 1); bond(S, a, oa, 1); bond(S, b, ob, 1); bond(S, 'ru', oa, 1); bond(S, 'ru', ob, 1);
  S.A.ru.ox = 6;
  relax(S, 700);
}
// 碎裂：C–C σ 键断开，两端各得 C=O，Ru(VI) → Ru(IV)
function frag(S, oa, ob, a, b, away) {
  bond(S, a, b, 0); bond(S, a, oa, 2); bond(S, b, ob, 2); bond(S, 'ru', oa, 0); bond(S, 'ru', ob, 0);
  S.A.ru.ox = 4;
  move(S, ['ru', ...nbrs(S, 'ru')], away);
  relax(S, 600);
}
function enterO(S, ids, from) { // 来自 IO₄⁻ 的氧原子加到 Ru 上
  const R0 = S.A.ru.p;
  ids.forEach((id, k) => { atom(S, id, 'O', add(R0, [0.8 * (k ? 1 : -1), 1.2, 0.6])); bond(S, 'ru', id, 2); S.enter[id] = from; });
}

export const SCENES = [];
export const KF = [];
function build() {
  const S = start();
  const scene = (o) => { SCENES.push(Object.assign({ k0: SCENES.length ? SCENES[SCENES.length - 1].k2 : 0 }, o)); };
  S.enter = {}; S.leave = {}; S.tags = [];
  KF.push(snap(S));

  // 幕 1：RuO₄ 登场，[3+2] 加到 C3=C4
  S.enter = {}; S.leave = {};
  present(S, 'q1', 'q2', 'c3', 'c4', [0, 1, 0]);
  S.tags = [];
  KF.push(snap(S));
  cyclo(S, 'q1', 'q2', 'c3', 'c4'); S.enter = {}; S.leave = {};
  KF.push(snap(S));
  scene({ k1: 1, k2: 2, st: 0, e: 2,
    t: '① RuO₄ 从苯环平面上方靠近 C3=C4，[3+2] 环加成',
    c: 'RuO₄ 是四面体分子（Ru 为 +8 价）。它从苯环的一个面靠近 C3=C4，两个 O 分别对准 C3 和 C4。三对电子同时流动：C=C 的 π 电子进攻 O，这个 O 原来与 Ru 之间的 π 电子回到 Ru，另一个 Ru=O 的 π 电子去连 C3。两个 C–O 键在同一面形成（顺式），C3、C4 上的 H 被推到另一面，苯环失去芳香性。',
    arrows: [[['b', 'c3', 'c4'], ['m', 'c4', 'q2'], -0.35], [['b', 'ru', 'q2'], ['a', 'ru'], 0.5], [['b', 'ru', 'q1'], ['m', 'q1', 'c3'], 0.4]] });

  // 幕 2：钌酸酯碎裂，开环成二烯二醛 + RuO₂
  frag(S, 'q1', 'q2', 'c3', 'c4', [0.6, 0.4, 1.6]);
  KF.push(snap(S));
  scene({ k1: 2, k2: 3, st: 0, e: 2,
    t: '① 钌酸酯碎裂：C3–C4 断开，环被打开',
    c: '同样的三根箭头再走一遍，这次流动的是 C3–C4 的 σ 键：两端各成为醛基（C=O），Ru 再得 2 个电子成为 Ru(IV) 的 RuO₂。原来的苯环变成一条两端带醛基的共轭二烯链，C1=C2、C5=C6 保持原来的顺式。',
    arrows: [[['b', 'c3', 'c4'], ['b', 'c4', 'q2'], 0.4], [['b', 'q2', 'ru'], ['a', 'ru'], 0.5], [['b', 'ru', 'q1'], ['b', 'q1', 'c3'], 0.4]] });

  // 幕 3：RuO₂ 被 2 IO₄⁻ 氧化回 RuO₄，从下方靠近 C1=C2，[3+2]
  S.enter = {}; S.leave = {};
  enterO(S, ['p1', 'p2'], [2, 3, 2]); S.A.ru.ox = 8;
  present(S, 'q3', 'q4', 'c1', 'c2', [0, -1, 0]);
  S.tags = [['ru', '+2 O（2 IO₄⁻ → 2 IO₃⁻）']];
  KF.push(snap(S));
  S.tags = [];
  cyclo(S, 'q3', 'q4', 'c1', 'c2'); S.enter = {}; S.leave = {};
  KF.push(snap(S));
  scene({ k1: 4, k2: 5, st: 1, e: 2,
    t: '② RuO₂ 被 NaIO₄ 再氧化，从下方进攻 C1=C2',
    c: 'RuO₂ 从两个 IO₄⁻ 各拿一个 O，回到 RuO₄（Ru IV → VIII）。剩下两根 C=C 里 C1=C2 连着环己基、电子更富，RuO₄ 这次从分子平面下方靠近，同样 [3+2] 成环状钌酸酯。',
    arrows: [[['b', 'c1', 'c2'], ['m', 'c2', 'q4'], 0.35], [['b', 'ru', 'q4'], ['a', 'ru'], -0.5], [['b', 'ru', 'q3'], ['m', 'q3', 'c1'], -0.4]] });

  // 幕 4：碎裂，C1 成为酮，C2–C3 以乙二醛离开
  frag(S, 'q3', 'q4', 'c1', 'c2', [0.2, -0.6, -1.6]);
  const gly1 = comp(S, 'c2');
  move(S, gly1, sc(nrm(sub(cen(S, gly1), S.A.c1.p)), 1.6));
  relax(S, 300);
  KF.push(snap(S));
  scene({ k1: 5, k2: 6, st: 1, e: 2,
    t: '② 碎裂：C1 变成酮，C2–C3 作为乙二醛离开',
    c: 'C1–C2 键的电子变成 C2=O，O–Ru 键的电子回到 Ru，另一根 Ru–O 的电子变成 C1=O。C1（紫）从此一边连环己基、一边是 C=O；C2、C3 带着各自的 O 和 H 成为乙二醛（OHC–CHO）。',
    arrows: [[['b', 'c1', 'c2'], ['b', 'c2', 'q4'], -0.4], [['b', 'q4', 'ru'], ['a', 'ru'], -0.5], [['b', 'ru', 'q3'], ['b', 'q3', 'c1'], -0.4]] });

  // 幕 5：乙二醛离场；RuO₂ 再氧化；从上方进攻 C5=C6
  S.enter = {}; S.leave = {};
  S.leave = drop(S, gly1, sc(nrm(sub(cen(S, gly1), S.A.c1.p)), 7));
  enterO(S, ['p3', 'p4'], [2, 3, 2]); S.A.ru.ox = 8;
  present(S, 'p1', 'p2', 'c5', 'c6', [0, 1, 0]);
  S.tags = [['ru', '+2 O（2 IO₄⁻ → 2 IO₃⁻）']];
  KF.push(snap(S));
  S.tags = [];
  cyclo(S, 'p1', 'p2', 'c5', 'c6'); S.enter = {}; S.leave = {};
  KF.push(snap(S));
  scene({ k1: 7, k2: 8, st: 2, e: 2,
    t: '③ 第三根 C=C：RuO₄ 进攻 C5=C6',
    c: '乙二醛离开（后面会被氧化成草酸、再到 CO₂）。Ru 再被 NaIO₄ 氧化回 RuO₄，对最后一根 C5=C6 做 [3+2]。',
    arrows: [[['b', 'c5', 'c6'], ['m', 'c6', 'p2'], -0.35], [['b', 'ru', 'p2'], ['a', 'ru'], 0.5], [['b', 'ru', 'p1'], ['m', 'p1', 'c5'], 0.4]] });

  // 幕 6：碎裂，得到 α-酮醛，C4–C5 以乙二醛离开
  frag(S, 'p1', 'p2', 'c5', 'c6', [0.4, 0.8, 1.6]);
  const gly2 = comp(S, 'c5');
  move(S, gly2, sc(nrm(sub(cen(S, gly2), S.A.c1.p)), 1.6));
  relax(S, 300);
  KF.push(snap(S));
  scene({ k1: 8, k2: 9, st: 2, e: 2,
    t: '③ 碎裂：剩下 α-酮醛，C4–C5 也成为乙二醛',
    c: 'C5–C6 断开：C6（青）成为醛基碳，仍连在 C1 上，得到 环己基–C(=O)–CHO（α-酮醛）；C4、C5 成为第二分子乙二醛。到这里，原苯环只剩 C1 和 C6 还连在环己基上。',
    arrows: [[['b', 'c5', 'c6'], ['b', 'c6', 'p2'], 0.4], [['b', 'p2', 'ru'], ['a', 'ru'], 0.5], [['b', 'ru', 'p1'], ['b', 'p1', 'c5'], 0.4]] });

  // 幕 7：乙二醛离场；Ru 再氧化；醛水合并与 RuO₄ 成酯；五元环内夺氢 → α-酮酸
  S.enter = {}; S.leave = {};
  S.leave = drop(S, gly2, sc(nrm(sub(cen(S, gly2), S.A.c1.p)), 7));
  enterO(S, ['p5', 'p6'], [2, 3, 2]);
  const c6 = S.A.c6.p, out6 = nrm(sub(c6, S.A.c1.p));
  atom(S, 'ow', 'O', add(c6, sc(out6, 1.3))); atom(S, 'hw1', 'H', add(S.A.p2.p, [0, 0.9, 0.3])); atom(S, 'hw2', 'H', add(S.A.ru.p, [0.5, 1.2, 0]));
  ['ow', 'hw1', 'hw2'].forEach(id => { S.enter[id] = [0, -3, 2]; });
  bond(S, 'c6', 'p2', 1); bond(S, 'p2', 'hw1', 1); bond(S, 'c6', 'ow', 1); bond(S, 'ow', 'ru', 1);
  bond(S, 'ru', 'p3', 1); bond(S, 'p3', 'hw2', 1); S.A.ru.ox = 8;
  move(S, ['ru', 'p3', 'p4', 'p5', 'p6', 'hw2'], sub(add(S.A.ow.p, sc(out6, 1.6)), S.A.ru.p));
  bond(S, 'h6', 'p4', 'h');
  S.R = [['h6', 'p4', 2.3]];
  relax(S, 900);
  S.tags = [['ru', '+2 O（IO₄⁻）、+ H₂O']];
  KF.push(snap(S));
  S.tags = []; S.R = [];
  bond(S, 'h6', 'p4', 0); bond(S, 'c6', 'h6', 0); bond(S, 'p4', 'h6', 1); bond(S, 'ru', 'p4', 1); bond(S, 'c6', 'ow', 2); bond(S, 'ow', 'ru', 0);
  S.A.ru.ox = 6; S.enter = {}; S.leave = {};
  move(S, ['ru', 'p3', 'p4', 'p5', 'p6', 'hw2', 'h6'], [0.6, 1.2, 0.8]);
  relax(S, 700);
  KF.push(snap(S));
  scene({ k1: 10, k2: 11, st: 3, e: 2,
    t: '④ 醛水合、与 RuO₄ 成酯，再经五元环夺氢：醛 → 羧酸',
    c: '醛基先加一分子水成为水合物（偕二醇），其中一个 O–H 加到 RuO₄ 上，得到钌(VIII)酸酯；C6 上的 H 正对着 Ru 的一个氧代（虚线）。三根箭头：Ru=O 的 π 电子夺取这个 H，C–H 键的电子形成 C=O，O–Ru 键的电子留给 Ru。得到 α-酮酸和 H₂RuO₄（Ru VI）。',
    arrows: [[['b', 'ru', 'p4'], ['a', 'h6'], 0.45], [['b', 'c6', 'h6'], ['b', 'c6', 'ow'], -0.45], [['b', 'ow', 'ru'], ['a', 'ru'], 0.5]] });

  // 幕 8：H₂RuO₄ 再氧化；酮水合、成酯；羧酸根推电子脱羧
  S.enter = {}; S.leave = {};
  const lw = sc(nrm(sub(S.A.p4.p, S.A.c1.p)), 6);
  S.leave = Object.assign(drop(S, ['p4', 'h6', 'hw2'], lw), drop(S, ['hw1'], [0, -5, 1]));
  atom(S, 'p7', 'O', add(S.A.ru.p, [0.9, 1.0, 0.4])); S.enter.p7 = [2, 3, 2];
  bond(S, 'ru', 'p3', 2); bond(S, 'ru', 'p7', 2);
  S.A.p2.chg = -1;
  const c1 = S.A.c1.p, up1 = nrm(crs(sub(S.A.c6.p, c1), sub(S.A.y1.p, c1)));
  atom(S, 'ow2', 'O', add(c1, sc(up1, 1.4))); atom(S, 'hw3', 'H', add(S.A.q3.p, [0, -0.9, 0.3])); atom(S, 'hw4', 'H', add(S.A.p3.p, [0.4, 0.8, 0]));
  ['ow2', 'hw3', 'hw4'].forEach(id => { S.enter[id] = [0, -3, 2]; });
  bond(S, 'c1', 'q3', 1); bond(S, 'q3', 'hw3', 1); bond(S, 'c1', 'ow2', 1); bond(S, 'ow2', 'ru', 1); bond(S, 'ru', 'p3', 1); bond(S, 'p3', 'hw4', 1);
  S.A.ru.ox = 8;
  move(S, ['ru', 'p3', 'p5', 'p6', 'p7', 'hw4'], sub(add(S.A.ow2.p, sc(up1, 1.9)), S.A.ru.p));
  relax(S, 900);
  S.tags = [['ru', '+ O（IO₄⁻）、+ H₂O；−H₂O、−H⁺']];
  KF.push(snap(S));
  S.tags = [];
  bond(S, 'c1', 'c6', 0); bond(S, 'c6', 'p2', 2); S.A.p2.chg = 0; bond(S, 'c1', 'ow2', 2); bond(S, 'ow2', 'ru', 0);
  bond(S, 'ru', 'p7', 1); S.A.p7.chg = -1; S.A.ru.ox = 6; S.enter = {}; S.leave = {};
  move(S, ['c6', 'ow', 'p2'], sc(nrm(sub(S.A.c6.p, S.A.c1.p)), 1.4));
  move(S, ['ru', 'p3', 'p5', 'p6', 'p7', 'hw4'], sc(up1, 1.2));
  relax(S, 700);
  KF.push(snap(S));
  scene({ k1: 12, k2: 13, st: 4, e: 2,
    t: '⑤ 酮水合、成酯，羧酸根推电子：C6 以 CO₂ 离开',
    c: 'Ru(VI) 被 NaIO₄ 氧化回 RuO₄；C1 的酮羰基加水成水合物，一个 OH 与 RuO₄ 成酯；羧基失去 H⁺ 成为羧酸根。三根箭头：O⁻ 的电子推向 C6 形成 CO₂，C1–C6 键的电子转到 C1 形成 C=O，O–Ru 键断开、电子交给 Ru。C6（青）变成 CO₂，C1（紫）成为羧基碳。',
    arrows: [[['a', 'p2'], ['b', 'c6', 'p2'], 0.6], [['b', 'c1', 'c6'], ['b', 'c1', 'ow2'], 0.45], [['b', 'ow2', 'ru'], ['a', 'ru'], -0.5]] });

  // 幕 9：CO₂ 与 Ru 物种离场，只剩环己甲酸
  S.enter = {}; S.leave = {};
  S.leave = Object.assign(drop(S, ['c6', 'ow', 'p2'], sc(nrm(sub(S.A.c6.p, S.A.c1.p)), 7)), drop(S, ['ru', 'p3', 'p5', 'p6', 'p7', 'hw4'], sc(up1, 7)));
  relax(S, 400);
  KF.push(snap(S));
  KF.push(snap(S));
  scene({ k1: 14, k2: 15, st: 4, e: 0,
    t: '产物：环己甲酸（94%）',
    c: '苯环的 6 个碳里，只有连着环己基的 C1 留了下来，成为羧基碳；C6 在上一步变成 CO₂，另外 4 个碳先成为两分子乙二醛，再经草酸变成 CO₂。环己基的椅式构象全程没有被碰过。拖动可以旋转分子。',
    arrows: [] });
}
build();
export { St, relax as _relax };
