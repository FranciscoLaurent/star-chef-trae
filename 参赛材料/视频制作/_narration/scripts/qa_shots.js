// 分镜验收帧批量截图：playwright 直连 ?rec=1 页面，__seek 定位，逐帧保存
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.resolve(__dirname, "../../素材/截图");
const URL = "http://localhost:8899/" + encodeURIComponent("演示视频.html") + "?rec=1";

const SHOTS = [
  ["s01-hook", 2.8], ["s02-36", 16.8], ["s03-card", 26.5], ["s04-chain", 35.0],
  ["s05-wait", 44.8], ["s06-source", 51.8], ["s07-score", 63.0], ["s08-typing", 74.5],
  ["s08-copy", 78.3], ["s09-community", 83.5], ["s10-vision", 95.5], ["s11-end", 104.5],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("console", m => { if (m.type() === "error") console.log("[console.error]", m.text()); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction("window.__ready === true", null, { timeout: 30000 });
  await page.waitForTimeout(800);
  for (const [name, t] of SHOTS) {
    await page.evaluate(tt => window.__seek(tt), t);
    await page.waitForTimeout(260);
    await page.screenshot({ path: path.join(OUT, `film-${name}.png`) });
    console.log("✓", name, `t=${t}`);
  }
  await browser.close();
  console.log("全部验收帧已保存");
})();
