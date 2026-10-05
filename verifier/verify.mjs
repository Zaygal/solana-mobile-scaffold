#!/usr/bin/env node
/**
 * Clock In — standalone verifier.
 *
 *   node verifier/verify.mjs <wallet-address>
 *   node verifier/verify.mjs --self-test
 *
 * What this is for: the app claims a streak. This program checks that claim
 * without the app. It reads a wallet's transaction history directly from a
 * Solana RPC node and rebuilds the streak from the memo records alone.
 *
 * It deliberately has NO dependencies. No npm install, no database, no server,
 * no build step, no copy of the app's code. If verifying the record required
 * trusting our binary, our schema, or our uptime, the record would not be worth
 * much. Node 18+ is the only requirement, because it ships `fetch`.
 *
 * WHAT THE OUTPUT PROVES
 *   - that a transaction carrying a well-formed round record exists in this
 *     wallet's on-chain history, at a known block time;
 *   - that the wallet in question is one of that transaction's signers;
 *   - that the sequence of recorded days is unbroken, or exactly where it
 *     breaks.
 *
 * WHAT IT DOES NOT PROVE
 *   - that a physical act happened. The record says which mechanism produced the
 *     observation (`source`), and a self-reported one is a self-reported one.
 *     Read that field rather than assuming.
 *   - that the RPC node answered honestly. A node can withhold or fabricate.
 *     Point this at a second RPC and compare; that is the whole reason the
 *     record is on a public chain instead of in our database.
 *   - anything about mainnet. This is devnet.
 *
 * The encoding is positional and fixed:
 *   clock1|<roundId>|<act>|<durationMs>|<peakMilli>|<source>|<version>
 * Decoding is strict, on purpose. A verifier that parses loosely is a verifier
 * that can be fooled, so anything that does not match exactly is reported as
 * malformed rather than guessed at.
 */

const SEAL_PREFIX = 'clock1';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const FIELD_COUNT = 7;
const VALID_SOURCES = ['device-sensor', 'camera', 'manual'];

/** Strict decode. Mirrors the app's decodeSeal exactly; returns null, never throws. */
export function decodeSeal(memo) {
  if (typeof memo !== 'string') return null;
  const parts = memo.trim().split('|');
  if (parts.length !== FIELD_COUNT) return null;
  const [prefix, roundId, act, dur, peak, source, version] = parts;
  if (prefix !== SEAL_PREFIX) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(roundId)) return null;
  if (act !== 'motion') return null;
  if (!VALID_SOURCES.includes(source)) return null;
  if (!/^\d+$/.test(dur) || !/^\d+$/.test(peak) || !/^\d+$/.test(version)) return null;
  return {
    roundId,
    act,
    durationMs: Number(dur),
    peakMilli: Number(peak),
    source,
    version: Number(version),
  };
}

