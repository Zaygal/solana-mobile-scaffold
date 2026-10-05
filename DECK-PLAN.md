# Clock In — pitch deck plan

Companion to `DEMO-VIDEO-SCRIPT.md`. That film shows the product working. This
deck has to do something the film cannot: state what we chose **not** to build,
and why that is the craft.

**Format:** 16:9, 1920×1080. Exported as PDF **and** PNG per slide.
**Length:** 10 slides. Read in ~3 minutes.
**Built:** HTML → Chromium render → PNG/PDF. No local installs, same as the meme
and the motion plan. A judge opening a deck built with the same toolchain as the
app is seeing one consistent thing.

---

## The one rule

**Every number on these slides must be checkable in the repository or on chain.**

No market-size figure. No "millions of users". No growth projection. The product's
entire proposition is that a claim you cannot check is worth nothing, and a deck
that opens with an unverifiable number has already lost the argument it is about
to make.

`VERIFIED` / `INFERRED` / `UNPROVEN` are the vocabulary. Where something is a
hypothesis, the slide says hypothesis.

---

## Slide 1 — Title

**Clock In**

> A daily record you can check, not one you have to trust.

Repo URL. One line of what it is: a Solana Mobile app that turns a daily act into
an on-chain record, and ships a second tool that reads that record without
trusting the first.

**No logo animation. No tagline stack.**

---

## Slide 2 — The problem, stated as the thing a judge already knows

> Every habit app tells you your own streak. That is the app's word, and the app
> is the only witness.

Then the consequence, one line: a record whose only custodian is the thing being
recorded is a claim, not evidence. Delete the app and the streak is gone — which
tells you where it lived.

**Keep it to two sentences.** This is the whole setup.

---

## Slide 3 — The act

One round a day. Held for ten seconds. Released.

> There is no camera, no sensor and no witness. The app will tell you that itself.

Visual: the hold screen, cold vessel, mid-hold. Caption carries the ten seconds.

**This is the slide that answers "what is it" in one image.**

---

## Slide 4 — What actually happens on chain

The canonical encoding, verbatim:

```
clock1|<roundId>|<act>|<durMs>|<peakMilli>|<source>|<version>
```

One signed transaction per sealed day. `source` records which mechanism produced
the observation — and a self-reported one stays self-reported.

Visual: a real devnet transaction. **Use the full signature from the explorer, not
a truncated one** — a shortened hash on a slide looks like a placeholder and a
judge may read it as one.

**Full signature, already recovered** (devnet, sealed day 2026-10-05):

```
2s3LKgk2GqjmqTJMgh4G6JMGBGCk5s3ptQGrhczgnkQ33m27678qTxyTXfz8RaJeK4rNvzNJrgXCw4hhhM7AbXvh
```

Fetched from `getSignaturesForAddress` on the wallet, matched on the block time
the verifier reports. Note the verifier itself truncates signatures at 20
characters when printing, which is why this had to come from the RPC.

---

## Slide 5 — The verifier

> The app is not the evidence. This is.

```
node verifier/verify.mjs 3BdNH5bHn7qpe4MaW8vSM8MiQTr5cAenWKeYxBXGwMPR
```

Real output, quoted, not paraphrased: transactions scanned, valid seals, sealed
days, current streak, day sequence, continuous.

Then the sentence that carries the whole submission:

> Delete the app's storage and the record survives, because the record was never
> in the app.

Visual: the terminal output, legible, unedited.

---

## Slide 6 — What it does not prove

**This is the strongest slide in the deck and it should look like a confession,
not a disclaimer.**

> The attestation is self-reported. The record says so on its own screen.

Three lines, from the app's own limits screen: it does not prove a physical act
happened; `source` records the mechanism, not the truth of the observation; and it
does not prove the RPC answered honestly — point it at another node and compare.

**Almost nobody ships a slide like this.** It is the differentiator made visible,
and it is also literally true.

