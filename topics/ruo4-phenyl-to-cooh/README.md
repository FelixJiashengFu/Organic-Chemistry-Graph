# 环己基苯 → 环己甲酸：RuO₄ 把苯环拆成羧基

> [打开页面](./index.html) · 在线：<https://felixjiashengfu.github.io/Organic-Chemistry-Graph/topics/ruo4-phenyl-to-cooh/>

题目：环己基苯（cyclohexylbenzene）在 RuCl₃、NaIO₄、MeCN/CCl₄ 中反应 24 h，得到环己甲酸（cyclohexanecarboxylic acid），收率 94%。这就是 Sharpless 等改进的 RuO₄ 催化氧化。苯环的 6 个碳里，连着环己基的 C1（ipso）留下来成为羧基碳，其余 5 个全部变成 CO₂。原题截图见 [`source/problem.png`](./source/problem.png)。

| 阶段 | 发生了什么 | Ru | 电子 |
|---|---|---|---|
| 催化剂 | RuCl₃ + NaIO₄ → RuO₄；低价 Ru 不断被 NaIO₄ 再氧化 | III → VIII | — |
| ① C3=C4 | [3+2] 环加成（去芳构化）→ 环状钌(VI)酸酯 → 碎裂开环成二烯二醛 | VIII → VI → IV | 4 e⁻ |
| ② C1=C2 | 同样两步；C1 成为酮，C2–C3 以乙二醛离开 | VIII → IV | 4 e⁻ |
| ③ C5=C6 | 同样两步；剩下 α-酮醛，C4–C5 以乙二醛离开 | VIII → IV | 4 e⁻ |
| ④ 醛 → 酸 | 水合物与 RuO₄ 成酯，五元环夺氢 → α-酮酸 | VIII → VI | 2 e⁻ |
| ⑤ 氧化脱羧 | 酮水合、成酯，羧酸根推电子 → 环己甲酸 + CO₂（C6） | VIII → VI | 2 e⁻ |
| ⑥ 小分子 | 2 乙二醛 → 2 草酸 → 4 CO₂ | — | 8 + 4 e⁻ |

合计 28 e⁻ = 14 当量 NaIO₄：C₁₂H₁₆ + 14 NaIO₄ → C₇H₁₂O₂ + 5 CO₂ + 2 H₂O + 14 NaIO₃。

## 页面包含

| 区块 | 内容 |
|---|---|
| 01 分步机理 | 11 帧 2D 结构式：总览 → 催化剂 → ① [3+2] → ① 碎裂 → 催化循环 → ② → ③ → ④ 醛氧化 → ⑤ 氧化脱羧 → ⑥ 乙二醛 / 草酸 → 记账。共 18 根弯箭头；紫圈追踪 C1，青圈追踪 C6；Ru 上标氧化态 |
| 02 3D 动画 | 9 幕球棍模型（约 54 s，H 全部画出）：RuO₄ 分别从苯环平面上方、下方落到 C=C 上，弯箭头逐笔画出，原子 id 全程不变，乙二醛、CO₂、Ru 物种离场，IO₄⁻ 给出的 O 和水进场。可暂停、逐幕、拖时间轴、0.5× / 1× / 2×、拖动旋转、键盘控制；滚到视野内才自动播放一次 |
| 03 各步做了什么 | 催化剂与溶剂（MeCN 的作用）、切断 C=C 的两步、收尾成 COOH；文献做法 |
| 04 原子与电子记账 | 各物种分子式与名称、配平方程式、28 个电子的来源、原子去向 |
| 05 常见错误 | 7 条（与 KMnO₄ 侧链氧化的对比、NaIO₄ 当量、[3+2] 的协同性等） |
| 06 术语表 | 39 条中英对照（含动词） |
| 07 来源与核验 | 分层说明、参考文献、技术说明 |

## 分层

- **用户原图**：题目截图（`source/problem.png`，页面“来源与核验”一节有链接）。
- **精确（脚本核验）**：
  - `source/verify.mjs`：读取 2D 每一帧画出的结构，逐原子检查价键与形式电荷，核对 Ru 氧化态与图上罗马数字一致；补齐隐含氢算分子式；核对每一步的元素与电荷守恒和页面上的配平式；逐步检查碳氧化态变化等于标注的电子数（全程 28 e⁻）；以及 C1 始终连环己基且不带 H、开环位置、乙二醛来源、α-酮醛 / α-酮酸、最终羧基碳等结构判断。
  - `source/verify3d.mjs`：在显式氢下检查 3D 的 16 个关键帧（价键、电荷、Ru 氧化态、无自由基），每一帧的物种分子式与 2D 逐一对照；每次过渡进出场原子的组成；弯箭头引用的原子和键；几何质量（键长偏差 < 8%、非键原子不相撞、起始苯环平面、环己基全程椅式、[3+2] 为顺式加成、RuO₄ 从环面上下方靠近）；全程逐帧渲染无 NaN。
