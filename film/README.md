# Clock In — demo film

`clock-in-demo.mp4` — 1:28, 1920x1080, H.264, AAC 48 kHz stereo.
`captions.srt` — the same captions as a sidecar, because judges often watch muted
and a burned-in caption survives a bad player.

## How it was built

The device footage is 280x640 — about 7% of 1080p. Upscaling that to fill a frame
is a 1.69x interpolation that cannot add detail, so the frame is composed instead:
the phone sits at 378x864 (a 1.35x scale, near native) inside a design whose type,
captions and beat labels are drawn at true 1920x1080 by Chromium. The sharp text is
the design; the footage is a window inside it.

Per-beat templates live in `frames.html`, rendered to PNG, and ffmpeg overlays the
footage at a fixed slot (1392,108).

## What is in the cut, and where it came from

| Beat | Source time in the device capture |
|---|---|
| 1 The claim | 84-98s — Today tab, streak 1, "4 transactions read, no local state consulted" |
| 2 The act | 96-116s — the ten-second hold, then "The act qualified" |
| 3 The seal | 159-168s (app offers the seal), 152.2s (Phantom's own approval sheet, held), 186-194s (2 days sealed, then the Record tab) |
| 4 The verifier | the standalone verifier's real output, run 2026-10-06 |
| 5 The limits | 195-203s — the Verify tab's "What it does not prove" |

## Two things a viewer should be told plainly

1. **The narration is a synthetic voice, and the film says so on screen.** The
   hackathon terms do not require it; this project's own rule does.
2. **There is no storage-wipe shot.** The script's Beat 4 called for clearing the
   app's storage on camera and having the verifier return the same days. That was
   not filmed, so the narration line was rewritten and the caption changed rather
   than asserting a wipe the pictures do not show. Shooting it upgrades this beat
   to the strongest one in the film.

## Excluded from the capture

The raw recording also contains the device home screen, Telegram's voice-recorder
UI, and a lock screen carrying a PIN pad over a personal photograph. None of that
is in the cut and none of it should be published.
