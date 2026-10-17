// 3D 动画播放器：播放 / 暂停、逐幕、时间轴、速度、拖动旋转、复位视角。
// 用到 mech3d.js 的 SCENES 和 render3d.js 的 frame / TL / TOTAL / makeCam（build.mjs 放进同一个块作用域）。
const q3 = id => document.getElementById(id);
const G3 = q3('s3G'), T3 = q3('s3T'), C3 = q3('s3C'), RG = q3('s3R'), SV = q3('s3S');
const ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>';
const V0 = [-0.6, 0.42];
let tau = 0, playing = false, speed = 1, stopAt = null, yaw = V0[0], pitch = V0[1], last = null, cur = -1;
RG.max = TOTAL.toFixed(2);
const dots3 = SCENES.map((s, i) => {
  const d = document.createElement('button');
  d.type = 'button'; d.className = 'dot'; d.setAttribute('aria-label', '第 ' + (i + 1) + ' 幕：' + s.t);
  d.onclick = () => go(i, true);
  q3('s3D').appendChild(d);
  return d;
});
function setIcon() { q3('s3P').innerHTML = playing ? ICON_PAUSE + '暂停' : ICON_PLAY + '播放'; }
function draw3() {
  const f = frame(tau, makeCam(yaw, pitch, 36, 340, 180));
  G3.innerHTML = f.svg;
  const i = f.st.seg.i;
  if (i !== cur) {
    cur = i; T3.textContent = SCENES[i].t; C3.textContent = SCENES[i].c;
    dots3.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    q3('s3N').textContent = (i + 1) + ' / ' + SCENES.length;
  }
  RG.value = tau.toFixed(2);
}
function tick(ts) {
  if (playing) {
    const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000);
    tau += dt * speed;
    if (stopAt != null && tau >= stopAt) { tau = stopAt; playing = false; stopAt = null; setIcon(); }
    if (tau >= TOTAL) { tau = TOTAL - 0.001; playing = false; setIcon(); }
    draw3();
  }
  last = ts;
  requestAnimationFrame(tick);
}
// 跳到第 i 幕开头；play = true 时播完这一幕自动停下
function go(i, play) {
  i = Math.max(0, Math.min(SCENES.length - 1, i));
  tau = TL[i].t0 + 0.001; stopAt = TL[i].t1 - 0.02; playing = play;
  setIcon(); draw3();
}
function toggle() {
  if (playing) playing = false;
  else { if (tau >= TOTAL - 0.01) tau = 0; stopAt = null; playing = true; }
  setIcon();
}
q3('s3P').onclick = toggle;
q3('s3F').onclick = () => go(cur + 1, true);
q3('s3B').onclick = () => go(tau - TL[cur].t0 > 1 ? cur : cur - 1, true);
RG.oninput = () => { tau = +RG.value; playing = false; stopAt = null; setIcon(); draw3(); };
document.querySelectorAll('[data-sp]').forEach(b => {
  b.onclick = () => { speed = +b.dataset.sp; document.querySelectorAll('[data-sp]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); };
});
q3('s3V').onclick = () => { yaw = V0[0]; pitch = V0[1]; draw3(); };
let drag = null;
SV.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; SV.setPointerCapture(e.pointerId); SV.style.cursor = 'grabbing'; });
SV.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = 680 / (SV.getBoundingClientRect().width || 680) * 0.01;
  yaw = drag[2] + (e.clientX - drag[0]) * k;
  pitch = Math.max(-1.45, Math.min(1.45, drag[3] + (e.clientY - drag[1]) * k));
  draw3();
});
const endDrag = () => { drag = null; SV.style.cursor = 'grab'; };
SV.addEventListener('pointerup', endDrag);
SV.addEventListener('pointercancel', endDrag);
SV.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1, true); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1, true); }
});
setIcon(); draw3(); requestAnimationFrame(tick);
// 第一次滚到动画区时自动播放一遍；系统开启“减少动态效果”时不自动播放
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => {
    if (es.some(x => x.isIntersecting)) { io.disconnect(); if (!playing && tau < 0.01) { playing = true; setIcon(); } }
  }, { threshold: 0.5 });
  io.observe(SV);
}
window.__anim3 = { go: go, get tau() { return tau; }, set tau(v) { tau = v; draw3(); }, get playing() { return playing; }, get scene() { return cur; }, get view() { return [yaw, pitch]; }, TOTAL: TOTAL, n: SCENES.length };
