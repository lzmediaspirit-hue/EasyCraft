import './_exit.mjs';
/** בדיקת מנוע התכנון האוטומטי: כללי מטבח על מספרים, בלי ממשק. */
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');

const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const A = await import('/src/features/design/autoPlan.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const R = await import('/src/catalog/kitchenRules.ts' + v);
  const B = await import('/src/catalog/builtins.ts' + v);

  const wall = (id, len, features = [], turn) => ({
    id, name: id, lengthMm: len, heightMm: 2600, features, turnDeg: turn,
  });
  const mk = (walls) => ({ walls, plan: P.buildPlan(walls, []) });
  const APP = { fridge: true, oven: true, hob: true, microwave: true, dishwasher: true, hood: true };
  const input = (walls, over = {}) => ({
    ...mk(walls), appliances: APP, seating: false, finish: 'standard', ...over,
  });

  const log = [];
  const ok = (name, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  /* --- 1. קיר יחיד --- */
  const single = input([wall('w1', 4000)]);
  const ps1 = A.planKitchen(single);
  ok('קיר יחיד מייצר הצעות', ps1.length === 3, `${ps1.length}`);
  ok('כל ההצעות בקיר יחיד הן single', ps1.every((p) => p.layout === 'single'));

  /* --- 2. שום ארגז לא חורג מהקיר, ואין חפיפה --- */
  const overlap = (p, walls) => {
    for (const wid of new Set(p.units.map((u) => u.wallId))) {
      const L = walls.find((w) => w.id === wid).lengthMm;
      for (const lvl of ['floor', 'tall', 'wall']) {
        const row = p.units.filter((u) => u.wallId === wid && !u.free
          && (lvl === 'wall' ? u.level === 'wall' : u.level !== 'wall'))
          .sort((a, b) => a.xMm - b.xMm);
        for (let i = 0; i < row.length; i++) {
          if (row[i].xMm < 0 || row[i].xMm + row[i].widthMm > L + 1) return `חורג: ${row[i].catalogKey} ${row[i].xMm}+${row[i].widthMm} > ${L}`;
          if (i && row[i].xMm < row[i - 1].xMm + row[i - 1].widthMm - 1) return `חפיפה: ${row[i - 1].catalogKey}/${row[i].catalogKey}`;
        }
        if (lvl === 'wall') break;
      }
    }
    return null;
  };
  const rooms = {
    'קיר יחיד 4מ': [wall('w1', 4000)],
    'שני קירות L': [wall('w1', 3600), wall('w2', 2800, [], 90)],
    'שלושה קירות U': [wall('w1', 3000), wall('w2', 2600, [], 90), wall('w3', 3000, [], 90)],
    'ארבעה קירות': [wall('w1', 4200), wall('w2', 3400, [], 90), wall('w3', 4200, [], 90), wall('w4', 3400, [], 90)],
    'קיר קטן': [wall('w1', 1500)],
    'עם דלת באמצע': [wall('w1', 5000, [{ id: 'd', kind: 'door', xMm: 2000, yMm: 0, widthMm: 900, heightMm: 2100 }])],
    'עם חלון': [wall('w1', 4000, [{ id: 'c', kind: 'window', xMm: 1500, yMm: 1000, widthMm: 1200, heightMm: 1200 }])],
  };
  for (const [name, walls] of Object.entries(rooms)) {
    for (const p of A.planKitchen(input(walls))) {
      const bad = overlap(p, walls);
      ok(`${name} · ${p.key}`, bad === null, bad ?? `${p.units.length} ארגזים, ציון ${p.score.total}`);
    }
  }

  /* --- 3. הפינה: הקיר השני מתחיל אחרי עומק הארון + סתימה --- */
  const Lroom = rooms['שני קירות L'];
  for (const p of A.planKitchen(input(Lroom)).filter((x) => x.layout === 'l')) {
    const second = p.units.filter((u) => u.wallId === 'w2' && !u.free);
    const first = Math.min(...second.map((u) => u.xMm));
    ok(`פינה ${p.key} מתחילה ב-675`, first >= R.KITCHEN.baseDepthMm + R.BLIND_CORNER.fillerMm, `${first}`);
  }

  /* --- 4. חלון חוסם ארון עליון ולא ארון תחתון --- */
  for (const p of A.planKitchen(input(rooms['עם חלון'])).filter((x) => x.priority !== 'economical')) {
    const bad = p.units.filter((u) => u.level === 'wall' && u.xMm < 2700 && u.xMm + u.widthMm > 1500);
    ok(`חלון · ${p.key} בלי עליון מעליו`, bad.length === 0, bad.map((b) => b.xMm).join());
    const under = p.units.filter((u) => u.level !== 'wall' && u.xMm < 2700 && u.xMm + u.widthMm > 1500);
    ok(`חלון · ${p.key} עדיין תחתונים מתחתיו`, under.length > 0);
  }

  /* --- 5. דלת חוסמת הכול --- */
  for (const p of A.planKitchen(input(rooms['עם דלת באמצע']))) {
    const bad = p.units.filter((u) => !u.free && u.xMm < 2900 && u.xMm + u.widthMm > 2000);
    ok(`דלת · ${p.key} לא נחסמת`, bad.length === 0, bad.map((b) => b.catalogKey).join());
  }

  /* --- 6. עדיפות חסכונית: בלי עליונים, ופחות ארגזים --- */
  const l = A.planKitchen(input(rooms['שני קירות L']));
  const eco = l.find((p) => p.priority === 'economical');
  const sto = l.find((p) => p.priority === 'storage');
  ok('חסכוני בלי עליונים', eco.units.every((u) => u.level !== 'wall'));
  ok('אחסון עם עליונים', sto.units.some((u) => u.level === 'wall'));
  ok('אחסון יותר ארגזים מחסכוני', sto.score.boxes > eco.score.boxes, `${sto.score.boxes} מול ${eco.score.boxes}`);

  /* --- 7. אין ארון רגיל מעל כיריים --- */
  for (const p of A.planKitchen(input(rooms['קיר יחיד 4מ']))) {
    const hob = p.units.find((u) => u.role === 'hob');
    if (!hob) continue;
    const above = p.units.filter((u) => u.level === 'wall' && u.xMm < hob.xMm + hob.widthMm && u.xMm + u.widthMm > hob.xMm);
    ok(`מעל הכיריים · ${p.key}`, above.every((u) => u.catalogKey === 'k-up-hood'), above.map((u) => u.catalogKey).join());
  }

  /* --- 8. סדר התנועה: מקרר לפני כיור לפני כיריים --- */
  for (const p of A.planKitchen(input(rooms['קיר יחיד 4מ']))) {
    const idx = (r) => p.units.findIndex((u) => u.role === r);
    const f = idx('fridge'), s = idx('sink'), h = idx('hob');
    ok(`סדר תנועה · ${p.key}`, f < s && s < h, `${f}/${s}/${h}`);
  }

  /* --- 9. כיריים לא צמודות לקצה --- */
  for (const [name, walls] of Object.entries(rooms)) {
    for (const p of A.planKitchen(input(walls))) {
      const hob = p.units.find((u) => u.role === 'hob');
      if (!hob) continue;
      const L = walls.find((w) => w.id === hob.wallId).lengthMm;
      ok(`כיריים ${name} · ${p.key}`, hob.xMm >= R.SAFETY.hobFromWallMm && L - (hob.xMm + hob.widthMm) >= R.SAFETY.hobFromWallMm - 1, `x=${hob.xMm} L=${L}`);
    }
  }

  /* --- 10. חדר קטן: אין הצעה, ויש סיבה --- */
  const tiny = A.planKitchen(input(rooms['קיר קטן']));
  ok('קיר 1500 עדיין נותן הצעה', tiny.length > 0);
  ok('חדר בלי קירות מסביר למה', /אין קירות/.test(A.whyNothing([])));
  ok('קיר קצר מסביר למה', /1200/.test(A.whyNothing(P.buildPlan([wall('w1', 800)], []))));

  /* --- 11. רוחבים חוקיים --- */
  for (const [name, walls] of Object.entries(rooms)) {
    for (const p of A.planKitchen(input(walls))) {
      /* כל רוחב חייב להיות רוחב שהפריט בספרייה באמת נבנה בו */
      const bad = p.units.filter((u) => {
        const it = (B.SEED_CATALOG ?? []).find((i) => i.key === u.catalogKey);
        return !u.free && it && !it.widths.includes(u.widthMm);
      });
      ok(`רוחבי ספרייה ${name} · ${p.key}`, bad.length === 0,
        bad.map((b) => `${b.catalogKey}=${b.widthMm}`).join());
    }
  }

  /* --- 12. מכשירים שירדו מדווחים --- */
  const narrow = A.planKitchen(input([wall('w1', 1500)]));
  ok('מה שלא נכנס מדווח', narrow.some((p) => p.dropped.length > 0), JSON.stringify(narrow[0]?.dropped ?? []));

  /* --- 13. ישיבה: אי רק כשיש מקום --- */
  const big = [wall('w1', 5000), wall('w2', 4500, [], 90), wall('w3', 5000, [], 90), wall('w4', 4500, [], 90)];
  const smallR = [wall('w1', 2600), wall('w2', 2200, [], 90), wall('w3', 2600, [], 90), wall('w4', 2200, [], 90)];
  const withSeat = A.planKitchen(input(big, { seating: true }));
  ok('חדר גדול מקבל אי', withSeat.some((p) => p.units.some((u) => u.free)), '');
  const noSeat = A.planKitchen(input(smallR, { seating: true }));
  ok('חדר קטן מוותר על אי ומסביר', noSeat.every((p) => !p.units.some((u) => u.free)) && noSeat.every((p) => p.dropped.some((d) => /ישיבה/.test(d))));

  /* --- 14. מקבילי רק כשהמעבר מספיק --- */
  const wideGal = P.buildPlan([wall('w1', 4000), wall('w2', 3000, [], 90), wall('w3', 4000, [], 90)], []);
  const tightGal = P.buildPlan([wall('w1', 4000), wall('w2', 2000, [], 90), wall('w3', 4000, [], 90)], []);
  ok('מעבר רחב מרשה מקבילי', A.layoutsFor(wideGal).includes('galley'), A.layoutsFor(wideGal).join());
  ok('מעבר צר פוסל מקבילי', !A.layoutsFor(tightGal).includes('galley'), A.layoutsFor(tightGal).join());

  /* --- 15. אין מפתח ספרייה מומצא --- */
  const keys = new Set((B.SEED_CATALOG ?? []).map((i) => i.key));
  const seen = new Set();
  for (const [, walls] of Object.entries(rooms)) {
    for (const p of A.planKitchen(input(walls, { seating: true }))) for (const u of p.units) seen.add(u.catalogKey);
  }
  const missing = [...seen].filter((k) => !keys.has(k));
  ok('כל המפתחות קיימים בספרייה', keys.size > 0 && missing.length === 0, `${missing.join()} (ספרייה: ${keys.size})`);

  /* --- 16. אורקל גאומטרי: אף שתי תיבות אינן חודרות זו לזו --- */
  const PL = await import('/src/features/design/placement.ts' + v);
  const C = await import('/src/features/design/collision.ts' + v);
  const seed = new Map((B.SEED_CATALOG ?? []).map((i) => [i.key, i]));
  const asUnit = (pl, i) => {
    const it = seed.get(pl.catalogKey);
    return {
      id: 'u' + i, projectId: 'p', wallId: pl.wallId, catalogItemId: pl.catalogKey,
      name: it.name, glyph: it.glyph, level: it.level,
      xMm: pl.xMm, yMm: it.level === 'wall' ? it.y : 0,
      widthMm: pl.widthMm, heightMm: it.h, depthMm: it.d,
      socleMm: it.socle, counterMm: it.counter, free: pl.free,
      createdAt: 0, updatedAt: 0,
    };
  };
  for (const [name, walls] of Object.entries(rooms)) {
    for (const q of A.planKitchen(input(walls, { seating: true }))) {
      const us = q.units.map(asUnit);
      const pl = P.buildPlan(walls, us);
      const hits = [];
      for (let i = 0; i < us.length; i++) {
        for (let j = i + 1; j < us.length; j++) {
          const a = PL.unitBox(us[i], pl), b = PL.unitBox(us[j], pl);
          if (a && b && C.clash(a, b)) hits.push(`${us[i].name}@${us[i].xMm}/${us[j].name}@${us[j].xMm}`);
        }
      }
      ok(`אין חדירה ${name} · ${q.key}`, hits.length === 0, hits.slice(0, 3).join(' , '));
    }
  }

  return log;
});

await browser.close();
const fails = out.filter((l) => l.startsWith('FAIL'));
console.log(out.join('\n'));
console.log(`\n${out.length - fails.length}/${out.length} עברו`);
process.exit(fails.length ? 1 : 0);
