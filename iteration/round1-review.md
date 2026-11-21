# 星厨传承 · 迭代日志

> 目标：2026-11-22 10:00 前把作品迭代到冲最高奖状态。流程：审查→辩论→修改→核对，全程 git 存档。
> 基线 commit：07994a0（2026-11-21 23:21）

## Round 1 · 审查报告（2026-11-22 00:00 前完成）

### A. 评审视角（完成度 76/100）

1. **[P0] src/lib/jobs.ts:29-106（schoolPref）** 10 个岗位的师门偏好键（rongpai/guangfu/huaiyang/xiangjiang/jinan/jing/zhejiang/min）与 chefs.json 实际键（shang-he-bang/guang-fu/xiang-jiang 等，node 验证 0 命中）全部错配。后果：师门 25 分死维度，「师承为信」核心匹配叙事失效；JobsPage.tsx:330 渲染「优先 （空）」、:364「师门偏好： 优先」空文案。修法：rongpai→shang-he-bang、guangfu→guang-fu、xiangjiang→xiang-jiang；淮扬/鲁/京/浙/闽岗位删 schoolPref。15min｜今晚可做
2. **[P0] JobsPage.tsx:59-69 雇主侧候选人** 直接取全库真实档案当「求职者」，含 91 位已故大师（成都川菜岗排序第一是关正兴，卒 1902），卡片标「已收录」+「联系厨师」按钮；chef 侧「推荐匹配厨师」同样列已故大师。修法：chefList 与 topChefsForJob 过滤 deathYear（可再限 era=当代），候选人卡显示 era。10min｜今晚可做
3. **[P1] 首页第一屏零公益信息**（HomePage.tsx:24-75 + design-system.css hero 区）：45+ 老师傅、不擅文书者叙事只藏在 AssistantPage.tsx:238 一句 lead。修法：hero-meta 换一格为「公益切口 帮不擅文书的老师傅，把口述经历变成能投出的档案」。15min｜今晚可做
4. **[P1] 全站无 TRAE 字样**（grep 全 src 为 0）。大赛要求「体现用 TRAE 构建」。修法：App.tsx:62 footer 加「Built with TRAE」。2min｜今晚可做
5. **[P1] 假闭环三处**：JobsPage.tsx:409/464、AssistantPage.tsx:402-403 投递/联系/发布到招聘广场/保存档案全是 toast「（演示）」。「发布到招聘广场」承诺了不存在的广场。修法（克制）：改「复制求职档案/自荐信」→ navigator.clipboard 真实可用；或档案一键转社区帖。30min｜今晚可做
6. **[P1] HomePage.tsx:131-134 首页索引 6 行**：「师门信用认证」「雇主人才库」无对应页面、双双链到 /jobs，与导航 5 模块口径打架。修法：删这两行，标题改「四大模块」。10min｜今晚可做
7. **[P2] RealLineagePreview.tsx:19-40** 自动策略选中「王伟」（本人无照片、无门派、姓名大众化），说服力弱于郑秀生(6徒有照)/屈浩/周晓燕。修法：master 本人照片/titles 加权，或候选池白名单（只选人不编数据）。20min｜今晚可做
8. **[P2] HomePage.tsx:57「两千万中国厨师」** 无口径 → 「上千万」或注「据公开行业报道」。5min｜今晚可做
9. **[P2] community.ts:30-70 种子帖虚构人物带编造点赞数**，卡片无「预置」标识（seed 字段已有未渲染）。修法：post-card 渲染「预置示例」小标签。15min｜今晚可做
10. **[P2] 可访问性**：全站无 :focus-visible；谱/社区/岗位卡 div onClick 键盘不可达；CommandPalette 无 aria。修法：全局 focus-visible（5min）+ 关键卡片 tabIndex+Enter（25min）。30min｜今晚可做
11. **[P2] 死代码**：App.css/index.css 未 import、design-system.css problem/story/flywheel/revenue 旧版块、.ped-families #familyList 失效选择器。10min｜低优先

不建议做：任何新模块（收藏/登录/真后端/更多 section）；首页结构不动，只做减法。

**距最高奖三大短板**：①公益身份没被「说出来」；②核心承诺可被证伪（键名错配+已故大师当候选人）；③参与链缺最后一环（假 toast）。

### B. 谱视觉专项（一句话诊断：把「名录」做扎实了，但「谱」的灵魂——点一人、亮一条链——锁在右栏文字里）

