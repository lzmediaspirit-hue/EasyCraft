import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { customersRepo } from './customersRepo';
import { NewCustomerSheet } from './NewCustomerSheet';
import { normalizePhone } from './phone';
import type { Customer } from '../../db/types';
import { ChevronIcon, PhoneIcon, PlusIcon, SearchIcon, UsersIcon } from '../../ui/icons';
import { nav } from '../../nav/navigation';

/** מעל כמה לקוחות מוצג שדה חיפוש. מתחת לזה הוא רק רעש. */
const SEARCH_THRESHOLD = 6;

export function CustomersScreen() {
  const customers = useLiveQuery(() => customersRepo.list(), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showSearch = (customers?.length ?? 0) >= SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    if (!customers) return [];
    const q = query.trim();
    if (!q) return customers;
    const digits = normalizePhone(q);
    return customers.filter(
      (c) =>
        c.name.includes(q) ||
        c.city.includes(q) ||
        (digits.length > 1 && c.phone?.includes(digits)),
    );
  }, [customers, query]);

  function handleCreated(name: string) {
    setSheetOpen(false);
    setQuery('');
    setToast(`${name} נוסף ללקוחות`);
    window.setTimeout(() => setToast(null), 2600);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-5 pt-6 pb-4 backdrop-blur">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold text-stone-900">לקוחות</h1>
          {!!customers?.length && (
            <span className="num text-sm font-medium text-stone-400">{customers.length}</span>
          )}
        </div>

        {showSearch && (
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="חיפוש לפי שם, עיר או טלפון"
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pe-4 ps-10 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-oak-500 focus:outline-none"
            />
          </div>
        )}
      </header>

      <main className="flex-1 px-5 pb-32">
        {customers === undefined ? null : customers.length === 0 ? (
          <EmptyState onAdd={() => setSheetOpen(true)} />
        ) : visible.length === 0 ? (
          <p className="pt-16 text-center text-stone-500">לא נמצאו לקוחות</p>
        ) : (
          <ul className="divide-y divide-stone-200/80 pt-2">
            {visible.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} />
            ))}
          </ul>
        )}
      </main>

      {customers !== undefined && customers.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg bg-gradient-to-t from-stone-50 via-stone-50 to-transparent px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
          >
            <PlusIcon />
            לקוח חדש
          </button>
        </div>
      )}

      {sheetOpen && (
        <NewCustomerSheet onClose={() => setSheetOpen(false)} onCreated={handleCreated} />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-28 z-40 mx-auto w-fit animate-fade-in rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <li>
      <div className="flex items-center gap-3.5 py-1.5">
        <button
          onClick={() => nav.push({ name: 'projects', customerId: customer.id })}
          className="-mx-2 flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-2 py-2 text-start transition-colors hover:bg-stone-100 active:bg-stone-100"
        >
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-oak-100 text-base font-semibold text-oak-700"
          >
            {customer.name.trim().charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-stone-900">{customer.name}</span>
            <span className="block truncate text-sm text-stone-500">{customer.city}</span>
          </span>
          <ChevronIcon className="size-4 shrink-0 text-stone-300" />
        </button>

        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            aria-label={`חיוג ל${customer.name}`}
            className="shrink-0 rounded-full border border-stone-200 bg-white p-2.5 text-stone-500 transition-colors hover:border-oak-300 hover:text-oak-700"
          >
            <PhoneIcon className="size-4" />
          </a>
        )}
      </div>
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center pt-24 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-oak-100 text-oak-500">
        <UsersIcon className="size-9" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-stone-800">אין לקוחות עדיין</h2>
      <p className="mt-1.5 max-w-xs text-[15px] text-stone-500">
        כל עבודה מתחילה מלקוח. הוסף את הראשון כדי להתחיל.
      </p>
      <button
        onClick={onAdd}
        className="mt-7 flex items-center gap-2 rounded-2xl bg-oak-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
      >
        <PlusIcon />
        הוספת לקוח
      </button>
    </div>
  );
}
