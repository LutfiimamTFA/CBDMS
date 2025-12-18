
'use client';

import React from 'react';
import { notFound, useParams } from 'next/navigation';
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
import { SharedMyWorkView } from '@/components/share/shared-my-work-view';
import { SharedSocialMediaView } from '@/components/share/shared-social-media-view';
import { SharedDailyReportView } from '@/components/share/shared-daily-report-view';
import { SharedRecurringTasksView } from '@/components/share/shared-recurring-tasks-view';
import { SharedScheduleView } from '@/components/share/shared-schedule-view';

const AccessDeniedComponent = () => (
    <div className="flex h-full items-center justify-center p-8 w-full">
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
    <div className="flex h-full items-center justify-center p-8 w-full">
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
  'dashboard': SharedDashboardView,
  'tasks': SharedTasksView,
  'calendar': SharedCalendarView,
  'schedule': SharedScheduleView,
  'reports': SharedReportsView,
  'my-work': SharedMyWorkView,
  'social-media': SharedSocialMediaView,
  'social-media/analytics': SharedSocialMediaView,
  'daily-report': SharedDailyReportView,
  'admin/settings/recurring': SharedRecurringTasksView,
};

export default function ShareScopePage() {
  const { session, navItems, isLoading, error } = useSharedSession();
  const params = useParams();
  const scope = Array.isArray(params.scope) ? params.scope.join('/') : params.scope;
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center w-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return <LinkNotFoundComponent />;
  }

  const navItemForScope = (navItems || []).find(item => {
    // Normalize the path by removing the leading slash if it exists
    const itemScope = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    return itemScope === scope;
  });
  
  if (!navItemForScope || !session.allowedNavItems.includes(navItemForScope.id)) {
      return <AccessDeniedComponent />;
  }

  const PageComponent = pageComponents[scope];

  if (!PageComponent) {
    return <AccessDeniedComponent />;
  }
  
  const viewProps = {
    session,
    isAnalyticsView: scope === 'social-media/analytics',
  };

  return (
    <div className='flex h-svh w-full'>
        <ShareSidebar session={session} navItems={navItems || []} />
        <main className='flex-1 overflow-auto flex w-full'>
            <PageComponent {...viewProps} />
        </main>
    </div>
  );
}
