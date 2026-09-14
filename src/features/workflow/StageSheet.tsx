import { useState } from 'react';
import { stagesRepo } from '../../workflow/workflowRepo';
import { ROLE_LABEL, canOwn, stageDef } from '../../workflow/stages';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass } from '../../ui/Field';
import type { ProjectStage, TeamMember } from '../../db/types';

/** תאריך ל-input[type=date] לפי השעון המקומי, לא לפי UTC. */
function toDateInput(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * שלב אחד: למי הוא מועבר, מה ההנחיה, מתי הוא מתוכנן — וסגירה שלו.
 *
 * סגירה פותחת את השלב הבא. זו כל המכניקה של התהליך, ולכן היא יושבת
 * במקום אחד ולא מפוזרת על פני מסכים.
 */
export function StageSheet({
  projectId,
  stage,
  team,
  me,
  onClose,
}: {
  projectId: string;
  stage: ProjectStage;
  team: TeamMember[];
  me: TeamMember | null;
  onClose: () => void;
}) {
  const def = stageDef(stage.key);
  const [note, setNote] = useState(stage.note ?? '');
  const [assigneeId, setAssigneeId] = useState(stage.assigneeId);
  const [date, setDate] = useState(toDateInput(stage.scheduledAt));
  const [busy, setBusy] = useState(false);

  const isManager = me?.role === 'manager';
  const active = stage.status === 'active';
  const mayClose = active && !!me && canOwn(me.role, def.role);
  // לשלב שנמדד מול הלקוח אין ממי לבחור בצוות
  const candidates =
    def.role === 'customer'
      ? []
      : team.filter((m) => m.active && canOwn(m.role, def.role) && m.role !== 'manager');

  async function saveDetails() {
    await stagesRepo.update(stage.id, {
      note: note.trim() || undefined,
      assigneeId,
      scheduledAt: date ? new Date(`${date}T08:00`).getTime() : undefined,
    });
  }

  async function finish(status: 'done' | 'skipped') {
    if (busy) return;
    setBusy(true);
    await saveDetails();
    await stagesRepo.complete(projectId, stage.key, status);
    onClose();
  }

  return (
    <Sheet
      title={def.label}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {/*
            קביעת מועד ואחראי היא פעולה נפרדת מסגירת השלב: מתאמים
            התקנה שבוע מראש, וסוגרים את השלב רק אחרי שהיא קרתה.
          */}
          {mayClose ? (
            <PrimaryButton disabled={busy} onClick={() => finish('done')}>
              {def.role === 'customer' ? 'הלקוח אישר' : 'סיימתי — העברה לשלב הבא'}
            </PrimaryButton>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={async () => {
                await saveDetails();
                onClose();
              }}
              className={
                mayClose
                  ? 'flex-1 rounded-2xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50'
                  : 'w-full rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white transition-colors hover:bg-stone-800'
              }
            >
              שמירה
            </button>
            {def.skippable && active && isManager && (
              <button
                onClick={() => finish('skipped')}
                className="flex-1 rounded-2xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                דילוג על השלב
              </button>
            )}
            {isManager && (stage.status === 'done' || stage.status === 'skipped') && (
              <button
                onClick={async () => {
                  await stagesRepo.reopen(projectId, stage.key);
                  onClose();
                }}
                className="flex-1 rounded-2xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                פתיחה מחדש
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-snug text-stone-500">{def.hint}</p>

        <div className="rounded-2xl bg-stone-50 p-3 text-sm">
          <span className="text-stone-500">מחכה ל־</span>{' '}
          <span className="font-medium text-stone-900">
            {def.role === 'customer' ? 'לקוח' : ROLE_LABEL[def.role]}
          </span>
          {stage.status === 'waiting' && (
            <span className="mt-1 block text-xs text-stone-400">
              השלב עוד לא נפתח — הוא ממתין לסיום השלב שלפניו.
            </span>
          )}
        </div>

        {candidates.length > 0 && (
          <Field group label="מי אחראי">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!assigneeId} onClick={() => setAssigneeId(undefined)}>
                לא הוקצה
              </Chip>
              {candidates.map((m) => (
                <Chip key={m.id} active={assigneeId === m.id} onClick={() => setAssigneeId(m.id)}>
                  {m.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {def.scheduled && (
          <Field label="מועד" hint="נכנס ללוח ההתקנות של המנהל">
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className={`${inputClass} num`}
            />
          </Field>
        )}

        <Field label="הנחיות" hint="מה שצריך לדעת בשלב הזה">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={
              stage.key === 'brief'
                ? 'מידות הקיר, הסגנון שהלקוח ביקש, ומה חשוב לשים לב אליו'
                : 'הערה לשלב'
            }
            className={`${inputClass} resize-none leading-snug`}
          />
        </Field>

        {stage.doneAt && (
          <p className="num text-xs text-stone-400">
            נסגר ב־{new Date(stage.doneAt).toLocaleDateString('he-IL')}
          </p>
        )}
      </div>
    </Sheet>
  );
}
