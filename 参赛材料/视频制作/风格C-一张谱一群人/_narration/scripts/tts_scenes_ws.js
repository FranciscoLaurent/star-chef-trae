// 逐段解说稿 TTS：Node 裸 TLS + 手写 WebSocket 帧协议直连 Edge TTS
// （背景：python aiohttp 被 TLS 指纹 tarpit、HeadlessChrome UA 被 403、服务端偶发中途断流，
//   Node TLS + Edge UA + 完整 upgrade 头实测 101 成功；本实现带逐场景重试）
// 协议与 edge-tts v7 一致：voice=XiaoxiaoNeural, rate=-6%,
// outputFormat=audio-24khz-48kbitrate-mono-mp3, WordBoundary 元数据。
// 输入：<项目>/script.md（## scene-id 段 + [[cue:xx]] 标记）
// 输出：<项目>/_narration/audio/<id>.mp3 + <项目>/_narration/scenes.json
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const tls = require("tls");
const { execFileSync } = require("child_process");

const PROJ = path.resolve(__dirname, "../../");
const AUDIO = path.join(PROJ, "_narration", "audio");
const SCRIPT = path.join(PROJ, "script.md");
const OUT_JSON = path.join(PROJ, "_narration", "scenes.json");
const HOST = "api.msedgeservices.com";
const VOICE = "zh-CN-XiaoxiaoNeural";
const RATE = "-6%";
const TRUSTED = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const GEC_VERSION = "1-140.0.3485.14";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.14";
const DEBUG = !!process.env.TTS_DEBUG;

function secMsGec() {
  let ticks = BigInt(Math.floor(Date.now() / 1000)) + 11644473600n;
  ticks -= ticks % 300n;
  const str = (ticks * 10000000n).toString() + TRUSTED;
  return crypto.createHash("sha256").update(str, "ascii").digest("hex").toUpperCase();
}

const tsHeader = () => {
  const D = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${D[d.getUTCDay()]} ${M[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
};
const reqId = () => crypto.randomUUID().replace(/-/g, "").toUpperCase();
const escapeXml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    const re = /\[\[cue:([\w-]+)\]\]/g;
    let m;
    while ((m = re.exec(s.raw))) {
      const before = s.raw.slice(0, m.index).replace(/\[\[cue:[\w-]+\]\]/g, "");
      cues.push({ id: m[1], charOffset: before.length });
    }
    s.text = text;
    s.cues = cues;
  }
  return scenes;
}

function encodeFrame(opcode, payload) {
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = 0x80 | len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([head, mask, masked]);
}

