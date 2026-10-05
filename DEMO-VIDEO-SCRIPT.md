# Clock In — demo film shooting script

Companion to `DEMO-VIDEO-PLAN.md`. The plan says *what* the film must do and why.
This says *how*: every shot, every caption, every command, in the order you shoot
them. Nothing here is decided at record time.

**Product name:** Clock In
**Runtime:** 2:40 target, 3:00 hard ceiling
**Deliverable:** 1080p · H.264 · captions burned in · captions also kept as `.srt`

---

## 0. Pre-flight — do not start recording until every line is true

| Check | How | Why it matters |
|---|---|---|
| Wallet connected, **streak ≥ 1 day already sealed** | open the app, Today tab | Beat 1 needs a number that is real. A zero makes the whole film a claim about the future |
| Verifier returns **the same number** | `node verifier/verify.mjs <address>` | If these disagree, you have a bug and not a film. Find out now, not at 2:30 |
| **Do Not Disturb on** | Android quick settings | One WhatsApp banner in frame and the take is dead |
| Screen recorder **1080p, internal audio off** | phone's own recorder | Re-encode loses the "this is the device" credibility |
| Battery **> 50%** | — | Recording drains; a low-battery icon is a distraction |
| One full run-through **not recorded** | do the whole sequence once | The first attempt always has a fumble |

**Wallet address for beat 4 (fill in before shooting):**

```
3BdNH5bHn7qpe4MaW8vSM8MiQTr5cAenWKeYxBXGwMPR
```

---

## 1. Cut list

Beats 2 and 3 are **one continuous real-time take**. They are split at 1:05 only
so the caption timing is deterministic — do not cut inside the hold.

| # | In | Out | Source | On screen |
|---|---|---|---|---|
| **BEAT 1 — THE CLAIM** | | | | |
| 1 | 0:00 | 0:11 | device | **Record** tab. Sealed days listed. One slow thumb scroll, top to bottom. |
| 2 | 0:11 | 0:20 | device | **Today** tab. The streak number, legible. Hold still. Caption 1. |
| **BEAT 2 — THE ACT** | | | | |
| 3 | 0:20 | 0:23 | device | Tap **Record** → the hold screen, vessel empty. |
| 4 | 0:23 | 0:33 | device | **The hold. Ten seconds, real time, uncut.** Caption 2 in at 0:25. |
| 5 | 0:33 | 0:38 | device | Release. The seal begins. |
| **BEAT 3 — THE SEAL** | | | | |
| 6 | 0:38 | 1:05 | device | **The wallet's own approval sheet.** You approve it yourself. Caption 3 in at 0:40. |
| 7 | 1:05 | 1:20 | device | Transaction confirms. The sealed day appears in the Record list. |
| 8 | 1:20 | 1:45 | device | **Today.** The streak increments. One beat longer than feels comfortable. |
| **BEAT 4 — THE VERIFIER** | | | | |
| 9 | 1:45 | 1:57 | device | **Clear the app's storage.** Settings → Apps → Clock In → Storage → Clear storage. |
| 10 | 1:57 | 2:05 | device | Reopen the app. It shows **nothing**. No streak, no history. Caption 4 in at 1:59. |
| 11 | 2:05 | 2:25 | terminal | The verifier, run against the same wallet. Same number comes back. |
| **BEAT 5 — THE LIMITS** | | | | |
| 12 | 2:25 | 2:36 | device | **Verify** tab. Scroll to *"What it does not prove"*. Let it sit, readable. Caption 5. |
| 13 | 2:36 | 2:40 | still | End card: app name, repo URL. Nothing else. |

**Total: 2:40.**

### The one permitted cut

Between shot 5 and shot 6 the wallet app takes as long as it takes to launch. That
interval measures the wallet's latency, not the product, so **one cut is allowed
there**. It must not be used to imply the hold, the seal or the confirmation was
faster than it was. Every other join is a hard cut on real time.

---

## 2. Caption sheet — verbatim, do not reword at record time

These five lines are the film. Write them exactly; the timings are in the `.srt`.

| # | In | Out | Text |
|---|---|---|---|
| 1 | 0:12 | 0:20 | One round a day. The streak is read back from Solana, not from the app. |
| 2 | 0:25 | 0:36 | Ten seconds, held. No camera, no sensor, no witness. The app will tell you that itself. |
| 3 | 0:40 | 1:20 | A real devnet transaction. A commitment record, not an escrow — nothing here holds funds. |
| 4 | 1:59 | 2:25 | The app has been wiped. This standalone script read the chain and counted the same days. |
| 5 | 2:26 | 2:36 | The attestation is self-reported. The record says so on its own screen. |

`captions.srt`:

```
1
00:00:12,000 --> 00:00:20,000
One round a day. The streak is read back from Solana, not from the app.

2
00:00:25,000 --> 00:00:36,000
Ten seconds, held. No camera, no sensor, no witness. The app will tell you that itself.

3
00:00:40,000 --> 00:01:20,000
A real devnet transaction. A commitment record, not an escrow — nothing here holds funds.

4
00:01:59,000 --> 00:02:25,000
The app has been wiped. This standalone script read the chain and counted the same days.

5
00:02:26,000 --> 00:02:36,000
The attestation is self-reported. The record says so on its own screen.
```

