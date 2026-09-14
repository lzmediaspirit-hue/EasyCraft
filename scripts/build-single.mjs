/**
 * אורז את תוצרי הבנייה לקובץ HTML בודד שאפשר לפתוח בכל מקום —
 * בלי שרת, בלי קבצים נלווים.
 *
 *   npm run build:single    ->  dist/easycraft.html
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist/assets';
const files = readdirSync(dir);
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8');

const hasNonAscii = (s) => /[\u0080-\uffff]/.test(s);

// כל תו עברי נכתב כ-\uXXXX, כך שהקובץ כולו ASCII ואינו תלוי
// בכך שהמארח יכריז על קידוד UTF-8.
const escapeNonAscii = (s) =>
  s.replace(/[\u0080-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const safeJs = escapeNonAscii(js).replaceAll('</script', '<\\/script');

if (hasNonAscii(css)) throw new Error('CSS contains non-ASCII characters');
if (css.includes('</style')) throw new Error('CSS contains a closing style tag');
if (hasNonAscii(safeJs)) throw new Error('JS still contains non-ASCII characters');

/*
 * מה שהדפדפן צריך כדי להציג את הדף נכון, ולא רק את התוכן שלו.
 *
 * בלי ה-viewport, דפדפן נייד מניח דף שולחני ופורש אותו על 980
 * פיקסלים: הקובץ הבודד נפתח בטלפון מוקטן פי שניים וחצי, בזמן
 * שהאפליקציה הרגילה נפתחת ברוחב המסך. הכיוון והשפה נקבעים כאן
 * מאותה סיבה — RTL אינו החלטה של ה-CSS אלא של המסמך.
 */
const out = `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1c1917">
<title>EasyCraft</title>
<style>

${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

const target = process.argv[2] ?? 'dist/easycraft.html';
writeFileSync(target, out);
console.log(`${target} — ${(out.length / 1024).toFixed(0)}KB, ASCII בלבד: ${!hasNonAscii(out)}`);
