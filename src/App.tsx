import { useEffect, useState } from 'react';
import { CustomersScreen } from './features/customers/CustomersScreen';
import { ProjectsScreen } from './features/projects/ProjectsScreen';
import { DesignScreen } from './features/design/DesignScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { WorkflowScreen } from './features/workflow/WorkflowScreen';
import { CalendarScreen } from './features/workflow/CalendarScreen';
import { TasksScreen } from './features/workflow/TasksScreen';
import { TeamScreen } from './features/team/TeamScreen';
import { seedCatalog } from './catalog/catalogRepo';
import { seedMaterials } from './materials/materialsRepo';
import { useRoute } from './nav/navigation';

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);

  // ספריית המוצרים נזרעת פעם אחת, לפני שמסך כלשהו מבקש ממנה פריטים
  useEffect(() => {
    Promise.all([seedCatalog(), seedMaterials()]).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  switch (route.name) {
    case 'customers':
      return <CustomersScreen />;
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
    case 'settings':
      return <SettingsScreen />;
  }
}