**Caption 4 is the one that wins the video.** Every other submission will show
their app working. This one shows the app *forgetting* and the chain remembering.

---

## 3. Device captures — record these five clips, in this order

Record each as a separate file so a bad one is re-shot without redoing the day.
Name them exactly; the assembly script expects this.

| File | What it is | Notes |
|---|---|---|
| `raw/01-claim.mp4` | Record tab → Today tab | Do the tab switch on camera. One slow scroll, not a flick |
| `raw/02-act-and-seal.mp4` | shots 3–8, one continuous take | **The ten-second hold is inside this file.** Do not stop the recorder |
| `raw/03-wiped.mp4` | shots 9–10 | Recording starts *before* you open Settings |
| `raw/04-limits.mp4` | shot 12 | Include the scroll down to the section |

The terminal capture (`raw/05-verifier.mp4`) is section 4.

**If any clip is spoiled — a notification, a mistimed hold, a fumble — re-record
it.** Do not let the edit patch over it. This product's whole claim is that a
record should not be taken on trust, and a demo that hides a retake contradicts
it.

---

## 4. Terminal capture — the strongest 20 seconds in the film

Run this **with the phone's app wiped**, so the two halves of the beat are
causally linked:

```sh
node verifier/verify.mjs 3BdNH5bHn7qpe4MaW8vSM8MiQTr5cAenWKeYxBXGwMPR
```

Expected shape of the output — **the streak must match what the app showed in
shot 8**:

```
Clock In — on-chain record
==========================================================
wallet           3BdNH5bHn7qpe4MaW8vSM8MiQTr5cAenWKeYxBXGwMPR
rpc              https://api.devnet.solana.com
transactions     <n> scanned
valid seals      <n>
sealed days      <n>
current streak   <n> days
most recent      <date>

day sequence
  <date>  source=manual  <signature>…

continuous       yes, no gaps
```

Then **scroll the output slowly** past `day sequence` and `continuous`. That is
the verifier showing what it checked — not a claim that it checked.

Before recording, prove it works with no testnet dependency:

```sh
node verifier/verify.mjs --self-test
```

Useful flags if the public RPC rate-limits you mid-take:
`--rpc <url>` and `--limit <n>`.

---

## 5. Narration — one decision still open

The plan left this open and it is still open. **Captions carry the film either
way**, so shoot captions-first and treat voice as additive.

If there is a voice track, these are the lines — they are longer than the
captions on purpose, because a spoken line can hold detail a caption cannot:

| Beat | Line |
|---|---|
| 1 | This is Clock In. One round a day, and the streak you are looking at was not stored by this app. |
| 2 | Here is the whole act. Ten seconds, held. There is no camera, no sensor and no witness — and the app says so on its own limits screen. |
| 3 | Sealing writes one signed transaction to Solana devnet. It is a commitment record. Nothing here holds your funds and nothing here can move them. |
| 4 | Now delete the app's storage. It has nothing left. Run a script with no dependencies against the same wallet — and the same days come back, because they were never in the app. |
| 5 | What it cannot prove is that a body held a button. The record says that plainly. That is the point of it. |

**If the voice is synthetic, it gets labelled on screen.** This project has a rule
against presenting anything as what it is not, and an unlabelled synthetic
narrator would break it in the one place a judge might not notice.

---

## 6. Assembly — reproducible, not a one-off artifact

```sh
cd /root/smscaffold

# 1. normalise every clip to the same codec, size and framerate
for f in raw/0*.mp4; do
  ffmpeg -y -i "$f" -vf "scale=1080:-2,fps=30" -c:v libx264 -crf 18 -an "norm/$(basename "$f")"
done

# 2. join in cut-list order
printf "file '%s'\n" norm/01-claim.mp4 norm/02-act-and-seal.mp4 \
  norm/03-wiped.mp4 norm/05-verifier.mp4 norm/04-limits.mp4 > list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -c copy cut.mp4

# 3. burn the captions in AND keep the sidecar timings
ffmpeg -y -i cut.mp4 -vf "subtitles=captions.srt:force_style='FontSize=22,Outline=2'" \
  -c:v libx264 -crf 18 -c:a copy clock-in-demo.mp4

# 4. confirms it is 1080p, H.264, and under 3:00
ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration \
  -of default=noprint_wrappers=1 clock-in-demo.mp4
```

**Note the concat order.** `04-limits` is last even though it is named fourth —
the filenames follow shooting order, the edit follows the cut list. Getting this
wrong is the one mistake this script makes easy.

Ship **both** `clock-in-demo.mp4` (captions burned in) and `captions.srt` —
some judges watch muted, and a burned-in caption survives a bad player.

---

## 7. End card

Two lines, one frame, 4 seconds, on the app's own background colour:

```
Clock In
github.com/Zaygal/solana-mobile-scaffold
```

No logo animation. No music sting. It is the last thing a judge sees and it should
contain nothing that could be mistaken for a claim.
