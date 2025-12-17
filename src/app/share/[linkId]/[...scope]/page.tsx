'use client';

import React from 'react';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SharedLink } from '@/lib/types';
import { Loader2, ShieldAlert, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Import reusable components for each view
import { SharedDashboardView } from '@/components/share/shared-dashboard-view';
import { SharedTasksView } from '@/components/share/shared-tasks-view';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';
import { SharedReportsView } from '@/components/share/shared-reports-view';

// Component for fallback if the page is not in scope
const AccessDeniedComponent = () => {
  return (
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
};

const LinkNotFoundComponent = () => (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <FileWarning className="h-6 w-6 text-destructive"/>
            Link Not Found
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
)


// Map URL scopes to their corresponding components
const pageComponents: { [key: string]: React.ComponentType<any> } = {
  dashboard: SharedDashboardView,
  tasks: SharedTasksView,
  calendar: SharedCalendarView,
  reports: SharedReportsView,
};

// Map Navigation Item IDs (from the database) to URL scopes
const navIdToScope: { [key: string]: string } = {
  nav_task_board: 'dashboard',
  nav_list: 'tasks',
  nav_calendar: 'calendar',
  nav_performance_analysis: 'reports',
};

export default function ShareScopePage() {
  const params = useParams();
  const firestore = useFirestore();
  
  // Guard against undefined params during initial render
  const linkId = Array.isArray(params.linkId) ? params.linkId[0] : params.linkId;
  const scope = params.scope as string[] | undefined;

  // Safely determine the current scope, defaulting to 'dashboard'
  const currentScope = (scope && scope.length > 0) ? scope[0] : 'dashboard';
  
  const linkDocRef = React.useMemo(() => {
    // Only create the doc ref if linkId is a valid string
    if (!firestore || typeof linkId !== 'string' || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading, error } = useDoc<SharedLink>(linkDocRef);

  // PRIMARY LOADING STATE: Show spinner if params aren't ready or data is being fetched.
  if (!linkId || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // ERROR/NOT FOUND STATE: If fetching finished and there's an error or no data, show a proper message.
  if (!isLoading && (error || !sharedLink)) {
    return <LinkNotFoundComponent />;
  }

  // PERMISSION CHECK STATE: Data is loaded, now check if the scope is allowed.
  const isScopeAllowed = sharedLink.allowedNavItems.some(navId => navIdToScope[navId] === currentScope);

  if (!isScopeAllowed) {
    return <AccessDeniedComponent />;
  }

  const PageComponent = pageComponents[currentScope];

  // If the scope doesn't map to a known component, show a 404
  if (!PageComponent) {
    notFound();
    return null;
  }

  // SUCCESS STATE: All checks passed, render the appropriate component.
  return <PageComponent permissions={sharedLink.permissions} companyId={sharedLink.companyId} />;
}
