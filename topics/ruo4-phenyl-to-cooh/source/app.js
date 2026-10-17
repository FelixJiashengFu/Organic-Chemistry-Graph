// 分步图交互：阶段标签、翻页、键盘、图例小箭头。
// 用到 mech.js 的 FRAMES / STAGES / DY / legendArrow（build.mjs 把两段脚本放进同一个块作用域）。
const $ = id => document.getElementById(id);
const G = $('mxG'), T = $('mxT'), C = $('mxC');
const strip = s => s.replace(/<[^>]+>/g, '');
const pills = STAGES.map(p => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pill'; b.textContent = p[0];
  b.onclick = () => show(p[1]);
  $('mxPills').appendChild(b);
  return b;
});
const dots = FRAMES.map((f, k) => {
  const d = document.createElement('button');
  d.type = 'button'; d.className = 'dot'; d.setAttribute('aria-label', '第 ' + (k + 1) + ' 帧：' + strip(f.t));
  d.onclick = () => show(k);
  $('mxDots').appendChild(d);
  return d;
});
let cur = 0;
function show(i) {
  cur = (i + FRAMES.length) % FRAMES.length;
  const f = FRAMES[cur];
  G.setAttribute('transform', 'translate(0,' + (DY[cur] || 0) + ')');
  G.innerHTML = f.d();
  T.textContent = f.t;
  C.innerHTML = f.c;
  pills.forEach((b, k) => { b.classList.toggle('on', k === f.st); b.setAttribute('aria-pressed', String(k === f.st)); });
  dots.forEach((d, k) => { d.classList.toggle('on', k === cur); d.setAttribute('aria-current', k === cur ? 'step' : 'false'); });
  $('mxCount').textContent = (cur + 1) + ' / ' + FRAMES.length;
}
$('mxPrev').onclick = () => show(cur - 1);
$('mxNext').onclick = () => show(cur + 1);
document.addEventListener('keydown', e => {
  const tg = e.target && e.target.tagName;
  if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA' || (e.target.closest && e.target.closest('#anim'))) return;
  if (e.key === 'ArrowRight') show(cur + 1);
  else if (e.key === 'ArrowLeft') show(cur - 1);
});
$('mxLeg').innerHTML = legendArrow();
window.__mech = { show: show, get cur() { return cur; }, n: FRAMES.length };
show(0);
