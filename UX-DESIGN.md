# Clock In — UX design

Design document. Written before implementation, deliberately.

The design language is taken from **Zay Studio** (`Zaygal/Zay-Studio`): its
`tailwind.config.ts` tokens, its `globals.css` behaviour, and its habit of one
concern per component. If that is not the sample you meant, say so and I will
re-cut this against the right one — everything below is written to be easy to
re-skin because the structure and the tokens are separate concerns.

---

## 1. What the review said

Three notes, in the order they matter.

1. **"Sealed, but the UX isn't nice."** Correct. The product works — the round
   sealed, the streak went 0 → 1, the chain read reported it — and the interface
   around that moment is still thin.
2. **The hold has no feedback.** A ten-second hold that shows nothing is asking
   for ten seconds of blind faith. It should fill as you hold, and you should
   feel the time passing.
3. **The wallet asks to confirm on every sign.** This one is a defect, not a
   taste issue, and it is mine: the auth token is held in memory, so it dies
   with the app and every signing session falls back to a full authorisation.

---

## 2. Design language

### 2.1 Reference corpus

Two sources, both open source and both deliberately chosen.

**`Zaygal/awesome-ios-design-md`** (fork of `Meliwat/awesome-ios-design-md`, MIT,
570★) — 200 production design systems for real apps, each as a `DESIGN.md` plus
framework-specific implementations including **`DESIGN-expo.md`**, which is React
Native. Forked to the account so the reference is pinned rather than merely
linked. Three of the eleven categories actually match this product:

| System | Category | What is taken | What is not |
|---|---|---|---|
| **Apple Fitness** | fitness | the vessel metaphor; track at 22% of the fill colour; type scale with tabular numerals; haptic vocabulary | the three-ring structure, the neon ring palette, ease-out motion (§3.2) |
| **Hevy** | fitness | how a set/streak history reads as a record rather than a game | its information density — too much for one daily act |
| **Linear** | productivity | restraint: hairlines instead of cards, one accent, mono for labels | keyboard-first interaction, which has no mobile equivalent here |

**`Zaygal/Zay-Studio`** — the account's own site. Its `tailwind.config.ts` tokens
are the palette below, and its `globals.css` sets the two rules that matter most:
`focus-visible` gets a real outline, and `prefers-reduced-motion` switches
animation off rather than shrinking it.

**Patterns are taken. Packages are not.** No UI kit is added as a dependency.
These are design decisions to implement in plain React Native, which is also what
the hackathon asks for — a screen built from an installed kit is not a screen
designed from the ground up.

One palette, mapped to React Native, and the accent means something specific.

| Token | Value | Used for | Not used for |
|---|---|---|---|
| `ink` | `#0B0D0F` | screen background | — |
| `panel` | `#131518` | raised surfaces, diagnostics | cards for prose |
| `hairline` | `#232629` | section separation | decoration |
| `paper` | `#EAEAE7` | primary text | buttons |
| `muted` | `#8A8F98` | secondary text | body copy |
| `steel` | `#5B7FB8` | links, secondary actions, the chain | status |
| `signal` | `#4ADE80` | **the seal, the streak, the live hold** | anything decorative |
| `alert` | `#E5654A` | failures that need action | warnings |

**`signal` is reserved.** It appears only where something real is true: a sealed
day, a live streak, a hold in progress. The moment it is used for decoration it
stops carrying that meaning.

**Type.** `mono` for labels, addresses, sigs and counts — always with `widest`
tracking, always upper case, never for sentences. `display` for the one line per
screen that matters. `body` for prose. This mirrors `.mono-label` in the sample.

**Motion.** Two allowed, both from the sample's `keyframes`: `flip` (0.4s fade,
2px rise) for content arriving, `blink` (1.2s step-end) for a live indicator.
The hold fill is the single exception — it is continuous, because it *is* the
information. Reduced motion replaces it with a countdown (§4.4).

**No cards around prose.** Sections are separated by `hairline` rules. Cards are
for things that are actually containers — the diagnostics panel, a filled hold.

---

## 3. The two things being fixed

### 3.1 Wallet: connect once, confirm only transactions

**The defect.** `sessionAuthToken` lives in a module variable. Close the app and
it is gone; the next signature falls back to `authorize`, which prompts. So the
user is asked to re-authorise before every transaction, which is what the review
describes.

**The design.**

- The auth token is **persisted** alongside the other device state.
- Every signing session calls `reauthorize` with the persisted token first.
  `reauthorize` is silent on a good token: no UI, no prompt.
- Only the transaction itself is presented for approval.
- `reauthorize` fails when the token has genuinely expired, and it fails without
  a useful error — this is documented behaviour. On failure: one full
  `authorize`, then persist the new token and go quiet again.
- The user is told this **before** it happens, on the connect screen:

  > Connect once. After that, only transactions ask for your approval.

  Most of what reads as a bug here is an unset expectation. Saying it costs one
  line.

**Honest limit, stated in the UI:** re-authorisation is silent, but the wallet
can always end a session — a reinstall, a wallet reset, a cleared session. The
app may have to ask once more, and it will say so rather than appearing to have
forgotten.

### 3.2 The hold: fill it, and feel it

Ten seconds is long enough to need feedback and short enough that it should feel
like one motion.

