# 逐段解说稿 TTS：edge-tts 合成 mp3 + 字级时间戳
# 输入：script.md（## scene-id 段 + [[cue:xx]] 标记）
# 输出：_narration/audio/<id>.mp3 + _narration/scenes.json（每段文本/字级时间戳/实测时长）
import asyncio, json, re, subprocess, sys
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
AUDIO.mkdir(exist_ok=True)
SCRIPT = ROOT.parent / "script.md"
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-6%"   # 略慢：庄重可信
OUT = ROOT / "scenes.json"

def parse_script(p: Path):
    scenes, cur = [], None
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            if cur: scenes.append(cur)
            cur = {"id": line[3:].strip(), "raw": ""}
        elif cur is not None:
            cur["raw"] += line.strip()
    if cur: scenes.append(cur)
    for s in scenes:
        cues = re.findall(r"\[\[cue:([\w-]+)\]\]", s["raw"])
        text = re.sub(r"\[\[cue:[\w-]+\]\]", "", s["raw"]).strip()
        # cue 在被删掉的标记位置之后触发；改为记录「cue 前的字符数」用于按比例定位
        marks = [(m.start(1), m.group(1)) for m in re.finditer(r"\[\[cue:([\w-]+)\]\]", s["raw"])]
        plain = re.sub(r"\[\[cue:[\w-]+\]\]", "", s["raw"])
        # 计算每个 cue 在纯文本中的字符偏移（标记前保留的部分长度）
        offsets = []
        pos = 0
        for raw_pos, name in marks:
            before = re.sub(r"\[\[cue:[\w-]+\]\]", "", s["raw"][:raw_pos])
            offsets.append({"id": name, "charOffset": len(before)})
        s.update({"text": text, "cues": offsets})
    return scenes

async def synth(scene):
    mp3 = AUDIO / f"{scene['id']}.mp3"
    words = []
    for attempt in range(14):  # 端点间歇性抽风：耐心重试（实测网络以分钟级窗口恢复）
        try:
            comm = edge_tts.Communicate(scene["text"], VOICE, rate=RATE,
                                        boundary="WordBoundary")  # v7 默认 SentenceBoundary，词级时间戳必须显式指定
            words = []
            async def _stream():
                with open(mp3, "wb") as f:
                    async for chunk in comm.stream():
                        if chunk["type"] == "audio":
                            f.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            words.append({
                                "text": chunk["text"],
                                "start": chunk["offset"] / 1e7,       # 100ns → s
                                "end": (chunk["offset"] + chunk["duration"]) / 1e7,
                            })
            await asyncio.wait_for(_stream(), timeout=100)  # 单次尝试硬超时，防悬挂
            if mp3.stat().st_size < 10000:
                raise IOError("mp3 too small")
            break
        except Exception as e:
            print(f"  retry {attempt+1} {scene['id']}: {type(e).__name__}", flush=True)
            await asyncio.sleep(min(4 + attempt * 3, 30))
    else:
        raise RuntimeError(f"{scene['id']} TTS failed after retries")
    # 实测时长
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3)], capture_output=True, text=True)
    dur = float(probe.stdout.strip())
    scene.update({"audio": f"audio/{scene['id']}.mp3", "duration": dur, "words": words})
    print(f"✓ {scene['id']}: {dur:.2f}s · {len(scene['text'])} 字 · {len(words)} 词块")
    return scene

ALL_SCENES = parse_script(SCRIPT)
scenes = ALL_SCENES if len(sys.argv) == 1 else [s for s in ALL_SCENES if s["id"] in set(sys.argv[1:])]
async def main():
    # 串行合成（并发会触发 edge 超时）；已成功的段落直接跳过；逐段落盘，中断可续跑
    done_ids = []
    if OUT.exists():
        for old in json.loads(OUT.read_text(encoding="utf-8")):
            if (AUDIO / f"{old['id']}.mp3").exists() and old.get("words"):
                done_ids.append(old)  # 缓存且带词级时间戳 → 直接复用
    results = {s["id"]: s for s in done_ids}
    for s in scenes:
        if s["id"] in results:
            print(f"· skip {s['id']}（缓存+词块）", flush=True)
            continue
        if (AUDIO / f"{s['id']}.mp3").exists() and (AUDIO / f"{s['id']}.mp3").stat().st_size > 10000:
            results[s["id"]] = await synth_skip(s)   # 有音频但缺词块 → 会在 synth_skip 里尝试补
        else:
            results[s["id"]] = await synth(s)
        await asyncio.sleep(0.4)
        # 逐段落盘（按 script.md 顺序）
        ordered = [results[x["id"]] for x in scenes if x["id"] in results]
        OUT.write_text(json.dumps(ordered, ensure_ascii=False, indent=1), encoding="utf-8")
    return [results[x["id"]] for x in scenes]

async def synth_skip(scene):
    mp3 = AUDIO / f"{scene['id']}.mp3"
    words = scene.get("words", [])
    if not words and OUT.exists():  # 缓存段从旧 scenes.json 补词级时间戳
        for old in json.loads(OUT.read_text(encoding="utf-8")):
            if old["id"] == scene["id"]:
                words = old.get("words", [])
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3)], capture_output=True, text=True)
    dur = float(probe.stdout.strip())
    scene.update({"audio": f"audio/{scene['id']}.mp3", "duration": dur, "words": words})
    print(f"✓ {scene['id']}: {dur:.2f}s（缓存，{len(words)} 词块）")
    return scene
results = asyncio.run(main())
# 合并写回：绝不因部分运行丢掉其他段（旧条目按 id 合并，新结果优先）
merged = {}
if OUT.exists():
    for old in json.loads(OUT.read_text(encoding="utf-8")):
        merged[old["id"]] = old
for r in results:
    merged[r["id"]] = r
ordered = sorted(merged.values(), key=lambda s: [x["id"] for x in ALL_SCENES].index(s["id"]))
OUT.write_text(json.dumps(ordered, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"✓ scenes.json 已写 {len(ordered)} 段")
