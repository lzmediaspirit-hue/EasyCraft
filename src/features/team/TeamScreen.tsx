import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { teamRepo, currentMember } from '../../workflow/workflowRepo';
import { useCurrentMemberId } from '../../workflow/useMember';
import { ROLE_LABEL } from '../../workflow/stages';
import { MemberSheet } from './MemberSheet';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { PlusIcon } from '../../ui/icons';
import type { TeamMember, UserRole } from '../../db/types';

const ROLE_ORDER: UserRole[] = ['manager', 'planner', 'carpenter', 'installer'];

/**
 * הצוות של הנגרייה, ומי עובד על המכשיר הזה.
 *
 * בחירת האדם היא מה שקובע מה יראו בשאר האפליקציה: מנהל רואה את כל
 * הפרויקטים ואת לוח ההתקנות, וכל אחד אחר רואה קודם את מה שמחכה לו.
 */
export function TeamScreen() {
  const members = useLiveQuery(() => teamRepo.list(), []);
  const currentId = useCurrentMemberId();
  const [editing, setEditing] = useState<TeamMember | 'new' | null>(null);

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    people: (members ?? []).filter((m) => m.role === role),
  })).filter((g) => g.people.length > 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader
        title="הצוות"
        subtitle="מי עובד, ומי מחובר במכשיר הזה"
        count={members?.length}
      />

      <main className="flex-1 px-5 pb-32">
        {members?.length === 0 && (
          <p className="mt-8 text-center text-[15px] leading-relaxed text-stone-500">
            עוד אין צוות. הוסף את עצמך כמנהל, ואז את התכנת והנגרים —
            ומכאן כל פרויקט יקבל תהליך עבודה.
          </p>
        )}

        {byRole.map((group) => (
          <section key={group.role} className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">
              {ROLE_LABEL[group.role]}
            </h2>
            <ul className="space-y-2">
              {group.people.map((m) => {
                const isMe = m.id === currentId;
                return (
                  <li key={m.id}>
                    <div
                      className={`flex items-center gap-2 rounded-2xl border bg-white p-3 ${
                        isMe ? 'border-oak-400 bg-oak-50' : 'border-stone-200'
                      }`}
                    >
                      <button
                        onClick={() => setEditing(m)}
                        className="min-w-0 flex-1 text-start"
                      >
                        <span className="block truncate font-medium text-stone-900">
                          {m.name}
                          {!m.active && (
                            <span className="ms-2 text-xs font-normal text-stone-400">לא פעיל</span>
                          )}
                        </span>
                        {m.phone && (
                          <span className="num block truncate text-xs text-stone-400">{m.phone}</span>
                        )}
                      </button>

                      <button
                        onClick={() => currentMember.set(isMe ? null : m.id)}
                        aria-pressed={isMe}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isMe
                            ? 'bg-oak-600 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {isMe ? 'זה אני' : 'התחברות'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <p className="mt-6 text-xs leading-snug text-stone-400">
          אין כאן סיסמאות — המכשיר הוא של מי שמחזיק בו. מה שהתפקיד קובע
          הוא מה מוצג ומה אפשר לסגור בתהליך העבודה.
        </p>
      </main>

      <div className="sticky bottom-0 mx-auto w-full max-w-lg px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setEditing('new')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
        >
          <PlusIcon />
          איש צוות חדש
        </button>
      </div>

      {editing && (
        <MemberSheet
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
