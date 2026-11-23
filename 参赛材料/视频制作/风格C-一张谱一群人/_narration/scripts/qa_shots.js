// 分镜验收帧批量截图：playwright 直连 ?rec=1 页面，__seek 定位，逐帧保存
// 用法：先在「视频制作」目录起 http 服务（python -m http.server 8899），再 node qa_shots.js
const { chromium } = require("C:/npm/node_global/node_modules/playwright");
const path = require("path");
const OUT = path.resolve(__dirname, "../../qa");
const URL = "http://localhost:8902/" + ["参赛材料", "视频制作", "风格C-一张谱一群人", "演示视频.html"].map(encodeURIComponent).join("/") + "?rec=1";

// 18 张验收帧（含字幕检查帧：s07/s10；≥12 张硬性要求）
const SHOTS = [
  ["s01-wall", 2.0], ["s01-who", 4.6],
  ["s02-plaque", 10.0], ["s02-sources", 13.5], ["s02-unwritten", 16.5],
  ["s03-tree", 23.5], ["s03-stamps", 28.5],
  ["s04-shi", 33.5], ["s04-18", 37.2],
  ["s05-wait", 43.5],
  ["s06-source", 51.5],
  ["s07-score", 65.5],
  ["s08-typing", 74.8], ["s08-copy", 78.5],
  ["s09-posts", 86.0], ["s09-circle", 88.5],
  ["s10-vision", 98.5],
  ["s11-book", 107.5],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("console", m => { if (m.type() === "error") console.log("[console.error]", m.text()); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction("window.__ready === true", null, { timeout: 30000 });
  // 等全部图片加载完成（群像 163 张头像）
  try {
    await page.waitForFunction(() => {
      const imgs = [...document.images];
      return imgs.length > 150 && imgs.every(i => i.complete && i.naturalWidth > 0);
    }, null, { timeout: 45000 });
    console.log("✓ 群像图片全部加载");
  } catch (e) {
    console.log("[warn] 图片未全部加载完成，继续截帧（验收时注意空洞）");
  }
  await page.waitForTimeout(800);
  for (const [name, t] of SHOTS) {
    await page.evaluate(tt => window.__seek(tt), t);
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(OUT, `qa-${name}.png`) });
    console.log("✓", name, `t=${t}`);
  }
  await browser.close();
  console.log("全部验收帧已保存至 qa/");
})();
