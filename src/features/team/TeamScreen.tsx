import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { teamRepo } from '../../workflow/workflowRepo';
import { can, session, usesDefaultPassword } from '../../workflow/auth';
import { nav } from '../../nav/navigation';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABEL } from '../../workflow/stages';
import { MemberSheet } from './MemberSheet';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { PlusIcon } from '../../ui/icons';
import type { TeamMember, UserRole } from '../../db/types';

const ROLE_ORDER: UserRole[] = ['manager', 'planner', 'carpenter', 'installer'];

/**
 * הצוות של הנגרייה.
 *
 * רק מנהל רואה ועורך את המסך הזה — הוא היחיד שפותח משתמשים,
 * קובע תפקידים ומאפס סיסמאות. כל אחד אחר מגיע לכאן רק כדי לצאת
 * מהחשבון שלו.
 */
export function TeamScreen() {
  const me = useCurrentMember();
  const members = useLiveQuery(() => teamRepo.list(), []);
  const [editing, setEditing] = useState<TeamMember | 'new' | null>(null);
  /* מי עדיין עם הסיסמה שמגיעה עם האפליקציה — סיסמה ידועה אינה סיסמה */
  const [defaults, setDefaults] = useState<string[]>([]);

  const isManager = can.manageTeam(me?.role);

  useEffect(() => {
    let alive = true;
    Promise.all(
      (members ?? []).map(async (m) => ((await usesDefaultPassword(m)) ? m.id : null)),
    ).then((ids) => alive && setDefaults(ids.filter((x): x is string => !!x)));
    return () => {
      alive = false;
    };
  }, [members]);

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    people: (members ?? []).filter((m) => m.role === role),
  })).filter((g) => g.people.length > 0);

  const signOut = (
    <button
      onClick={() => {
        // המסך שפתוח שייך למי שיצא, ולכן חוזרים להתחלה
        nav.reset();
        session.signOut();
      }}
      className="shrink-0 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200"
    >
      יציאה
    </button>
  );

  if (!isManager) {
    return (
      <div className="app-page flex min-h-dvh flex-col bg-stone-50">
        <ScreenHeader title="החשבון שלי" subtitle={me?.name} action={signOut} />
        <main className="flex-1 px-5 pt-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <span className="block font-semibold text-stone-900">{me?.name}</span>
            <span className="block text-sm text-stone-500">
              {me ? ROLE_LABEL[me.role] : ''}
              {me?.username && <span className="num"> · {me.username}</span>}
            </span>
          </div>
          <p className="mt-4 text-sm leading-snug text-stone-500">
            ניהול הצוות, פתיחת משתמשים ואיפוס סיסמאות פתוחים למנהל בלבד.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page flex min-h-dvh flex-col bg-stone-50">
      <ScreenHeader
        title="הצוות"
        subtitle={`מחובר: ${me?.name ?? ''}`}
        count={members?.length}
        action={signOut}
      />

      <main className="flex-1 px-5 pb-32">
        {byRole.map((group) => (
          <section key={group.role} className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              {ROLE_LABEL[group.role]}
            </h2>
            <ul className="space-y-2">
              {group.people.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setEditing(m)}
                    className={`flex w-full items-center gap-2 rounded-2xl border bg-white p-3 text-start transition-colors hover:border-oak-400 ${
                      m.id === me?.id ? 'border-oak-400 bg-oak-50' : 'border-stone-200'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-stone-900">
                        {m.name}
                        {m.id === me?.id && (
                          <span className="ms-2 text-xs font-normal text-oak-700">זה אני</span>
                        )}
                        {!m.active && (
                          <span className="ms-2 text-xs font-normal text-stone-400">לא פעיל</span>
                        )}
                      </span>
                      <span className="num block truncate text-xs text-stone-400">
                        {m.username ?? 'בלי שם משתמש'}
                        {m.phone && ` · ${m.phone}`}
                      </span>
                    </span>
                    {!m.passwordHash ? (
                      <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        בלי סיסמה
                      </span>
                    ) : (
                      defaults.includes(m.id) && (
                        <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          סיסמת ברירת מחדל
                        </span>
                      )
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-6 text-xs leading-snug text-stone-400">
          כל אחד נכנס עם שם משתמש וסיסמה משלו, והתפקיד קובע מה הוא רואה
          ומה מותר לו. הסיסמאות נשמרות מגובבות בלבד — גם מהמכשיר עצמו אי
          אפשר לקרוא אותן. זו הפרדה בין אנשים, ולא הגנה על המכשיר.
        </p>
      </main>

      <div className="app-page sticky bottom-0 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setEditing('new')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
        >
          <PlusIcon />
          משתמש חדש
        </button>
      </div>

      {editing && (
        <MemberSheet
          member={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === me?.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
