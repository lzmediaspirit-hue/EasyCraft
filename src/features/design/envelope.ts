import { bodyHeightMm, intoRoomMm } from '../../db/types';
import type { PlacedUnit, WallFeature } from '../../db/types';
import { glyphDef } from '../../catalog/glyphList';
import { applianceOf } from '../../catalog/appliances';
import { unitFronts, unitZones, zoneBands, zoneCells } from '../../catalog/zones';
import { featureBox, rad, unitBox, unitFrame } from './placement';
import type { UnitBox } from './placement';
import type { PlanWall } from './plan';
import { boxesMeet } from './collision';

/**
 * מעטפת התנועה — המקום שדבר צריך כדי להיפתח.
 *
 * עד כאן נבדק רק מה שתופס מקום כשהוא סגור: שני גופים שחודרים זה
 * לזה. אבל ארון אינו חפץ סטטי — הדלת שלו מסתובבת רבע מעגל אל תוך
 * החדר, המגירה נשלפת קדימה כאורך המסילה, ודלת החדר סוחפת שטח
 * שלם ברצפה. רצועה של עשרה סנטימטרים בפתח אינה בדיקה שדלת נפתחת;
 * היא בדיקה שארגז אינו יושב עליה.
 *
 * מה שנבנה כאן הוא הגוף שהפתיחה סוחפת, באותה מערכת שבה נמדד
 * הארגז — ולכן אפשר לשאול עליו בדיוק את אותה שאלה של התנגשות.
 *
 * ובמפורש: מה שאין עליו נתון אינו מנוחש. מסילה שאורכה לא הוזן,
 * דלת חדר שאיש לא אמר לאיזה צד היא נפתחת, ותנור שאין לו מרווח
 * מהיצרן — כל אלה מדווחים כנתון חסר. מספר שהומצא כאן הוא ארון
 * שנבנה לפיו.
 *
 * הערה למי שקורא אחרי: החישוב הזה אינו מוצג כרגע בשום מסך.
 * ההתראות שהציגו אותו ירדו לבקשת הבעלים, והבעלים ביקש להשאיר את
 * החישוב עצמו — הוא נכון, הוא מכוסה בבדיקות (l133), והוא מה
 * שיחובר למסך ביום שבו יוחלט להציג את זה שוב. אל תמחקו אותו
 * כ"קוד מת".
 */

/** מה נפתח. */
export type OpeningKind = 'cabinetDoor' | 'lift' | 'drawer' | 'appliance' | 'roomDoor' | 'window';

const KIND_LABELS: Record<OpeningKind, string> = {
  cabinetDoor: 'דלת הארון',
  lift: 'קלאפה',
  drawer: 'מגירה',
  appliance: 'דלת המכשיר',
  roomDoor: 'דלת החדר',
  window: 'כנף החלון',
};

function openingLabel(kind: OpeningKind): string {
  return KIND_LABELS[kind];
}

/** מעטפת אחת: מי נפתח, לאן, ומה חסר כדי לדעת. */
export interface Envelope {
  /** מזהה הארגז או הסימון שהמעטפת שייכת לו */
  ownerId: string;
  ownerName: string;
  kind: OpeningKind;
  /** הגוף שהפתיחה סוחפת. ריק כשאין די נתונים כדי לשרטט אותו. */
  box: UnitBox | null;
  /** הנתון שחסר. קיים = המעטפת היא הערכה או שאינה קיימת כלל. */
  missing?: string;
}

/**
 * כמה מקום שואבת דלת שנפתחת.
 *
 * דלת על צירים מסתובבת רבע מעגל, והקשת שהיא מתארת נכנסת כולה
 * לריבוע שצלעו רוחב הכנף. זו הערכה גסה כלפי מעלה, וזה מה שרוצים:
 * מוטב להתריע על ארון שכמעט חוסם מאשר לפספס אחד שחוסם.
 */
function leafReachMm(widthMm: number, doors: number): number {
  return doors > 0 ? widthMm / doors : 0;
}

