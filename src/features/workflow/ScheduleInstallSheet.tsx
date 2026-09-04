import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import { stagesRepo } from '../../workflow/workflowRepo';
import { Sheet } from '../../ui/Sheet';
import { SearchIcon } from '../../ui/icons';

/**
 * קביעת התקנה מתוך לוח ההתקנות.
 *
 * עד כאן מועד נקבע רק מתוך תהליך עבודה פתוח, ולכן פרויקט שנסגר —
 * וכל התקנה חוזרת, תיקון או השלמה — לא היה יכול להיכנס ללוח. אבל
 * ההתקנות האלה קורות, והלוח שלא מכיל אותן משקר למנהל כשהוא מבטיח
 * ללקוח תאריך.
 *
 * לכן: פרויקט סגור נבחר כמו כל פרויקט אחר, ושלב ההתקנה שלו נפתח
 * מחדש עם המועד. הפרויקט לא נמחק ולא משוכפל — הוא פשוט חוזר לעבודה.
 */
export function ScheduleInstallSheet({
  date,
  onClose,
}: {
  /** היום שנבחר בלוח */
  date: Date;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [includeClosed, setIncludeClosed] = useState(true);
  const [saving, setSaving] = useState(false);

  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const customers = useLiveQuery(() => customersRepo.list(), []);
  const archived = useLiveQuery(() => customersRepo.list(true), []);
  const stages = useLiveQuery(() => stagesRepo.all(), []);

  const rows = useMemo(() => {
    if (!projects || !stages) return [];
    const byId = new Map([...(customers ?? []), ...(archived ?? [])].map((c) => [c.id, c]));
    const q = query.trim();
    return projects
      .map((p) => {
        const mine = stages.filter((s) => s.projectId === p.id);
        const install = mine.find((s) => s.key === 'install');
        // פרויקט "סגור" הוא כזה שההתקנה שלו כבר נסגרה או שדילגו עליה
        const closed = install ? install.status === 'done' || install.status === 'skipped' : false;
        const customer = byId.get(p.customerId);
        return { project: p, install, closed, customer };
      })
      .filter((r) => (includeClosed ? true : !r.closed))
      .filter(
        (r) =>
          !q || r.project.name.includes(q) || (r.customer?.name.includes(q) ?? false),
      )
      .sort((a, b) => Number(a.closed) - Number(b.closed) || b.project.createdAt - a.project.createdAt);
  }, [projects, stages, customers, archived, query, includeClosed]);

  async function schedule(projectId: string, closed: boolean) {
    if (saving) return;
    setSaving(true);
    /*
     * שעה 8 בבוקר — הלוח עובד בימים ולא בשעות, וחצות היה נופל
     * ליום הקודם באזורי זמן מסוימים.
     */
    const at = new Date(date);
    at.setHours(8, 0, 0, 0);
    const list = await stagesRepo.ensure(projectId, false);
    const install = list.find((s) => s.key === 'install');
    if (install) {
      await stagesRepo.update(install.id, {
        scheduledAt: at.getTime(),
        // התקנה שנקבעה מחדש היא עבודה שממתינה, ולא עבודה שנגמרה
        ...(closed ? { status: 'active', doneAt: undefined } : {}),
      });
    }
    onClose();
  }

  return (
    <Sheet
      title={`התקנה ב־${date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}`}
      onClose={onClose}
      tall
    >
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="חיפוש לפי פרויקט או לקוח"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pe-4 ps-10 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-oak-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setIncludeClosed((v) => !v)}
          aria-pressed={includeClosed}
          className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            includeClosed
              ? 'bg-oak-600 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          כולל פרויקטים שנסגרו
        </button>

        {rows.length === 0 ? (
          <p className="pt-10 text-center text-sm text-stone-500">לא נמצאו פרויקטים.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.project.id}>
                <button
                  onClick={() => schedule(r.project.id, r.closed)}
                  disabled={saving}
                  className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-start transition-colors hover:border-oak-400 disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">
                      {r.project.name}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {r.customer?.name ?? 'לקוח שנמחק'}
                      {r.install?.scheduledAt && (
                        <span className="num">
                          {' · נקבע ל־'}
                          {new Date(r.install.scheduledAt).toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'numeric',
                          })}
                        </span>
                      )}
                    </span>
                  </span>
                  {r.closed && (
                    <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                      נסגר
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs leading-snug text-stone-500">
          פרויקט שנסגר וחוזר ללוח — שלב ההתקנה שלו נפתח מחדש, כדי שמי
          שיוצא לשטח יראה אותו ברשימה שלו.
        </p>
      </div>
    </Sheet>
  );
}
