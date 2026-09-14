import { useLiveQuery } from 'dexie-react-hooks';
import { stagesRepo } from '../../workflow/workflowRepo';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABEL, canOwn, stageDef } from '../../workflow/stages';
import { nav } from '../../nav/navigation';
import { CalendarIcon, FlowIcon, TeamIcon } from '../../ui/icons';

/**
 * שורת העבודה במסך הפתיחה.
 *
 * לפני רשימת הלקוחות עונה על שתי שאלות: מה מחכה לי, ומה קבוע ביומן.
 * כשאין צוות ואין תהליכים היא מצטמצמת להזמנה אחת להקים צוות, כדי
 * שנגרייה של אדם אחד לא תראה מסך מלא בכפתורים שאינה צריכה.
 */
export function WorkBar() {
  const me = useCurrentMember();
  const stages = useLiveQuery(() => stagesRepo.all(), []);

  if (me === undefined || stages === undefined) return null;

  const active = stages.filter((s) => s.status === 'active');
  const mine = me ? active.filter((s) => canOwn(me.role, stageDef(s.key).role)) : [];
  const upcoming = stages.filter(
    (s) => s.scheduledAt && s.status !== 'skipped' && s.scheduledAt >= startOfToday(),
  ).length;


  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Tile
        icon={<FlowIcon className="size-5" />}
        label={me?.role === 'manager' ? 'תהליכים פתוחים' : 'המשימות שלי'}
        value={me?.role === 'manager' ? active.length : mine.length}
        onClick={() => nav.push({ name: 'tasks' })}
        highlight={mine.length > 0}
      />
      <Tile
        icon={<CalendarIcon className="size-5" />}
        label="לוח התקנות"
        value={upcoming}
        onClick={() => nav.push({ name: 'calendar' })}
      />
      {me && (
        <button
          onClick={() => nav.push({ name: 'team' })}
          className="col-span-2 flex items-center gap-1.5 text-start text-[11px] text-stone-400 transition-colors hover:text-oak-700"
        >
          <TeamIcon className="size-3.5" />
          {me.name} · {ROLE_LABEL[me.role]}
        </button>
      )}
    </div>
  );
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Tile({
  icon,
  label,
  value,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-start transition-colors ${
        highlight ? 'border-oak-400 bg-oak-50' : 'border-stone-200 bg-white hover:border-oak-400'
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          highlight ? 'bg-oak-600 text-white' : 'bg-stone-100 text-stone-500'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="num block text-lg leading-tight font-bold text-stone-900">{value}</span>
        <span className="block truncate text-[11px] text-stone-500">{label}</span>
      </span>
    </button>
  );
}
