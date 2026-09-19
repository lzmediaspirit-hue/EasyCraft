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

  /* תשעים סנטימטר עד פני המשטח — הגובה שהבעלים קבע */
  const COUNTER_TOP = 900;
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

  /*
   * 1. המתכנן מודד לפי המשטח של הנגרייה, ולא לפי מספר קבוע.
   *
   * חלון שסִפּוֹ 90 ס"מ הוא החלון הנפוץ במטבח, והוא מותר מעל
   * שורה שראשה 90 ואסור מעל שורה שראשה 92. כל עוד המתכנן ושער
   * ההנחה קוראים את אותו מספר, שתי התשובות נכונות — וזה מה
   * שנבדק כאן, ולא איזו מהן יוצאת היום.
   */
  const winWall = [wall('w1', 4000, [win(1400)])];
  const winPlan = P.buildPlan(winWall, []);
  const spans90 = A.baseSpans(winPlan[0], 0, 4000, 900);
  const spans92 = A.baseSpans(winPlan[0], 0, 4000, 920);
  ok('חלון בסף 900 אינו חוסם ארגז שמגיע ל-900', spans90.length === 1);
  ok('ואותו חלון כן חוסם ארגז שמגיע ל-920', spans92.length === 2,
    JSON.stringify(spans92));
  /* ובנגרייה הזאת הראש הוא 90, ולכן תחתונים עוברים מתחת לחלון */
  ok('הנגרייה עובדת בראש 90, ולכן החלון אינו חוסם',
    A.baseSpans(winPlan[0], 0, 4000, COUNTER_TOP).length === 1, String(COUNTER_TOP));

  /* 2. עמודה אינה נכנסת מתחת לחלון */
  const k = A.planKitchen({
    walls: winWall, plan: winPlan, appliances: APP,
    seating: false, finish: 'standard', counterTopMm: COUNTER_TOP,
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
    seating: false, finish: 'standard', counterTopMm: COUNTER_TOP,
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

  /*
   * 5. דרישה שמסומנת במסך — יש לה פריט בספרייה.
   *
   * "מגירות פנימיות" בחדר ארונות הייתה מסומנת כברירת מחדל,
   * וביקשה מפלס `tall` בלבד. בספרייה יש בדיוק את הפריט —
   * "יחידת מגירות", איור מגירות — במפלס `floor`, ולכן כל תכנון
   * של חדר ארונות דיווח "אין בספרייה של החדר יחידה כזאת"
   * והוריד ציון על משהו שקיים.
   *
   * ובחדר השירות ירד ארון הכיור מהפרופיל עצמו, לבקשת הבעלים:
   * אין שם יחידה שמצהירה על כיור, והדרישה חזרה בכל תכנון כחוסר.
   * הרשימה כאן ריקה במכוון — דרישה שאין לה מענה בספרייה אינה
   * דרישה שמסמנים מראש.
   */
  const KNOWN_GAPS = [];
  const unmetWants = [];
  for (const prof of RP.ROOM_PROFILES) {
    const mine = items.filter((i) => i.rooms.includes(prof.room));
    for (const w of prof.wants) {
      if (w.needs && !prof.options.find((o) => o.key === w.needs)?.on) continue;
      const levels = Array.isArray(w.pick.level) ? w.pick.level : [w.pick.level];
      const has = mine.some(
        (i) =>
          levels.includes(i.level) &&
          (!w.pick.group || i.group === w.pick.group) &&
          (!w.pick.glyphs || w.pick.glyphs.includes(i.glyph)),
      );
      if (!has) unmetWants.push(`${prof.room}/${w.label}`);
    }
  }
  ok('לכל דרישה שמסומנת מראש יש פריט בספרייה',
    unmetWants.every((k) => KNOWN_GAPS.includes(k)),
    unmetWants.join(' ; '));

  /*
   * 6. חדר עם יותר מארבעה קירות.
   *
   * הפריסה `u` רצה על כל רצף הקירות השימושיים ולא על שלושה,
   * ולכן חדר L סגור בן שישה קירות וחדר בן שמונה אמורים לעבוד —
   * וזה מה שנבדק כאן, על מצולעים פשוטים בלבד. חדר שקירותיו
   * חוצים זה את זה אינו חדר, והמנוע פוסל אותו בצדק.
   */
  const many = {
    'חמישה פתוח': [wall('a', 4000), wall('b', 2500, [], 90), wall('c', 1500, [], 90),
                    wall('d', 1500, [], -90), wall('e', 2500, [], 90)],
    'שישה — L סגור': [wall('a', 4000), wall('b', 3000, [], 90), wall('c', 2000, [], 90),
                       wall('d', 2000, [], -90), wall('e', 2000, [], 90), wall('f', 5000, [], 90)],
    'שמונה — סגור': [wall('a', 5000), wall('b', 3000, [], 90), wall('c', 1500, [], 90),
                      wall('d', 1500, [], -90), wall('e', 2000, [], 90), wall('f', 1500, [], 90),
                      wall('g', 1500, [], -90), wall('h', 3000, [], 90)],
  };
  const manyBlocked = [];
  let manyCases = 0;
  let manyProposals = 0;
  for (const [sn, mk] of Object.entries(many)) {
    for (const marks of ['נקי', 'עם אובייקטים']) {
      for (const room of rooms) {
        manyCases++;
        const walls = mk.map((w) => ({ ...w, features: [] }));
        if (marks !== 'נקי') {
          walls[0] = { ...walls[0], features: [door(400), win(2200, 1000)] };
          const last = walls.length - 1;
          walls[last] = { ...walls[last], features: [pillar(600)] };
        }
        const plan = P.buildPlan(walls, []);
        const profile = RP.roomProfile(room);
        const ps = profile
          ? PR.planRoom({ room, walls, plan, items: items.filter((i) => i.rooms.includes(room)),
              options: Object.fromEntries(profile.options.map((o) => [o.key, o.on])) })
          : A.planKitchen({ walls, plan, appliances: APP, seating: false, finish: 'standard', counterTopMm: COUNTER_TOP });
        if (!ps.length) { manyBlocked.push(`${sn}/${marks}/${room}: אין הצעות`); continue; }
        for (const p of ps) {
          manyProposals++;
          const r = RES.resolvePlan({
            placements: p.units, items, walls, defaults, room,
            nameOf: (pl) => (profile ? PR.roomPlacementName(pl, items) : A.placementName(pl)),
          });
          if (r.issues.length) manyBlocked.push(`${sn}/${marks}/${room}/${p.key}: ${r.issues[0].text}`);
        }
      }
    }
  }
  ok('חדר עם חמישה עד שמונה קירות — כל ההצעות ניתנות להנחה',
    manyBlocked.length === 0, manyBlocked.slice(0, 3).join(' ; '));
  ok('ונבדקו בו הצעות מכל החדרים', manyCases === Object.keys(many).length * 2 * rooms.length && manyProposals > 100,
    `${manyCases} מקרים, ${manyProposals} הצעות`);

  /* וחדר סגור בן שישה קירות מנוצל על כל קירותיו */
  const sixWalls = many['שישה — L סגור'].map((w) => ({ ...w, features: [] }));
  const sixPlan = P.buildPlan(sixWalls, []);
  const six = A.planKitchen({
    walls: sixWalls, plan: sixPlan, appliances: APP,
    seating: false, finish: 'standard', counterTopMm: COUNTER_TOP,
  });
  const sixUsed = new Set(six[0].units.filter((u) => !u.free).map((u) => u.wallId)).size;
  ok('ובחדר L סגור הפריסה רצה על כל ששת הקירות', sixUsed === 6, String(sixUsed));

  /* 7. קיר שנחתך לפתחים קטנים אינו נשאר ריק */
  const cutWalls = [wall('w1', 4000, [door(400), win(1800), pillar(3200)])];
  const cut = A.planKitchen({
    walls: cutWalls, plan: P.buildPlan(cutWalls, []), appliances: APP,
    seating: false, finish: 'standard', counterTopMm: COUNTER_TOP,
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
