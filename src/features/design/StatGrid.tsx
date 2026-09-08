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
 * המחוון עצמו, לפי המפתח שלו.
 * הפרדה בין "מה מוצג" ל"באיזה סדר" — הסדר שייך לרשת, והתוכן כאן.
 */
export function statTile(
  key: StatKey,
  wall: Wall,
  units: PlacedUnit[],
  analysis: WallAnalysis,
): React.ReactNode {
  switch (key) {
    case 'wallArea':
      return (
        <Stat
          label="שטח הקיר"
          value={((wall.lengthMm / 1000) * (wall.heightMm / 1000)).toFixed(2)}
          unit="מ״ר"
        />
      );
    case 'wallHeight':
      return <Stat label="גובה הקיר" value={cm(wall.heightMm)} unit={unitLabel()} />;
    case 'floorMeters':
      return <Stat label="מטר רץ תחתון" value={meters(analysis.floorUsedMm)} unit="מ׳" />;
    case 'unitCount':
      return <Stat label="ארגזים" value={String(units.length)} />;
    case 'freeSpace':
      return (
        <Stat
          label={analysis.freeMm >= 0 ? 'נשאר על הקיר' : 'חריגה'}
          value={cm(Math.abs(analysis.freeMm))}
          unit={unitLabel()}
          tone={analysis.freeMm < 0 ? 'bad' : 'plain'}
        />
      );
    case 'frontArea':
      return (
        <Stat
          label="שטח חזיתות"
          value={units
            .reduce((n, u) => n + (u.widthMm / 1000) * (u.heightMm / 1000), 0)
            .toFixed(2)}
          unit="מ״ר"
        />
      );
  }
}
