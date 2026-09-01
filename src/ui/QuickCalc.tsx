import { useState } from 'react';
import { Sheet } from './Sheet';
import { KeypadIcon } from './icons';

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];

/**
 * מחשבון מהיר.
 *
 * מול לקוח צריך לפעמים לחלק רוחב קיר לארונות או לחבר כמה מידות,
 * ולצאת מהאפליקציה בשביל זה שובר את השיחה. לכן הוא יושב בכותרת
 * ומחזיק את התרגיל האחרון, כדי שאפשר יהיה להמשיך ממנו.
 */
export function QuickCalcButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="מחשבון"
        title="מחשבון"
        className="shrink-0 rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800"
      >
        <KeypadIcon />
      </button>
      {open && <QuickCalcSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickCalcSheet({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');
  const live = evaluate(expr);

  function press(key: string) {
    if (key === '=') {
      // התוצאה הופכת לתרגיל הבא, כדי להמשיך לחשב ממנה
      if (live !== null) setExpr(String(live));
      return;
    }
    setExpr((e) => e + key);
  }

  return (
    <Sheet title="מחשבון" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl bg-stone-900 px-4 py-3 text-white">
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value.replace(/[^0-9+\-−*×/÷.() ]/g, ''))}
            autoFocus
            inputMode="decimal"
            aria-label="תרגיל"
            placeholder="0"
            className="num block w-full bg-transparent text-end text-2xl font-semibold placeholder:text-white/30 focus:outline-none"
          />
          <div className="num mt-1 text-end text-sm text-white/50">
            {expr.trim() === '' ? ' ' : live === null ? 'תרגיל לא שלם' : `= ${live}`}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={`num rounded-xl py-3.5 text-lg font-semibold transition-colors ${
                k === '='
                  ? 'bg-oak-600 text-white hover:bg-oak-700'
                  : '+−×÷'.includes(k)
                    ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                    : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setExpr((e) => e.slice(0, -1))}
            className="flex-1 rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
          >
            מחיקת תו
          </button>
          <button
            onClick={() => setExpr('')}
            className="flex-1 rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-200"
          >
            ניקוי
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * מחשב את התרגיל.
 *
 * הפירוק ידני ולא דרך eval — קלט של המשתמש לא הופך לקוד רץ. תומך
 * בארבע פעולות ובסוגריים, וזה מה שצריך לחישוב מהיר מול לקוח.
 */
export function evaluate(input: string): number | null {
  const src = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  const tokens = src.match(/\d+\.?\d*|[+\-*/()]/g);
  if (!tokens) return null;

  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  /** ביטוי: חיבור וחיסור */
  function expr(): number | null {
    let left = term();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = eat();
      const right = term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  /** מכפלה: כפל וחילוק */
  function term(): number | null {
    let left = factor();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = eat();
      const right = factor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  /** גורם: מספר, סימן מינוס, או סוגריים */
  function factor(): number | null {
    const t = peek();
    if (t === undefined) return null;
    if (t === '-') {
      eat();
      const v = factor();
      return v === null ? null : -v;
    }
    if (t === '(') {
      eat();
      const v = expr();
      if (v === null || eat() !== ')') return null;
      return v;
    }
    const n = Number(eat());
    return Number.isFinite(n) ? n : null;
  }

  const value = expr();
  // שאריות אחרי סוף התרגיל פירושן קלט שגוי, לא תוצאה חלקית
  if (value === null || i < tokens.length || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}
