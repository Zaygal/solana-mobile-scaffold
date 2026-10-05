#!/bin/sh
# Capture the app as a brand-new user sees it.
#
# The review's acceptance test starts cold: a fresh install with no wallet app
# present, which is the most important first impression and the one nothing has
# ever looked at. This screenshots each step and prints the visible text, so the
# interface can be judged as an interface rather than read out of the source.
#
# Learnings carried forward rather than rediscovered:
#   - match labels case-sensitively as substrings (tab labels render uppercase)
#   - read the real screen size from the device
#   - never swallow a parse error
#   - NEW: uiautomator intermittently declines to write its dump file, typically
#     while the app is animating. The old version pulled that file with the error
#     sent to /dev/null, so a MISSING dump and an EMPTY screen looked identical,
#     and the whole walk died on the first fixable failure. Retry, read with cat,
#     and print the reason.
#   - NEW: one failed tap must not abort the remaining screens. The walk used &&
#     chains, so the first miss produced exactly two screenshots out of seven.

set -u
ADB="adb -e"
OUT="capture.txt"
mkdir -p shots
: > "$OUT"

say() { echo "$@" | tee -a "$OUT"; }

APK=$(find apk -name '*.apk' 2>/dev/null | head -1)
[ -z "$APK" ] && APK=$(find . -name '*.apk' 2>/dev/null | head -1)
if [ -z "$APK" ]; then
  say "no APK found to install; the download step produced nothing"
  exit 1
fi
say "installing $APK"
$ADB install -r -g "$APK" >/dev/null 2>&1 || $ADB install -r "$APK" >/dev/null 2>&1
say "install exit: $?"

PKGS=$($ADB shell pm list packages -3 2>/dev/null | sed 's/package://' | tr -d '\r')
say "third-party packages: $(echo "$PKGS" | tr '\n' ' ')"
PKG=$(echo "$PKGS" | grep -iE 'scaffold|clock' | head -1)
[ -z "$PKG" ] && PKG=$(echo "$PKGS" | head -1)
if [ -z "$PKG" ]; then
  say "no third-party package installed - the APK did not install"
  exit 1
fi
say "package: $PKG"

# Dump the current UI into $1. Returns non-zero and leaves LASTDUMP explaining
# itself when the device would not produce one.
LASTDUMP=""
grab() {
  target="$1"
  LASTDUMP=""
  for attempt in 1 2 3; do
    $ADB shell rm -f /sdcard/ui.xml >/dev/null 2>&1
    LASTDUMP=$($ADB shell uiautomator dump /sdcard/ui.xml 2>&1 | tr -d '\r' | tr '\n' ' ')
    $ADB shell cat /sdcard/ui.xml > "$target" 2>/dev/null
    if [ -s "$target" ]; then
      LASTDUMP=""
      return 0
    fi
    sleep 2
  done
  return 1
}

# Print every visible string on the dump. Truncation was hiding the cause once
# already: the bottom navigation renders LAST in the tree, so a 700-character cap
# cut off precisely the labels the walk was searching for.
visible() {
  python3 - "$1" <<'PY' 2>&1
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
seen = list(dict.fromkeys(seen))
joined = " | ".join(seen)
print("   nodes=%d strings=%d" % (len(list(root.iter('node'))), len(seen)))
print("   %s" % joined[:1600])
if len(joined) > 1600:
    print("   ...TAIL... %s" % joined[-500:])
PY
}

shot() {
  $ADB exec-out screencap -p > "shots/$1.png" 2>/dev/null
  say "== $1 =="
  if grab "dump-$1.xml"; then
    visible "dump-$1.xml" | tee -a "$OUT"
  else
    say "   NO DUMP after 3 attempts. uiautomator said: $LASTDUMP"
  fi
}

tap() {
  want="$1"; label="$2"
  if ! grab "dump-tap-$label.xml"; then
    say "  [$label] NO DUMP after 3 attempts: $LASTDUMP"
    return 1
  fi
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
    say "  [$label] no element matching '$want' - what IS on screen follows"
    visible "dump-tap-$label.xml" | tee -a "$OUT"
    return 1
  fi
  set -- $coords
  say "  [$label] tapping '$want' at ($1,$2)"
  $ADB shell input tap "$1" "$2"
  sleep 3
  return 0
}

# The app re-renders every second - the round countdown ticks - so uiautomator
# never observes an idle hierarchy and refuses to dump anything after onboarding
# ("ERROR: could not get idle state"). Measured from the captured screenshot:
# four fixed columns whose label row sits at y = 0.93 of the screen height, with
# column centres at 1/8, 3/8, 5/8 and 7/8 of the width. Used only when the text
# lookup fails, so this stays a fallback rather than the mechanism.
TAB_Y=0.93
tap_tab() {
  col="$1"; label="$2"
  size=$($ADB shell wm size 2>/dev/null | sed -n 's/.*: *\([0-9]*\)x\([0-9]*\).*/\1 \2/p' | tr -d '\r')
  set -- $size
  W=${1:-1080}; H=${2:-2340}
  X=$(awk "BEGIN{printf \"%d\", $W*$col}")
  Y=$(awk "BEGIN{printf \"%d\", $H*$TAB_Y}")
  say "  [$label] no dump available; tapping the tab column at ($X,$Y) of ${W}x${H}"
  $ADB shell input tap "$X" "$Y"
  sleep 3
}

say "== starting the app =="
$ADB shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
$ADB shell pidof "$PKG" >/dev/null 2>&1 || say "the app is not running after launch - nothing to capture"
shot 01-onboarding

# Leave onboarding. Skip is on every panel; Continue is the fallback. A second run
# has already been onboarded, so a miss here is expected rather than a failure.
# Every step below uses ';' not '&&': one miss must not cost the other screens.
tap "Skip" "onboarding-skip" || { tap "Continue" "ob-1"; sleep 1; tap "Continue" "ob-2"; sleep 1; tap "Get started" "ob-3"; }
sleep 4
shot 02-today

# The four destinations, each independent of the others' success. Text lookup
# first; the coordinate fallback covers the case where no dump is obtainable.
tap "RECORD" "tab-record"  || tap_tab 0.375 "tab-record";  sleep 2; shot 03-record
tap "VERIFY" "tab-verify"  || tap_tab 0.625 "tab-verify";  sleep 2; shot 04-verify
tap "PROFILE" "tab-profile" || tap_tab 0.875 "tab-profile"; sleep 2; shot 05-profile
tap "TODAY" "tab-today"    || tap_tab 0.125 "tab-today";   sleep 2; shot 06-today-returning

say "== done =="
