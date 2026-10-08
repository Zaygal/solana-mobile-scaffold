#!/usr/bin/env bash
set -euo pipefail

SRC="film/clock-in-demo.mp4"
OUT="film/clock-in-demo-v2.mp4"
SRT="film/clock-in-demo-v2.srt"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The existing film README documents these exact raw-capture windows:
# Today 84-98, hold 96-116, seal/wallet 152.2-168, sealed state 186-194,
# verifier 54-70, limits 195-203.
#
# We deliberately use the real recorded footage from those windows. No UI is
# generated or simulated. The edit is muted because the raw capture audio is
# not the narration track; the new sidecar captions carry the story.

ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -an -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "$WORK/full.mp4"

# Extract real source windows, then add a restrained evidence label.
ffmpeg -hide_banner -loglevel error -y -ss 84 -t 8 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='CLOCK IN  /  TODAY':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/01.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 96 -t 18 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='THE ACT  /  10 SECOND HOLD':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/02.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 152.2 -t 15.8 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='SEAL  /  MOBILE WALLET ADAPTER':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/03.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 186 -t 8 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='ON CHAIN  /  SIGNED RECORD':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/04.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 54 -t 16 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='INDEPENDENT CHECK  /  VERIFIER':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/05.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 195 -t 8 -i "$WORK/full.mp4" \
  -vf "drawbox=x=48:y=44:w=1824:h=992:color=white@0.16:t=2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='LIMITS  /  SELF-REPORTED ACTION':fontcolor=white:fontsize=34:x=76:y=72:borderw=2:bordercolor=black@0.45" \
  -an -c:v libx264 -preset veryfast -crf 18 "$WORK/06.mp4"

cat > "$WORK/list.txt" <<EOF
file '$WORK/01.mp4'
file '$WORK/02.mp4'
file '$WORK/03.mp4'
file '$WORK/04.mp4'
file '$WORK/05.mp4'
file '$WORK/06.mp4'
EOF

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$WORK/list.txt" \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -movflags +faststart "$OUT"

cat > "$SRT" <<'EOF'
1
00:00:00,000 --> 00:00:08,000
Clock In records one round a day directly on Solana.

2
00:00:08,000 --> 00:00:26,000
The round qualifies after a ten-second hold.

3
00:00:26,000 --> 00:00:41,800
Sealing asks the wallet to approve a real devnet transaction.

4
00:00:41,800 --> 00:00:49,800
The record is a signed memo, not an escrow or transfer.

5
00:00:49,800 --> 00:01:05,800
The streak can be checked independently from the chain.

6
00:01:05,800 --> 00:01:13,800
The important limit: the physical action is self-reported.
EOF

ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of default=noprint_wrappers=1 "$OUT"
