# 拼整轨 voiceover.mp3（头部静音 + 段间 gap + 尾部静音）并生成 timeline.json + timeline_inline.js
# 关键改造（风格B）：
#   1) cue 绝对时间用 edge-tts 词级时间戳实测（字符插值），不再按字数比例估
#   2) chunks 在 Python 侧按实测时长切好（规避主版 HTML 里 s.duration 缺失 → NaN 的坑）
#   3) BEATS：画面动效短语锚点（如「史正良」「七十五分」）实测成绝对秒，写进 timeline_inline.js
#   4) 长音频拼接用 wave 模块（ffmpeg concat demuxer 中文路径只输出头部静音——主版踩坑）
import json, subprocess, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
scenes = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
AUDIO = ROOT / "audio"
HEAD, GAP, TAIL = 0.8, 0.55, 1.4

PUNCT = "，。！？；：、——…·「」『』（）()《》 \u3000,.!?;:"

def strip_punct(s):
    return "".join(c for c in s if c not in PUNCT)

def word_time_at(scene, char_pos_stripped):
    """在词级时间戳里把「去标点字符偏移」映射到秒；字符级线性插值。"""
    words = scene.get("words") or []
    if not words:
        return None
    cum = 0
    for w in words:
        wl = len(strip_punct(w["text"]))
        if wl == 0:
            continue
        if char_pos_stripped <= cum + wl:
            frac = (char_pos_stripped - cum) / wl
            return w["start"] + frac * (w["end"] - w["start"])
        cum += wl
    return words[-1]["end"]

# 画面动效短语锚点：场景 id → [(beat名, 短语)]，全部按去标点子串搜索首个命中
BEAT_PHRASES = {
    "s01-hook":      [("wave", "说起手艺"), ("chunk1", "三十年刀工"), ("chunk2", "文思豆腐"), ("chunk3", "二十多个徒弟")],
    "s02-problem":   [("pen", "笔尖悬在纸上"), ("big1", "他的手艺"), ("big2", "简历装不下")],
    "s03-turn":      [("flow", "一条条变成"), ("slogan", "会说话")],
    "s04-card":      [("f1", "五十五岁"), ("f2", "淮扬菜"), ("f3", "扬州"), ("f4", "三十年"), ("f5", "二十多个徒弟"), ("seal", "只提取")],
    "s05-lineage":   [("c1", "一千二百三十八"), ("c2", "二百六十二条"), ("chain1", "史正良"), ("chain2", "门下十八人")],
    "s06-source":    [("card", "每条师承"), ("go", "评委查得到")],
    "s07-jobs":      [("bar1", "菜系"), ("bar2", "师门"), ("bar3", "地域"), ("bar4", "薪资"), ("roll", "七十五分"), ("note", "拆开看")],
    "s08-community": [("circles", "按菜系成圈"), ("post1", "师傅招徒"), ("post2", "学徒拜师"), ("post3", "同行切磋")],
    "s09-vision":    [("v1", "木匠"), ("v2", "绣娘"), ("v3", "理发师"), ("tagline", "被看见")],
    "s10-merge":     [("s1", "一千二百三十八"), ("s2", "八百五十三"), ("s3", "二百六十二条"), ("punch", "口说")],
    "s11-end":       [("mark", "星厨传承"), ("tag", "让手艺有出处")],
}

def find_beat(scene, phrase):
    text = scene["text"]
    stripped = strip_punct(text)
    ps = strip_punct(phrase)
    idx = stripped.find(ps)
    if idx < 0:
        raise RuntimeError(f"beat phrase 「{phrase}」 not found in {scene['id']}")
    return word_time_at(scene, idx)

# 1) 逐段 mp3 → wav(24k mono s16)，wave 模块拼接
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

# 2) timeline.json + timeline_inline.js
cursor = HEAD
tl_scenes, inline_scenes = [], []
for s in scenes:
    d = s["duration"]
    text = s["text"]
    stripped = strip_punct(text)
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
        raw_pos = min(c["charOffset"], len(text))
        stripped_pos = len(strip_punct(text[:raw_pos]))
        wt = word_time_at(s, stripped_pos)
        off = wt if wt is not None else d * stripped_pos / (len(stripped) or 1)
        cues.append({"id": c["id"], "offset": round(off, 3), "absoluteTime": round(cursor + off, 3),
                     "measured": wt is not None})
    beats = {}
    for name, ph in BEAT_PHRASES.get(s["id"], []):
        bt = find_beat(s, ph)
        beats[name] = round(cursor + bt, 3)
    tl_scenes.append({"id": s["id"], "start": round(cursor, 3), "end": round(cursor + d, 3),
                      "duration": round(d, 3), "audio": f"audio/{s['id']}.mp3",
                      "text": text, "chunks": chunks, "cues": cues})
    inline_scenes.append({"id": s["id"], "start": round(cursor, 3), "end": round(cursor + d, 3),
                          "duration": round(d, 3), "text": text, "chunks": chunks,
                          "cues": {c["id"]: c["absoluteTime"] for c in cues},
                          "beats": beats})
    cursor += d + GAP

timeline = {"title": "星厨传承 · 参赛演示片（风格B · 从口述到档案）", "voice": "edge-tts zh-CN-XiaoxiaoNeural",
            "speed": 1.0, "gap": GAP, "totalDuration": round(total, 3),
            "voiceover": "voiceover.mp3", "scenes": tl_scenes}
(ROOT / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")

inline = {"title": timeline["title"], "totalDuration": timeline["totalDuration"],
          "voiceover": "voiceover.mp3", "scenes": inline_scenes}
(ROOT / "timeline_inline.js").write_text(
    "// 由 build_timeline.py 自动生成（实测时间，勿手改）\nwindow.__TL = " +
    json.dumps(inline, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")

print(f"✓ timeline.json + timeline_inline.js：{len(tl_scenes)} 段，末段结束 {tl_scenes[-1]['end']:.2f}s，整轨 {total:.1f}s")
for s in tl_scenes:
    tags = [f"{c['id']}@{c['absoluteTime']:.2f}{'' if c['measured'] else '~'}" for c in s["cues"]]
    beats = inline_scenes[[x["id"] for x in inline_scenes].index(s["id"])]["beats"]
    btags = [f"{k}@{v:.2f}" for k, v in beats.items()]
    print(f"  {s['id']:<14} {s['start']:>6.2f} → {s['end']:>6.2f}")
    print(f"      cues : {tags}")
    print(f"      beats: {btags}")
