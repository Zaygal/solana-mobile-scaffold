# Clock In — demo video plan

This is the plan, written before anything is recorded. It exists so that the
recording session is mechanical: every clip has a stated purpose, a stated
length, and a stated reason for being in the film. Nothing here is shot to "see
what it looks like".

## What the video has to do

The rubric scores **Presentation & Demo Quality at 25%**. But the video is doing
a second job that matters more: this product's entire claim is that a record can
be trusted without trusting the app, so a demo that overstates itself would
contradict the product. **The film has to be as honest as the record.**

That gives one governing rule, and it resolves most arguments in advance:

> **Show the thing, do not illustrate it.** Every second on screen is either the
> real software doing the real thing, or a caption. No animation stands in for
> evidence.

## Runtime

**Target 2:40, hard ceiling 3:00.** Long enough to show five beats properly,
short enough that a judge watches to the end. Given the choice between cutting a
beat and speeding a clip up, cut the beat.

## The five beats

### 1. The claim — 0:00 to 0:20

Open on the phone, already on **Record**, with the sealed days listed. Not a logo.
Not a title card. The first thing a judge sees is the product's output.

Caption: *"One round a day. The streak is read back from Solana, not from the app."*

Then hold on that screen a beat longer than feels comfortable, so the streak is
legible. This is the whole product in one image, and it costs twenty seconds to
establish it before anything is explained.

### 2. The act — 0:20 to 1:05

The hold, in **real time**. Ten seconds is ten seconds of video.

- The vessel filling bottom-up. The per-second haptic ticks are invisible on
  video, so the caption says they happen rather than implying them.
- **Do not speed this up and do not cut around it.** A hold is a measurement.
  Showing it compressed would be the video lying about the product in exactly the
  way the product refuses to lie about a record.
- The streak after sealing: `1` becomes `2`. Real time, no cut.

Caption during the hold: *"Ten seconds, held. No camera, no sensor, no witness.
The app will tell you that itself."*

### 3. The seal — 1:05 to 1:45

The only beat with anything resembling a flourish, and it is a real one: the
wallet approval sheet, then the transaction, then the day appearing in the list.

- Show the **wallet's** approval screen, not a cropped-out transaction. The
  integration is the point.
- Open the transaction in the explorer from the day detail sheet. Devnet. The
  cluster is stated in the caption, because a demo that hides which network it is
  on is a demo inviting the wrong conclusion.

Caption: *"The seal is a real devnet transaction. It is a commitment record, not
an escrow — no funds are held by anything here."*

### 4. The verifier — 1:45 to 2:25

**The strongest beat in the film.** This is the one competitors will not have.

Split or cut to a plain terminal, **with the app closed**:

```
$ node verifier/verify.mjs <wallet address>
```

The verifier re-derives the streak from chain history alone and prints it. Same
number as the app showed. Then scroll the verifier's own output showing what it
checked and what it could not.

Caption: *"The app is closed. This is a standalone script with no dependencies.
It read the chain and counted the same days."*

This beat is the product's differentiator being demonstrated rather than claimed,
which is the difference between a feature list and a proof.

### 5. The limits — 2:25 to 2:40

Stay on the phone, on the **Verify** tab, at the *"What it does not prove"*
section. Let it sit on screen and be readable.

Caption: *"The attestation is self-reported. Nothing on-chain observes the body.
The record says so on its own screen."*

Then one closing frame — the repo URL and the app name. Nothing else.

## Why the limits get screen time

Every other submission will end on the product's strongest claim. Ending on its
stated limits is deliberate. The thesis accepted for this project is that it is a
**craft and credibility play, not an invention play**, and a judge who has watched
a demo make an unqualified claim will discount everything before it. The limits
section is not a disclaimer to be tolerated. It is the pitch.

## What is forbidden, by standing instruction

Verbatim from the constraints on this project:

- generic Web3 visuals
- glowing blockchain graphics
- stock footage
- generic AI-generated "futuristic" scenes
- endless terminal shots
- template transitions
- a slideshow of screenshots
- text-heavy explanations
- the usual hackathon montage

Nothing on that list is in this plan, and anything added later has to displace
something that is, rather than being added on top.

## Assets required

1. **Three screen recordings from the device**, real time, no editing inside them:
   - the hold, complete, start to seal
   - the wallet approval sheet appearing
   - the sealed day opening in the explorer
2. **One terminal capture** — the verifier run, with the app closed.
3. **Caption text** — the lines above, finalised before recording so no clip is
   shot twice for wording.
4. **Music**, or deliberately none. Not a template hackathon build.

## The step only you can take

Every frame that shows the device is your hand, your phone, your wallet. I will
not stage that, and the standing rule on this project forbids me from fabricating
human participation in any form. Concretely:

- Record with the phone's own screen recorder so the footage is the device's
  output, not a re-encode.
- On the approval sheet, approve it yourself. I am not present for that and will
  not pretend to be.
- If a clip fails — a mistimed hold, a notification — re-record it. Do not let me
  patch over it in editing, because that would be the film making a claim about
  the product that the product did not make.

Everything after the raw clips — trimming, captions, the assembly, the export — is
mine.

## Narration: one open decision

The brief from 2 October said: pitch video in your voice, demo video with **no
voice, captions only**. When asked directly just now, you said **"Your voice but
write out all plan first."**

Those point in different directions — "your voice" could mean yours over the demo,
or a synthetic read of it. I am not guessing, so:

- The plan is built **captions-first**, which is correct and complete either way.
- Nothing in the five beats depends on narration. The captions carry it.
- Adding a voice track afterwards is additive, not a rebuild.

Tell me which it is and I will add it in one pass. If it is a synthetic voice, I
would label it as one on screen, because this project has a rule against
presenting anything as what it is not, and an unlabelled synthetic narrator is
that rule being broken in the one place a judge might not notice.

## Assembly

- **ffmpeg** for the edit, captions burned in. No editor dependency, no licence
  question, reproducible from a script.
- The script lives in the repo beside the verifier, so the video can be rebuilt
  from the raw clips rather than being a one-off artifact nobody can regenerate.
- Export: 1080p, H.264, captions burned in **and** the timings kept, because some
  judges watch muted.