const dayBefore = roundId => {
  const [y, m, d] = roundId.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return [
    prev.getUTCFullYear(),
    String(prev.getUTCMonth() + 1).padStart(2, '0'),
    String(prev.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

/**
 * Rebuild the streak from records alone. Same computation the app performs, so
 * agreement between the two is a real check rather than a coincidence. RPC
 * ordering is not trusted: days are de-duplicated and sorted before counting.
 */
export function streakFromSeals(records) {
  const days = Array.from(new Set(records.map(r => r.roundId))).sort();
  if (days.length === 0) return {length: 0, latest: null, days: [], gaps: []};

  let length = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (dayBefore(days[i]) === days[i - 1]) length++;
    else break;
  }

  // Every break in the sequence, not just where the current streak begins.
  const gaps = [];
  for (let i = 1; i < days.length; i++) {
    if (dayBefore(days[i]) !== days[i - 1]) gaps.push([days[i - 1], days[i]]);
  }
  return {length, latest: days[days.length - 1], days, gaps};
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  if (!res.ok) throw new Error(`RPC ${method} returned HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC ${method} error: ${JSON.stringify(body.error)}`);
  return body.result;
}

/** Pull every memo string the transaction carries, and who signed it. */
export function extractTransaction(tx) {
  const message = tx?.transaction?.message;
  if (!message) return null;
  const keys = (message.accountKeys || []).map(k =>
    typeof k === 'string' ? {pubkey: k, signer: false} : {pubkey: k.pubkey, signer: !!k.signer},
  );
  const signers = keys.filter(k => k.signer).map(k => k.pubkey);
  const memos = [];
  for (const ix of message.instructions || []) {
    const programId = ix.programId || ix.programIdIndex;
    const isMemo = ix.programId === MEMO_PROGRAM_ID || ix.program === 'spl-memo';
    if (!isMemo) continue;
    if (ix.parsed && typeof ix.parsed === 'object' && ix.parsed.info?.memo !== undefined) {
      memos.push(String(ix.parsed.info.memo));
    } else if (typeof ix.parsed === 'string') {
      memos.push(ix.parsed);
    }
  }
  return {signers, memos, blockTime: tx.blockTime ?? null, signature: tx.transaction.signatures?.[0] ?? null};
}

async function readWallet(address, rpcUrl, limit) {
  const signatures = await rpc(rpcUrl, 'getSignaturesForAddress', [address, {limit}]);
  if (!signatures.length) return {scanned: 0, seals: [], malformed: [], rejected: []};

  const seals = [];
  const malformed = [];
  const rejected = [];

  for (const entry of signatures) {
    const tx = await rpc(rpcUrl, 'getTransaction', [
      entry.signature,
      {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0},
    ]);
    if (!tx) continue;
    const info = extractTransaction(tx);
    if (!info) continue;

    for (const memo of info.memos) {
      if (!memo.trim().startsWith(SEAL_PREFIX)) continue;

      // A record only counts if this wallet signed the transaction carrying it.
      // Otherwise anyone could paste another participant's payload into their
      // own history and appear to hold that streak.
      if (!info.signers.includes(address)) {
        rejected.push({signature: info.signature, memo, reason: 'wallet is not a signer'});
        continue;
      }

      const decoded = decodeSeal(memo);
      if (!decoded) {
        malformed.push({signature: info.signature, memo});
        continue;
      }
      seals.push({...decoded, signature: info.signature, blockTime: info.blockTime});
    }
  }

  // Oldest first, by block time where the node gave us one.
  seals.sort((a, b) => (a.blockTime ?? 0) - (b.blockTime ?? 0));
  return {scanned: signatures.length, seals, malformed, rejected};
}

function utc(blockTime) {
  if (blockTime == null) return 'block time unavailable';
  return new Date(blockTime * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

async function verify(address, rpcUrl, limit) {
  const {scanned, seals, malformed, rejected} = await readWallet(address, rpcUrl, limit);
  const streak = streakFromSeals(seals);

  console.log('');
  console.log('Clock In — on-chain record');
  console.log('='.repeat(58));
  console.log(`wallet           ${address}`);
  console.log(`rpc              ${rpcUrl}`);
  console.log(`transactions     ${scanned} scanned`);
  console.log(`valid seals      ${seals.length}`);
  console.log(`sealed days      ${streak.days.length}`);
  console.log(`current streak   ${streak.length} ${streak.length === 1 ? 'day' : 'days'}`);
  console.log(`most recent      ${streak.latest ?? 'nothing sealed yet'}`);
  console.log('');

  if (streak.days.length > 0) {
    console.log('day sequence');
    for (const day of streak.days) {
      const record = seals.find(s => s.roundId === day);
      const mark = streak.gaps.some(g => g[1] === day) ? '  (gap before this day)' : '';
      console.log(`  ${day}  source=${record?.source ?? 'unknown'}  ${record?.signature?.slice(0, 20) ?? ''}…${mark}`);
    }
    console.log('');
  }

  console.log(`continuous       ${streak.gaps.length === 0 ? 'yes, no gaps' : 'no'}`);
  for (const [from, to] of streak.gaps) {
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) - 1;
    console.log(`                 gap of ${days} ${days === 1 ? 'day' : 'days'} between ${from} and ${to}`);
  }
  if (streak.latest) {
    console.log(`last sealed day  ${streak.latest}`);
  }

  if (malformed.length) {
    console.log('');
    console.log(`malformed        ${malformed.length} record(s) carried the prefix but did not decode`);
    for (const m of malformed.slice(0, 5)) console.log(`                 ${m.signature.slice(0, 20)}… "${m.memo.slice(0, 60)}"`);
  }

  if (rejected.length) {
    console.log('');
    console.log(`rejected         ${rejected.length} record(s) in this history were not signed by this wallet`);
    for (const r of rejected.slice(0, 5)) console.log(`                 ${r.signature.slice(0, 20)}… ${r.reason}`);
  }

  if (seals.length) {
    console.log('');
    console.log(`earliest         ${utc(seals[0].blockTime)}`);
    console.log(`final            ${utc(seals[seals.length - 1].blockTime)}`);
  }

  console.log('');
  console.log('What this establishes');
  console.log('  These transactions are in this wallet\'s history on devnet, this wallet');
  console.log('  is one of their signers, and the day sequence above is what the chain');
  console.log('  contains. The app\'s local database was not read, consulted or trusted.');
  console.log('');
  console.log('What this does not establish');
  console.log('  That a physical act happened. `source` records which mechanism produced');
  console.log('  the observation, and a self-reported one stays self-reported. Nor that');
  console.log('  this RPC answered honestly: point it at another node and compare.');
  console.log('');
  return seals.length;
}

/** Known-answer tests. No network, so this can gate a build. */
function selfTest() {
  const cases = [
    ['clock1|2026-10-04|motion|10400|420|manual|1', true],
    ['clock1|2026-10-04|motion|10400|420|device-sensor|1', true],
    ['clock1|2026-10-04|motion|10400|420|manual|1.0', false],   // float version
    ['clock1|2026-10-4|motion|10400|420|manual|1', false],      // unpadded date
    ['clock1|2026-10-04|motion|10400.5|420|manual|1', false],   // float duration
    ['clock1|2026-10-04|motion|10400|420|inferred|1', false],   // invented source
    ['clock1|2026-10-04|squat|10400|420|manual|1', false],      // other act
    ['clock1|2026-10-04|motion|10400|420|manual', false],       // missing version
    ['clock1|2026-10-04|motion|10400|420|manual|1|extra', false],
    ['clock2|2026-10-04|motion|10400|420|manual|1', false],     // wrong version tag
  ];
  let failed = 0;
  for (const [memo, shouldDecode] of cases) {
    const ok = decodeSeal(memo) !== null;
    if (ok !== shouldDecode) {
      console.log(`FAIL  expected decode=${shouldDecode} got ${ok}: ${memo}`);
      failed++;
    }
  }

  const mk = (day, source = 'manual') => ({roundId: day, act: 'motion', durationMs: 1, peakMilli: 1, source, version: 1});
  const streakCases = [
    [[], 0],
    [[mk('2026-10-04')], 1],
    [[mk('2026-10-02'), mk('2026-10-03'), mk('2026-10-04')], 3],
    [[mk('2026-10-01'), mk('2026-10-03'), mk('2026-10-04')], 2],
    [[mk('2026-10-04'), mk('2026-10-03')], 2],                  // out of order in
    [[mk('2026-10-03'), mk('2026-10-03'), mk('2026-10-04')], 2], // duplicate day
    [[mk('2026-03-01'), mk('2026-02-28')], 2],                   // month boundary
    [[mk('2027-01-01'), mk('2026-12-31')], 2],                   // year boundary
  ];
  for (const [records, expected] of streakCases) {
    const got = streakFromSeals(records).length;
    if (got !== expected) {
      console.log(`FAIL  streak expected ${expected} got ${got} for ${JSON.stringify(records.map(r => r.roundId))}`);
      failed++;
    }
  }

  // A gap must be reported with the right span.
  const gap = streakFromSeals([mk('2026-09-28'), mk('2026-10-04')]);
  if (gap.gaps.length !== 1 || gap.gaps[0][0] !== '2026-09-28' || gap.gaps[0][1] !== '2026-10-04') {
    console.log(`FAIL  gap detection: ${JSON.stringify(gap.gaps)}`);
    failed++;
  }

  // End-to-end through the real extractor, using transactions shaped exactly as
  // the RPC returns them under jsonParsed. Without this the self-test would only
  // cover decode and counting, and the part that reads the chain - program id
  // matching, the parsed-memo shape, the signer check - would be untested until
  // the first live run.
  const W = 'Wa11etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const txWith = (memo, signer) => ({
    blockTime: 1791000000,
    transaction: {
      signatures: ['sig-' + String(memo).slice(0, 10)],
      message: {
        accountKeys: [{pubkey: signer, signer: true, writable: true, source: 'transaction'}],
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            program: 'spl-memo',
            parsed: {type: 'memo', info: {memo}},
            accounts: [],
            data: '',
          },
        ],
      },
    },
  });

  const good = extractTransaction(txWith('clock1|2026-10-04|motion|10400|420|manual|1', W));
  if (!good || good.memos.length !== 1) { console.log('FAIL  extractor did not pick up the memo'); failed++; }
  else if (decodeSeal(good.memos[0])?.roundId !== '2026-10-04') { console.log('FAIL  extracted memo did not decode'); failed++; }
  if (good && !good.signers.includes(W)) { console.log('FAIL  signer not detected'); failed++; }

  const foreign = extractTransaction(txWith('clock1|2026-10-04|motion|10400|420|manual|1', 'SomeoneElseEntirely'));
  if (foreign.signers.includes(W)) { console.log('FAIL  signer check would accept another wallet'); failed++; }

  const unrelated = extractTransaction({
    blockTime: 1791000000,
    transaction: {
      signatures: ['sig-x'],
      message: {
        accountKeys: [{pubkey: W, signer: true}],
        instructions: [{programId: 'ComputeBudget111111111111111111111111111111', parsed: null, accounts: []}],
      },
    },
  });
  if (!unrelated || unrelated.memos.length !== 0) { console.log('FAIL  non-memo instruction produced a memo'); failed++; }

  const total = cases.length + streakCases.length + 1 + 4;
  if (failed) {
    console.log(`\nSELF-TEST FAILED: ${failed} of ${total} cases`);
    process.exit(1);
  }
  console.log(`SELF-TEST PASSED: ${total} cases (decode strictness, streak counting, gaps)`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.includes('--self-test') || args.length === 0) {
  if (args.length === 0 && !args.includes('--self-test')) {
    console.log('usage: node verifier/verify.mjs <wallet-address> [--rpc <url>] [--limit <n>]');
    console.log('       node verifier/verify.mjs --self-test');
    process.exit(2);
  }
  selfTest();
}

const rpcFlag = args.indexOf('--rpc');
const limitFlag = args.indexOf('--limit');
const rpcUrl = rpcFlag >= 0 ? args[rpcFlag + 1] : DEFAULT_RPC;
const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : 1000;
const address = args.find(a => !a.startsWith('--') && a !== rpcUrl && a !== String(limit) && !/^\d+$/.test(a));

if (!address) {
  console.log('usage: node verifier/verify.mjs <wallet-address> [--rpc <url>] [--limit <n>]');
  process.exit(2);
}

try {
  await verify(address, rpcUrl, limit);
} catch (e) {
  console.error(`\nCould not read the chain: ${e.message}`);
  process.exit(1);
}
