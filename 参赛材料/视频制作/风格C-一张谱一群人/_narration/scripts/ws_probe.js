// 诊断：三种 ws 连接变体，找出哪一种能通过
const crypto = require("crypto");
const { chromium } = require("C:/npm/node_global/node_modules/playwright");

const TRUSTED = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
function secMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  return crypto.createHash("sha256").update(`${ticks}${TRUSTED}`, "ascii").digest("hex").toUpperCase();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  page.on("websocket", (ws) => console.log("  [playwright ws event]", ws.url().slice(0, 60)));
  page.on("console", (m) => console.log("  [console]", m.text().slice(0, 120)));

  const gec = secMsGec();
  const base = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-140.0.3485.14&ConnectionId=${crypto.randomUUID().replace(/-/g, "")}`;

  for (const [name, pageUrl, withProto] of [
    ["A: bing页面+子协议", "https://speech.platform.bing.com/", true],
    ["B: bing页面无子协议", "https://speech.platform.bing.com/", false],
    ["C: msedge页面+子协议", "https://api.msedgeservices.com/", true],
  ]) {
    console.log("—", name);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch((e) => console.log("  goto err", e.message.slice(0, 60)));
    console.log("  page url:", page.url());
    const res = await page.evaluate(async ({ url, withProto }) => {
      return await new Promise((resolve) => {
        let ws;
        try { ws = withProto ? new WebSocket(url, ["synthesize"]) : new WebSocket(url); }
        catch (e) { resolve("EXC " + e.message); return; }
        const t = setTimeout(() => resolve("TIMEOUT"), 12000);
        ws.onopen = () => { clearTimeout(t); resolve("OPEN protocol=" + ws.protocol); try { ws.close(); } catch (e) {} };
        ws.onerror = () => { clearTimeout(t); resolve("ERROR"); };
        ws.onclose = (ev) => { clearTimeout(t); resolve("CLOSED code=" + ev.code + " reason=" + (ev.reason || "").slice(0, 60)); };
      });
    }, { url: base, withProto }).catch((e) => "EVAL ERR " + e.message.slice(0, 80));
    console.log("  result:", res);
  }
  await browser.close();
})();
