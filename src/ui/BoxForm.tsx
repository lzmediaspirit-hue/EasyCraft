import { GLYPH_FAMILIES, glyphsOf } from '../catalog/glyphList';
import { commonGlyphs, isCommonGlyph } from '../catalog/glyphPicks';
import { constructionCaps } from '../catalog/construction';
import { useState, type ReactNode } from 'react';
import type { RoomKind } from '../db/types';
import { KITCHEN } from '../catalog/standards';
import { limitsFor } from '../catalog/saveGate';
import { GlyphPreview } from '../catalog/GlyphPreview';
import { ProductionGap } from '../catalog/CabinetThumbnail';
import { Field, Chip, NumField, inputClass, selectOnFocus } from './Field';

/** תיאור מלא של ארגז — משותף לפריט בספרייה ולארגז שכבר מונח על הקיר. */
export interface BoxSpec {
  name: string;
  glyph: string;
  doors: number;
  /** שורות מגירות */
  drawers: number;
  /** עמודות מגירות — מגירות זו לצד זו ברוחב אחיד */
  drawerCols: number;
  shelves: number;
  /** מגירה חיצונית עם חזית בולטת, או פנימית מאחורי דלתות */
  drawerStyle: 'outer' | 'inner';
  widthMm: number;
  heightMm: number;
  depthMm: number;
  yMm: number;
  socleMm: number;
  counterMm: number;
}

const COUNTS = [0, 1, 2, 3, 4, 5, 6];
const COLS = [1, 2, 3, 4];
const SHELF_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * טופס בניית ארגז. מציג רק את ההגדרות שהאיור שנבחר באמת תומך בהן,
 * ומראה תצוגה מקדימה חיה של התוצאה.
 */