// —— 单次连接合成 ——
function synthAttempt(text) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const gec = secMsGec();
    const connId = crypto.randomUUID().replace(/-/g, "");
    const urlPath = `/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${connId}`;
    const key = crypto.randomBytes(16).toString("base64");

    const chunks = [];
    const words = [];
    const pathsSeen = new Set();
    let buf = Buffer.alloc(0);
    let upgraded = false;
    let finBuf = null;
    let settled = false;
    let bytesAudio = 0;

    const ok = () => {
      if (settled) return;
      settled = true;
      const audio = Buffer.concat(chunks);
      if (DEBUG) console.log(`  [dbg] resolve: audio=${audio.length}B words=${words.length} paths=[${[...pathsSeen].join(",")}] ${Date.now() - t0}ms`);
      try { sock.write(encodeFrame(0x8, Buffer.from([0x03, 0xe8]))); } catch (e) {}
      setTimeout(() => { try { sock.destroy(); } catch (e) {} }, 150);
      resolve({ audio, words });
    };
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (e) {}
      reject(new Error(`${msg} (t=${Date.now() - t0}ms audio=${bytesAudio}B paths=[${[...pathsSeen].join(",") || "none"}])`));
    };

    const sock = tls.connect({ host: HOST, port: 443, servername: HOST }, () => {
      sock.write(
        `GET ${urlPath} HTTP/1.1\r\nHost: ${HOST}\r\nPragma: no-cache\r\nCache-Control: no-cache\r\n` +
        `Connection: Upgrade\r\nUpgrade: websocket\r\nOrigin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: synthesize\r\n` +
        `User-Agent: ${UA}\r\nAccept-Encoding: gzip, deflate, br\r\nAccept-Language: en-US,en;q=0.9\r\n\r\n`,
      );
    });
    // 断流检测：8s 无新音频但已收到音频 → 视为完成；完全无音频 20s → 失败
    let lastAudioAt = Date.now();
    let gotAudio = false;
    const watchdog = setInterval(() => {
      const idle = Date.now() - lastAudioAt;
      if (gotAudio && idle > 8000) ok();
      else if (!gotAudio && idle > 20000) fail("no audio 20s");
      else if (idle > 25000) fail("stall 25s");
    }, 1000);

    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!upgraded) {
        const s = buf.toString("latin1");
        const idx = s.indexOf("\r\n\r\n");
        if (idx === -1) return;
        const status = s.slice(9, 12);
        if (status !== "101") return fail("handshake " + s.split("\r\n")[0]);
        upgraded = true;
        buf = buf.slice(idx + 4);
        const configMsg =
          `X-Timestamp:${tsHeader()}\r\n` +
          "Content-Type:application/json; charset=utf-8\r\n" +
          "Path:speech.config\r\n\r\n" +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{' +
          '"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"' +
          '},' +
          '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"' +
          "}}}}\r\n";
        sock.write(encodeFrame(0x1, Buffer.from(configMsg, "utf-8")));
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${VOICE}'><prosody pitch='+0Hz' rate='${RATE}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
        sock.write(encodeFrame(0x1, Buffer.from(
          `X-RequestId:${reqId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${tsHeader()}Z\r\nPath:ssml\r\n\r\n${ssml}`, "utf-8")));
        if (DEBUG) console.log(`  [dbg] upgraded ${Date.now() - t0}ms`);
      }
      for (;;) {
        if (buf.length < 2) return;
        const b0 = buf[0], b1 = buf[1];
        const opcode = b0 & 0x0f;
        let len = b1 & 0x7f;
        let off = 2;
        if (len === 126) { if (buf.length < off + 2) return; len = buf.readUInt16BE(off); off += 2; }
        else if (len === 127) { if (buf.length < off + 8) return; len = Number(buf.readBigUInt64BE(off)); off += 8; }
        const masked = (b1 & 0x80) !== 0;
        if (masked) off += 4;
        if (buf.length < off + len) return;
        const payload = buf.slice(off, off + len);
        buf = buf.slice(off + len);
        if (opcode === 0x9) { sock.write(encodeFrame(0xA, payload)); continue; }
        if (opcode === 0x8) { if (DEBUG) console.log(`  [dbg] server close frame ${Date.now() - t0}ms`); ok(); return; }
        if (opcode === 0x1 || opcode === 0x2) finBuf = { opcode, parts: [payload] };
        else if (opcode === 0x0 && finBuf) finBuf.parts.push(payload);
        if (!(b0 & 0x80)) continue;   // 未 FIN，等待后续分片
        if (!finBuf) continue;
        const full = Buffer.concat(finBuf.parts);
        const op = finBuf.opcode;
        finBuf = null;
        if (op === 0x1) {
          const msg = full.toString("utf-8");
          const pIdx = msg.indexOf("\r\n\r\n");
          const head = pIdx >= 0 ? msg.slice(0, pIdx) : msg;
          const body = pIdx >= 0 ? msg.slice(pIdx + 4) : "";
          const pm = head.match(/Path:(\w+)/);
          if (!pm) continue;
          pathsSeen.add(pm[1]);
          if (DEBUG) console.log(`  [frame] ${pm[1]} len=${full.length} ${Date.now() - t0}ms`);
          if (pm[1] === "turn.end") { ok(); return; }
          if (pm[1] === "audio.metadata") {
            try {
              const meta = JSON.parse(body);
              for (const item of (meta.Metadata || [])) {
                if (item.Type === "WordBoundary") {
                  words.push({
                    text: item.Data.text?.Text ?? "",
                    start: item.Data.Offset / 1e7,
                    end: (item.Data.Offset + item.Data.Duration) / 1e7,
                  });
                }
              }
            } catch (e) { if (DEBUG) console.log("  [warn] metadata parse fail"); }
          }
        } else if (op === 0x2) {
          if (full.length > 2) {
            const hLen = full.readUInt16BE(0);
            const header = full.toString("latin1", 2, 2 + hLen);
            if (header.includes("Path:audio")) {
              chunks.push(full.slice(2 + hLen));
              bytesAudio += full.length - 2 - hLen;
              gotAudio = true;
              lastAudioAt = Date.now();
            }
          }
        }
      }
    });
    sock.on("error", (e) => fail("tls: " + e.message));
    sock.on("close", () => { if (!settled) { clearInterval(watchdog); if (gotAudio) ok(); else fail("closed early"); } });
    sock.on("close", () => clearInterval(watchdog));
  });
}

