#!/bin/sh
# כל חבילות הבדיקה, אחת אחרי השנייה.
#
# דורש שרת פיתוח פעיל על 5173 (npm run dev) — הבדיקות מריצות את
# האפליקציה האמיתית בדפדפן אמיתי, ולא מדמות אותה.
#
# נכשלת = שורת FAIL אמיתית או שגיאת דף.
cd "$(dirname "$0")"

if ! curl -sf -o /dev/null http://localhost:5173/; then
  echo "אין שרת על http://localhost:5173 — הרץ 'npm run dev' בחלון אחר"
  exit 1
fi

bad_total=0
for f in l*.mjs _scene.mjs _paint.mjs _angles.mjs _plan.mjs _render.mjs _ray.mjs; do
  out=$(node "$f" 2>&1)
  bad=$(printf '%s' "$out" | grep -c "^FAIL\|PAGEERROR\|[1-9][0-9]* fail\|[1-9][0-9]* wrong of\|[1-9][0-9]* בעיות" || true)
  if [ "$bad" -gt 0 ]; then
    bad_total=$((bad_total + 1))
    echo "== $f =="
    printf '%s\n' "$out" | grep "^FAIL\|PAGEERROR\|fail\|wrong of" | head -6
  else
    echo "ok $f"
  fi
done

if [ "$bad_total" -gt 0 ]; then
  echo ""
  echo "$bad_total חבילות נכשלו"
  exit 1
fi