1. **[P0] 谱页无链路点亮**：现谱是「按代分组名单」，262 条边 0 条可见；选人后谱面无反应。修法：openChef 时算 chain+disciples id 集，命中 person-card 加 `.in-chain`（朱砂描边+浅印底），ped-title 下加「上溯 X 代 · 门下 N 人」胶囊。40min｜今晚可做 ⭐最值得做
2. **[P0] 移动端点卡片零反馈**：860px 下 ped-detail 折到最底，无 scrollIntoView（grep 0 处）。修法：窄屏对 .ped-detail scrollIntoView。10min｜今晚可做
3. **[P1] 代际待控行淹没主视觉**（川 112/193，其他 338/386；全库 893/1415 无代际）。修法：null 行默认显前 12 张+「展开全部 N 人」+「暂无公开师承记载，仅入名录」。30min｜今晚可做
4. **[P1] 跨派师承不可见**：72 条跨菜系师承边（罗国荣→王义均 川→鲁等），D3 的 ※ 角标未吸收；.unverified 样式写了没用。修法：master.cuisine≠chef.cuisine 加 ※ 角标+右栏 crossNote。45min｜今晚可做
5. **[P1] person-card 高低不齐**：meta 全拼接无截断。修法：D7 方案——城市优先否则职位前 6 字，nowrap+ellipsis+min-height。15min｜今晚可做
6. **[P1] 口径**：hero「已收录 1,238」vs 左栏 fam 计数含 derived 合计 1,415。修法：fam 副行改「N 人·另 M 条待补档案」。20min｜今晚可做
7. **[P1] RLP 连线几何 bug**：竖干固定 x=50，徒弟 <4 人时横杠右端 <50 悬空；d-name 无 hover。修法：bar 端点取 min/max(centers, 50)；d-name hover 朱砂下划线。15min｜今晚可做
8. **[P2] 左栏 44 行目录过长、钢印字重复**（京/京帮/京苏同「京」；12 菜系 0 师傅）。修法：分「八大菜系/地方菜系」两段，0 师傅压缩行高；空谱加提示。35min｜今晚可做
9. **[P2] RLP 无照片钢印层级**：master 40px vs 徒弟 22px 拉不开。修法：.rlp-photo--master（印泥朱砂底+双描边）。20min｜今晚可做
10. 不建议做：全景星图复活、跨派全局连线图、用户新增师承 UGC。

### C. 数据审计（一句话诊断：数据是真底子、谱是半张网——把每处「缺」诚实标成「宁缺毋滥」）

1. **[P0] 孤儿师傅/占位支点**：apprenticeMap 319 名师傅中 177 名（55.5%）只有 derived「档案待补」占位，涉及 187/400 条徒弟边（46.8%）；chef 侧 662 条 master 引用中 316 条（47.7%）指向占位。修法 A：谱页中栏人卡（LineagePage.tsx:204-219）对 derived 加「待补」灰化徽标+图例（ChefProfile 已有、人卡没有）。20min｜今晚可做（A）；B=管线补真实师傅实体
2. **[P0] 置信度缺失**：262 条 master 边 100% inferred=true，全库 verified=true 为 0（字段从未赋真值）。ChefProfile.tsx:92 有「据简介推断·待核实」，但谱页 hero「师承关系可追溯 262·占比21%」与中栏人卡零标注。修法 A：hero 加「均为公开简介推断、人工核验进行中」（5min）｜今晚可做
3. **[P1] 代际观感**：真实厨师仅 345/1238（27.9%）有 gen；gen=1 的 260 人中 177 是占位（68%），gen=2 的 177 全是真——真实的人挤在「待考」，占位的顶着「第一代」。修法 A：「？」行折叠+「谱系已覆盖已溯源链 27.9%」文案。15min｜今晚可做
4. **[P0] 名厨谱瘦**：史正良 3 徒（公开 18，-83%）、许菊云 2、周晓燕 5、屈浩 5；103/142 真实师傅仅 1 徒（中位数 1、最大 8）；侯玉瑞/李启贵/罗永存等缺席。修法 A：ChefProfile 徒弟区加固定申明「只录可溯源徒弟，宁缺毋滥，名单持续补录」（10min）｜今晚可做；B=管线补录（今晚不做）
5. **[P1] AI 编造风险低**：web 端仅 2 处 prompt（EXTRACT_SYSTEM:135、explainPrompt:334），已明令严禁编造；mock 为规则拼接无虚构统计。残余：extractResume temperature=0.7 对抽取偏高。修法：降 0.2（2min）｜今晚可做
6. **[P1] 口径一致性**：App.tsx:53「1,238 位真实厨师档案」✓；lineage.ts buildFamilies 遍历 1415 条计家派人数，与 hero 1238 同页对不上；meta.inferredEdges=189≠实际 262（评委开 JSON 可见矛盾）；RealLineagePreview「全谱 262 条师承记录」措辞偏满。修法 A：家派计数过滤 derived 或注明含待补 177（10min）；RLP 文案改「262 条已溯源师承（推断·待核实）」（5min）｜今晚可做；inferredEdges 归 B

## Round 1 · 辩论与裁决

（待填）

## Round 1 · 修改文档

（待填）

## Round 1 · 核对

（待填）
