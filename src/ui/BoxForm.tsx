import { GLYPH_FAMILIES, glyphDef, glyphsOf } from '../catalog/glyphList';
import { limitsFor } from '../catalog/saveGate';
import { GlyphPreview } from '../catalog/GlyphPreview';
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
}: {
  value: BoxSpec;
  onChange: (patch: Partial<BoxSpec>) => void;
  namePlaceholder?: string;
  /**
   * פנים הארון מתואר באזורים שאי אפשר לסכם במספר אחד — שני אזורי
   * מגירות, או קושרת שמחלקת אותם לעמודות. מספר יחיד כאן היה
   * הבטחה שאינה מתקיימת: הוא נשמר, והארון נשאר כפי שהיה.
   */
  composed?: boolean;
}) {
  const caps = glyphDef(value.glyph);
  /*
   * מכשיר חשמלי נקנה שלם, ולכן אין בו מה לבנות: סוקל, משטח, דלתות
   * ומדפים הם שאלות על ארגז. מה שכן נשאל עליו הוא המידה שלו ואיפה
   * הוא עומד — וזה בדיוק מה שהנגר מודד בקטלוג של היצרן.
   */
  const bought = !!caps.standalone;
  /* הגבולות והתוויות של שדות המידה נגזרים ממה שהמוצר הוא */
  const limits = limitsFor(value.glyph);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4">
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

      <Field label="שם הארגז">
        <input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onFocus={selectOnFocus}
          className={inputClass}
          placeholder={namePlaceholder}
        />
      </Field>

      {/*
        האיורים לפי משפחות.

        שלושים ואחד ברשת אחת הם רשימה שמחפשים בה: מי שחיפש כיור
        עבר בדרך על מראה, נעליים ותלייה כפולה. ארון, פינה, מכשיר
        ולוח הם ארבע שאלות שונות, ולכן ארבע קבוצות.
      */}
      <Field group label="איור">
        <div className="space-y-2.5">
          {GLYPH_FAMILIES.map((fam) => {
            const list = glyphsOf(fam.key);
            if (!list.length) return null;
            return (
              <div key={fam.key}>
                <p className="mb-1 text-[10px] font-medium text-stone-400">{fam.label}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {list.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => onChange({ glyph: g.key })}
                      title={g.label}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 transition-colors ${
                        g.key === value.glyph
                          ? 'border-oak-500 bg-oak-50 text-oak-700'
                          : 'border-stone-200 bg-white text-stone-400 hover:border-oak-300'
                      }`}
                    >
                      <GlyphPreview
                        glyph={g.key}
                        widthMm={600}
                        heightMm={720}
                        doors={2}
                        drawers={3}
                        shelves={2}
                        className="h-8 w-full"
                      />
                      <span className="w-full truncate text-[9px] leading-none">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
        */}
        <NumField
          label={limits.heightLabel}
          value={value.heightMm}
          minMm={limits.minHeightMm}
          inMm={limits.heightInMm}
          onChange={(v) => onChange({ heightMm: v })}
        />
        <NumField label="עומק" value={value.depthMm} minMm={limits.minDepthMm}
          onChange={(v) => onChange({ depthMm: v })} />
        <NumField
          label="גובה מהרצפה"
          value={value.yMm}
          onChange={(v) => onChange({ yMm: v })}
        />
        {/* סוקל ומשטח הם חלקים שנחתכים, ולמכשיר קנוי אין כאלה */}
        {!bought && (
          <>
            <NumField label="סוקל" value={value.socleMm} onChange={(v) => onChange({ socleMm: v })} />
            <NumField
              label="משטח עבודה"
              value={value.counterMm}
              onChange={(v) => onChange({ counterMm: v })}
            />
          </>
        )}
      </div>
    </div>
  );
}
