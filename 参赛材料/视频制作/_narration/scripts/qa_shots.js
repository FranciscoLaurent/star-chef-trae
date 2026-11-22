// 分镜验收帧批量截图：playwright 直连 ?rec=1 页面，__seek 定位，逐帧保存
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.resolve(__dirname, "../../素材/截图");
// 服务器根 = 仓库根（头像走 ../../web/public/portraits 相对路径）
const URL = "http://localhost:8899/" + encodeURI("参赛材料/视频制作/演示视频.html") + "?rec=1";

const SHOTS = [
  ["s01-wall", 4.6], ["s01-focus", 6.5], ["s02-band", 10.6], ["s02-chips", 15.9],
  ["s02-resume", 18.1], ["s03-card", 26.5], ["s04-sweep", 33.8], ["s04-stamp", 36.5],
  ["s05-wait", 44.8], ["s06-source", 51.8], ["s07-score", 63.0], ["s08-typing", 74.5],
  ["s08-copy", 78.3], ["s09-community", 83.5], ["s10-vision", 95.5], ["s11-end", 104.6],
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
