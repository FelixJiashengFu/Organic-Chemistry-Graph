# 邻甲氧基苯甲酸 → 2-丁基环己-2-烯酮：分步机理

> [打开页面](./index.html) · 在线：<https://uugyfgyb.github.io/Organic-Chemistry-Graph/topics/birch-anisic-acid-steps/>

题目（II. Reactions of Carbon–Carbon π-Bonds）：由 2-methoxybenzoic acid（邻甲氧基苯甲酸）合成 2-butylcyclohex-2-en-1-one（2-丁基环己-2-烯酮）。题目给出的三条提示是：tandem Birch reduction–alkylation；enol ether hydrolysis；β-keto acid decarboxylation and alkene isomerization。原题截图见 [`source/problem.png`](./source/problem.png)。

| 步骤 | 条件 | 产物 | 分子式 |
|---|---|---|---|
| ① Birch 还原–烷基化 | Li（或 Na）, NH₃(l), −78 °C；*n*-BuBr；H₃O⁺ 后处理 | 1-丁基-2-甲氧基环己-2,5-二烯-1-甲酸 | C₁₂H₁₈O₃ |
| ② 烯醇醚水解 | H₃O⁺ | 1-丁基-6-氧代环己-2-烯-1-甲酸（β-酮酸） | C₁₁H₁₆O₃ |
| ③ 脱羧 + 双键异构化 | H₃O⁺, Δ（常与 ② 同一锅） | 2-丁基环己-2-烯-1-酮 | C₁₀H₁₆O |

## 页面包含

| 区块 | 内容 |
|---|---|
| 01 分步机理 | 11 帧可翻页的机理图：总览 → 去质子化与第一次单电子转移 → C4 质子化 → 第二次电子转移（碳负离子 ↔ 烯二醇盐）→ C1 烷基化 → 烯醇醚 C3 质子化 → 水进攻成半缩酮 → 失去 MeOH 得 β-酮酸 → 六元环过渡态脱羧 → 二烯醇互变异构 → 原子记账。共 19 根弯箭头；紫圈追踪原 C1，青圈追踪原 C2；阶段标签、进度点、← → 键翻页 |
| 02 三步各做了什么 | 三张卡片：区域选择性（吸电子基所在碳和对位变 sp³，给电子基留在双键上）、烯醇醚水解的氧来源、季碳 β-酮酸为什么也能脱羧、为什么停在共轭烯酮；附文献实验做法 |
| 03 原子记账 | 各中间体分子式、三个阶段的配平总式、原子去向（C1 → α-碳，C2 → 羰基碳，O 来自水，三个新 H 的来源） |
| 04 常见错误 | 7 条 |
| 05 术语表 | 37 条中英对照（含动词） |
| 06 来源与核验 | 分层说明、参考文献、技术说明 |

## 分层

- **用户原图**：题目截图（`source/problem.png`）。
- **精确（脚本核验）**：页面画出的每个结构都由 `source/verify.mjs` 从同一份数据（`source/mech.js`）重新读取，逐原子检查价键与形式电荷，按电子数奇偶核对自由基，补齐隐含氢算分子式；再核对每一帧的元素与电荷守恒（未画出的副产物在脚本里声明）、三个阶段的配平总式，以及 1,4-二烯不共轭、OMe 在 C=C 上（烯醇醚）、C1 为季碳、β-酮酸的 β 关系、脱羧六元环闭合、碳负离子与烯二醇盐 σ 骨架相同（共振式）、产物为共轭烯酮且侧链为正丁基、原子去向等结构判断。
- **文献**：反应条件与“② ③ 同一锅”：Birch & Slobbe 1977；帝国理工本科实验 A2（1-溴庚烷 → 2-庚基环己-2-烯酮）。
- **教学示意**：理想正六边形的 2D 结构式；自由基负离子只画了一个共振式；C4 的质子源写成 *t*-BuOH（文献做法里它来自 *t*-BuOK 成盐，体系里也可能由 NH₃ 提供）；去质子化画成金属直接还原 O–H 放出 H₂（文献做法是先用 *t*-BuOK 成盐）；“动力学质子化在 C1、热力学产物是共轭烯酮”是一般规律，不是本页的计算结果。

## 核验

- `source/verify.mjs`：92 项，全部通过，见 [`verification.json`](./verification.json)。做过变异测试：在副本里同时把产物侧链删掉一个碳、去掉自由基负离子 C4 上的负电荷，有 9 项检查报错（分子式、守恒、正丁基、对位电荷）。
- `source/qa-browser.mjs`：在 Chromium 里逐帧翻页，核对标题、弯箭头数与计数；检查阶段标签、进度点、键盘翻页、目录锚点、术语表条数；1440 / 768 / 390 px 无横向溢出（390 px 时结构图保持 560 px 宽，在框内横向滚动）；深色模式下原子标签为浅色；无脚本报错、零网络请求。结果见 [`qa-browser.json`](./qa-browser.json)。

## 参考文献

1. A. J. Birch, J. Slobbe, “Reduction by dissolving metals. XXII. Reduction and reductive alkylation of some methoxy- and dimethylamino-benzoic acids”, *Aust. J. Chem.* **30**, 1045–1049 (1977). [doi:10.1071/CH9771045](https://doi.org/10.1071/CH9771045)
2. Imperial College London 本科有机实验 A2：“Reactions in liquid ammonia. The preparation of 2-heptyl-2-cyclohexenone via the Birch reduction of *o*-anisic acid”：<https://www.ch.ic.ac.uk/local/organic/6.html>

## 技术

单文件 HTML（约 47 KB）：结构式、电荷、单电子和弯箭头由页内脚本手写成 SVG（`source/mech.js`），不用位图、不引用 CDN 或在线字体，下载后可离线打开。浅色 / 深色随系统切换。

```bash
deno install
deno run -A source/verify.mjs      # 结构与守恒核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png
```
