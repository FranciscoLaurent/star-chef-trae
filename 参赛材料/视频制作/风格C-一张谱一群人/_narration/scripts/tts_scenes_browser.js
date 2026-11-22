// 逐段解说稿 TTS（Chromium 页面内 WebSocket 转发）
// 背景：edge-tts(python aiohttp) 在本机被 api.msedgeservices.com 的 TLS 指纹拦截（curl/浏览器可通过），
// 本脚本用 playwright chromium 打开 https 页面，在页面内按 edge-tts 同款协议直连，
// 协议参数与 edge-tts v7 完全一致（voice=XiaoxiaoNeural, rate=-6%, 24khz 48kbit mono mp3, WordBoundary）。
// 输入：<项目>/script.md（## scene-id 段 + [[cue:xx]] 标记）
// 输出：<项目>/_narration/audio/<id>.mp3 + <项目>/_narration/scenes.json
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { chromium } = require("C:/npm/node_global/node_modules/playwright");

const PROJ = path.resolve(__dirname, "../../");           // 风格C-一张谱一群人/
const AUDIO = path.join(PROJ, "_narration", "audio");
const SCRIPT = path.join(PROJ, "script.md");
const OUT_JSON = path.join(PROJ, "_narration", "scenes.json");
const VOICE = "zh-CN-XiaoxiaoNeural";
const RATE = "-6%";
const TRUSTED = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const GEC_VERSION = "1-140.0.3485.14";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.14";

// —— Sec-MS-GEC（与 edge_tts.DRM 同算法：Windows epoch 秒向下取 5 分钟 ×1e7 FILETIME，sha256(ticks+token) 大写）——
function secMsGec() {
  let ticks = BigInt(Math.floor(Date.now() / 1000)) + 11644473600n;
  ticks -= ticks % 300n;
  const str = (ticks * 10000000n).toString() + TRUSTED;
  return crypto.createHash("sha256").update(str, "ascii").digest("hex").toUpperCase();
}

// —— 解析 script.md（与 tts_scenes.py 同口径）——
function parseScript(p) {
  const scenes = [];
  let cur = null;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      if (cur) scenes.push(cur);
      cur = { id: line.slice(3).trim(), raw: "" };
    } else if (cur) {
      cur.raw += line.trim();
    }
  }
  if (cur) scenes.push(cur);
  for (const s of scenes) {
    const text = s.raw.replace(/\[\[cue:[\w-]+\]\]/g, "").trim();
    const cues = [];
    let re = /\[\[cue:([\w-]+)\]\]/g, m;
    while ((m = re.exec(s.raw))) {
      const before = s.raw.slice(0, m.index).replace(/\[\[cue:[\w-]+\]\]/g, "");
      cues.push({ id: m[1], charOffset: before.length });
    }
    s.text = text;
    s.cues = cues;
  }
  return scenes;
}

