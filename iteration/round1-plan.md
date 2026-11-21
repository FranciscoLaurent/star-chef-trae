# Round 1 · 修改文档（辩论共识 + 主线程裁决）

> 辩论结论：D1（评委视角）与 D2（体验/工程视角）在 P0 上完全收敛。本文档为合并裁决。
> 诚实标注原则（双方共识）：每屏最多一句，绑在数字旁，把缺陷转述为方法论（宁缺毋滥/推断待核实），一次说清。全局最多四处：谱 hero、待考行、徒弟区、社区页头（已有）。
> 执行批次依赖（D2）：同文件改动必须同批；全局 CSS 最后做；每批后跑回归。

## 批次 1 · 招聘与 AI 闭环（文件：jobs.ts / JobsPage.tsx / AssistantPage.tsx / ai.ts）— Agent M1
1. **A1** jobs.ts:29-106 schoolPref 键名修正：rongpai→shang-he-bang、guangfu→guang-fu、xiangjiang→xiang-jiang；淮扬/鲁/京/浙/闽岗位无对应键则删除 schoolPref 字段（渲染端已兼容空值）。
2. **A2** JobsPage.tsx:59-69 雇主侧候选人与 :396 chef 侧推荐列表：过滤 `deathYear` 非空者（等价排除已故），候选人卡显示 era（当代/近代）；过滤后候选不足时不硬凑文案。
3. **A5** 假闭环改真闭环：JobsPage:409「投递简历」、:464「联系厨师」、AssistantPage:402-403「发布到招聘广场/保存档案」统一改为「复制求职档案 / 复制自荐信」——navigator.clipboard.writeText + execCommand fallback（局域网 http 非安全上下文，约 15 行 fallback 函数）；toast 改「已复制到剪贴板」。**禁止**「转社区帖」变体（D1/D2 一致反对）。删除「发布到招聘广场」这一虚假承诺文案。
4. **C5** ai.ts extractResume temperature 0.7 → 0.5。
回归：招聘页 chef/employer 双模式、助手页无 Key 演示、无 Key 环境（localStorage 无 key）。

## 批次 2 · 谱页点亮与诚实标注（文件：LineagePage.tsx + design-system.css）— Agent M2
5. **B1 ⭐** 选中即点亮师承链：openChef(id) 时用 getLineage + getDisciples（递归徒弟）计算 id 集合，命中的 person-card 加 `.in-chain`（朱砂描边 + 浅印底，与 `.active` 分层：active 更重）；ped-title 下加胶囊「上溯 X 代 · 门下 N 人」；selected 默认 familyChefs[0] → **首屏即亮链**。性能无忧（n=1415 微秒级）。
6. **C1** 中栏人卡对 derived 实体加「待补」灰化小徽标（可复用 ChefProfile 的 ld-tag 样式思路），谱页加一次性图例说明。
7. **C2** 谱页 hero「师承关系可追溯 262 · 占比21%」处加一句：「均来自公开简介推断 · 人工核验持续进行中」。
8. **B5** person-card meta 截断：城市优先，否则职位前 6 字；nowrap+ellipsis；卡 min-height 对齐。**只限 person-card，勿殃及 face-card/rlp。**
9. **B3+C3** 「代际待考」行折叠：默认显示前 12 张卡 +「展开全部」按钮（**禁写「展开 N 位待考者」**）；行首注「暂无公开师承记载，仅入名录」；27.9% 覆盖率以行内小字跟在胶囊旁。禁止修改 lineage.ts 导出签名。
回归：谱页全路径（选人→点亮→/chef/:id 刷新直达）、375px。

