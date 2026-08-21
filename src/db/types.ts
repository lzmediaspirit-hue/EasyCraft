/** ישות בסיס — לכל רשומה מזהה ותאריכי מעקב. */
export interface Entity {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Customer extends Entity {
  /** שם הלקוח — חובה */
  name: string;
  /** עיר — חובה */
  city: string;
  /** טלפון בפורמט מנורמל (ספרות בלבד) — לא חובה */
  phone?: string;
}

/** מה שנדרש כדי ליצור לקוח חדש. */
export type NewCustomer = Pick<Customer, 'name' | 'city'> & { phone?: string };
