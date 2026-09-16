import { useEffect, useState } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import { catalogRepo } from '../../catalog/catalogRepo';
import { roomsRepo } from '../../catalog/roomsRepo';
import { glyphDef } from '../../catalog/glyphList';
import { autoShelves } from '../../catalog/CabinetGlyph';
import { drawerRows, drawersAreSimple, zonesWithDrawerRows } from '../../catalog/zones';
import { GROUP_LABELS } from '../../catalog/rooms';
import { KITCHEN } from '../../catalog/standards';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton } from '../../ui/Field';

import { BoxForm, type BoxSpec } from '../../ui/BoxForm';
import { TrashIcon } from '../../ui/icons';
import { CUSTOM_ROOM, type CatalogGroup, type CatalogItem, type RoomKind, type UnitLevel } from '../../db/types';

const GROUPS: CatalogGroup[] = ['base', 'upper', 'tall', 'storage', 'island', 'shelf', 'panel'];
/** המפלס נגזר מהקבוצה — פחות החלטות למשתמש. */
const LEVEL_BY_GROUP: Record<CatalogGroup, UnitLevel> = {
  base: 'floor',
  upper: 'wall',
  tall: 'tall',
  storage: 'floor',
  island: 'floor',
  shelf: 'wall',
  panel: 'floor',
};

/** גובה תחתית ברירת מחדל לפי קבוצה. */
const Y_BY_GROUP: Record<CatalogGroup, number> = {
  base: KITCHEN.socleH,
  upper: KITCHEN.upperBottom,
  tall: KITCHEN.socleH,
  storage: 80,
  island: 0,
  shelf: KITCHEN.upperBottom,
  panel: 0,
};

