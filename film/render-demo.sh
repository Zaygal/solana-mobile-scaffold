#!/usr/bin/env bash
set -euo pipefail

SRC="film/clock-in-demo.mp4"
OUT="film/clock-in-demo-v2.mp4"
BURNED="film/clock-in-demo-v2-captioned.mp4"
SRT="film/clock-in-demo-v2.srt"

# The existing Clock In film is already the real 1:28 product recording. Its
# README documents the five beats and the evidence used in each. This v2 is a
# director's cut of that real film: no generated UI, no synthetic wallet screen,
# no invented transaction. We keep the original audio and footage and add only
# restrained beat labels and a clean captioned export.

cat > "$SRT" <<'EOF'
1
00:00:01,000 --> 00:00:13,500
One round a day. The streak is read back from Solana, not from the app.

2
00:00:14,500 --> 00:00:33,500
No camera, no sensor, no witness - and the app says so on its own limits screen.

3
00:00:34,500 --> 00:00:53,000
A real devnet transaction. A commitment record, not an escrow - nothing here holds funds.

4
00:00:54,000 --> 00:01:11,000
This verifier reads the same record from the chain alone. It never reads the app.

5
00:01:12,000 --> 00:01:27,000
The attestation is self-reported. The record says so on its own screen.
EOF

LABELS="drawbox=x=28:y=28:w=1864:h=1024:color=white@0.14:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='DEVNET':fontcolor=white@0.78:fontsize=24:x=1810:y=62:borderw=2:bordercolor=black@0.35,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE CLAIM':fontcolor=white:fontsize=30:x=62:y=58:borderw=2:bordercolor=black@0.45:enable='between(t,0,14.5)',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE ACT':fontcolor=white:fontsize=30:x=62:y=58:borderw=2:bordercolor=black@0.45:enable='between(t,14.5,34.5)',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE SEAL':fontcolor=white:fontsize=30:x=62:y=58:borderw=2:bordercolor=black@0.45:enable='between(t,34.5,54)',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE VERIFIER':fontcolor=white:fontsize=30:x=62:y=58:borderw=2:bordercolor=black@0.45:enable='between(t,54,72)',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE LIMITS':fontcolor=white:fontsize=30:x=62:y=58:borderw=2:bordercolor=black@0.45:enable='between(t,72,88)'"

ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -vf "$LABELS" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -movflags +faststart "$OUT"

ffmpeg -hide_banner -loglevel error -y -i "$OUT" \
  -vf "subtitles=$SRT:force_style='FontName=DejaVu Sans,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=64'" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy \
  -movflags +faststart "$BURNED"

echo "=== clean ==="
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of default=noprint_wrappers=1 "$OUT"
echo "=== captioned ==="
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of default=noprint_wrappers=1 "$BURNED"
