import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import { stagesRepo, teamRepo } from '../../workflow/workflowRepo';
import { stageDef } from '../../workflow/stages';
import { Page, ScreenHeader } from '../../ui/Page';
import { nav } from '../../nav/navigation';
import { ScheduleInstallSheet } from './ScheduleInstallSheet';
import { ChevronIcon, PlusIcon } from '../../ui/icons';
import type { ProjectStage } from '../../db/types';

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * לוח ההתקנות של המנהל.
 *
 * חודש אחד על המסך, ועליו רק מה שנקבע לו מועד. זו התמונה שהמנהל
 * צריך כדי לדעת אם אפשר להבטיח ללקוח תאריך — לא רשימת משימות.
 */
export function CalendarScreen() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date | null>(() => new Date());
  const [scheduling, setScheduling] = useState(false);

  const stages = useLiveQuery(() => stagesRepo.all(), []);
  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const customers = useLiveQuery(() => customersRepo.list(), []);
  const team = useLiveQuery(() => teamRepo.list(), []);

  const scheduled = useMemo(
    () =>
      (stages ?? [])
        .filter((s) => s.scheduledAt && s.status !== 'skipped')
        .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)),
    [stages],
  );

  // ריבוע הלוח מתחיל תמיד ביום ראשון של השבוע שבו נופל ה-1 בחודש
  const gridStart = new Date(month);
  gridStart.setDate(1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const forDay = (d: Date) => scheduled.filter((s) => sameDay(new Date(s.scheduledAt!), d));
  const today = new Date();
  const selectedItems = selected ? forDay(selected) : [];

  const label = (s: ProjectStage) => {
    const p = projects?.find((x) => x.id === s.projectId);
    const c = customers?.find((x) => x.id === p?.customerId);
    const who = team?.find((m) => m.id === s.assigneeId);
    return {
      title: p?.name ?? 'פרויקט',
      sub: [c?.name, stageDef(s.key).label, who?.name].filter(Boolean).join(' · '),
      projectId: s.projectId,
    };
  };

  return (
    <Page>
      <ScreenHeader title="לוח התקנות" subtitle="מה נקבע, ומתי" />

      <main className="flex-1 px-5 pb-10">
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label="חודש קודם"
            className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70"
          >
            <ChevronIcon className="size-5 rotate-180" />
          </button>
          <h2 className="flex-1 text-center text-base font-semibold text-stone-900">
            {month.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label="חודש הבא"
            className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70"
          >
            <ChevronIcon className="size-5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-center text-[11px] font-medium text-stone-400">
              {d}
            </span>
          ))}

          {days.map((d) => {
            const items = forDay(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isToday = sameDay(d, today);
            const isSelected = selected && sameDay(d, selected);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors ${
                  isSelected
                    ? 'bg-stone-900 text-white'
                    : items.length
                      ? 'bg-oak-100 text-oak-900'
                      : inMonth
                        ? 'text-stone-700 hover:bg-stone-200/60'
                        : 'text-stone-300'
                }`}
              >
                <span className={`num ${isToday && !isSelected ? 'font-bold text-oak-700' : ''}`}>
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span
                    className={`size-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-oak-600'}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-700">
            {selected?.toLocaleDateString('he-IL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>

          {selectedItems.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
              אין התקנות ביום הזה.
            </p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((s) => {
                const l = label(s);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => nav.push({ name: 'workflow', projectId: l.projectId })}
                      className="flex w-full items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-start transition-colors hover:border-oak-400"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-stone-900">{l.title}</span>
                        <span className="block truncate text-xs text-stone-500">{l.sub}</span>
                      </span>
                      <ChevronIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/*
            התקנה נקבעת גם מכאן, ולא רק מתוך תהליך עבודה פתוח:
            התקנה חוזרת או תיקון אצל לקוח שהפרויקט שלו כבר נסגר הם
            עבודה אמיתית, ולוח שלא מכיל אותם משקר.
          */}
          {selected && (
            <button
              onClick={() => setScheduling(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700"
            >
              <PlusIcon className="size-4" />
              קביעת התקנה
            </button>
          )}
        </section>

        {scheduled.length === 0 && (
          <p className="mt-5 text-xs leading-snug text-stone-400">
            מועד נקבע בשלב ההתקנה של הפרויקט או מכאן, ומופיע בלוח.
          </p>
        )}
      </main>

      {scheduling && selected && (
        <ScheduleInstallSheet date={selected} onClose={() => setScheduling(false)} />
      )}
    </Page>
  );
}
