// 播放控制：时间轴 τ、播放 / 暂停、重播本步、下一步、拖动进度、速度、阶段标签、键盘。
// 用到 anim.js 的 SC / STG / N / frame / legendArrow（build.mjs 把两段脚本放进同一个模块作用域）。
const DUR = 4.6; // 1× 速度下每幕的秒数
const $ = id => document.getElementById(id);
const gEl = $('maG'), rng = $('maR'), bP = $('maPlay'), cnt = $('maN'), tEl = $('maT'), cEl = $('maC'), cond = $('maCond');
const ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor"/><rect x="9.5" y="2.8" width="3" height="10.4" rx="1" fill="currentColor"/></svg>';
rng.max = N;
const pills = STG.map(g => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pill'; b.textContent = (g.tag ? g.tag + ' ' : '') + g.name;
  b.onclick = () => { stopPlay(); tau = g.s; play(g.s + 1); };
  $('maPills').appendChild(b);
  return b;
});
let tau = 0, playing = false, target = null, last = 0, shown = -1, speed = 1, started = false;
function draw() {
  const f = frame(tau);
  gEl.innerHTML = f.svg;
  rng.value = tau;
  if (f.k !== shown) {
    shown = f.k;
    const sc = SC[f.k], g = STG[sc.stg];
    tEl.innerHTML = (g.tag ? g.tag + ' ' : '') + sc.t;
    cEl.innerHTML = sc.c;
    cond.innerHTML = g.cond; cond.hidden = !g.cond;
    pills.forEach((p, i) => { p.classList.toggle('on', i === sc.stg); p.setAttribute('aria-pressed', String(i === sc.stg)); });
  }
  cnt.textContent = '第 ' + (f.k + 1) + ' / ' + N + ' 幕';
}
const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function setBtn() { bP.innerHTML = playing ? ICON_PAUSE + '暂停' : ICON_PLAY + '播放'; bP.setAttribute('aria-pressed', String(playing)); }
function loop(ts) {
  if (!playing) return;
  if (last) tau += Math.min(0.05, (ts - last) / 1000) * speed / DUR;
  last = ts;
  const stop = target == null ? N : target;
  if (tau >= stop) { tau = stop; playing = false; target = null; setBtn(); }
  draw();
  if (playing) requestAnimationFrame(loop);
}
function play(to) {
  started = true;
  if (RM) { tau = to == null ? N : to; draw(); return; } // 减少动态效果：直接跳到这一幕的结果
  target = to == null ? null : to; playing = true; last = 0; setBtn(); requestAnimationFrame(loop);
}
function stopPlay() { playing = false; target = null; setBtn(); }
bP.onclick = () => { if (playing) { stopPlay(); return; } if (tau >= N - 1e-6) tau = 0; play(null); };
$('maNext').onclick = () => { stopPlay(); if (tau >= N - 1e-6) tau = 0; play(Math.floor(tau + 1e-6) + 1); };
$('maRe').onclick = () => { stopPlay(); const f = Math.floor(tau + 1e-6); tau = Math.min(N - 1, (tau - f < 1e-6 && f > 0) ? f - 1 : f); play(tau + 1); };
rng.oninput = () => { stopPlay(); started = true; tau = +rng.value; draw(); };
$('maSp').onchange = e => { speed = +e.target.value; };
document.addEventListener('keydown', e => {
  const tg = e.target && e.target.tagName;
  if (tg === 'INPUT' || tg === 'SELECT' || tg === 'BUTTON' || tg === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); bP.click(); }
  else if (e.key === 'ArrowRight') $('maNext').click();
  else if (e.key === 'ArrowLeft') $('maRe').click();
});
$('maLeg').innerHTML = legendArrow();
// 第一次滚到动画区时自动播放一遍（系统设置“减少动态效果”时不自动播放）
if (!RM && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && !started) { io.disconnect(); setTimeout(() => { if (!started) play(null); }, 500); } }, { threshold: 0.5 });
  io.observe($('stage'));
}
window.__anim = { set: t => { stopPlay(); started = true; tau = t; draw(); }, get tau() { return tau; }, get playing() { return playing; }, N: N };
setBtn();
draw();
