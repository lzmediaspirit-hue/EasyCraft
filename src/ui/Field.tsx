export const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-oak-500 focus:outline-none';

export function Field({
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

/** כפתור הפעולה הראשית — אחד בכל מסך. */
export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white transition-colors hover:bg-oak-700 disabled:bg-stone-200 disabled:text-stone-400"
    >
      {children}
    </button>
  );
}
