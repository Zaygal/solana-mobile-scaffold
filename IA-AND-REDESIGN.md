# Clock In — IA audit and redesign

Written after inspecting the existing product, before changing it. The companion
document `UX-DESIGN.md` still holds the visual language and the hold spec; this
one replaces the **architecture**, which is where the web-ness actually lives.

---

## 1. What exists now

**Two screens, and one of them is a wall.**

`App.tsx` is a wallet state machine — `disconnected · connecting · unavailable ·
cancelled · timeout · connected`. If the state is `connected` it renders
`RoundScreen`. For every other state it renders the connect screen. There is no
third possibility.

So on a fresh device with no wallet installed, the new user sees a brand, one
sentence, a `Connect Wallet` button, and — after pressing it — an error card
saying no compatible wallet was found. **The product behind that card is
unreachable.** Nothing to browse, nothing to understand, no evidence the thing
works. That is the architecture being criticised, stated in the code.

**Behind the wall: one long document.**

`RoundScreen.tsx` is a single scrolling column of seven ruled sections:

```
What you must do · What happens either way · What the record proves ·
On Solana, devnet · Sealed days · Verify it without this app · Not built
```

These are written as prose — they explain, justify and caveat. That is a
specification document, and as a product surface it is the most web-shaped thing
in the app. "What happens either way" is not a screen; it is a paragraph.

**What is genuinely good and must survive:**

- The **seal loop** — round, commitment transaction, signature, on-chain seal,
  streak. Proven on the user's own phone.
- The **chain read** ("4 transactions read, no local state consulted") — the
  proof that the streak is not local state.
- The **hold** and its vessel, the per-second ticks, the linear fill.
- The **streak count**, the **countdown** to the end of the UTC day, the
  **sealed-days** list.
- The **standalone verifier** — the product's actual differentiator.
- The **honesty** about what the record proves and what is not built. The content
  is right; only its placement is wrong.

**And there is no navigation of any kind.** No tabs, no stack, no sheets, no
onboarding, no profile, no back affordance. One screen renders the other.

---

## 2. The new information architecture

Four primary destinations, each derived from functionality that already exists.
Nothing here is invented to fill a tab bar.

| Tab | What it is | Drawn from |
|---|---|---|
| **Today** | The round: the date, the state in one line, the countdown, the vessel, the streak at a glance | the current round screen's first half |
| **Record** | Every sealed day, each with its on-chain transaction, the streak length, the gaps | the "Sealed days" and "On Solana, devnet" sections |
| **Verify** | The standalone verifier, and the honest limits of what the record proves | "Verify it without this app", "What the record proves", "Not built" |
| **Profile** | Wallet, address, developer diagnostics, about | the wallet machine, the diagnostics footer |

**Today** is where the product is used and is the app's default.
**Record** is what the product produces.
**Verify** is why it can be believed — and it earns a tab because the verifier is
the differentiator, not an appendix. Giving it bottom-level placement is the
single strongest structural statement the redesign makes.
**Profile** is where identity and settings live, which is where a wallet belongs.

The prose that justifies the design moves to where it is asked for: the limits of
the record belong on **Verify**, beside the command that demonstrates them; the
"not built" list belongs there too. Explanation becomes something you open when
you want it, not the whole surface.

### Navigation

- **Bottom tab bar**, four items, with the platform's own safe-area handling.
- **A stack per tab** so back is predictable: Record → a single day's detail;
  Verify → a verification result.
- **Sheets** for anything that is a task rather than a place: the wallet
  chooser, the connect result, the day detail, diagnostics.
- **Headers** compact and mobile — a title and at most one action. No hero
  sections.
- **Pull to refresh** on Record, where re-reading the chain is a meaningful act
  rather than a decorative one.

---

## 3. The flows

### First launch

```
Launch → Welcome (1 of 3)          what this is, in one sentence
       → swipe → (2 of 3)          the streak is written to Solana
       → swipe → (3 of 3)          you can check it without trusting this app
       → Get started → Today
```

Skippable at every panel. Completion is persisted, so a returning user never
sees it again.

### Returning user

```
Launch → Today        (no wallet prompt, no gate)
```

### Wallet — an action, not a gate

Every entry point is the user doing something that needs a wallet:

```
Today, holding the vessel with no wallet connected
   → sheet: "Connect a wallet to seal today"   [ Not now ] [ Choose a wallet ]
   → Choose a wallet → wallet chooser
   → Mobile Wallet Adapter flow
   → back to Today, context intact, the hold now available
```

Also available deliberately at **Profile → Wallet**, with disconnect beside it.

**On the chooser, and a real tension.** An earlier instruction was "do not fake
wallet discovery. Do not hard-code a fake wallet picker." A list of
Phantom/Solflare/Backpack drawn from nowhere would break exactly that. So the
chooser lists the wallet applications **actually installed on the device**,
queried from the platform, with those names used to label what is genuinely
found — real detection, real deep links, and Mobile Wallet Adapter doing the
connection. If nothing is installed, that is not an error card: it is a proper
screen explaining what has to be installed first, with links.

---

## 4. What is kept, and what is retired

**Kept, restructured:** the round engine, the commitment, the seal, the chain
read, the streak maths, the hold and its vessel, the countdown, the sealed-days
data, the verifier, the honesty content, the design tokens.

**Retired as surfaces:** the stacked prose sections as page content; the connect
screen as the application's front door; the notice cards as the primary
experience of a missing wallet; the single scrolling column as the only layout.

**Not touched:** the Solana logic, the MWA integration, the canonical positional
encoding, the verifier, the devnet-only configuration. The redesign moves where
things appear and when they are asked for. It does not rewrite what they do.

---

## 5. Open-source patterns adopted, and why

From **`Zaygal/awesome-ios-design-md`** (MIT), which is a corpus of documented
interaction patterns from shipped apps rather than a component kit:

- **Apple Fitness** — the ring-track idea already adopted for the vessel. In this
  redesign its second lesson applies: one screen, one dominant metric, with
  everything else subordinate. That is what makes **Today** feel like an app
  screen instead of a document.
- **Hevy** — how a history reads as a record. **Record** takes its structure:
  a reverse-chronological list of real events, no gamification.
- **Linear** — restraint, hairlines over cards, mono for figures. Already the
  visual language; here it governs the density of the tab screens.

Conventional mobile architecture — bottom tabs, per-tab stacks, modal sheets,
onboarding carousel, pull to refresh, safe-area insets — is used because it is
the platform's own vocabulary. These are patterns to implement directly in React
Native; **no UI kit becomes a dependency.** A screen assembled from someone
else's kit is not a screen designed for this product.

---

## 6. What this redesign does not fix

The **demo video** and the **pitch deck** are required deliverables and are still
unbuilt, and the submission deadline is **8 October 23:59 UTC**. The redesign is
scheduled before them because a submission whose interface reads as a web page
scores badly on two of the four judging criteria — but the sequence has to hold:
rebuild the shell, re-verify the seal loop end to end, then produce the video and
the deck. If time runs short the order does not change; the cut comes out of
polish, not out of the video.
