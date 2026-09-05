import { useEffect, useState } from 'react';
import { CustomersScreen } from './features/customers/CustomersScreen';
import { ProjectsScreen } from './features/projects/ProjectsScreen';
import { DesignScreen } from './features/design/DesignScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { WorkflowScreen } from './features/workflow/WorkflowScreen';
import { CalendarScreen } from './features/workflow/CalendarScreen';
import { TasksScreen } from './features/workflow/TasksScreen';
import { TeamScreen } from './features/team/TeamScreen';
import { StockScreen } from './features/stock/StockScreen';
import { seedCatalog } from './catalog/catalogRepo';
import { seedMaterials } from './materials/materialsRepo';
import { seedAdmin } from './workflow/auth';
import { useRoute } from './nav/navigation';
import { useDisplayUnit } from './ui/useDisplayUnit';
import { LoginScreen } from './features/team/LoginScreen';
import { useCurrentMember } from './workflow/useMember';

export default function App() {
  const route = useRoute();
  // שינוי יחידת התצוגה נוגע בכל מספר על המסך, ולכן העץ נבנה מחדש
  const unit = useDisplayUnit();
  const me = useCurrentMember();
  const [ready, setReady] = useState(false);

  // הספרייה, החומרים וחשבון המנהל נזרעים פעם אחת, לפני שמסך מבקש אותם
  useEffect(() => {
    Promise.all([seedCatalog(), seedMaterials(), seedAdmin()]).finally(() => setReady(true));
  }, []);

  if (!ready || me === undefined) return null;
  // בלי משתמש מחובר אין מה להראות: התפקיד קובע מה מוצג בכל מסך
  if (!me) return <LoginScreen />;

  return <div key={unit}>{screen(route)}</div>;
}

function screen(route: ReturnType<typeof useRoute>) {
  switch (route.name) {
    case 'customers':
      return <CustomersScreen />;
    case 'archive':
      return <CustomersScreen archived />;
    case 'projects':
      return <ProjectsScreen customerId={route.customerId} />;
    case 'design':
      return <DesignScreen projectId={route.projectId} />;
    case 'workflow':
      return <WorkflowScreen projectId={route.projectId} />;
    case 'tasks':
      return <TasksScreen />;
    case 'calendar':
      return <CalendarScreen />;
    case 'team':
      return <TeamScreen />;
    case 'stock':
      return <StockScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}
