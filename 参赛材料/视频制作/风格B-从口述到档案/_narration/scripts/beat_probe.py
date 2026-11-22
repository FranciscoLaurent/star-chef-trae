# 节拍探针：在词级时间戳里搜短语，输出绝对秒（用于 HTML 里画面动效与旁白逐字对齐）
# 用法: python beat_probe.py "s01-hook:三十年刀工,文思豆腐" "s05-lineage:史正良" ...
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
scenes = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
HEAD, GAP = 0.8, 0.55
PUNCT = "，。！？；：、——…·「」『』（）()《》 \u3000,.!?;:"

def strip_punct(s):
    return "".join(c for c in s if c not in PUNCT)

def build_index(scene):
    """拼接去标点文本 + 每个字符的绝对时间（词内线性插值）。"""
    cursor = HEAD
    for s in scenes:
        if s["id"] == scene:
            break
        cursor += s["duration"] + GAP
    chars, times = [], []
    for w in scene_words(scene):
        txt = strip_punct(w["text"])
        n = len(txt)
        for i, ch in enumerate(txt):
            frac = (i + 0.5) / max(n, 1)
            chars.append(ch)
            times.append(cursor + w["start"] + frac * (w["end"] - w["start"]))
    return "".join(chars), times

_cache = {}
def scene_words(sid):
    if sid not in _cache:
        for s in scenes:
            if s["id"] == sid:
                _cache[sid] = s.get("words") or []
    return _cache[sid]

for arg in sys.argv[1:]:
    sid, _, phrases = arg.partition(":")
    text, times = build_index(sid)
    for ph in [p for p in phrases.split(",") if p]:
        ps = strip_punct(ph)
        idx = text.find(ps)
        if idx < 0:
            print(f"{sid}  ✗ 未找到「{ph}」")
            continue
        print(f"{sid}  「{ph}」 → {times[idx]:.3f}s  (ctx …{text[max(0,idx-4):idx+len(ps)+4]}…)")
