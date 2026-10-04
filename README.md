# solana-mobile-scaffold

A deliberately minimal React Native Android app that proves the **Mobile Wallet
Adapter** path end to end: connect to a wallet, authorise an account, and send a
real devnet transaction from an installed APK.

It exists to de-risk the parts of a Solana Mobile project that are usually
discovered too late — an APK that installs, a JS bundle that loads, polyfills
that are in the right order, an ABI that the target device accepts, and a wallet
that is actually reachable.

## What is verified by CI

`Android APK` builds the APK and asserts three things about it:

- the React Native JS bundle is inside the APK (otherwise: red screen on launch);
- `lib/x86_64/*.so` is present, so it installs on an x86_64 emulator — the only
  device available without Seeker hardware;
- `lib/arm64-v8a/*.so` is present, so it installs on a real device.

`Emulator smoke test (MWA)` boots an x86_64 emulator, installs the APK, launches
it, and asserts from logcat that the JS ran and no native crash occurred.

## Running it yourself

```bash
cd mobile
npm install
cd android && gradle :app:assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
```

Install a wallet first. On a plain emulator the official mock wallet is enough:

```bash
npx solana-mobile@latest device install fakewallet
```

## Devnet only

`src/config.ts` points at `https://api.devnet.solana.com` and the transfer sends
0.0001 SOL to the sender's own address, so no funds can leave the account. No
mainnet endpoint appears anywhere in this repository.

## Notes that cost time to learn

- MWA is Android-only. There is no iOS path.
- Polyfills (`react-native-get-random-values`, `buffer`) must load before any
  Solana import, or signing fails before the wallet opens.
- MWA address fields are **base64**; decoding them any other way yields a
  plausible but wrong public key.
- `minContextSlot` is passed to avoid "payloads invalid" when a blockhash
  expires while the approval sheet is open.
- `authorize` is called rather than `reauthorize`, because a stale reauth token
  fails silently.
- Gate on the Seeker Genesis Token, never on `Platform.constants.Model`, since an
  emulator and a Seeker can run identical code.
