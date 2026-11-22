#!/bin/bash
# 成片混音（风格B）：无声 MP4 + 解说 + BGM(垫底) + 4 处 SFX → 最终 MP4
# 用法: bash mix_final.sh <无声视频.mp4> <输出.mp4>
# 时长与 SFX 打点来自 _narration/timeline.json 实测（voiceover 110.756s，整轨 110.8s）
set -e
HD="C:/Users/吴凌睿/.agents/skills/huashu-design"
VIDEO="${1:?需要无声视频路径}"
OUT="${2:-成片.mp4}"
DUR=110.76          # timeline.json totalDuration（实测）

ffmpeg -y -v warning -i "$VIDEO" \
  -i "_narration/voiceover.mp3" \
  -i "$HD/assets/bgm-educational.mp3" \
  -i "$HD/assets/sfx/impact/brand-stamp.mp3" \
  -i "$HD/assets/sfx/transition/whoosh-fast.mp3" \
  -i "$HD/assets/sfx/ui/click.mp3" \
  -i "$HD/assets/sfx/feedback/success-chime.mp3" \
  -filter_complex "\
[1:a]aresample=44100,volume=0.92[v];\
[2:a]atrim=0:${DUR},volume=0.10,afade=t=in:st=0:d=2,afade=t=out:st=106.76:d=4[b];\
[3:a]adelay=16180|16180,volume=0.50[st];\
[4:a]adelay=21800|21800,volume=0.35[wh];\
[5:a]adelay=54400|54400,volume=0.55[cl];\
[6:a]adelay=104730|104730,volume=0.42[ch];\
[v][b][st][wh][cl][ch]amix=inputs=6:duration=first:normalize=0,alimiter=limit=0.95[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"

echo "✓ 成片: $OUT"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT"
ffprobe -v quiet -select_streams a -show_entries stream=codec_name -of csv=p=0 "$OUT"
