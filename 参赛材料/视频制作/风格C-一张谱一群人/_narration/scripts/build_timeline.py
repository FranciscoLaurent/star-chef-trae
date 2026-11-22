# 拼整轨 voiceover.mp3（头部静音 + 段间 gap + 尾部静音）并生成 timeline.json
# 字幕行按标点切分（≤13 字），时间按字符占比在段内插值（无字级时间戳的诚实降级）
import json, subprocess, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
scenes = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
AUDIO = ROOT / "audio"
HEAD, GAP, TAIL = 0.8, 0.55, 1.4

# 1) 逐段 mp3 → wav(24k mono s16)，用 wave 模块拼接（规避 concat demuxer 中文路径问题）
import wave
SR = 24000

def mp3_to_frames(p: Path):
    wav_tmp = p.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", str(p),
                    "-ar", str(SR), "-ac", "1", "-sample_fmt", "s16", str(wav_tmp)], check=True)
    with wave.open(str(wav_tmp), "rb") as w:
        frames = w.readframes(w.getnframes())
    wav_tmp.unlink()
    return frames

def silence_frames(seconds):
    return b"\x00\x00" * int(SR * seconds)

pieces = [silence_frames(HEAD)]
for i, s in enumerate(scenes):
    pieces.append(mp3_to_frames(ROOT / s["audio"]))
    if i < len(scenes) - 1:
        pieces.append(silence_frames(GAP))
pieces.append(silence_frames(TAIL))
voiceover_wav = ROOT / "voiceover.wav"
with wave.open(str(voiceover_wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    for p in pieces:
        w.writeframes(p)
voiceover = ROOT / "voiceover.mp3"
subprocess.run(["ffmpeg", "-y", "-v", "quiet", "-i", str(voiceover_wav),
                "-c:a", "libmp3lame", "-b:a", "96k", str(voiceover)], check=True)
total = len(b"".join(pieces)) / 2 / SR
print(f"✓ voiceover.mp3 {total:.2f}s")

def split_lines(text, max_len=13):
    # 先按强标点切句，再按弱标点合并到 ≤max_len
    import re
    sentences = re.split(r"(?<=[。！？；])", text)
    lines = []
    for sent in [s for s in sentences if s.strip()]:
        if len(sent) <= max_len:
            lines.append(sent.strip())
            continue
        parts = re.split(r"(?<=[，、：——])", sent)
        buf = ""
        for p in [x for x in parts if x.strip()]:
            if buf and len(buf + p) > max_len:
                lines.append(buf.strip()); buf = p
            else:
                buf += p
        if buf.strip(): lines.append(buf.strip())
    return lines

# 3) timeline.json
cursor = HEAD
tl_scenes = []
for s in scenes:
    d = s["duration"]
    text = s["text"]
    lines = split_lines(text)
    total_chars = sum(len(l) for l in lines) or 1
    chunks, t = [], 0.0
    for l in lines:
        cd = d * len(l) / total_chars
        chunks.append({"text": l, "start": round(t, 3), "end": round(t + cd, 3),
                       "absoluteStart": round(cursor + t, 3), "absoluteEnd": round(cursor + t + cd, 3)})
        t += cd
    cues = []
    for c in s.get("cues", []):
        off = d * min(c["charOffset"], len(text)) / (len(text) or 1)
        cues.append({"id": c["id"], "offset": round(off, 3), "absoluteTime": round(cursor + off, 3)})
    tl_scenes.append({"id": s["id"], "start": round(cursor, 3), "end": round(cursor + d, 3),
                      "duration": round(d, 3), "audio": f"audio/{s['id']}.mp3",
                      "text": text, "chunks": chunks, "cues": cues})
    cursor += d + GAP

timeline = {"title": "星厨传承 · 参赛演示片", "voice": "edge-tts zh-CN-XiaoxiaoNeural",
            "speed": 1.0, "gap": GAP, "totalDuration": round(total, 3),
            "voiceover": "voiceover.mp3", "scenes": tl_scenes}
(ROOT / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"✓ timeline.json：{len(tl_scenes)} 段，末段结束 {tl_scenes[-1]['end']:.1f}s，整轨 {total:.1f}s")
for s in tl_scenes:
    print(f"  {s['id']:<12} {s['start']:>6.1f} → {s['end']:>6.1f}  cues: {[c['id'] for c in s['cues']]}")
