import { Stat } from '../../ui/Stat';
import { cm, meters, unitLabel } from '../../ui/units';
import type { StatKey } from './viewOptions';
import type { WallAnalysis } from './analysis';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * מחווני הקיר.
 *
 * הסדר הוא בחירה — לכל נגר יש מספר אחד שהוא מסתכל עליו קודם —
 * והוא נקבע בחיצים שבמגירת ההגדרות. על המסך עצמו הם אינם נגררים:
 * אריח שזז מתחת לאצבע בזמן שקוראים מספר הוא הפרעה, לא כלי.
 */
export function StatGrid({
  order,
  shown,
  render,
}: {
  /** כל המחוונים, לפי הסדר השמור */
  order: StatKey[];
  /** האם המחוון דלוק. כבוי אינו מוצג, אבל שומר את מקומו בסדר */
  shown: (key: StatKey) => boolean;
  render: (key: StatKey) => React.ReactNode;
}) {
  const visible = order.filter(shown);
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {visible.map((key) => (
        <div key={key} data-stat={key}>
          {render(key)}
        </div>
      ))}
    </div>
  );
}

/**
 * מה שהמחוונים מודדים: קיר אחד, או החדר כולו.
 *
 * המספרים מגיעים מוכנים ולא נגזרים כאן מהקיר ומהארגזים, כי אותם
 * שישה מחוונים צריכים לענות על שתי שאלות — "מה יש על הקיר הזה"
 * ו"מה יש בחדר" — ולסכימה של חדר אין קיר אחד שאפשר להצביע עליו.
 */
export interface StatSource {
  /** מודדים את החדר כולו ולא קיר בודד — משנה את שמות המחוונים */
  room: boolean;
  areaM2: number;
  heightMm: number;
  unitCount: number;
  floorUsedMm: number;
  freeMm: number;
  frontAreaM2: number;
}

/** קיר אחד. */
export function wallStats(wall: Wall, units: PlacedUnit[], analysis: WallAnalysis): StatSource {
  return {
    room: false,
    areaM2: (wall.lengthMm / 1000) * (wall.heightMm / 1000),
    heightMm: wall.heightMm,
    unitCount: units.length,
    floorUsedMm: analysis.floorUsedMm,
    freeMm: analysis.freeMm,
    frontAreaM2: frontAreaM2(units),
  };
}

/**
 * כל הקירות יחד.
 *
 * השטח נסכם קיר־קיר ולא כאורך הכולל כפול הגובה הגבוה: בחדר שיש בו
 * קיר נמוך מהאחרים החשבון השני היה מוסיף שטח שאינו קיים.
 */
export function roomStats(
  walls: Wall[],
  units: PlacedUnit[],
  analyze: (wall: Wall) => WallAnalysis,
): StatSource {
  let areaM2 = 0;
  let floorUsedMm = 0;
  let freeMm = 0;
  for (const wall of walls) {
    areaM2 += (wall.lengthMm / 1000) * (wall.heightMm / 1000);
    const a = analyze(wall);
    floorUsedMm += a.floorUsedMm;
    freeMm += a.freeMm;
  }
  return {
    room: true,
    areaM2,
    heightMm: Math.max(...walls.map((w) => w.heightMm), 0),
    unitCount: units.length,
    floorUsedMm,
    freeMm,
    frontAreaM2: frontAreaM2(units),
  };
}

function frontAreaM2(units: PlacedUnit[]): number {
  return units.reduce((n, u) => n + (u.widthMm / 1000) * (u.heightMm / 1000), 0);
}

/**
 * המחוון עצמו, לפי המפתח שלו.
 * הפרדה בין "מה מוצג" ל"באיזה סדר" — הסדר שייך לרשת, והתוכן כאן.
 */
export function statTile(key: StatKey, s: StatSource): React.ReactNode {
  const where = s.room ? 'בחדר' : 'על הקיר';
  switch (key) {
    case 'wallArea':
      return (
        <Stat label={s.room ? 'שטח הקירות' : 'שטח הקיר'} value={s.areaM2.toFixed(2)} unit="מ״ר" />
      );
    case 'wallHeight':
      return (
        <Stat
          label={s.room ? 'הקיר הגבוה' : 'גובה הקיר'}
          value={cm(s.heightMm)}
          unit={unitLabel()}
        />
      );
    case 'floorMeters':
      return (
        <Stat
          label={s.room ? 'מטר רץ בחדר' : 'מטר רץ תחתון'}
          value={meters(s.floorUsedMm)}
          unit="מ׳"
        />
      );
    case 'unitCount':
      return <Stat label={s.room ? 'ארגזים בחדר' : 'ארגזים'} value={String(s.unitCount)} />;
    case 'freeSpace':
      return (
        <Stat
          label={s.freeMm >= 0 ? `נשאר ${where}` : 'חריגה'}
          value={cm(Math.abs(s.freeMm))}
          unit={unitLabel()}
          tone={s.freeMm < 0 ? 'bad' : 'plain'}
        />
      );
    case 'frontArea':
      return <Stat label="שטח חזיתות" value={s.frontAreaM2.toFixed(2)} unit="מ״ר" />;
  }
}