**Structure.** The primary action is a vessel, not a button. Holding fills it.

**Fill.** From the **bottom up**, because "brimming" is a vertical metaphor and a
left-right wipe reads as a progress bar rather than something filling. The fill
rises in `signal` across the full 10s, with a soft leading edge — a 2px brighter
band at the top, which is the "light" being described. Label text sits above the
fill and stays legible as it passes.

**The empty vessel is drawn, not left blank.** Apple Fitness's Expo guide sets
the ring track to the fill colour at 22% opacity, and the same treatment applies
to a box: the unfilled area is `signal` at 22% over `panel`, not grey. The
container reads as a vessel that is being filled, rather than as an empty stage.

**Motion is linear, and this is a deliberate divergence from the reference.**
Apple's rings animate with `Easing.out(Easing.ease)` over 1000ms, which is
correct for decoration — it settles pleasingly. A ten-second hold is not
decoration: it is a measurement, and an ease-out would tell the user they had
held longer than they had. `Easing.linear` over exactly 10000ms.

**Releasing early.** The fill drains in 250ms and the hold resets. No error, no
message: an interrupted hold is not a failure, it is an interrupted hold.

**Haptics**, using React Native's own `Vibration` so no dependency is added:

| Moment | Feel | Why |
|---|---|---|
| Press in | one light impact | acknowledge the touch immediately |
| Each second held | one short tick, 10 total | the count is felt, not read |
| Completed 10s | two pulses | distinct from the ticks, so success is unmistakable |
| Released early | nothing | absence is the signal that it did not take |

The ticks are the important one. They are what turns a ten-second wait into
something being counted *by the phone*, rather than a wait with a spinner. Apple
Fitness's guide uses `selectionAsync()` for exactly this kind of per-step
feedback, and `notificationAsync(Success)` at completion — the same vocabulary,
chosen for the same reasons.

**Implemented with React Native's built-in `Vibration`, not `expo-haptics`.**
This is a bare RN app; pulling in `expo-modules-core` and `expo-haptics` to get
three haptic types is a poor trade when `Vibration` already distinguishes
duration and pattern. The vocabulary maps cleanly:

| Intended | `expo-haptics` | here |
|---|---|---|
| acknowledge touch | `impactAsync(Medium)` | `Vibration.vibrate(40)` |
| per-second tick | `selectionAsync()` | `Vibration.vibrate(20)` |
| completed | `notificationAsync(Success)` | `Vibration.vibrate([0, 60, 80, 60])` |
| released early | nothing | nothing |

If haptics are ever wanted on iOS with real Taptic Engine types, adding
`expo-haptics` is the upgrade and this table is the mapping.

**Pressed state.** The action scales to `0.97` while held, as in the reference.
On release it returns without animation, so the only continuous thing on screen
is the fill.

**What the hold does not claim.** A completed hold means the user held a button
for ten seconds. It is not evidence of a physical act, and the record continues
to say so — `source: manual`, labelled "Self-reported" in the UI. The fill is
drawn with the same honesty the chain record carries.

---

## 4. States

Every state below gets a designed screen. No state is a raw error string.

### 4.1 Wallet
`disconnected` · `connecting` · `unavailable` (no compatible wallet) ·
`cancelled` (user backed out; nothing happened) · `timeout` (handoff never
returned) · `connected`

### 4.2 Round
`reading the chain` · `open` (waiting on the hold) · `holding` (filling) ·
`released early` (silent reset) · `committing` (transaction approval) ·
`attesting` · `sealing` · `sealed` · `already sealed today` · `day closed`
(the UTC day ended mid-flow)

### 4.3 Failure
`commitment rejected` · `commitment failed` · `seal rejected` · `seal failed` ·
`chain unreachable` (with the cached read clearly labelled as cache)

### 4.4 Reduced motion
When reduced motion is on: no rising fill, no leading glow, no `flip`. The hold
becomes a **numeric countdown** — `10`, `9`, `8` — with the same per-second
haptics. The information is identical; only the presentation changes. Nothing in
this design is carried by animation alone.

---

## 5. Copy rules

- Sentence case for prose. Upper-case mono only for labels and values.
- The countdown is stated, never implied: "18h 16m 50s left in the UTC day."
- Provenance is stated where the number is, not in a footnote: "Rebuilt from
  devnet transaction history — 4 transactions read, no local state consulted."
- Never: "verified workout", "proof of movement", "tamper-proof", "AI verified".
- Always available but never prominent: **Developer diagnostics**, collapsed,
  containing rpc, identity, the canonical seal payload, the round-trip result,
  streak length, and the last raw error.

---

## 6. What this design deliberately does not do

- **No gradients, glow or glass to make it feel premium.** The sample earns its
  quality from restraint, a reserved accent and good type. Matching that is the
  point.
- **No streak flame, badge or confetti.** The streak is a number and a row of
  marks. It is a record, not a game. Hevy's history screens were the reference
  for this, and the lesson taken was structural: show the record, not a reward.
- **No UI kit as a dependency.** The reference corpus is for design decisions.
  Installing a component library would put someone else's interface around this
  product, and the brief asks for a screen designed from the ground up.
- **No wallet picker.** The platform owns discovery and approval. We never
  imitate it.
- **No claim the record cannot support.** The seal proves a wallet signed a
  claim at a time. Nothing here implies more.
