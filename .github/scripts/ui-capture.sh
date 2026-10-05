#!/bin/sh
# Capture the app as a brand-new user sees it.
#
# The review's acceptance test starts cold: a fresh install with no wallet app
# present, which is the most important first impression and the one nothing has
# ever looked at. This screenshots each step and prints the visible text, so the
# interface can be judged as an interface rather than read out of the source.
#
# Learnings from the Zaycomm harness are applied here rather than rediscovered:
# match labels case-sensitively as substrings, read the real screen size, print
# what is on screen when a label is not found, and never swallow a parse error.

set -u
ADB="adb -e"
OUT="capture.txt"
mkdir -p shots
: > "$OUT"

say() { echo "$@" | tee -a "$OUT"; }

# Install first. The first version of this script downloaded the artifact and went
# straight to looking for the package, which is why it reported 'the APK did not
# install' - nothing had tried to install it.
APK=$(find apk -name '*.apk' 2>/dev/null | head -1)
[ -z "$APK" ] && APK=$(find . -name '*.apk' 2>/dev/null | head -1)
if [ -z "$APK" ]; then
  say "no APK found to install; the download step produced nothing"
  exit 1
fi
say "installing $APK"
# -g grants the runtime permissions the app declares, so the first screen is not
# a permission dialog.
$ADB install -r -g "$APK" >/dev/null 2>&1 || $ADB install -r "$APK" >/dev/null 2>&1
say "install exit: $?"

# Package name is discovered, not assumed, and restricted to THIRD-PARTY
# packages. The first version filtered the full list on a name pattern and matched
# com.android.deskclock - the emulator's own clock app, containing 'clock' - then
# spent the run trying to launch it. System apps are now excluded by the platform
# rather than by my guessing at names.
PKGS=$($ADB shell pm list packages -3 2>/dev/null | sed 's/package://' | tr -d '\r')
say "third-party packages: $(echo "$PKGS" | tr '\n' ' ')"
PKG=$(echo "$PKGS" | grep -iE 'scaffold|clock' | head -1)
[ -z "$PKG" ] && PKG=$(echo "$PKGS" | head -1)
if [ -z "$PKG" ]; then
  say "no third-party package installed - the APK did not install"
  exit 1
fi
say "package: $PKG"

shot() {
  # Screenshot, and the text that is on it. Both, always - a screenshot alone
  # cannot be grepped in a log, and a text dump alone cannot show layout.
  $ADB exec-out screencap -p > "shots/$1.png" 2>/dev/null
  $ADB shell uiautomator dump /sdcard/d.xml >/dev/null 2>&1
  $ADB pull /sdcard/d.xml "dump-$1.xml" >/dev/null 2>&1
  say "== $1 =="
  python3 - "dump-$1.xml" <<'PY' 2>/dev/null | tee -a "$OUT"
import sys, xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
except Exception as e:
    print("   (dump unreadable: %s)" % e); raise SystemExit
seen = []
for n in root.iter('node'):
    t = (n.get('text') or '').strip() or (n.get('content-desc') or '').strip()
    if t:
        seen.append(t)
print("   " + " | ".join(dict.fromkeys(seen))[:700])
PY
}

tap() {
  want="$1"; label="$2"
  real_h=$($ADB shell wm size 2>/dev/null | sed -n 's/.*: *[0-9]*x\([0-9]*\).*/\1/p' | tr -d '\r')
  [ -z "$real_h" ] && real_h=2000
  $ADB shell uiautomator dump /sdcard/t.xml >/dev/null 2>&1
  $ADB pull /sdcard/t.xml "dump-tap-$label.xml" >/dev/null 2>&1
  coords=$(python3 - "dump-tap-$label.xml" "$want" <<'PY' 2>/dev/null
import sys, re, xml.etree.ElementTree as ET
path, want = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(path).getroot()
except Exception as e:
    print("unreadable:%s" % e, file=sys.stderr); raise SystemExit
for n in root.iter('node'):
    t = (n.get('text') or '').strip()
    d = (n.get('content-desc') or '').strip()
    if want in t or want in d:
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds') or '')
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            print("%d %d" % ((x1 + x2) // 2, (y1 + y2) // 2))
PY
  )
  if [ -z "$coords" ]; then
    say "  [$label] no element matching '$want'"
    return 1
  fi
  set -- $coords
  say "  [$label] tapping '$want' at ($1,$2)"
  $ADB shell input tap "$1" "$2"
  sleep 3
  return 0
}

say "== starting the app =="
# monkey resolves the launcher activity itself, so the activity name is never
# guessed either.
$ADB shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
if ! $ADB shell pidof "$PKG" >/dev/null 2>&1; then
  say "the app is not running after launch - nothing to capture"
fi
shot 01-launch

# Whatever the first screen offers as its primary action, press it. On a device
# with no wallet installed this is where the product either explains itself or
# dead-ends, which is the thing being measured.
for label in "Connect Wallet" "Connect wallet" "CONNECT WALLET"; do
  if tap "$label" "primary"; then break; fi
done
sleep 8
shot 02-after-primary-action

# Any notice the app puts up after that.
shot 03-state

# The collapsed diagnostics, if present.
tap "Developer" "diagnostics" && sleep 3 && shot 04-diagnostics

say "== done =="