/**
 * העומק הפנוי בתוך הארגז — כמה מגירה נשלפת כשאין נתון מהיצרן.
 *
 * מסילה רגילה נשלפת כמעט כל עומק התיבה, ולכן זו הערכה סבירה —
 * אבל היא מסומנת כהערכה, ולא מוצגת כאילו נמדדה.
 */
function drawerReachMm(u: PlacedUnit): number {
  return Math.max(intoRoomMm(u) - 50, 0);
}

/** תיבה שיושבת לפני החזית של ארגז, בעומק נתון. */
function inFront(b: UnitBox, reachMm: number, y: number, h: number): UnitBox {
  const at = unitFrame(b);
  const [cx, cz] = at(b.w / 2, b.d + reachMm / 2);
  return { cx, cz, w: b.w, d: reachMm, y, h, facing: b.facing };
}

/**
 * רצועה אופקית בגוף הארון, שמשהו בה נפתח.
 *
 * הגבהים נמדדים מתחתית הגוף כלפי מעלה, כמו האזורים עצמם.
 */
interface Band {
  fromMm: number;
  toMm: number;
}

/** תחתית גוף הארון מהרצפה — מעל הרגליים. */
function bodyBottomMm(u: PlacedUnit): number {
  return u.yMm + (u.socleMm ?? 0);
}

/**
 * כל רצועת מגירות בארון, כולל פנימיות וכולל אלה שבתוך עמודה.
 *
 * הבדיקה הקודמת שאלה רק את סוג האזור העליון, ורק על מגירה
 * חיצונית. לכן מגירה פנימית מאחורי דלת ומגירה בתוך עמודת אזור לא
 * קיבלו מעטפת שליפה כלל: פתיחת הדלת אינה מייתרת את המקום שהמגירה
 * צריכה, ומכשול בין טווח הדלת לבין השליפה לא נראה.
 */
function drawerBands(u: PlacedUnit, bodyMm: number): Band[] {
  const out: Band[] = [];
  for (const { zone, top, bottom } of zoneBands(unitZones(u), bodyMm)) {
    /* `zoneBands` מודד מלמעלה; הרצועה נמדדת מלמטה */
    const band = { fromMm: bodyMm - bottom, toMm: bodyMm - top };
    if (zoneCells(zone).some((c) => c.content.kind === 'drawers' && (c.content.drawers ?? 0) > 0)) {
      out.push(band);
    }
  }
  return out;
}

/**
 * המעטפות של ארגז אחד.
 *
 * ארגז יכול להחזיק כמה מהן יחד — דלת למעלה ומגירה למטה — ולכן זו
 * רשימה ולא ערך אחד.
 */
