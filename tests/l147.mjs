import './_exit.mjs';
/*
 * שכבה 147 — A02: אין מעגלי ייבוא בזמן ריצה.
 *
 * `zones` ייבא מ-`CabinetGlyph` שייבא מ-`zones`, ו-`projectsRepo`
 * ייבא מ-`consumptionRepo` שייבא ממנו בחזרה. מעגל כזה אינו נופל
 * תמיד — הוא נופל אצל מי שטען את הצד ה"לא נכון" ראשון, ואז מה
 * שרואים זה `undefined is not a function` בלי שום קשר לשינוי
 * האחרון. הבדיקה הזאת עוצרת את המעגל הבא בכניסה.
 *
 * ייבוא טיפוס (`import type`) אינו קיים בזמן ריצה, ולכן אינו נספר.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = execSync("find src -name '*.ts' -o -name '*.tsx'", { cwd: root })
  .toString()
  .trim()
  .split('\n');

const bare = (f) => f.replace(/\.(tsx|ts)$/, '');
const known = new Set(files.map(bare));
const graph = new Map();

for (const f of files) {
  const src = readFileSync(path.join(root, f), 'utf8');
  const deps = [];
  /* ייבוא ערך בלבד, ורק יחסי — חבילות חיצוניות אינן חלק מהגרף */
  const re = /^\s*import\s+(?!type\b)[^;]*?from\s+['"](\.[^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(src))) {
    const to = bare(path.normalize(path.join(path.dirname(f), m[1])));
    if (known.has(to)) deps.push(to);
  }
  graph.set(bare(f), deps);
}

const seen = new Map();
const stack = [];
const cycles = [];
function walk(node) {
  if (seen.get(node) === 'done') return;
  if (seen.get(node) === 'open') {
    cycles.push([...stack.slice(stack.indexOf(node)), node].join(' → '));
    return;
  }
  seen.set(node, 'open');
  stack.push(node);
  for (const d of graph.get(node) ?? []) walk(d);
  stack.pop();
  seen.set(node, 'done');
}
for (const node of graph.keys()) walk(node);

const out = [];
out.push(`${cycles.length === 0 ? 'PASS' : 'FAIL'} אין מעגלי ייבוא בזמן ריצה | ${files.length} קבצים`);
for (const c of cycles) out.push('FAIL מעגל: ' + c);

/* ושני המעגלים שנסגרו במפורש — כדי שהתיקון לא ייסוג בשקט */
const noEdge = (from, to) => !(graph.get(from) ?? []).includes(to);
out.push(
  `${noEdge('src/catalog/zones', 'src/catalog/CabinetGlyph') ? 'PASS' : 'FAIL'} ` +
    'zones אינו נשען על מנוע האיורים',
);
out.push(
  `${noEdge('src/materials/consumptionRepo', 'src/features/projects/projectsRepo') ? 'PASS' : 'FAIL'} ` +
    'מאגר הצריכה אינו נשען על מאגר הפרויקטים',
);

console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
