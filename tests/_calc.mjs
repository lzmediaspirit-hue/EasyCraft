import './_exit.mjs';
function evaluate(input) {
  const src = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  const tokens = src.match(/\d+\.?\d*|[+\-*/()]/g);
  if (!tokens) return null;

  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  /** ביטוי: חיבור וחיסור */
  function expr() {
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
  function term() {
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
  function factor() {
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

export { evaluate };