export function unitEnvelopes(u: PlacedUnit, plan: PlanWall[]): Envelope[] {
  const box = unitBox(u, plan);
  if (!box) return [];
  const def = glyphDef(u.glyph);
  const out: Envelope[] = [];
  const own = { ownerId: u.id, ownerName: u.name };

  /*
   * מכשיר עצמאי אינו ארון שאנחנו בונים, אבל מרווח הפתיחה שלו אינו
   * נעלם: דלת תנור נופלת קדימה, דלת מקרר מסתובבת ומדיח נפתח כלפי
   * מטה, ולכל אחד מהם מידת תקן. מי שהזין מידה משלו מקבל אותה;
   * מי שלא — מקבל את התקן, ולא "נתון חסר" על שאלה שיש לה תשובה.
   */
  if (def.standalone) {
    const std = applianceOf(u);
    const reach = u.openClearanceMm ?? std?.openClearanceMm;
    out.push({
      ...own,
      kind: 'appliance',
      box: reach ? inFront(box, reach, u.yMm, u.heightMm) : null,
      missing: reach ? undefined : 'מרווח הפתיחה של המכשיר',
    });
    return out;
  }

  const bodyMm = bodyHeightMm(u);
  const bottom = bodyBottomMm(u);
  const fronts = unitFronts({ ...u, heightMm: bodyMm }, bodyMm);

  if (u.opening !== 'sliding') {
    for (const f of fronts) {
      if (f.doors <= 0) continue;
      const h = f.toMm - f.fromMm;
      if (u.opening === 'lift') {
        /*
         * קלאפה אינה סוחפת רצפה אלא אוויר מעליה: היא מתרוממת ונשארת
         * פתוחה מעל הארון. מה שחוסם אותה הוא ארון שמעליו, ולכן
         * המעטפת עולה מהתקרה של הגוף.
         */
        out.push({
          ...own,
          kind: 'lift',
          box: { ...box, y: u.yMm + u.heightMm, h: leafReachMm(h, f.doors) },
        });
        continue;
      }
      /*
       * מעטפת לכל קומת חזית בנפרד, ברוחב הכנף שלה ובגובה שלה.
       *
       * הסכימה הקודמת חיברה את כל הכנפיים בארון לספירה אחת: ארון
       * ברוחב 800 עם שתי קומות ובכל קומה שתי דלתות קיבל 800 חלקי
       * ארבע — טווח פתיחה של 200 מ״מ במקום 400. כנף אינה מתקצרת
       * מפני שיש עוד כנף מעליה.
       *
       * דלת אחת בלי צד צירים — לא ידוע לאן היא נפתחת, ולכן
       * המעטפת מכסה את כל החזית. זו ההערכה הבטוחה, והיא מספיקה:
       * הבחירה הידנית של צד הצירים ירדה מהעורך, ולכן "חסר צד
       * הצירים" הייתה הודעה שאין ממנה דרך החוצה.
       */
      out.push({
        ...own,
        kind: 'cabinetDoor',
        box: inFront(box, leafReachMm(u.widthMm, f.doors), bottom + f.fromMm, h),
      });
    }
  }

  /*
   * שליפת מגירה, לכל רצועת מגירות בגובה שלה.
   *
   * המעטפת נמתחת על כל רוחב הארון גם כשהמגירה יושבת בעמודה אחת:
   * זו הערכה כלפי מעלה, והיא מסומנת ככזאת. מוטב להתריע על מכשול
   * שאינו בדרך מאשר לפספס אחד שכן.
   */
  const reach = u.openClearanceMm ?? drawerReachMm(u);
  for (const band of drawerBands(u, bodyMm)) {
    out.push({
      ...own,
      kind: 'drawer',
      box: reach > 0 ? inFront(box, reach, bottom + band.fromMm, band.toMm - band.fromMm) : null,
      missing: u.openClearanceMm ? undefined : 'אורך השליפה של המסילה',
    });
  }

  return out;
}

/**
 * המעטפת של דלת חדר או חלון.
 *
 * רק מה שנפתח פנימה סוחף שטח בחדר. נגררת אינה סוחפת דבר, ומה
 * שנפתח החוצה נפתח אל מחוץ לחדר — שניהם מעטפת ריקה ולא אזהרה.
 */
export function featureEnvelope(f: WallFeature, p: PlanWall): Envelope | null {
  if (f.kind !== 'door' && f.kind !== 'window') return null;
  const kind: OpeningKind = f.kind === 'door' ? 'roomDoor' : 'window';
  const label = kind === 'roomDoor' ? 'דלת החדר' : 'החלון';
  const own = { ownerId: f.id, ownerName: label };

  if (!f.swing) {
    return { ...own, kind, box: null, missing: `לאן נפתחת ${label}` };
  }
  if (f.swing !== 'in') return null;

  /*
   * הכנף מסתובבת סביב הצירים שלה, והריבוע שצלעו רוחב הכנף מכיל
   * את כל הקשת. בלי צד הצירים אין דרך לדעת לאיזה צד — והמעטפת
   * נמתחת על כל הפתח, שזו ההערכה הבטוחה.
   */
  const a = rad(p.headingDeg);
  const dir = { x: Math.cos(a), z: Math.sin(a) };
  const normal = { x: -Math.sin(a), z: Math.cos(a) };
  const reach = f.widthMm;
  const cxAlong = f.xMm + f.widthMm / 2;
  return {
    ...own,
    kind,
    box: {
      w: f.widthMm,
      d: reach,
      y: f.yMm,
      h: f.heightMm,
      cx: p.start.x + dir.x * cxAlong + normal.x * (reach / 2),
      cz: p.start.y + dir.z * cxAlong + normal.z * (reach / 2),
      facing: a + Math.PI / 2,
    },
    missing: f.hingeSide ? undefined : `צד הצירים של ${label}`,
  };
}

