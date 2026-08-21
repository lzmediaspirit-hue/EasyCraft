import { useEffect, useState } from 'react';
import { CustomersScreen } from './features/customers/CustomersScreen';
import { ProjectsScreen } from './features/projects/ProjectsScreen';
import { DesignScreen } from './features/design/DesignScreen';
import { seedCatalog } from './catalog/catalogRepo';
import { useRoute } from './nav/navigation';

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);

  // ספריית המוצרים נזרעת פעם אחת, לפני שמסך כלשהו מבקש ממנה פריטים
  useEffect(() => {
    seedCatalog().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  switch (route.name) {
    case 'customers':
      return <CustomersScreen />;
    case 'projects':
      return <ProjectsScreen customerId={route.customerId} />;
    case 'design':
      return <DesignScreen projectId={route.projectId} />;
  }
}