async function synthOne(text) {
  let lastErr;
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await synthAttempt(text);
      if (r.audio.length < 2000) throw new Error(`audio too small (${r.audio.length}B)`);
      return r;
    } catch (e) {
      lastErr = e;
      if (DEBUG) console.log(`  [retry] attempt ${i} failed: ${e.message}`);
      await new Promise((res) => setTimeout(res, 2000 * i));
    }
  }
  throw lastErr;
}

(async () => {
  fs.mkdirSync(AUDIO, { recursive: true });
  const scenes = parseScript(SCRIPT);
  const only = process.argv.slice(2);
  const todo = only.length ? scenes.filter((s) => only.includes(s.id)) : scenes;

  const results = [];
  for (const s of todo) {
    const mp3 = path.join(AUDIO, `${s.id}.mp3`);
    // 已有有效音频（>4KB）时跳过，支持断点续跑
    if (fs.existsSync(mp3) && fs.statSync(mp3).size > 4096) {
      const dur = parseFloat(execFileSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim());
      const prev = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, "utf-8")).find((x) => x.id === s.id) : null;
      results.push({ id: s.id, raw: s.raw, text: s.text, cues: s.cues, audio: `audio/${s.id}.mp3`, duration: dur, words: prev?.words || [] });
      console.log(`↷ ${s.id}: 已有 ${dur.toFixed(2)}s，跳过`);
      continue;
    }
    let r;
    try {
      r = await synthOne(s.text);
    } catch (e) {
      console.error(`✗ ${s.id}: ${e.message}`);
      process.exit(2);
    }
    fs.writeFileSync(mp3, r.audio);
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim());
    results.push({ id: s.id, raw: s.raw, text: s.text, cues: s.cues, audio: `audio/${s.id}.mp3`, duration: dur, words: r.words });
    console.log(`✓ ${s.id}: ${dur.toFixed(2)}s · ${s.text.length} 字 · ${r.words.length} 词块 · ${(r.audio.length / 1024).toFixed(0)}KB`);
  }

  const order = scenes.map((s) => s.id);
  let merged;
  if (only.length && fs.existsSync(OUT_JSON)) {
    const prev = JSON.parse(fs.readFileSync(OUT_JSON, "utf-8"));
    merged = prev.map((p) => (only.includes(p.id) ? results.find((r) => r.id === p.id) : p));
    for (const r of results) if (!prev.find((p) => p.id === r.id)) merged.push(r);
    merged.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  } else {
    merged = order.map((id) => results.find((r) => r.id === id));
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(merged, null, 1), "utf-8");
  console.log(`✓ scenes.json 已写 ${merged.length} 段`);
})();
