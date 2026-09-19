import './_exit.mjs';
/**
 * הכפתור האוטומטי: מה שהוצע — אפשר להניח.
 *
 * הבדיקה אינה על "יצאו הצעות" אלא על החוזה שבין המתכנן לשער
 * ההנחה: כל הצעה שמוצגת חייבת לעבור את `resolvePlan` בלי חסם.
 * עד כאן השניים מדדו בשני גבהים — המתכנן מול 90 ס"מ של התקן
 * ושער ההנחה מול המשטח שנשמר בפועל — וחלון שסִפּוֹ בגובה המשטח
 * פסל את שלוש ההצעות בכל מטבח.
 *
 * מטריצה: תשעה חדרים × שש צורות חדר × שישה מצבי סימונים.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/');

const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const A = await import('/src/features/design/autoPlan.ts' + v);
  const PR = await import('/src/features/design/planRoom.ts' + v);
  const RP = await import('/src/features/design/roomProfiles.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const RES = await import('/src/features/design/planResolve.ts' + v);
  const SH = await import('/src/catalog/shipped.ts' + v);
  const PD = await import('/src/catalog/products.ts' + v);

  const items = [
    ...SH.SHIPPED_LIBRARY,
    ...PD.SHIPPED_PRODUCTS.filter((p) => !SH.SHIPPED_LIBRARY.some((i) => i.id === p.id)),
  ].map((i) => ({ ...i, workshopId: '', rev: 0, createdAt: 0, updatedAt: 0 }));

  /* משטח 92 ס"מ — מה שהנגרייה עובדת בו, ולא 90 של התקן */
  const COUNTER_TOP = 920;
  const defaults = {
    drawerBox: 'metal', backKind: 'thin', socleMm: 100,
    counterTopMm: COUNTER_TOP, counterMm: 20,
  };

  const wall = (id, len, features = [], turn) =>
    ({ id, name: id, lengthMm: len, heightMm: 2600, features, turnDeg: turn });
  const door = (x, w = 900) => ({ id: 'd' + x, kind: 'door', xMm: x, widthMm: w, yMm: 0, heightMm: 2100 });
  const win = (x, w = 1200, y = 900) => ({ id: 'n' + x, kind: 'window', xMm: x, widthMm: w, yMm: y, heightMm: 1000 });
  const lowWin = (x, w = 1200) => ({ id: 'lw' + x, kind: 'window', xMm: x, widthMm: w, yMm: 300, heightMm: 1400 });
  const pillar = (x, w = 300) => ({ id: 'p' + x, kind: 'pillar', xMm: x, widthMm: w, yMm: 0, heightMm: 2600 });

  const shapes = {
    'קיר יחיד': () => [wall('w1', 4000)],
    'שני קירות': () => [wall('w1', 4000), wall('w2', 3000, [], 90), wall('w3', 4000, [], 90)],
    'פינה': () => [wall('w1', 4000), wall('w2', 3000, [], 90)],
    'חדר סגור': () => [wall('w1', 4000), wall('w2', 3000, [], 90), wall('w3', 4000, [], 90), wall('w4', 3000, [], 90)],
    'חדר קטן': () => [wall('w1', 2500), wall('w2', 2200, [], 90), wall('w3', 2500, [], 90), wall('w4', 2200, [], 90)],
  };
  const marks = {
    'נקי': () => [],
    'דלת': () => [door(1500)],
    /* חלון שסִפּוֹ בדיוק בגובה המשטח — זה מה שפסל הכול */
    'חלון בגובה המשטח': () => [win(1400)],
    'חלון נמוך': () => [lowWin(1400)],
    'עמוד': () => [pillar(1800)],
    'דלת ליד הפינה': () => [door(400)],
    'דלת+חלון+עמוד': () => [door(400), win(1800), pillar(3200)],
  };

  const rooms = ['kitchen', 'closet', 'bedroom', 'bathroom', 'children', 'office', 'living', 'utility', 'entrance'];
  const APP = { fridge: true, oven: true, hob: true, microwave: true, dishwasher: true, hood: true };

  const log = [];
  let cases = 0;
  let proposals = 0;
  const blockedAt = [];
  const emptyAt = [];

  for (const room of rooms) {
    const profile = RP.roomProfile(room);
    const options = Object.fromEntries((profile?.options ?? []).map((o) => [o.key, o.on]));
    const roomItems = items.filter((i) => i.rooms.includes(room));
    for (const [sn, mk] of Object.entries(shapes)) {
      for (const [mn, mf] of Object.entries(marks)) {
        cases++;
        const walls = mk();
        walls[0] = { ...walls[0], features: mf().filter((f) => f.xMm + f.widthMm <= walls[0].lengthMm) };
        const plan = P.buildPlan(walls, []);
        const ps = profile
          ? PR.planRoom({ room, walls, plan, items: roomItems, options })
          : A.planKitchen({ walls, plan, appliances: APP, seating: false, finish: 'standard', counterTopMm: COUNTER_TOP });
        if (!ps.length) { emptyAt.push(`${room}/${sn}/${mn}`); continue; }
        for (const p of ps) {
          proposals++;
          const r = RES.resolvePlan({
            placements: p.units, items, walls, defaults, room,
            nameOf: (pl) => (profile ? PR.roomPlacementName(pl, roomItems) : A.placementName(pl)),
          });
          if (r.issues.length) blockedAt.push(`${room}/${sn}/${mn}/${p.key}: ${r.issues[0].text}`);
        }
      }
    }
  }
  const ok = (name, cond, extra = '') =>
    log.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  ok('המטריצה רצה במלואה', cases === rooms.length * 5 * 7, `${cases}`);
  ok('כל הצעה שמוצגת ניתנת להנחה', blockedAt.length === 0, blockedAt.slice(0, 3).join(' ; '));
  ok('כמעט כל מצב מייצר הצעות', emptyAt.length <= 6, emptyAt.join(' ; '));
  ok('נבדקו מאות הצעות', proposals > 600, `${proposals}`);

  /* --- הבדיקות הנקודתיות, על הסיבות עצמן --- */

  /* 1. חלון שסִפּוֹ בגובה המשטח: המתכנן מודד לפי המשטח של הנגרייה */
  const winWall = [wall('w1', 4000, [win(1400)])];
  const winPlan = P.buildPlan(winWall, []);
  const spans90 = A.baseSpans(winPlan[0], 0, 4000, 900);
  const spans92 = A.baseSpans(winPlan[0], 0, 4000, 920);
  ok('חלון בסף 900 אינו חוסם ארגז שמגיע ל-900', spans90.length === 1);
  ok('ואותו חלון כן חוסם ארגז שמגיע ל-920', spans92.length === 2,
    JSON.stringify(spans92));

  /* 2. עמודה אינה נכנסת מתחת לחלון */
  const k = A.planKitchen({
    walls: winWall, plan: winPlan, appliances: APP,
    seating: false, finish: 'standard', counterTopMm: 920,
  });
  const underWindow = k.flatMap((p) => p.units).filter(
    (u) => u.level === 'tall' && u.xMm < 2600 && u.xMm + u.widthMm > 1400,
  );
  ok('אין עמודה מתחת לחלון', underWindow.length === 0, JSON.stringify(underWindow));

  /* 3. ארון פינה מתה אינו נוחת על דלת */
  const cornerWalls = [
    wall('w1', 2500, [door(1400)]), wall('w2', 2200, [], 90),
    wall('w3', 2500, [], 90), wall('w4', 2200, [], 90),
  ];
  const cornerPlan = P.buildPlan(cornerWalls, []);
  const kc = A.planKitchen({
    walls: cornerWalls, plan: cornerPlan, appliances: APP,
    seating: false, finish: 'standard', counterTopMm: 920,
  });
  const onDoor = kc.flatMap((p) => p.units).filter(
    (u) => u.wallId === 'w1' && u.level !== 'wall' && u.xMm < 2300 && u.xMm + u.widthMm > 1400,
  );
  ok('שום ארגז תחתון אינו נוחת על הדלת', onDoor.length === 0, JSON.stringify(onDoor));

  /* 4. הפינה שיש בה דלת אינה נמסרת לקיר הקודם */
  const ringWalls = [
    wall('w1', 4000, [door(400)]), wall('w2', 3000, [], 90),
    wall('w3', 4000, [], 90), wall('w4', 3000, [], 90),
  ];
  const ringPlan = P.buildPlan(ringWalls, []);
  const closet = PR.planRoom({
    room: 'closet', walls: ringWalls, plan: ringPlan,
    items: items.filter((i) => i.rooms.includes('closet')),
    options: { double: true, drawers: true, shoes: true, island: false },
  });
  const last = closet[0].units.filter((u) => u.wallId === 'w4');
  const reach = last.length ? Math.max(...last.map((u) => u.xMm + u.widthMm)) : 0;
  ok('הקיר האחרון עוצר לפני הפינה שיש בה דלת', reach <= 3000 - 400, `${reach}`);

  /* 5. קיר שנחתך לפתחים קטנים אינו נשאר ריק */
  const cutWalls = [wall('w1', 4000, [door(400), win(1800), pillar(3200)])];
  const cut = A.planKitchen({
    walls: cutWalls, plan: P.buildPlan(cutWalls, []), appliances: APP,
    seating: false, finish: 'standard', counterTopMm: 920,
  });
  ok('קיר מחורר מקבל אחסון ולא כלום', cut.length > 0 && cut[0].units.length > 0,
    `${cut.length} הצעות`);

  return log;
});

await browser.close();
for (const line of out) console.log(line);
const bad = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - bad}/${out.length} עברו`);
process.exit(bad ? 1 : 0);
