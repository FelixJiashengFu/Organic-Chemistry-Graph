// 把 page.html + mech.js + app.js 合成一个可直接打开的 ../index.html。
// 运行：deno run -A source/build.mjs   （或 node source/build.mjs）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, f), 'utf8');

let html = read('page.html');
// mech.js 是 ES 模块（verify.mjs 要 import 它）；内联进页面时去掉 export，和 app.js 共用一个模块作用域
const mech = read('mech.js').replace(/^export (?=const|function|let)/gm, '');
if (/^\s*export\b/m.test(mech)) throw new Error('mech.js 里还有没去掉的 export');
const app = read('app.js');

const put = (mark, text) => {
  if (!html.includes(mark)) throw new Error('模板缺少占位符 ' + mark);
  html = html.replace(mark, () => text);
};
put('/*@@MECH@@*/', mech);
put('/*@@APP@@*/', app);

// 本库规则：页面不得依赖在线资源。外链脚本、样式、图片、字体、@import 一律拒绝构建；<a href> 指向的参考文献除外。
const external = [...html.matchAll(/<(?:script|link|img|source|iframe|video|audio|embed|object)\b[^>]*\b(?:src|href|data)="(https?:[^"]+)"|url\(\s*["']?(https?:[^)"']+)|@import\s+["']?(https?:[^"';]+)/g)]
  .map(m => m[1] || m[2] || m[3]);
if (external.length) throw new Error('页面引用了在线资源：' + external.join(', '));
if (/\/\*@@\w+@@\*\//.test(html)) throw new Error('还有没替换的占位符');

// 页面里引用的 id 必须都在模板里
for (const id of ['mxG', 'mxT', 'mxC', 'mxPills', 'mxDots', 'mxPrev', 'mxNext', 'mxCount', 'mxLeg']) {
  if (!html.includes(`id="${id}"`)) throw new Error('模板缺少元素 #' + id);
}

fs.writeFileSync(path.join(here, '..', 'index.html'), html);
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), frames: (mech.match(/FRAMES\.push\(/g) || []).length }, null, 2));
