import { useRef, useState } from 'react';
import { Stat } from '../../ui/Stat';
import { cm, meters, unitLabel } from '../../ui/units';
import type { StatKey } from './viewOptions';
import type { WallAnalysis } from './analysis';
import type { PlacedUnit, Wall } from '../../db/types';

/**
 * מחווני הקיר, בסדר שאפשר לשנות בגרירה.
 *
 * לכל נגר יש מספר אחד שהוא מסתכל עליו קודם — אצל אחד זה מטר רץ,
 * אצל אחר מה שנשאר על הקיר — ולכן הסדר הוא בחירה ולא נתון. גרירה
 * היא הדרך שבה מסדרים דברים על מסך מגע, ולכן היא כאן ולא רק
 * כחיצים במגירת ההגדרות.
 *
 * הסדר משתנה תוך כדי הגרירה ולא בשחרור: רואים לאן זה הולך לפני
 * שמשחררים, וזה מה שהופך גרירה לוודאית.
 */
export function StatGrid({
  order,
  shown,
  render,
  onReorder,
}: {
  /** כל המחוונים, לפי הסדר השמור */
  order: StatKey[];
  /** האם המחוון דלוק. כבוי אינו מוצג, אבל שומר את מקומו בסדר */
  shown: (key: StatKey) => boolean;
  render: (key: StatKey) => React.ReactNode;
  onReorder: (next: StatKey[]) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  /** המחוון שנמצא כרגע ביד, והסדר הזמני שנראה על המסך */
  const [dragKey, setDragKey] = useState<StatKey | null>(null);
  const [preview, setPreview] = useState<StatKey[] | null>(null);

  const live = preview ?? order;
  const visible = live.filter(shown);
  if (visible.length === 0) return null;

  /** המחוון שהאצבע נמצאת מעליו כרגע. */
  function keyUnder(x: number, y: number): StatKey | null {
    const grid = gridRef.current;
    if (!grid) return null;
    for (const el of grid.querySelectorAll<HTMLElement>('[data-stat]')) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return (el.dataset.stat as StatKey) ?? null;
      }
    }
    return null;
  }

  function moveTo(target: StatKey) {
    if (!dragKey || target === dragKey) return;
    setPreview(() => {
      const next = [...live];
      const from = next.indexOf(dragKey);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return next;
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-3 gap-2"
      onPointerMove={(e) => {
        if (!dragKey) return;
        const target = keyUnder(e.clientX, e.clientY);
        if (target) moveTo(target);
      }}
      onPointerUp={() => {
        if (preview) onReorder(preview);
        setDragKey(null);
        setPreview(null);
      }}
      onPointerCancel={() => {
        setDragKey(null);
        setPreview(null);
      }}
    >
      {visible.map((key) => (
        <div
          key={key}
          data-stat={key}
          onPointerDown={(e) => {
            /*
             * תפיסת המצביע יושבת על הרשת ולא על האריח: האצבע עוברת
             * מאריח לאריח, ותפיסה על האריח עצמו הייתה בולעת את
             * התנועה מעליו.
             */
            e.currentTarget.parentElement?.setPointerCapture(e.pointerId);
            setDragKey(key);
          }}
          className={`cursor-grab touch-none transition-transform active:cursor-grabbing ${
            dragKey === key ? 'scale-95 opacity-70' : ''
          }`}
        >
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
