#!/usr/bin/env sh
# Emulator smoke test.
#
# This lives in a file rather than inline in the workflow on purpose.
# reactivecircus/android-emulator-runner executes each LINE of an inline script
# in its own shell, so shell variables do not survive between lines and a
# trailing backslash is passed through as a literal argument. That has now
# broken this job twice:
#   1. `adb install -r "$APK"` ran with an empty $APK -> "filename doesn't end
#      .apk or .apex".
#   2. the mock-wallet install received a literal "\\" -> "Not a file,
#      directory, or catalog APK: \\", and its `||` fallback sat on the next
#      line where it could not catch anything.
# Running one real script removes the whole failure class.

set -e

APK="$GITHUB_WORKSPACE/mobile/android/app/build/outputs/apk/diagnostic/app-diagnostic.apk"

echo "== installing $APK =="
ls -la "$APK"
adb install -r "$APK"

echo "== installing the mock wallet (best effort) =="
if timeout 300 npx -y solana-mobile@latest device install fakewallet; then
  echo "mock wallet installed"
else
  echo "mock wallet install skipped; continuing with smoke assertions"
fi
adb shell pm list packages | grep -i wallet || true

echo "== launching =="
adb logcat -c
adb shell monkey -p com.zaygal.scaffold -c android.intent.category.LAUNCHER 1
sleep 45

echo "== process check =="
if adb shell pidof com.zaygal.scaffold >/dev/null 2>&1; then
  echo "OK: app process alive"
else
  echo "FAIL: app process not running after launch"
  exit 1
fi

echo "== logcat =="
adb logcat -d > /tmp/logcat.txt
grep -E "MWASCAFFOLD|AndroidRuntime|ReactNativeJS" /tmp/logcat.txt | tail -60 || true

if grep -q "MWASCAFFOLD" /tmp/logcat.txt; then
  echo "OK: app reached its own diagnostics"
else
  echo "FAIL: no MWASCAFFOLD output; JS may not have started"
  exit 1
fi

# The whole submission claim is that the app and the verifier agree on the
# canonical payload, so assert the round-trip inside the shipped bundle rather
# than trusting the build.
if grep -q "seal-roundtrip OK" /tmp/logcat.txt; then
  echo "OK: seal payload round-tripped in the shipped bundle"
else
  echo "FAIL: seal payload did not round-trip"
  exit 1
fi

if grep -q "AndroidRuntime: FATAL" /tmp/logcat.txt; then
  echo "FAIL: native crash detected"
  grep -A20 "AndroidRuntime: FATAL" /tmp/logcat.txt
  exit 1
fi
echo "OK: no native crash"

echo "== JS diagnostics as recorded =="
grep "MWASCAFFOLD" /tmp/logcat.txt | head -20 || true
