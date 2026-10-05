# Clock In — standalone verifier

Rebuilds a streak from a Solana wallet's transaction history, without the app.

```sh
node verifier/verify.mjs <wallet-address>
node verifier/verify.mjs --self-test
```

**No dependencies.** No `npm install`, no database, no server, no copy of the
app. Node 18 or newer, because it ships `fetch`. If checking the record required
trusting our binary or our uptime, the record would not be worth much.

## The demo it exists for

> The app says I have a streak. But you don't have to trust the app.
> Let's delete the app's local state and ask the chain.

Clear the app's storage, reopen it, and it holds nothing. Run this against the
same wallet and the streak comes back, because it was never stored in the app -
it was written to a public chain in transactions anyone can read.

## Where the record comes from

Each sealed day is an SPL Memo instruction in a transaction the participant
signs themselves:

```
clock1|<roundId>|<act>|<durationMs>|<peakMilli>|<source>|<version>
clock1|2026-10-04|motion|10400|420|manual|1
```

Positional, not JSON. Key order, whitespace and float formatting are all ways
two honest JSON payloads can differ, and a verifier that parses loosely is a
verifier that can be fooled. Decoding here is strict: a payload that does not
match exactly is reported as malformed rather than guessed at.

## What it checks

- a well-formed record exists in this wallet's transaction history;
- **this wallet is one of that transaction's signers** — so nobody can paste
  someone else's payload into their own history and appear to hold that streak;
- the recorded days are continuous, or exactly where they break, with the size
  of each gap.

## What it does not check

- **That a physical act happened.** The record carries the `source` that
  produced the observation, and a self-reported one stays self-reported. Read
  that field rather than assuming.
- **That the RPC answered honestly.** A node can withhold or fabricate. Point
  this at a second RPC and compare — that is the reason the record lives on a
  public chain instead of in our database.

## Devnet only

Every record here is on devnet. Nothing in this repository moves real funds,
and nothing in it can move a user's funds at all.
