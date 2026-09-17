#!/bin/sh
# חבילות החוזה — מה שחייב לעבור לפני שהאפליקציה עולה לאוויר.
#
# הסבב המלא הוא מאה ועשרים חבילות בדפדפן אמיתי, וזה יותר מדי כדי
# לעצור בו כל פרסום. מה שכן עוצר פרסום הוא החוזים שאם הם נשברים
# הנגר מקבל רשימת חיתוך שגויה או מאבד ארגז: זהות בשמירה ובייבוא,
# אפס שנשאר אפס, איור שאינו משנה את מה שבפנים, והספרייה מול
# הגיליון. הסבב המלא רץ לפני מיזוג, ביד.
#
# דורש שרת פיתוח פעיל על 5173.
cd "$(dirname "$0")"

# הדפדפן. ברירת המחדל שבתוך החבילות היא הנתיב של סביבת הפיתוח כאן;
# במקום שבו הוא אינו קיים — CI, מכונה אחרת — נשאל Playwright עצמו
# איפה הדפדפן שהוא התקין.
DEV_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
if [ -z "$CHROME_PATH" ] && [ ! -x "$DEV_CHROME" ]; then
  CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())" 2>/dev/null)
  export CHROME_PATH
fi

SUITES="l137b l138 l140 l141 l143 l144 l145 l146 l147 l148"

if ! curl -sf -o /dev/null http://localhost:5173/; then
  echo "אין שרת על http://localhost:5173 — הרץ 'npm run dev' בחלון אחר"
  exit 1
fi

bad=0
for name in $SUITES; do
  f="$name.mjs"
  if [ ! -f "$f" ]; then
    echo "== $f == חסר"
    bad=$((bad + 1))
    continue
  fi
  out=$(node "$f" 2>&1)
  code=$?
  lines=$(printf '%s' "$out" | grep -c "^FAIL\|PAGEERROR\|[1-9][0-9]* fail" || true)
  if [ "$code" -ne 0 ] || [ "$lines" -gt 0 ]; then
    bad=$((bad + 1))
    echo "== $f == (יציאה $code)"
    printf '%s\n' "$out" | grep "^FAIL\|PAGEERROR\|Error" | head -8
  else
    echo "ok $f"
  fi
done

if [ "$bad" -gt 0 ]; then
  echo ""
  echo "$bad חבילות חוזה נכשלו — אין פרסום"
  exit 1
fi
echo ""
echo "כל חבילות החוזה עברו"
