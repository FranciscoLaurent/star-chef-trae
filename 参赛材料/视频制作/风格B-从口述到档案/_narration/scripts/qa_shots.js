// 分镜验收帧批量截图（风格B）：playwright 直连 ?rec=1 页面，__seek 确定性定位，逐帧保存
// 验收帧时间全部从 timeline_inline.js 的实测节拍推导——重跑 TTS 后无需手改
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require("C:/npm/node_global/node_modules/playwright");

const OUT = path.resolve(__dirname, "../../qa");
const HTML = path.resolve(__dirname, "../../演示视频.html");
const URL = pathToFileURL(HTML).href + "?rec=1&probe=1";

// 读实测节拍
const code = fs.readFileSync(path.resolve(__dirname, "../timeline_inline.js"), "utf8");
const win = {};
new Function("window", code)(win);
const TL = win.__TL;
const S = id => TL.scenes.find(s => s.id === id);
const B = (id, name) => { const v = S(id).beats[name]; if (v === undefined) throw new Error(`beat ${id}.${name} 缺失`); return v; };
const END = TL.totalDuration;

const SHOTS = [
  ["s01-wave",   B("s01-hook", "wave") + 2.3],
  ["s01-chips",  B("s01-hook", "chunk3") + 1.1],
  ["s02-pen",    B("s02-problem", "pen") + 1.1],
  ["s02-big",    B("s02-problem", "big2") + 0.75],
  ["s03-flight", B("s03-turn", "flow") + 0.5],
  ["s03-slogan", B("s03-turn", "slogan") + 1.0],
  ["s04-fields", B("s04-card", "f4") + 0.7],
  ["s04-seal",   B("s04-card", "seal") + 1.4],
  ["s05-stats",  B("s05-lineage", "chain1") + 1.5],
  ["s05-inset",  B("s05-lineage", "chain2") + 1.1],
  ["s06-click",  B("s06-source", "go") + 0.9],
  ["s07-bars",   B("s07-jobs", "bar4") + 0.9],
  ["s07-score",  B("s07-jobs", "roll") + 1.6],
  ["s08-posts",  B("s08-community", "post3") + 1.1],
  ["s09-ghosts", B("s09-vision", "tagline") + 0.8],
  ["s10-punch",  B("s10-merge", "punch") + 1.1],
  ["s11-end",    END - 2.0],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("console", m => { if (m.type() === "error") console.log("[console.error]", m.text()); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__ready === true", null, { timeout: 60000 });
  await page.waitForTimeout(900);
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, t] of SHOTS) {
    await page.evaluate(tt => window.__seek(tt), Math.max(0.05, t));
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(OUT, `b-${name}.png`) });
    console.log("✓", name, `t=${Math.max(0.05, t).toFixed(2)}`);
  }
  await browser.close();
  console.log("全部验收帧已保存 →", OUT);
})();