const escapeXml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// —— 页面内合成单段（收集 mp3 分片 + WordBoundary）——
const synthOne = async ({ text, voice, rate, gec, gecVer, connId, trusted }) => {
  const url = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${trusted}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${gecVer}&ConnectionId=${connId}`;
  const ws = new WebSocket(url, ["synthesize"]);
  const chunks = [];
  const words = [];
  let turnEnd = false;

  const ts = () => new Date().toString();
  const reqId = () => crypto.randomUUID().replace(/-/g, "").toUpperCase();

  const configMsg = () => {
    const body = JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "true" },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });
    return `X-Timestamp:${ts()}\r\nX-RequestId:${reqId()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` + body;
  };
  const ssmlMsg = () => {
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
    return `X-RequestId:${reqId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts()}\r\nPath:ssml\r\n\r\n` + ssml;
  };

  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("synth timeout 60s")), 60000);
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        const pathMatch = ev.data.match(/^X-RequestId:.*?\r\nPath:(\w+)\r\n\r\n([\s\S]*)$/);
        if (!pathMatch) return;
        const p = pathMatch[1], body = pathMatch[2];
        if (p === "turn.end") { turnEnd = true; clearTimeout(timer); resolve(); }
        else if (p === "audio.metadata") {
          try {
            const meta = JSON.parse(body);
            for (const item of (meta.Metadata?.Data || [])) {
              if (item.type === "WordBoundary") {
                words.push({
                  text: item.Data.text?.Text ?? item.Data.text?.text ?? "",
                  start: item.Data.Offset / 1e7,
                  end: (item.Data.Offset + item.Data.Duration) / 1e7,
                });
              }
            }
          } catch (e) { /* metadata 解析失败不致命 */ }
        }
      } else if (ev.data instanceof ArrayBuffer) {
        const dv = new DataView(ev.data);
        const headerLen = dv.getUint16(0);
        const header = new TextDecoder().decode(new Uint8Array(ev.data, 2, headerLen));
        if (header.includes("Path:audio")) {
          chunks.push(new Uint8Array(ev.data, 2 + headerLen));
        }
      } else if (ev.data instanceof Blob) {
        ev.data.arrayBuffer().then((buf) => {
          const dv = new DataView(buf);
          const headerLen = dv.getUint16(0);
          const header = new TextDecoder().decode(new Uint8Array(buf, 2, headerLen));
          if (header.includes("Path:audio")) chunks.push(new Uint8Array(buf, 2 + headerLen));
        });
      }
    };
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error("ws error: " + (e.message || "unknown"))); };
    ws.onclose = () => { clearTimeout(timer); if (!turnEnd) reject(new Error("ws closed before turn.end")); };
  });

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = (e) => reject(new Error("handshake failed: " + (e.message || "unknown")));
    setTimeout(() => reject(new Error("handshake timeout 20s")), 20000);
  });
  ws.send(configMsg());
  ws.send(ssmlMsg());
  await done;
  try { ws.close(); } catch (e) {}

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  let b64 = "";
  const BIN = typeof Buffer === "undefined";
  // 页面内没有 Buffer：分块 btoa
  const bytes = merged;
  const CHUNK = 0x8000;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  b64 = btoa(parts.join(""));
  return { audioB64: b64, words };
};

(async () => {
  fs.mkdirSync(AUDIO, { recursive: true });
  const scenes = parseScript(SCRIPT);
  const only = process.argv.slice(2);
  const todo = only.length ? scenes.filter((s) => only.includes(s.id)) : scenes;

  // 服务端 403 拒绝含 HeadlessChrome 的 UA（实测：Edge UA 可过）——浏览器级参数确保 ws 握手也带
  const browser = await chromium.launch({ headless: true, args: ["--user-agent=" + UA] });
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();
  // CDP 诊断：ws 握手状态码
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on("Network.webSocketHandshakeResponseEvent", (e) => { if (e.status !== 101) console.error(`  [ws handshake] ${e.status}`); });
  // 打开任意 https 页面取得 secure context（crypto.subtle / 浏览器 TLS 指纹）
  await page.goto("https://speech.platform.bing.com/", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});

  const results = [];
  for (const s of todo) {
    const gec = secMsGec();
    const connId = crypto.randomUUID().replace(/-/g, "");
    let r;
    try {
      r = await page.evaluate(synthOne, { text: s.text, voice: VOICE, rate: RATE, gec, gecVer: GEC_VERSION, connId, trusted: TRUSTED });
    } catch (e) {
      console.error(`✗ ${s.id}: ${e.message}`);
      await browser.close();
      process.exit(2);
    }
    const mp3 = path.join(AUDIO, `${s.id}.mp3`);
    fs.writeFileSync(mp3, Buffer.from(r.audioB64, "base64"));
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim());
    results.push({ id: s.id, raw: s.raw, text: s.text, cues: s.cues, audio: `audio/${s.id}.mp3`, duration: dur, words: r.words });
    console.log(`✓ ${s.id}: ${dur.toFixed(2)}s · ${s.text.length} 字 · ${r.words.length} 词块`);
  }
  await browser.close();

  // 保持原顺序写 scenes.json
  const order = scenes.map((s) => s.id);
  const merged = [];
  if (only.length && fs.existsSync(OUT_JSON)) {
    const prev = JSON.parse(fs.readFileSync(OUT_JSON, "utf-8"));
    for (const p of prev) merged.push(only.includes(p.id) ? results.find((r) => r.id === p.id) : p);
    for (const r of results) if (!prev.find((p) => p.id === r.id)) merged.push(r);
    merged.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  } else {
    for (const id of order) merged.push(results.find((r) => r.id === id));
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(merged, null, 1), "utf-8");
  console.log(`✓ scenes.json 已写 ${merged.length} 段`);
})();
