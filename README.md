# Organic Chemistry Graph｜有机化学图解

有机化学反应机理与合成路线的交互图解。结构式、形式电荷、单电子和弯箭头都由页内脚本手绘成 SVG；页面画出的每一个结构都由脚本重新读取，逐原子检查价键、补齐隐含氢算分子式、核对每一步的元素与电荷守恒。

在线阅读：<https://felixjiashengfu.github.io/Organic-Chemistry-Graph/>

## 专题

| 专题 | 内容 | 关键词 |
|---|---|---|
| [`birch-anisic-acid-steps`](./topics/birch-anisic-acid-steps/) | 邻甲氧基苯甲酸 → 2-丁基环己-2-烯酮：11 帧分步机理、原子记账、常见错误 | Birch 还原–烷基化、烯醇醚水解、β-酮酸脱羧、互变异构 |
| [`birch-anisic-acid-animation`](./topics/birch-anisic-acid-animation/) | 同一路线的 13 幕 2D 机理动画，每个原子全程可追踪 | 关键帧插值、弯箭头逐笔画出、逐幕守恒核验 |
| [`ruo4-phenyl-to-cooh`](./topics/ruo4-phenyl-to-cooh/) | 环己基苯 → 环己甲酸（RuCl₃ / NaIO₄）：11 帧分步机理 + 9 幕 3D 球棍动画，Ru 价态与 28 个电子记账 | RuO₄ 催化氧化、[3+2] 环加成、钌酸酯碎裂、芳环降解、氧化脱羧、Sharpless 条件 |

## 结构

```
Organic-Chemistry-Graph/
├── index.html                                   目录页（浅色／深色自适应）
├── README.md
├── .nojekyll
└── topics/
    ├── birch-anisic-acid-steps/
    │   ├── index.html                           单文件专题页，可离线打开（由 source/build.mjs 生成）
    │   ├── README.md                            内容、分层、来源与核验
    │   ├── preview.png / preview-mobile.png
    │   ├── verification.json                    source/verify.mjs 的结构与守恒核验
    │   ├── qa-browser.json                      source/qa-browser.mjs 的浏览器验收
    │   ├── package.json                         构建 / 核验脚本依赖（playwright-core）
    │   └── source/
    │       ├── problem.png                      用户原图（题目截图）
    │       ├── page.html                        页面模板（样式与正文）
    │       ├── mech.js                          结构式绘制引擎 + 11 帧数据，页面与核验脚本共用
    │       ├── app.js                           翻页交互
    │       ├── build.mjs                        合成 index.html，拒绝任何在线资源
    │       ├── verify.mjs                       读取每帧画出的结构：价键、分子式、守恒、结构判断
    │       └── qa-browser.mjs                   真实浏览器里逐帧核对
    ├── birch-anisic-acid-animation/
    │   ├── （同上）
    │   └── source/
    │       ├── problem.png
    │       ├── page.html
    │       ├── anim.js                          13 幕关键帧数据 + 插值渲染，页面与核验脚本共用
    │       ├── app.js                           播放控制
    │       ├── build.mjs
    │       ├── verify.mjs                       39 个关键帧的价键、守恒、原子去向；全程逐帧渲染
    │       └── qa-browser.mjs
    └── ruo4-phenyl-to-cooh/
        ├── index.html                           2D 分步机理 + 3D 动画在同一页
        ├── verification.json / verification-3d.json
        ├── （其余同上）
        └── source/
            ├── problem.png
            ├── page.html
            ├── mech.js                          2D 结构式引擎 + 11 帧数据
            ├── app.js                           2D 翻页交互
            ├── mech3d.js                        3D 关键帧：只写拓扑，坐标由位置松弛算出
            ├── render3d.js                      3D 时间轴、插值与 SVG 渲染
            ├── app3d.js                         3D 播放器
            ├── build.mjs
            ├── verify.mjs                       2D：价键、守恒、Ru 氧化态、逐步电子数
            ├── verify3d.mjs                     3D：显式氢价键、与 2D 分子式对照、进出场原子、几何质量
            └── qa-browser.mjs
```

## 本库规则

1. **页面不得依赖在线资源**：不引用 CDN、在线字体或第三方库（中文使用本地字体栈）。结构式用页内脚本画成 SVG，不贴位图。单个 `index.html` 下载后即可离线阅读；参考文献外链除外。`build.mjs` 发现外链资源会拒绝构建。
2. **结构与守恒必须可复算**：页面上画出的每个结构都要由 `verify.mjs` 从同一份数据重新读取——逐原子检查价键与形式电荷、按电子数奇偶核对自由基、补齐隐含氢算分子式；每一步的元素与电荷必须守恒（未画出的副产物在脚本里声明）；页面上的结构判断（共轭与否、区域选择性、原子去向等）也要有对应检查。
3. **弯箭头约定**：红色弯箭头 = 一对电子的流向，从电子对（孤对电子、负电荷或键）出发，指向新键位置或接受电子的原子；单个电子用红色 e⁻ 小球表示，不画鱼钩箭头；被追踪的原子用紫 / 青圈。
4. **分层标注**：分清 用户原图 / 精确（脚本核验）/ 文献 / 教学示意（理想化几何、所选共振式、动画插值路径与时长等），不把示意写成实测。
5. **术语中英对照**：名词与动词都标注，页末汇总为术语表。
6. 只有 `main` 分支，每次提交直接推送到 `main`。

## 本地构建与核验

本机只需 [Deno](https://deno.com) 2（或 Node ≥ 18）：

```bash
cd topics/birch-anisic-acid-steps        # 或 birch-anisic-acid-animation、ruo4-phenyl-to-cooh（后者另有 verify3d.mjs）
deno install
deno run -A source/verify.mjs      # 结构与守恒核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png（需本机 Chromium / Chrome / Edge）
```
