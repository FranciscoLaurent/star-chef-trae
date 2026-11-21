# Round 2 · 修改文档（D3/D4 辩论 + 主线程裁决，2026-11-22 00:15）

> R2 复审 11 条 + ⌘K 提示。事实核实：①（#familyList 死选择器 + max-height:auto 非法）④（search 不索引 school）均属实。

## N1 线（谱页/招聘移动端 + 文案）— 文件：design-system.css / LineagePage.tsx / JobsPage.tsx
1. **① 谱页移动端目录**：design-system.css @860px 区块（:1148-1162）`.ped-families #familyList` 改为 `.ped-families`，`max-height:auto` → `max-height:none`（横滑 flex 布局保留）；确认桌面基础规则 78vh 不受影响。
2. **③ 招聘页移动端**：:1329 断点内补 `.jobs-list{max-height:none;overflow:visible}`；JobsPage 点岗位卡后对详情区 scrollIntoView（nearest，仅窄屏）。
3. **⑪ 文案**：JobsPage:258「填入示例，一键看效果」改为编辑体口吻（如「试一试：填入示例，看匹配如何打分」）；顶部「LIVE · 数据在线」→「ARCHIVE · 数据可溯」（NavBar.tsx 该字符串如在本文件改不了则归 N3）。

## N2 线（字体自托管）— 文件：index.html / package.json / main.tsx（或 index.css）
4. **②** 安装 @fontsource-variable/fraunces + @fontsource-variable/instrument-sans + @fontsource-variable/jetbrains-mono（OFL 许可）；在 main.tsx import 对应 css；删除 index.html 的 Google Fonts 三行（preconnect×2 + stylesheet）。
5. **关键**：@fontsource-variable 注册的 family 名带「Variable」后缀——必须让现有 CSS 引用不回退：查 tokens/design-system 中 font-family 定义（--serif: 'Fraunces', … / --mono: 'JetBrains Mono', …），用 aliases 兜底（在 index.css 或 main.tsx 追加少量 @font-face 把 'Fraunces'/'Instrument Sans'/'JetBrains Mono' 映射到 Variable 文件，src: url(包内 woff2) format('woff2-variations')），或直接把 fontsource 的 css 里 family 名对齐——总之**改完 hero 大标题渲染字体必须与改前一致**（用 build + 视觉抽验确认）。
6. npm install 后跑 lint+build；报告打包体积变化（woff2 进 dist 的增量）。

## N3 线（搜索/助手页/社区/导航）— 文件：search.ts / NavBar.tsx / app-shell.css / AssistantPage.tsx / CommunityPage.tsx
7. **④ 门派可搜**：search.ts 索引加入 school（用 data.schools 的 key→subName/name 中文名映射 + 拼音），使「上河帮」「广府」可搜到该门派下厨师；palette 结果项注明「门派」。
8. **⑤ 助手页姓名编辑**：ao-name 拆分——姓名保持 contentEditable，「· 42岁」移入独立 span（不可编辑）；档案卡顶部加一行 hint：「灰字可直接点击修改」（编辑体口吻，一行）。
9. **⑥ 演示沉底**：30 秒一键演示 generate 成功后 `.asst-output` scrollIntoView({behavior:'smooth', block:'center'})。
10. **⑧ 社区 tabs 派生**：visibleTabs = ['全部', ...new Set(posts.map(p=>p.cuisine))]（保持稳定顺序：全部固定首位，其余按种子帖序），空菜系 tab 不再显示；composer 的 9 菜系 chips 保留不动；发新菜系帖后 tab 自动生长。**不补任何虚构种子帖。**
11. **⑨ 移动端搜索**：app-shell.css ≤860px 处不隐藏文字 span，改隐藏 ⌘K kbd 徽标（触屏显示「搜索厨师」短文案，宽度放不下则「搜索」）。

## 明确不做（D3/D4 一致）
⑩ 头像缩略图（93MB、lazy+aspect-ratio 已就位，列入提交前优化清单）；⌘K 首页发现性提示（克制）；inferredEdges 管线项；portrait webp 批处理脚本（后续清单）。

## 回归清单
N2 后：hero 大标题字体渲染一致性（截图对比）；N1/N3 后：375px 谱页目录横滑、招聘页点卡详情入视口、⌘K 搜「上河帮」出结果、助手页演示后输出区居中、社区 tab 无空态、姓名编辑不含年龄；全局 lint+build 零 error。

## Round 2 · 核对与收官（2026-11-22 00:35）

**V3 终审（提交前最后一道关卡）**：残留扫描全部清零（编造数字/人物、过期赛事、虚假承诺、console 调试、硬编码 Key 均为 0）；界面数字与 meta 全部一致；字体自托管终验通过（6 个同源 woff2、零 googleapis 残留、@font-face 由 JS 注入且 base 路径正确）；四处诚实标注各一次；4 处复制按钮 fallback 齐备；移动端三处关键点无溢出；dist 为最新构建。

**终审盲区修复（主线程）**：① JobsPage:205 权重标注加「匹配权重：（满分 100）」消除与「43 菜系」的误读矛盾；② RealLineagePreview 两处「262 条师承记录」→「262 位厨师录得师承出处」（口径精确化：withMaster 是厨师数而非边数）。

**两轮迭代总账**：
- Round 1（15 项）：招聘师门键名、已故候选人过滤、剪贴板真闭环、谱页点亮师承链、待补徽标、置信度标注、代际折叠、hero 公益句、TRAE 字样、RLP 选人加权（郑秀生）、连线几何、钢印层级、上千万口径、人卡截断、AI 温度
- Round 2（11 项）：字体自托管（294KB 零外链）、谱页移动端横滑、招聘移动端滚动+沉底、门派可搜、姓名编辑拆分、演示沉底、社区 tabs 派生、移动端搜索文案、ARCHIVE 口径、跨派 ※ 角标（38 边）、focus-visible+键盘可达
- 热修（2 项）：无 Key 演示年龄误提取（18→42）、获奖捕获吞文本
- 终审补漏（2 项）：权重标注、师承口径精确化

**完成度轨迹**：76 → 88（Round 1）→ 92（Round 2）→ 93（热修+终审）。lint/build 全程零 error；7 个功能 commit 可随时回退。

**距「99% 把握拿最高奖」还差（均需用户参与）**：
1. GitHub Pages 部署修复（需要用户 push 权限/仓库设置）——评委可访问的在线链接是硬前提
2. 数据管线补录名厨徒弟（史正良 18 徒等，需爬虫+人工核验，约 1-2 天）
3. 演示视频重做（用户已表态自己重做；素材/分镜/口播稿框架已备）
4. 项目计划书重写（赛道三叙事，软创版素材已归档可复用）
5. 用真实 DeepSeek Key 走一遍全 AI 流程验证（用户有 Key）
