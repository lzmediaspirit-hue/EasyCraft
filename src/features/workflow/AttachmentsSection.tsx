import { useEffect, useState } from 'react';
import { attachmentsRepo } from '../../workflow/workflowRepo';
import { FileIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import type { Attachment, AttachmentKind } from '../../db/types';

const KINDS: { kind: AttachmentKind; label: string; hint: string }[] = [
  { kind: 'cutlist', label: 'פירוק לוחות', hint: 'רשימת החיתוך שהנגר עובד לפיה' },
  { kind: 'render', label: 'הדמיות', hint: 'איך המוצר ייראה אצל הלקוח' },
  { kind: 'assembly', label: 'הוראות הרכבה', hint: 'סדר ההרכבה בנגרייה' },
];

/**
 * הקבצים שהתכנת מעלה לפרויקט.
 *
 * הכול נשמר במכשיר, ולכן העלאה עובדת גם בנגרייה בלי קליטה. תצוגה
 * מקדימה נוצרת מ-Blob ומשוחררת ביציאה, כדי שגלריית תמונות כבדה לא
 * תשאיר זיכרון תפוס.
 */
export function AttachmentsSection({
  projectId,
  attachments,
  canEdit,
}: {
  projectId: string;
  attachments: Attachment[];
  canEdit: boolean;
}) {
  const [preview, setPreview] = useState<Attachment | null>(null);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-700">קבצים לייצור</h2>

      <div className="space-y-3">
        {KINDS.map((k) => {
          const mine = attachments.filter((a) => a.kind === k.kind);
          return (
            <div key={k.kind} className="rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-medium text-stone-800">{k.label}</h3>
                <span className="num text-xs text-stone-400">{mine.length}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-400">{k.hint}</p>

              {mine.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {mine.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <button
                        onClick={() => setPreview(a)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2 text-start transition-colors hover:bg-stone-100"
                      >
                        <FileIcon className="size-4 shrink-0 text-stone-400" />
                        <span className="min-w-0 flex-1 truncate text-xs text-stone-700">
                          {a.name}
                        </span>
                        <span className="num shrink-0 text-[10px] text-stone-400">
                          {Math.max(Math.round(a.sizeBytes / 1024), 1)} KB
                        </span>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => attachmentsRepo.remove(a.id)}
                          aria-label={`מחיקת ${a.name}`}
                          className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canEdit && (
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-oak-400 hover:text-oak-700">
                  <PlusIcon className="size-3.5" />
                  העלאת קובץ
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    aria-label={`העלאת ${k.label}`}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      for (const f of files) await attachmentsRepo.add(projectId, k.kind, f);
                      e.target.value = '';
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {preview && <PreviewOverlay item={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function PreviewOverlay({ item, onClose }: { item: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(item.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [item]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/90 p-4">
      <button
        onClick={onClose}
        className="self-start rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
      >
        סגירה
      </button>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {url &&
          (item.mime.startsWith('image/') ? (
            <img src={url} alt={item.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="px-6 text-center text-sm leading-relaxed text-white/80">
              {item.name}
              <span className="mt-2 block text-white/50">
                תצוגה מקדימה זמינה לתמונות בלבד.
              </span>
            </p>
          ))}
      </div>
    </div>
  );
}
