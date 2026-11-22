#!/bin/bash
# 成片混音：无声 MP4 + 解说 + BGM(垫底) + 4 处 SFX → 最终 MP4
# 用法: bash mix_final.sh <无声视频.mp4> <输出.mp4>
set -e
HD="C:/Users/吴凌睿/.agents/skills/huashu-design"
VIDEO="${1:?需要无声视频路径}"
OUT="${2:-成片.mp4}"
DUR=107.6

ffmpeg -y -v warning -i "$VIDEO" \
  -i "_narration/voiceover.mp3" \
  -i "$HD/assets/bgm-educational.mp3" \
  -i "$HD/assets/sfx/ui/click.mp3" \
  -i "$HD/assets/sfx/keyboard/type-fast.mp3" \
  -i "$HD/assets/sfx/keyboard/type-fast.mp3" \
  -i "$HD/assets/sfx/magic/transform.mp3" \
  -i "$HD/assets/sfx/feedback/success-chime.mp3" \
  -filter_complex "\
[1:a]aresample=44100,volume=0.92[v];\
[2:a]atrim=0:${DUR},volume=0.10,afade=t=in:st=0:d=2,afade=t=out:st=103.5:d=4[b];\
[3:a]adelay=51350|51350,volume=0.55[c];\
[4:a]adelay=71900|71900,volume=0.30[k1];\
[5:a]adelay=73400|73400,volume=0.26[k2];\
[6:a]adelay=74600|74600,volume=0.40[t];\
[7:a]adelay=103155|103155,volume=0.42[ch];\
[v][b][c][k1][k2][t][ch]amix=inputs=7:duration=first:normalize=0,alimiter=limit=0.95[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"

echo "✓ 成片: $OUT"
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT"
ffprobe -v quiet -select_streams a -show_entries stream=codec_name -of csv=p=0 "$OUT"
