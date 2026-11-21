# CLAUDE.md

本文件为 AI 协作开发（TRAE / Claude Code 等）提供项目约定。

## 项目定位

「星厨传承」—— 以师承关系为信任底层的厨师职业平台。
**参赛赛事**：TRAE AI 全国大学生创造力大赛 · 赛道三「社会公益丨造个助人的好工具」（截止 2026.12.25）。
**唯一交付物**：`web/`（Vite 8 + React 19 + TypeScript）。

## 本仓库范围（最小化）

- 只包含参赛在用的内容：`web/` 主工程 + `.github/` Pages 部署 + 两份说明文档；
- 数据管线（爬虫/清洗/合并脚本）、git 提交历史、已停用模块都在工作仓 `D:\Study\AI_Space\TRAE\star_chef`，本仓库不放冗余；
- 更新数据：去工作仓改来源 JSON → `node data/_merge.js` → 同步产物到本仓库 `web/public/data/chefs.json`。

## 硬约束（不可违反）

- **视觉风格不可回退**：Fraunces 衬线 + Noto Serif SC，复古纸纹色板（`--paper/--ink/--vermillion/--moss/--gold`），报刊版式 + 钢印元素；
- **不得明文写入任何 API Key**：Key 由用户在页面输入，存 `localStorage`（`star-chef:deepseek-key`）；
- **真实数据可溯源、宁缺毋滥**：推断信息显式标注置信度，演示数据在界面标注；
- **不要在本仓库新建归档/备份目录**，冗余内容一律留在工作仓；
- 注释与文档用中文；改动后跑 `npm run lint` + `npm run build` 验证。

## 常用命令

```bash
cd web
npm run dev        # 开发（含 /api/deepseek 代理）
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```

## 架构要点

- `src/lib/ai.ts`：DeepSeek 封装，proxy/直连双模式；无 Key 本地规则兜底并诚实标注；
- `src/lib/useData.ts`：运行时 `fetch('/data/chefs.json')`，字段（`master/masters/masterIds`、`gen`、`portrait`、`sourceUrl`）与合并产物强相关，改字段两端同步；
- 4 处 AI 调用各有独立 prompt（师承推断/匹配解释/求职档案/帖子整理），改 AI 行为逐处检查；
- 匹配算法在 `src/lib/jobs.ts`：多维拆解 + 可解释理由。

## 数据口径

`web/public/data/chefs.json`：1,513 条 = 1,238 真实 + 275 待补档案（`meta.total=1238`，`derivedChefs=275`），8 门派 / 43 菜系，853 头像，262 位真实厨师录得师承出处。界面所有统计数字必须与该文件一致，不得出现无来源的宣传数字；「待补」档案在界面一律以徽标诚实标注。
