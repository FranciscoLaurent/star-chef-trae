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
    for attempt in range(6):  # 串行+重试：并发连 edge 容易超时
        try:
            comm = edge_tts.Communicate(scene["text"], VOICE, rate=RATE,
                                        boundary="WordBoundary")  # v7 默认 SentenceBoundary，词级时间戳必须显式指定
            words = []
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
            break
        except Exception as e:
            print(f"  retry {attempt+1} {scene['id']}: {type(e).__name__}")
            await asyncio.sleep(2 + attempt * 3)
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

scenes = parse_script(SCRIPT)
if len(sys.argv) > 1:  # 只跑指定段
    ids = set(sys.argv[1:])
    scenes = [s for s in scenes if s["id"] in ids]
async def main():
    # 串行合成（并发会触发 edge 超时）；已成功的段落直接跳过
    done = []
    for s in scenes:
        if (AUDIO / f"{s['id']}.mp3").exists() and (AUDIO / f"{s['id']}.mp3").stat().st_size > 10000:
            print(f"· skip {s['id']}（已有缓存）")
            done.append(await synth_skip(s))
            continue
        done.append(await synth(s))
        await asyncio.sleep(0.4)
    return done

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
results = sorted(results, key=lambda s: [x["id"] for x in parse_script(SCRIPT)].index(s["id"]))
OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"✓ scenes.json 已写 {len(results)} 段")
