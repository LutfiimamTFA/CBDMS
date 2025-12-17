
'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import { useSharedSession } from '@/context/shared-session-provider';
import { Loader2, ShieldAlert, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Import reusable, stateless view components
import { SharedDashboardView } from '@/components/share/shared-dashboard-view';
import { SharedTasksView } from '@/components/share/shared-tasks-view';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';
import { SharedReportsView } from '@/components/share/shared-reports-view';
import { ShareSidebar } from '@/components/share/share-sidebar';

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
                <a href="/login">Return to Login</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);

const pageComponents: { [key: string]: React.ComponentType<any> } = {
  '/dashboard': SharedDashboardView,
  '/tasks': SharedTasksView,
  '/calendar': SharedCalendarView,
  '/reports': SharedReportsView,
  '/admin/users': SharedTasksView, // Fallback to tasks view for now
  '/my-work': SharedTasksView, // Fallback to tasks view
};

export default function ShareScopePage() {
  const { session, isLoading, error } = useSharedSession();
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return <LinkNotFoundComponent />;
  }

  // Determine which page to render based on the snapshot
  const currentRoute = session.viewConfig?.currentRoute || '/dashboard';
  const PageComponent = pageComponents[currentRoute];

  if (!PageComponent) {
    // If the route in the snapshot is not a shareable page, show access denied.
    return <AccessDeniedComponent />;
  }
  
  // All data and view state is passed down from the sharedLink document snapshot.
  const viewProps = {
    permissions: session.permissions,
    tasks: session.tasks || [],
    users: session.users || [],
    brands: session.brands || [],
    statuses: session.statuses || [],
    viewConfig: session.viewConfig, // Pass the entire view config
  };

  return (
    <div className='flex h-svh'>
        <ShareSidebar />
        <main className='flex-1'>
            <PageComponent {...viewProps} />
        </main>
    </div>
  );
}
