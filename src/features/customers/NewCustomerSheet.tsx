import { useEffect, useRef, useState } from 'react';
import { customersRepo } from './customersRepo';
import { isValidPhone, normalizePhone } from './phone';
import { CloseIcon } from '../../ui/icons';

type Props = {
  onClose: () => void;
  onCreated: (name: string) => void;
};

/**
 * יצירת לקוח חדש — שלושה שדות בלבד.
 * שם ועיר חובה, טלפון לא חובה.
 */
export function NewCustomerSheet({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0 && city.trim().length > 0 && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    const normalized = normalizePhone(phone);
    if (normalized && !isValidPhone(normalized)) {
      setPhoneError('מספר טלפון לא תקין');
      return;
    }

    setSaving(true);
    const customer = await customersRepo.create({
      name,
      city,
      phone: normalized || undefined,
    });
    onCreated(customer.name);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-stone-900/40"
      />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-customer-title"
        className="relative mx-auto w-full max-w-lg animate-sheet-in rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id="new-customer-title" className="text-lg font-semibold text-stone-900">
            לקוח חדש
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="-me-2 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <Field label="שם לקוח">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              className={inputClass}
            />
          </Field>

          <Field label="עיר">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              className={inputClass}
            />
          </Field>

          <Field label="טלפון" hint="לא חובה" error={phoneError}>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(null);
              }}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="050-1234567"
              className={`${inputClass} num text-end placeholder:text-stone-300`}
            />
          </Field>
        </div>

        <div className="px-5 pb-5">
          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
          >
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-oak-500 focus:outline-none';

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