---

## Slide 7 — Why this is an app and not a website in a shell

Four destinations — Today, Record, Verify, Profile — with the wallet as an
**action** rather than a gate. Onboarding that does not block. Sheets for tasks,
a stack for detail. Marks drawn rather than typed, because Unicode's list glyph is
a hamburger menu and its circle is an unselected radio button. The hardware back
key unwinds to Today instead of closing the application.

> A mobile app built with web technology. Not: a website made responsive.

---

## Slide 8 — What we refused to build

> The craft is in what was refused.

Three refusals that are documented and can be shown without a claim that cannot be
backed:

1. **A streak-recovery feature.** Proposed, built to the point of the schema, then
   dropped: restoring a broken streak would have needed `source='recovery'` on
   chain, which would have put a fabricated day in a record whose entire value is
   that its days are real. The feature lost to the product's own thesis.
2. **A fake wallet picker.** Explicitly refused — no invented wallet discovery, no
   hard-coded list, no fabricated "wallet not detected" as the primary experience.
   The protocol disappears into the experience instead of being mimed by it.
3. **More code.** Five candidate concepts were scored and killed before building,
   between 0.80 and 0.90, on the rule that a better submission is not a larger one.

**Note on the five scored concepts:** their scores are in the project record but
**their one-line reasons are not in this repository**, and I could not recover them
in this session. **Do not put the bare table of scores on a slide** — a list of
numbers with no reasons reads as a brag, and inventing the reasons would be exactly
the thing this deck is arguing against. Either recover the reasons first, or ship
the three refusals above, which need no archaeology.

---

## Slide 9 — Engineering, as evidence rather than assertion

- CI-gated: an APK, an ABI guard across 7 libraries, a verifier self-test of 23
  cases, and an emulator round-trip that prints
  `seal-roundtrip OK clock1|2026-01-01|motion|10000|1000|manual|1`
- A screen-capture harness that drives the real APK on an emulator and asserts the
  process survived every tap — **including the hardware back key**
- Defects found and fixed by that harness, named: a fatal `VIBRATE` crash on every
  tab tap, a status bar printing over every title, and an app that called itself
  `MWA Scaffold` on the device

> Every one of those was found by looking, not by reading. Two were invisible in
> the source.

**This slide is deliberate:** it shows the process, and a judge scoring
engineering judgement is looking for exactly this.

---

## Slide 10 — Close

The claim, once:

> A daily record you can check. Held for ten seconds, sealed to Solana, and read
> back by a tool that does not trust the app that wrote it.

Repo. APK. Verifier. One line on what is next, without a promise the product
cannot keep.

---

## Rubric coverage, for our own check

| Rubric (25% each) | Slides |
|---|---|
| Stickiness & PMF | 2, 3 |
| User Experience | 7 |
| Innovation / X-factor | 5, 6, 8 |
| Presentation & Demo Quality | 1, 4, 9, 10 |

**Stickiness is the weakest quadrant and the deck should not pretend otherwise.**
The honest position: the mechanic is one round a day with a visible streak the
user cannot fake, and the hypothesis is that a record you cannot inflate is worth
more than one you can. That is a hypothesis. Slide 2 states it as one.

---

## Banned from this deck

- Generic Web3 visuals, glowing blockchain graphics, stock footage
- A slideshow of screenshots — the film does that, deliberately
- Long text slides; if a slide needs a paragraph, it is two slides
- Any market size, user count, or growth curve
- Roadmap items that are not in the repository
- The word "revolutionary", or any adjective doing the arguing

---

## Build order

1. Pull the **full transaction signature** for slide 4
2. Fill the **kill reasons** for slide 8 from the project record
3. Render 10 HTML slides, screenshot to 1920×1080 PNG each
4. Assemble to PDF
5. **Read every slide back and look at it** — the meme took three renders, and two
   of the three defects were only visible by cropping and actually looking
