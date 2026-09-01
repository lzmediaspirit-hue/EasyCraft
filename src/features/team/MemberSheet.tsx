import { useState } from 'react';
import { teamRepo, currentMember } from '../../workflow/workflowRepo';
import { ROLE_LABEL } from '../../workflow/stages';
import { normalizePhone, isValidPhone } from '../customers/phone';
import { Sheet } from '../../ui/Sheet';
import { Chip, Field, PrimaryButton, inputClass, selectOnFocus } from '../../ui/Field';
import { TrashIcon } from '../../ui/icons';
import type { TeamMember, UserRole } from '../../db/types';

const ROLES: UserRole[] = ['manager', 'planner', 'carpenter', 'installer'];

const ROLE_HINT: Record<UserRole, string> = {
  manager: 'רואה את כל הפרויקטים, את התהליכים ואת לוח ההתקנות',
  planner: 'מתכנן את הקיר ומעלה את הקבצים לייצור',
  carpenter: 'חיתוך, קנטים והרכבה',
  installer: 'התקנה אצל הלקוח',
};

/** הוספה ועריכה של איש צוות. */
export function MemberSheet({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState<UserRole>(member?.role ?? 'carpenter');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [active, setActive] = useState(member?.active ?? true);

  const normalized = normalizePhone(phone);
  const phoneError = phone.trim() && !isValidPhone(normalized) ? 'מספר לא תקין' : null;
  const canSave = name.trim().length > 0 && !phoneError;

  async function save() {
    await teamRepo.save({
      id: member?.id,
      name: name.trim(),
      role,
      phone: normalized || undefined,
      active,
    });
    onClose();
  }

  return (
    <Sheet
      title={member ? 'עריכת איש צוות' : 'איש צוות חדש'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {member && (
            <button
              onClick={async () => {
                // מי שנמחק לא יכול להישאר מחובר במכשיר
                if (currentMember.id() === member.id) currentMember.set(null);
                await teamRepo.remove(member.id);
                onClose();
              }}
              aria-label="מחיקת איש הצוות"
              className="shrink-0 rounded-2xl border border-stone-200 p-4 text-stone-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon />
            </button>
          )}
          <div className="flex-1">
            <PrimaryButton disabled={!canSave} onClick={save}>
              שמירה
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="שם">
          <input
            autoFocus={!member}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={selectOnFocus}
            className={inputClass}
          />
        </Field>

        <Field group label="תפקיד">
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <Chip key={r} active={r === role} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </Chip>
            ))}
          </div>
          <span className="mt-1.5 block text-xs text-stone-400">{ROLE_HINT[role]}</span>
        </Field>

        <Field label="טלפון" hint="לא חובה" error={phoneError}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onFocus={selectOnFocus}
            type="tel"
            inputMode="tel"
            className={`${inputClass} num text-end`}
          />
        </Field>

        {member && (
          <button
            onClick={() => setActive((v) => !v)}
            aria-pressed={active}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-start text-sm font-medium transition-colors ${
              active ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span
              className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                active ? 'bg-white/30' : 'bg-stone-300'
              }`}
            >
              <span
                className={`size-4 rounded-full bg-white transition-transform ${
                  active ? '-translate-x-4' : ''
                }`}
              />
            </span>
            <span className="flex-1">
              עובד פעיל
              <span
                className={`block text-[11px] font-normal ${
                  active ? 'text-white/70' : 'text-stone-400'
                }`}
              >
                עובד שאינו פעיל נשאר בהיסטוריה אבל לא מקבל משימות חדשות
              </span>
            </span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