- **文献**：改进的 RuO₄ 催化体系（加 MeCN）与芳环降解：Carlsen 等 1981；苯基作为羧基等价物：Núñez & Martín 1990、Piccialli 2014 综述；烯烃被 RuO₄ 切断而 OsO₄ 停在二醇的理论讨论：Frunzke 等 2004。94% 取自题图；Carlsen 1981 只核对了题目、作者与摘要。
- **教学示意**：先切哪根 C=C（这里依次是 C3=C4、C1=C2、C5=C6）是教学上的选择；苯环降解的逐步顺序文献没有确证。“Ru(VI) 环酯直接碎裂成 2 C=O + RuO₂”是最简画法，实际也可能先被 IO₄⁻ 氧化成 Ru(VIII) 酯再碎裂，或先水解成二醇再由高碘酸切断。醛 → 酸、氧化脱羧的成酯–消除机理借用了铬酸酯与 H₂O₂ / 高碘酸氧化的常见写法。MeCN 的作用写的是“通常的解释”。3D 坐标由页内的位置松弛（键长、键角、sp² 平面、双键共面、非键排斥）算出，不是量子化学结构；RuO₂ 画成分子，实际是固体；动画路径和时长都是示意。

## 核验

- `source/verify.mjs`：76 项，全部通过，见 [`verification.json`](./verification.json)。做过变异测试：在副本里把一个 Ru(VIII) 的标注改成 VI，Ru 氧化态检查立即报错。
- `source/verify3d.mjs`：43 项，全部通过，见 [`verification-3d.json`](./verification-3d.json)。苯环平面的容差是 0.1 Å（示意几何的松弛精度），实测最大偏离 0.08 Å（一个环上 H）。
- `source/qa-browser.mjs`：46 项，全部通过，见 [`qa-browser.json`](./qa-browser.json)。2D 逐帧核对标题、弯箭头数、计数、阶段标签、键盘；3D 逐幕核对标题与弯箭头数，检查自动播放（滚到视野内才开始）、暂停、下一幕、时间轴、拖动旋转、复位视角、画面聚焦时的键盘控制（不影响 2D）、速度切换、减少动态效果时不自动播放；1440 / 768 / 390 px 无横向溢出；深色模式；原图链接存在；无脚本报错、零网络请求。

## 参考文献

1. P. H. J. Carlsen, T. Katsuki, V. S. Martin, K. B. Sharpless, “A greatly improved procedure for ruthenium tetroxide catalyzed oxidations of organic compounds”, *J. Org. Chem.* **46**, 3936–3938 (1981). [doi:10.1021/jo00332a045](https://doi.org/10.1021/jo00332a045)
2. M. T. Núñez, V. S. Martín, “Efficient oxidation of phenyl groups to carboxylic acids with ruthenium tetraoxide. A simple synthesis of (*R*)-γ-caprolactone, the pheromone of *Trogoderma granarium*”, *J. Org. Chem.* **55**, 1928–1932 (1990). [doi:10.1021/jo00293a044](https://doi.org/10.1021/jo00293a044)
3. V. Piccialli, “Ruthenium tetroxide and perruthenate chemistry. Recent advances and related transformations mediated by other transition metal oxo-species”, *Molecules* **19**, 6534 (2014). [doi:10.3390/molecules19056534](https://doi.org/10.3390/molecules19056534)
4. J. Frunzke, C. Loschen, G. Frenking, “Why are olefins oxidized by RuO₄ under cleavage of the carbon–carbon bond whereas oxidation by OsO₄ yields *cis*-diols?”, *J. Am. Chem. Soc.* **126**, 3642–3652 (2004). [doi:10.1021/ja039921a](https://doi.org/10.1021/ja039921a)

## 技术

单文件 HTML（约 100 KB）。2D 结构式、3D 球棍模型和弯箭头都由页内脚本现画成 SVG，不引用 CDN 或在线字体，下载后可离线打开。浅色 / 深色随系统切换。2D 与 3D 的脚本各放在一个块作用域里。

```
source/
├── problem.png      用户原图
├── page.html        页面模板（样式与正文）
├── mech.js          2D 结构式引擎 + 11 帧数据（页面与 verify.mjs 共用）
├── app.js           2D 翻页交互
├── mech3d.js        3D 关键帧：拓扑 + 位置松弛算坐标（页面与 verify3d.mjs 共用）
├── render3d.js      3D 时间轴、插值与 SVG 渲染（纯函数）
├── app3d.js         3D 播放器
├── build.mjs        合成 index.html，拒绝任何在线资源
├── verify.mjs       2D 结构、守恒、Ru 价态与电子数核验
├── verify3d.mjs     3D 关键帧核验
└── qa-browser.mjs   真实浏览器验收
```

```bash
deno install
deno run -A source/verify.mjs      # 2D 核验 → verification.json
deno run -A source/verify3d.mjs    # 3D 核验 → verification-3d.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png（需本机 Chromium / Chrome / Edge）
```
