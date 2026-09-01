import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import { stagesRepo, teamRepo } from '../../workflow/workflowRepo';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABEL, canOwn, stageDef } from '../../workflow/stages';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { nav } from '../../nav/navigation';
import { ChevronIcon } from '../../ui/icons';

/**
 * מה פתוח עכשיו בעסק.
 *
 * המנהל רואה כאן את כל התהליכים שרצים ואיפה כל אחד תקוע; כל אחד
 * אחר רואה קודם את מה שמחכה לו, ורק אחר כך את השאר. זה המסך
 * שאמור לענות על "מה אני עושה עכשיו" בלי לפתוח פרויקטים אחד אחד.
 */
export function TasksScreen() {
  const me = useCurrentMember();
  const stages = useLiveQuery(() => stagesRepo.all(), []);
  const projects = useLiveQuery(() => projectsRepo.all(), []);
  const customers = useLiveQuery(() => customersRepo.list(), []);
  const team = useLiveQuery(() => teamRepo.list(), []);

  const active = (stages ?? []).filter((s) => s.status === 'active');
  const mine = me ? active.filter((s) => canOwn(me.role, stageDef(s.key).role)) : [];
  const rest = active.filter((s) => !mine.includes(s));

  const row = (stageId: string) => {
    const s = active.find((x) => x.id === stageId)!;
    const p = projects?.find((x) => x.id === s.projectId);
    const c = customers?.find((x) => x.id === p?.customerId);
    const who = team?.find((m) => m.id === s.assigneeId);
    const def = stageDef(s.key);
    return (
      <li key={s.id}>
        <button
          onClick={() => nav.push({ name: 'workflow', projectId: s.projectId })}
          className="flex w-full items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-start transition-colors hover:border-oak-400"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-stone-900">
              {p?.name ?? 'פרויקט'}
              <span className="ms-2 text-xs font-normal text-stone-400">{c?.name}</span>
            </span>
            <span className="block truncate text-xs text-stone-500">
              {def.label} ·{' '}
              {who?.name ?? (def.role === 'customer' ? 'הלקוח' : ROLE_LABEL[def.role])}
            </span>
          </span>
          {s.scheduledAt && (
            <span className="num shrink-0 text-xs font-medium text-stone-500">
              {new Date(s.scheduledAt).toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          )}
          <ChevronIcon className="size-4 shrink-0 rotate-180 text-stone-300" />
        </button>
      </li>
    );
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader
        title={me?.role === 'manager' ? 'תהליכים פתוחים' : 'המשימות שלי'}
        subtitle={me ? `${me.name} · ${ROLE_LABEL[me.role]}` : 'אף אחד לא מחובר'}
        count={active.length}
      />

      <main className="flex-1 px-5 pb-10">
        {!me && (
          <button
            onClick={() => nav.push({ name: 'team' })}
            className="mt-5 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-start text-sm leading-snug text-amber-900"
          >
            אף אחד לא מחובר במכשיר הזה. בחר מי אתה במסך הצוות כדי לראות
            את מה שמחכה לך.
          </button>
        )}

        {active.length === 0 && (
          <p className="mt-8 text-center text-[15px] leading-relaxed text-stone-500">
            אין תהליכים פתוחים. כל פרויקט חדש נפתח עם תהליך עבודה משלו.
          </p>
        )}

        {mine.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">אצלך</h2>
            <ul className="space-y-2">{mine.map((s) => row(s.id))}</ul>
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              {mine.length > 0 ? 'אצל אחרים' : 'תהליכים פתוחים'}
            </h2>
            <ul className="space-y-2">{rest.map((s) => row(s.id))}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
