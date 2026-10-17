# 邻甲氧基苯甲酸 → 2-丁基环己-2-烯酮：2D 机理动画

> [打开页面](./index.html) · 在线：<https://felixjiashengfu.github.io/Organic-Chemistry-Graph/topics/birch-anisic-acid-animation/>

与 [`birch-anisic-acid-steps`](../birch-anisic-acid-steps/)（11 帧分步机理）同一道题、同一条路线：Birch 还原–烷基化 → 烯醇醚水解 → β-酮酸脱羧与双键异构化。这一页把机理连成 13 幕动画：试剂从场外进来，弯箭头一笔一笔画出（箭身上一对红点代表电子对），键断开与生成，副产物飘走。每个原子从头到尾是同一个对象，可以看清 H 和 O 的去向。原题截图见 [`source/problem.png`](./source/problem.png)。

## 页面包含

| 区块 | 内容 |
|---|---|
| 01 动画 | 13 幕：去质子化、两次单电子转移（红色 e⁻ 小球从 Li 飞入）、C4 质子化、共振成烯二醇盐、C1 的 S<sub>N</sub>2 烷基化、酸化、烯醇醚 C3 质子化、水进攻、失去 MeOH、六元环过渡态脱羧（CO₂ 拉直飞走）、互变异构、改画成键线式。共 22 根弯箭头。播放 / 暂停、重播本步、下一步（只放一幕）、进度条拖到任意中间形态、0.5× / 1× / 2×、阶段标签、键盘（空格、→、←）；第一次滚到动画区时自动播放一遍（约 1 分钟） |
| 02 怎么看 | 每幕三拍（试剂进场 → 弯箭头 → 键重排）；三件要盯的事：蓝色的水氧成为羰基氧、脱羧时 H 先转向酮氧、三个灰色新 H 的来源；插值路径不是反应坐标的说明 |
| 03 每一幕都守恒 | 13 幕的元素 / 电荷守恒式（脚本核验） |
| 04 术语表 | 34 条中英对照（含动词） |
| 05 来源与核验 | 分层说明、参考文献、技术说明 |

## 分层

- **用户原图**：题目截图（`source/problem.png`）。
- **精确（脚本核验）**：`source/verify.mjs` 读取 `source/anim.js` 里动画实际使用的 39 个关键帧（每幕 K0 试剂进场前、K1 试剂就位、K2 重排完成，包括正在离场、已透明的副产物），逐原子检查价键与形式电荷、按电子数奇偶核对自由基、补齐隐含氢；核对每幕进场前后原子不变、重排前后元素与电荷守恒（加入的电子、只写在标签里离开的 H⁺ 单独计入）、每幕之后主物种的分子式、共振幕 σ 骨架不变、弯箭头根数、单电子转移所在的幕；核对原子去向：蓝色 O 来自水并成为羰基氧，OMe 的氧随 MeOH 离开，羧基碳以 O=C=O 离开，三个新 H 留在 C4 / C3 / C5，侧链为正丁基，产物为共轭烯酮；并在 τ = 0–13 每隔 0.01 渲染一次（1301 帧）确认没有异常。
- **文献**：反应条件与路线：Birch & Slobbe 1977；帝国理工本科实验 A2（1-溴庚烷 → 2-庚基环己-2-烯酮，② ③ 同一锅）。
- **教学示意**：原子移动路径（关键帧之间直线插值）、每幕时长、键淡入淡出的节奏、副产物飘走的方向；自由基负离子只画一个共振式；C4 的质子源写成 *t*-BuOH；去质子化画成金属直接还原 O–H（文献实验先用 *t*-BuOK 成盐）。动画不是反应轨迹，也不表示各步快慢。

## 核验

- `source/verify.mjs`：74 项，全部通过，见 [`verification.json`](./verification.json)。它第一次运行时就抓到一处数据错误：最后一幕把 “Bu” 标签设成透明却没删掉，同时又画上了四个链碳，丁基被算了两遍；已改为删除标签原子（渲染时仍会淡出）。
- `source/qa-browser.mjs`：减少动态效果模式下逐项核对按钮、阶段标签、进度条与每幕弯箭头数、e⁻ 小球、结尾画面；正常模式下核对滚到动画区自动播放、暂停后 τ 不动、2× 速度下“下一步”只放一幕、空格键；1440 / 768 / 390 px 无横向溢出（390 px 时画布保持 560 px 宽，在框内横向滚动）；深色模式；无脚本报错、零网络请求。结果见 [`qa-browser.json`](./qa-browser.json)。

## 参考文献

1. A. J. Birch, J. Slobbe, “Reduction by dissolving metals. XXII. Reduction and reductive alkylation of some methoxy- and dimethylamino-benzoic acids”, *Aust. J. Chem.* **30**, 1045–1049 (1977). [doi:10.1071/CH9771045](https://doi.org/10.1071/CH9771045)
2. Imperial College London 本科有机实验 A2：“Reactions in liquid ammonia. The preparation of 2-heptyl-2-cyclohexenone via the Birch reduction of *o*-anisic acid”：<https://www.ch.ic.ac.uk/local/organic/6.html>

## 技术

单文件 HTML（约 50 KB）：每一帧由页内脚本按时间 τ 现算现画成 SVG（关键帧插值，`source/anim.js`），不用视频、不用第三方动画库、不引用 CDN 或在线字体，下载后可离线打开。浅色 / 深色随系统切换；系统设置“减少动态效果”时不自动播放，按钮直接跳到每一幕的结果。

```bash
deno install
deno run -A source/verify.mjs      # 关键帧核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png
```