/** כל המעטפות בחדר: של הארגזים ושל הפתחים שבקירות. */
export function roomEnvelopes(units: PlacedUnit[], plan: PlanWall[]): Envelope[] {
  const out: Envelope[] = [];
  for (const u of units) out.push(...unitEnvelopes(u, plan));
  for (const p of plan) {
    for (const f of p.wall.features) {
      const e = featureEnvelope(f, p);
      if (e) out.push(e);
    }
  }
  return out;
}

/** התנגשות בין מעטפת פתיחה לגוף אחר — ושני העצמים נקובים בשמם. */
export interface EnvelopeClash {
  envelope: Envelope;
  /** הגוף שעומד בדרך */
  blockerId: string;
  blockerName: string;
}

/** שם קריא לסימון מבני שחוסם פתיחה. */
const FEATURE_LABEL: Partial<Record<WallFeature['kind'], string>> = {
  pillar: 'עמוד',
  step: 'מדרגה',
};

/**
 * מי חוסם את מי.
 *
 * המעטפת נבדקת מול הגופים עצמם ולא מול מעטפות אחרות: דלת שנפתחת
 * אל מול דלת אחרת היא עניין של סדר פתיחה, וארון שעומד בדרכה של
 * דלת הוא פשוט חסימה. הבעלים עצמו מוחרג — דלת אינה חוסמת את
 * הארון שהיא תלויה עליו.
 */
export function envelopeClashes(
  envelopes: Envelope[],
  units: PlacedUnit[],
  plan: PlanWall[],
): EnvelopeClash[] {
  const boxes = units
    .map((u) => ({ u, b: unitBox(u, plan) }))
    .filter((x): x is { u: PlacedUnit; b: UnitBox } => x.b !== null)
    .filter((x) => !glyphDef(x.u.glyph).cladding);

  /*
   * עמוד ומדרגה חוסמים מגירה בדיוק כמו ארגז.
   *
   * המעטפת נבדקה מול ארגזים בלבד, ולכן מגירה שנפתחת אל תוך עמוד
   * בטון עברה בשקט: גוף הארגז פנוי, והמגירה אינה. הם נמדדים
   * באותה מערכת ובאותה שאלה — `boxesMeet` — ולכן אין כאן קירוב.
   *
   * מה שבולט לחדר בלבד: חלון ושקע שטוחים על הקיר אינם חוסמים
   * פתיחה, והם כבר נבדקים כמעטפת בפני עצמם.
   */
  const solids: { id: string; name: string; b: UnitBox }[] = [];
  for (const p of plan) {
    for (const f of p.wall.features) {
      const label = FEATURE_LABEL[f.kind];
      if (!label) continue;
      const bite = f.depthMm ?? 0;
      if (bite <= 0) continue;
      solids.push({ id: f.id, name: label, b: featureBox(f, p, bite) });
    }
  }

  const out: EnvelopeClash[] = [];
  for (const e of envelopes) {
    if (!e.box) continue;
    for (const { u, b } of boxes) {
      if (u.id === e.ownerId) continue;
      if (!boxesMeet(e.box, b)) continue;
      out.push({ envelope: e, blockerId: u.id, blockerName: u.name });
    }
    for (const sol of solids) {
      if (sol.id === e.ownerId) continue;
      if (!boxesMeet(e.box, sol.b)) continue;
      out.push({ envelope: e, blockerId: sol.id, blockerName: sol.name });
    }
  }
  return out;
}

/**
 * "דלת הארון של ארגז תנור" — משפט, ולא שני שדות.
 *
 * לדלת החדר ולחלון השם הוא כבר מה שנפתח, ולכן אין מה להוסיף לו:
 * "דלת החדר של דלת החדר" אינו משפט.
 */
export function envelopeOwnerLabel(e: Envelope): string {
  if (e.kind === 'roomDoor' || e.kind === 'window') return e.ownerName;
  return `${openingLabel(e.kind)} של ${e.ownerName}`;
}
