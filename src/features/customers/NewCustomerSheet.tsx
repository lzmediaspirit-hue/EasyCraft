import { useEffect, useRef, useState } from 'react';
import { customersRepo } from './customersRepo';
import { isValidPhone, normalizePhone } from './phone';
import { Sheet } from '../../ui/Sheet';
import { Field, PrimaryButton, inputClass } from '../../ui/Field';

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
  }, []);

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
    const customer = await customersRepo.create({ name, city, phone: normalized || undefined });
    onCreated(customer.name);
  }

  return (
    <Sheet
      title="לקוח חדש"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <PrimaryButton type="submit" disabled={!canSave}>
          שמירה
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
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
    </Sheet>
  );
}
