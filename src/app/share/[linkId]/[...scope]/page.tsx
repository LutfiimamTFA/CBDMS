
'use client';

import React from 'react';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { SharedLink, Task, User, Brand, WorkflowStatus } from '@/lib/types';
import { Loader2, ShieldAlert, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Import reusable, stateless view components
import { SharedDashboardView } from '@/components/share/shared-dashboard-view';
import { SharedTasksView } from '@/components/share/shared-tasks-view';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';
import { SharedReportsView } from '@/components/share/shared-reports-view';

const AccessDeniedComponent = () => (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You do not have permission to view this page through the link you are using.
          </p>
        </CardContent>
      </Card>
    </div>
);

const LinkNotFoundComponent = () => (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <FileWarning className="h-6 w-6 text-destructive"/>
            Link Not Found or Expired
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The share link you are trying to access is invalid, has expired, or has been disabled.</p>
            <Button variant="link" asChild className='mt-4'>
                <a href="/">Return to Homepage</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);

const pageComponents: { [key: string]: React.ComponentType<any> } = {
  dashboard: SharedDashboardView,
  tasks: SharedTasksView,
  calendar: SharedCalendarView,
  reports: SharedReportsView,
};

const navIdToScope: { [key: string]: string } = {
  nav_task_board: 'dashboard',
  nav_list: 'tasks',
  nav_calendar: 'calendar',
  nav_performance_analysis: 'reports',
};

export default function ShareScopePage() {
  const params = useParams();
  const firestore = useFirestore();
  
  const linkId = Array.isArray(params.linkId) ? params.linkId[0] : params.linkId;
  const scope = params.scope as string[] | undefined;
  const currentScope = (scope && scope.length > 0) ? scope[0] : 'dashboard';
  
  // 1. Fetch the SharedLink document itself.
  const linkDocRef = React.useMemo(() => {
    if (!firestore || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);
  
  const activeCompanyId = sharedLink?.companyId;

  // 2. Fetch all necessary data based *only* on the companyId from the shared link.
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(
    React.useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId)) : null), [firestore, activeCompanyId])
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(
    React.useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'users'), where('companyId', '==', activeCompanyId)) : null), [firestore, activeCompanyId])
  );
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(
    React.useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'brands'), where('companyId', '==', activeCompanyId), orderBy('name')) : null), [firestore, activeCompanyId])
  );
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(
    React.useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'statuses'), where('companyId', '==', activeCompanyId), orderBy('order')) : null), [firestore, activeCompanyId])
  );

  // Central loading state: Wait for the link AND all its dependent data.
  const isLoading = isLinkLoading || isTasksLoading || isUsersLoading || areBrandsLoading || areStatusesLoading;

  if (!linkId || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (linkError || !sharedLink) {
    return <LinkNotFoundComponent />;
  }

  const isScopeAllowed = sharedLink.allowedNavItems.some(navId => navIdToScope[navId] === currentScope);

  if (!isScopeAllowed) {
    return <AccessDeniedComponent />;
  }

  const PageComponent = pageComponents[currentScope];

  if (!PageComponent) {
    notFound();
    return null;
  }
  
  const viewProps = {
    permissions: sharedLink.permissions,
    tasks: tasks || [],
    users: users || [],
    brands: brands || [],
    statuses: statuses || [],
  };

  return <PageComponent {...viewProps} />;
}