export function BoxForm({
  value,
  onChange,
  namePlaceholder,
  composed,
  room,
  identity,
}: {
  value: BoxSpec;
  onChange: (patch: Partial<BoxSpec>) => void;
  namePlaceholder?: string;
  /**
   * החדר שבשבילו נבנה הארגז — קובע אילו איורים מוצגים ראשונים.
   * בלעדיו מוצגים הנפוצים בכל חדר.
   */
  room?: RoomKind;
  /**
   * זהות הארגז — חדר, קבוצה, וכל מה ששייך ל"מה זה" ולא ל"איך הוא
   * בנוי". נכנס מיד אחרי השם, לפני בחירת האיור: מי שעונה קודם
   * "ארון מטבח תחתון" רואה אחר כך את האיורים של מטבח.
   */
  identity?: ReactNode;
  /**
   * פנים הארון מתואר באזורים שאי אפשר לסכם במספר אחד — שני אזורי
   * מגירות, או קושרת שמחלקת אותם לעמודות. מספר יחיד כאן היה
   * הבטחה שאינה מתקיימת: הוא נשמר, והארון נשאר כפי שהיה.
   */
  composed?: boolean;
}) {
  const caps = constructionCaps(value.glyph);
  /*
   * מכשיר חשמלי נקנה שלם, ולכן אין בו מה לבנות: סוקל, משטח, דלתות
   * ומדפים הם שאלות על ארגז. מה שכן נשאל עליו הוא המידה שלו ואיפה
   * הוא עומד — וזה בדיוק מה שהנגר מודד בקטלוג של היצרן.
   */
  const bought = !!caps.standalone;
  /* גוף ארון — מה שיש לו רגליים בתוך הגובה. לוח בודד ומכשיר אינם כאלה */
  const body = !bought && !caps.noCarcass;
  /* הגבולות והתוויות של שדות המידה נגזרים ממה שהמוצר הוא */
  const limits = limitsFor(value.glyph);
  /* העובי שנבחר, כדי שכיבוי המשטח לא ימחק אותו */
  const [lastCounter, setLastCounter] = useState(value.counterMm || KITCHEN.counterH);
  /* הרשימה הקצרה של החדר, והמתג שפותח את כולן */
  const short = commonGlyphs(room);
  const [all, setAll] = useState(() => !isCommonGlyph(value.glyph, room));

  return (
    <div className="cabinet-form space-y-5">
      <div className="cabinet-preview flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
        <span className="shrink-0 text-stone-500">
          <GlyphPreview
            glyph={value.glyph}
            widthMm={value.widthMm || 600}
            heightMm={value.heightMm || 720}
            doors={value.doors}
            drawers={value.drawers}
            drawerCols={value.drawerCols}
            shelves={value.shelves}
            drawerStyle={value.drawerStyle}
            className="h-20 w-20"
          />
        </span>
        <span className="shrink-0 text-stone-400">
          <GlyphPreview
            glyph={value.glyph}
            widthMm={value.widthMm || 600}
            heightMm={value.heightMm || 720}
            doors={value.doors}
            drawers={value.drawers}
            drawerCols={value.drawerCols}
            shelves={value.shelves}
            drawerStyle={value.drawerStyle}
            inside
            className="h-20 w-20"
          />
        </span>
        <p className="text-sm leading-snug text-stone-500">
          חזית ופנים הארון, בפרופורציה של המידות שהזנת.
        </p>
      </div>

      {/*
        תצוגה יפה אינה אישור לייצור.
        אם התבנית אינה כוללת את הנישה או הפרזול שהשם והאיור
        מבטיחים — זה נאמר כאן, ליד התמונה עצמה.
      */}
      <ProductionGap item={value} />

      <Field label="שם הארגז">
        <input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onFocus={selectOnFocus}
          className={inputClass}
          placeholder={namePlaceholder}
        />
      </Field>

      {identity}

      {/*
        האיורים.

        שלושים וארבעה ברשת אחת הם רשימה שמחפשים בה: מי שחיפש כיור
        עבר בדרך על מראה, נעליים ותלייה כפולה. מה שמוצג הוא מה
        שבאמת נבנה בחדר הזה, וכל השאר במרחק לחיצה — לפי משפחות,
        כי ארון, פינה, מכשיר ולוח הם ארבע שאלות שונות.

        ארגז שהאיור שלו אינו ברשימה הקצרה פותח אותה מעצמו: רשימה
        שאינה מכילה את מה שנבחר מראה "לא נבחר כלום".
      */}
      <Field group label="איור">
        {all ? (
          <div className="space-y-2.5">
            {GLYPH_FAMILIES.map((fam) => {
              const list = glyphsOf(fam.key);
              if (!list.length) return null;
              return (
                <div key={fam.key}>
                  <p className="mb-1 text-[10px] font-medium text-stone-400">{fam.label}</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {list.map((g) => (
                      <GlyphButton
                        key={g.key}
                        glyph={g.key}
                        label={g.label}
                        active={g.key === value.glyph}
                        onClick={() => onChange({ glyph: g.key })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {short.map((g) => (
                <GlyphButton
                  key={g.key}
                  glyph={g.key}
                  label={g.label}
                  active={g.key === value.glyph}
                  onClick={() => onChange({ glyph: g.key })}
                />
              ))}
            </div>
            <button
              onClick={() => setAll(true)}
              className="mt-2 text-xs font-medium text-oak-700 underline underline-offset-2"
            >
              כל האיורים
            </button>
          </>
        )}
      </Field>

      {!bought && caps.doors && (
        <Field group label="דלתות" hint="0 = בלי חזית">
          <div className="flex flex-wrap gap-1.5">
            {COUNTS.map((n) => (
              <Chip key={n} active={n === value.doors} onClick={() => onChange({ doors: n })}>
                <span className="num">{n}</span>
              </Chip>
            ))}
          </div>
        </Field>
      )}

      {!bought && caps.drawers && composed && (
        <Field group label="שורות מגירות">
          <p className="text-[11px] leading-snug text-stone-500">
            פנים הארון מתואר באזורים — שנה אותו בעריכה המתקדמת, בהדמיה.
          </p>
        </Field>
      )}

      {!bought && caps.drawers && !composed && (
        <>
          <Field group label="שורות מגירות">
            <div className="flex flex-wrap gap-1.5">
              {COUNTS.map((n) => (
                <Chip
                  key={n}
                  active={n === value.drawers}
                  onClick={() => onChange({ drawers: n })}
                >
                  <span className="num">{n}</span>
                </Chip>
              ))}
            </div>
          </Field>

          {value.drawers > 0 && (
            <>
              <Field group label="מגירות לרוחב" hint="מגירות זו לצד זו בגובה אחיד">
                <div className="flex flex-wrap gap-1.5">
                  {COLS.map((n) => (
                    <Chip
                      key={n}
                      active={n === value.drawerCols}
                      onClick={() => onChange({ drawerCols: n })}
                    >
                      <span className="num">{n}</span>
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field group label="סוג המגירה">
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={value.drawerStyle !== 'inner'}
                    onClick={() => onChange({ drawerStyle: 'outer' })}
                  >
                    חזית בולטת
                  </Chip>
                  <Chip
                    active={value.drawerStyle === 'inner'}
                    onClick={() => onChange({ drawerStyle: 'inner' })}
                  >
                    פנימית מאחורי דלתות
                  </Chip>
                </div>
              </Field>
            </>
          )}
        </>
      )}

      {!bought && caps.shelves && (
        <Field group label="מדפים" hint="נראים בתצוגת פנים הארון">
          <div className="flex flex-wrap gap-1.5">
            {SHELF_COUNTS.map((n) => (
              <Chip key={n} active={n === value.shelves} onClick={() => onChange({ shelves: n })}>
                <span className="num">{n}</span>
              </Chip>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-5">
        <NumField label="רוחב" value={value.widthMm} minMm={limits.minWidthMm}
          onChange={(v) => onChange({ widthMm: v })} />
        {/*
          "גובה" של ארגז ו"גובה" של מדף אינם אותו דבר: באחד זה
          המרחק מהרצפה לתקרה שלו, ובשני זה עובי הלוח. מינימום של
          50 מ״מ שהוחל על שניהם הפך מדף של 30 ל-50 בלי לומר מילה
          — הטופס "תיקן" מידה תקינה לגמרי.

          ובארגז נשאלת דווקא מידת הגוף. הגובה השמור הוא גוף ועוד
          רגליים, ולכן שדה שמראה את הסכום ומעליו שדה רגליים נפרד
          הופך כל שינוי ברגליים לשינוי שקט בגוף: מי שהעלה רגליים
          מ-100 ל-150 קיצר את הארון בחמישה ס״מ בלי לבקש.
        */}
        <NumField
          label={body ? 'גובה גוף' : limits.heightLabel}
          value={body ? value.heightMm - value.socleMm : value.heightMm}
          minMm={limits.minHeightMm}
          maxMm={limits.maxHeightMm}
          inMm={limits.heightInMm}
          onChange={(v) => onChange({ heightMm: body ? v + value.socleMm : v })}
        />
        <NumField label="עומק" value={value.depthMm} minMm={limits.minDepthMm}
          onChange={(v) => onChange({ depthMm: v })} />
        {/* סוקל ומשטח הם חלקים שנחתכים, ולמכשיר קנוי אין כאלה */}
        {!bought && (
          <NumField
            label="גובה רגליים"
            value={value.socleMm}
            onChange={(v) =>
              /* הגוף נשאר כפי שהוא, והגובה השמור נספר מחדש. רגליים מעמידות על הרצפה */
              onChange({ socleMm: v, heightMm: value.heightMm - value.socleMm + v, ...(v > 0 ? { yMm: 0 } : {}) })
            }
          />
        )}
        {/*
          רגליים מעמידות את הארגז על הרצפה, ולכן "גובה מהרצפה" הוא
          שאלה רק כשאין להן. שני שדות שסותרים זה את זה באותו מסך
          הם שאלה שאין לה תשובה נכונה.
        */}
        {(bought || value.socleMm === 0) && (
          <NumField label="גובה מהרצפה" value={value.yMm} onChange={(v) => onChange({ yMm: v })} />
        )}
      </div>

      {/*
        משטח עבודה — יש או אין, ואז כמה עבה.
        מספר לבדו אינו אומר מה הכבוי שלו: אפס נראה כמו שדה שלא
        מולא, ומי שרצה להוריד משטח לא ידע שזה מה שהוא עושה. העובי
        האחרון נזכר, כדי שכיבוי והדלקה לא ימחקו מידה שנבחרה.
      */}
      {!bought && (
        <Field group label="משטח עבודה">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              active={value.counterMm > 0}
              onClick={() => onChange({ counterMm: value.counterMm > 0 ? value.counterMm : lastCounter })}
            >
              יש
            </Chip>
            <Chip
              active={value.counterMm === 0}
              onClick={() => {
                if (value.counterMm > 0) setLastCounter(value.counterMm);
                onChange({ counterMm: 0 });
              }}
            >
              אין
            </Chip>
          </div>
          {value.counterMm > 0 && (
            <div className="mt-3 max-w-40">
              <NumField
                label="עובי המשטח"
                inMm
                minMm={1}
                value={value.counterMm}
                onChange={(v) => {
                  setLastCounter(v);
                  onChange({ counterMm: v });
                }}
              />
            </div>
          )}
        </Field>
      )}
    </div>
  );
}

/**
 * כפתור איור אחד. הרשימה הקצרה והרשימה המלאה מציגות את אותו דבר
 * ולכן מציירות אותו מקוד אחד — שתי עותקות של אותה רשת היו נפרדות
 * בשינוי הראשון.
 */
function GlyphButton({
  glyph,
  label,
  active,
  onClick,
}: {
  glyph: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      /*
       * "מדפים" הוא גם שם של איור וגם כותרת של שדה. שם נגיש מפורש
       * מבדיל ביניהם — למי שמקריא את המסך, ולבדיקות.
       */
      aria-label={`איור ${label}`}
      aria-pressed={active}
      className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 transition-colors ${
        active
          ? 'border-oak-500 bg-oak-50 text-oak-700'
          : 'border-stone-200 bg-white text-stone-400 hover:border-oak-300'
      }`}
    >
      <GlyphPreview glyph={glyph} widthMm={600} heightMm={720} doors={2} drawers={3} shelves={2}
        className="h-8 w-full" />
      <span className="w-full truncate text-[9px] leading-none">{label}</span>
    </button>
  );
}