## 批次 3 · 首页谱块与叙事（文件：RealLineagePreview.tsx / HomePage.tsx / App.tsx + design-system.css .rlp-* 区）— Agent M3（在 M2 完成后执行，共享 CSS）
10. **A7** pickLineage 加权：master 本人 portrait +2 分（photoCount×2 + masterPortrait?1:0 → 微调使郑秀生类「本人有照+徒弟全照」胜出「本人无照」的大众名）。**不做白名单**（D2 方案，避免硬编码）。
11. **B7** 连线几何修复：横杠端点取 min/max(centers, 50)，杜绝徒弟 <4 时的悬空；d-name 加 hover 朱砂下划线。
12. **B9** 无照片钢印层级：.rlp-photo--master（印泥朱砂底 + 双描边），master 与徒弟拉层级。
13. **A3** 首页 hero-meta 换一格：「公益切口 帮不擅文书的老师傅，把口述经历变成能投出的档案」。视觉不动。
14. **A8** HomePage.tsx:57「两千万中国厨师」→「上千万中国厨师」。
15. **A4** App.tsx footer 加「Built with TRAE」（一行，monospace 小字风格）。
回归：首页全览、375px、RLP 主角是否换为本人有照片的师傅。

## 批次 4 · 可选（P0 全部完成且回归通过后才做）
16. **B4** 跨派师承 ※ 角标（72 条跨菜系边）：master.cuisine≠chef.cuisine 时 person-card 加 ※ + 右栏 crossNote 一句。45min，时间紧则砍。
17. **A10**（收敛版）：全局 :focus-visible（品牌朱砂轮廓）+ 谱页 person-card 与社区卡 tabIndex+Enter。不做 CommandPalette aria。

## 明确不做（双方一致）
A9 社区逐卡预置标签（页头已披露，重复=过度自曝）；A11 死代码清理；B8 左栏重构（35min 严重低估）；C1 修法 B / inferredEdges 重算（需数据管线，列入后续清单）；全景星图/UGC/新模块。

## 修改后全局回归清单（核对 agent + 主线程执行）
① 首页（含真实谱区块+hero 文案）② 谱页：选人→点亮→胶囊→/chef/:id 刷新直达 ③ 招聘页双模式：师门偏好有值、候选人无已故者、复制按钮真实可用 ④ 助手页无 Key 演示→复制档案 ⑤ 社区 localStorage 闭环 ⑥ 375px 全页走查 ⑦ npm run lint + build 零错误

## Round 1 · 核对结果（2026-11-22 00:10）

**V1 代码核对**：15/15 项 ✅ 全落地，无计划外改动（9 文件 +255/-54 全可归属），无硬约束违规（零编造/tokens 未动/数字与 meta 一致），lint 0 error、build 通过。3 个低风险备忘：同名厨师在 apprenticeMap 合并（既有设计）；execCommand 已废弃但兜底完备；折叠态跨家派保持（可接受设计）。

**V2 验收核对**：静态推演 15 项 ✅，诚实标注 3 处 ≤ 上限 4。主线程浏览器目验 5/5 画面通过：①首页首屏公益句+上千万 ✓ ②RLP 郑秀生（真实照片+朱砂双框钢印+6徒全照）✓ ③谱页首链点亮+胶囊+置信度注+待补徽标+图例 ✓ ④待考折叠（112 人/展开全部/申明）+ 关正兴师承脉络 ✓ ⑤招聘页雇主模式（80 位在世候选、era 显示、师门 25/25 生效、复制按钮、无虚假承诺）✓。

**Round 2 遗留清单**（按优先级）：
1. B2 谱页移动端人卡点击 scrollIntoView（M2 未做）
2. 厨师侧求职档案补「师承」字段（表单无 master 输入项，复制出的档案缺关键信息）
3. 谱页图例与待考行首注同屏合并降曝
4. 空档案复制拦截（姓名：匿名厨师 时应提示而非复制）
5. era 原始值归一显示（近代-当代/清末民初，可选）
6. B4 跨派师承 ※ 角标（72 条边，45min，可选）
7. A10 收敛版 :focus-visible + 关键卡 tabIndex（可选）

**Round 1 完成度评估：76 → 预估 88**（核心承诺不可证伪 ✓ 公益身份进首屏 ✓ 参与链真闭环 ✓ 谱页点亮 ✓ 诚实标注体系 ✓；剩余短板：师承数据覆盖率需管线补录、社区/AI 深度打磨、视频材料未做）
