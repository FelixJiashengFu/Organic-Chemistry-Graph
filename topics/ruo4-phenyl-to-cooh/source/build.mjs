// 把 page.html + 2D（mech.js、app.js）+ 3D（mech3d.js、render3d.js、app3d.js）合成一个可直接打开的 ../index.html。
// 2D 与 3D 各放进一个块作用域，互不干扰（两边都有 dot 等同名函数）。
// 运行：deno run -A source/build.mjs   （或 node source/build.mjs）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// ES 模块（核验脚本要 import 它们）内联时去掉 import / export
const inline = s => s.replace(/^import .*\n/gm, '').replace(/^export \{[^}]*\};?\n?/gm, '').replace(/^export (?=const|function|let)/gm, '');

let html = read('page.html');
const parts = { '/*@@MECH@@*/': inline(read('mech.js')), '/*@@APP@@*/': read('app.js'), '/*@@MECH3D@@*/': inline(read('mech3d.js')), '/*@@RENDER3D@@*/': inline(read('render3d.js')), '/*@@APP3D@@*/': read('app3d.js') };
for (const [mark, text] of Object.entries(parts)) {
  if (/^\s*(export|import)\b/m.test(text)) throw new Error(mark + ' 里还有没去掉的 import / export');
  if (!html.includes(mark)) throw new Error('模板缺少占位符 ' + mark);
  html = html.replace(mark, () => text);
}

// 本库规则：页面不得依赖在线资源。外链脚本、样式、图片、字体、@import 一律拒绝构建；<a href> 指向的参考文献除外。
const external = [...html.matchAll(/<(?:script|link|img|source|iframe|video|audio|embed|object)\b[^>]*\b(?:src|href|data)="(https?:[^"]+)"|url\(\s*["']?(https?:[^)"']+)|@import\s+["']?(https?:[^"';]+)/g)]
  .map(m => m[1] || m[2] || m[3]);
if (external.length) throw new Error('页面引用了在线资源：' + external.join(', '));
if (/\/\*@@\w+@@\*\//.test(html)) throw new Error('还有没替换的占位符');
for (const id of ['mxG', 'mxT', 'mxC', 'mxPills', 'mxDots', 'mxPrev', 'mxNext', 'mxCount', 'mxLeg', 's3S', 's3G', 's3T', 's3C', 's3R', 's3P', 's3B', 's3F', 's3N', 's3D', 's3V']) {
  if (!html.includes(`id="${id}"`)) throw new Error('模板缺少元素 #' + id);
}
fs.writeFileSync(path.join(here, '..', 'index.html'), html);
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), frames2d: (parts['/*@@MECH@@*/'].match(/FRAMES\.push\(/g) || []).length }, null, 2));