/** בניית ארגז חדש לספרייה, או עריכת ארגז קיים. */
export function CustomItemSheet({
  item,
  roomKind,
  defaultGroup,
  onClose,
}: {
  item: CatalogItem | null;
  roomKind: RoomKind;
  defaultGroup: CatalogGroup;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<CatalogGroup>(item?.group ?? defaultGroup);
  /*
   * המק״ט — מזהה פנימי, לא שדה במסך.
   *
   * הוא מה שמונע כפילות: שמירה או ייבוא תחת מק״ט קיים מעדכנים את
   * הארגז שנושא אותו. לנגר אין מה לעשות איתו, ולכן הוא נוצר לבד
   * לפי הקטגוריה ואינו מוצג. ארגז קיים שומר את שלו.
   */
  const [code, setCode] = useState(item?.code ?? '');
  const [favorite, setFavorite] = useState(!!item?.favorite);

  useEffect(() => {
    if (item?.code) return;
    let live = true;
    void catalogRepo.nextCode(group).then((next) => live && setCode(next));
    return () => {
      live = false;
    };
  }, [group, item?.code]);

  /* החדרים שאפשר לסמן — מהטבלה, כדי שחדר שנוסף יופיע כאן מיד */
  const roomChoices = useLiveQuery(() => roomsRepo.all(), [], []);
  const [rooms, setRooms] = useState<RoomKind[]>(
    item?.rooms ?? (roomKind === CUSTOM_ROOM ? [] : [roomKind]),
  );
  /*
   * ארגז חדש בחדר ללא סוג מסומן לכל החדרים הקיימים: הוא נבנה בלי
   * חדר מסוים בראש, ורשימה ריקה הייתה מסתירה אותו מכל ספרייה.
   */
  useEffect(() => {
    if (item || roomKind !== CUSTOM_ROOM || !roomChoices.length) return;
    setRooms((prev) => (prev.length ? prev : roomChoices.map((r) => r.id)));
  }, [item, roomKind, roomChoices]);
  const [spec, setSpec] = useState<BoxSpec>({
    name: item?.name ?? '',
    glyph: item?.glyph ?? 'doors',
    doors: item?.doors ?? 2,
    /* מה שבארון בפועל: אזורים מפורשים גוברים על השדה הישן */
    drawers: item ? drawerRows(asUnit(item)) : 3,
    drawerCols: item?.drawerCols ?? 1,
    shelves: item?.shelves ?? autoShelves(item?.defaultHeightMm ?? 720),
    /* מהארגז השמור, לא מקבוע: מגירה פנימית חזרה להיות חזית בולטת */
    drawerStyle: item?.drawerStyle ?? 'outer',

    widthMm: item?.defaultWidthMm ?? 600,
    heightMm: item?.defaultHeightMm ?? 720,
    depthMm: item?.defaultDepthMm ?? 580,
    yMm: item?.defaultYMm ?? Y_BY_GROUP[defaultGroup],
    socleMm: item?.socleMm ?? 0,
    counterMm: item?.counterMm ?? 0,
  });

  const canSave = spec.name.trim().length > 0 && spec.widthMm > 0 && spec.heightMm > 0 && rooms.length > 0;

  function changeGroup(g: CatalogGroup) {
    setGroup(g);
    if (!item) setSpec((s) => ({ ...s, yMm: Y_BY_GROUP[g] }));
  }

  /* פריט שפנימו מתואר באזורים מורכבים אינו מקבל מספר מגירות יחיד */
  const composed = !!item && !drawersAreSimple(asUnit(item));

  async function save() {
    const caps = glyphDef(spec.glyph);
    /* שינוי המספר מגיע גם אל האזור עצמו, שאחרת גובר עליו */
    const zones =
      item && caps.drawers && !composed
        ? zonesWithDrawerRows(asUnit(item), spec.drawers)
        : undefined;
    await catalogRepo.saveCustom({
      id: item?.id,
      rooms,
      group,
      name: spec.name.trim(),
      glyph: spec.glyph,
      ...(zones ? { zones } : {}),
      doors: caps.doors ? spec.doors : undefined,
      drawers: caps.drawers ? spec.drawers : undefined,
      drawerCols: caps.drawers ? spec.drawerCols : undefined,
      drawerStyle: caps.drawers ? spec.drawerStyle : undefined,
      shelves: caps.shelves ? spec.shelves : undefined,

      level: LEVEL_BY_GROUP[group],
      defaultWidthMm: spec.widthMm,
      widthOptionsMm: widthLadder(spec.widthMm),
      defaultHeightMm: spec.heightMm,
      defaultDepthMm: spec.depthMm,
      defaultYMm: spec.yMm,
      /*
       * אפס נשמר כאפס ולא כ"לא צוין". `saveCustom` משמיט שדות ריקים
       * כדי לא לדרוס מה שלא נערך, ולכן ביטול של רגליים או של משטח
       * נקרא כ"אל תיגע" — והמספר הישן חזר בפתיחה הבאה.
       */
      socleMm: spec.socleMm,
      counterMm: spec.counterMm,
      code: code.trim() || undefined,
      favorite,
      note: item?.note,
    });
    onClose();
  }

  /*
   * הסרה מהספרייה. ארגז שהמשתמש בנה נמחק; ארגז שהגיע עם האפליקציה
   * רק יורד מהרשימות, ואפשר להחזיר אותו משם. בשני המקרים פרויקטים
   * קיימים אינם נפגעים — הארגז שהונח שמר את המידות שלו בעצמו.
   */
  async function remove() {
    if (!item) return;
    await catalogRepo.remove(item.id);
    onClose();
  }

  return (
    <Sheet
      title={item ? 'עריכת ארגז' : 'ארגז חדש'}
      onClose={onClose}
      tall
      footer={
        <div className="flex items-center gap-2">
          {item && (
            <button
              onClick={remove}
              aria-label="מחיקה מהספרייה"
              className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          )}
          <div className="flex-1">
            <PrimaryButton disabled={!canSave} onClick={save}>
              שמירה בספרייה
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <BoxForm
          value={spec}
          composed={composed}
          onChange={(patch) => setSpec((s) => ({ ...s, ...patch }))}
          namePlaceholder="למשל: שידה עם שש מגירות"
        />

        <div className="space-y-5 border-t border-stone-100 pt-5">
          {/*
            מועדף: מה שבאמת מרכיבים בנגרייה, מתוך כל מה שקיים.
            זו רשימה נפרדת מהחדר ומהקטגוריה ואינה מחליפה אותם.
          */}
          <Field group label="ארגזים מועדפים">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={favorite} onClick={() => setFavorite(true)}>
                מועדף
              </Chip>
              <Chip active={!favorite} onClick={() => setFavorite(false)}>
                לא מועדף
              </Chip>
            </div>
          </Field>

          <Field group label="קבוצה בספרייה">

            <div className="flex flex-wrap gap-1.5">
              {GROUPS.map((g) => (
                <Chip key={g} active={g === group} onClick={() => changeGroup(g)}>
                  {GROUP_LABELS[g]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field group label="באילו חדרים יופיע">
            <div className="flex flex-wrap gap-1.5">
              {roomChoices.map((r) => (
                <Chip
                  key={r.id}
                  active={rooms.includes(r.id)}
                  onClick={() =>
                    setRooms((prev) =>
                      prev.includes(r.id) ? prev.filter((k) => k !== r.id) : [...prev, r.id],
                    )
                  }
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/** סולם רוחבים סביב הרוחב שנבחר, מעוגל ל-5 ס"מ. */
function widthLadder(w: number): number[] {
  const raw = [w * 0.5, w * 0.75, w, w * 1.25, w * 1.5];
  const rounded = raw.map((v) => Math.max(50, Math.round(v / 50) * 50));
  return [...new Set(rounded)].sort((a, b) => a - b);
}

/**
 * פריט ספרייה בלשון של ארגז מונח.
 * חישוב האזורים מדבר על `heightMm`, ולפריט יש `defaultHeightMm` —
 * אותה מידה, שני שמות.
 */
function asUnit(item: CatalogItem) {
  return { ...item, heightMm: item.defaultHeightMm };
}
