'use client';

import React from 'react';
import { useParams } from 'next/navigation';
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
import { SharedGuideView } from '@/components/share/shared-guide-view';

const AccessDeniedPlaceholder = ({ pageName }: { pageName: string }) => (
    <div className="flex h-full items-center justify-center p-8 w-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            '{pageName}' Not Included
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page is not included in this shared link. Please select an available page from the sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
);

const LinkNotFoundComponent = () => (
    <div className="flex h-full items-center justify-center p-8 w-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
            <FileWarning className="h-6 w-6"/>
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

// This map is the single source of truth for routing in share mode.
const pageComponents: { [key: string]: React.ComponentType<any> } = {
  'my-work': SharedMyWorkView,
  'dashboard': SharedDashboardView,
  'tasks': SharedTasksView,
  'daily-report': SharedDailyReportView,
  'schedule': SharedScheduleView,
  'calendar': SharedCalendarView,
  'social-media': SharedSocialMediaView,
  'social-media/analytics': SharedSocialMediaView,
  'reports': SharedReportsView,
  'guide': SharedGuideView,
  'admin/settings/recurring': SharedRecurringTasksView,
};

export default function ShareScopePage() {
  const { session, navItems, isLoading, error, ...restOfData } = useSharedSession();
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

  // Find the nav item corresponding to the current URL scope
  const navItemForScope = (navItems || []).find(item => {
    // Normalize path by removing leading slash for direct comparison
    const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    return itemPath === scope;
  });
  
  const isPageAllowed = navItemForScope && session.allowedNavItems.includes(navItemForScope.id);
  
  const PageComponent = pageComponents[scope];

  // If the page is not allowed or the component doesn't exist, show a placeholder.
  if (!isPageAllowed || !PageComponent) {
      return (
          <div className='flex h-svh w-full'>
              <ShareSidebar />
              <main className='flex-1 overflow-auto flex w-full'>
                 <AccessDeniedPlaceholder pageName={navItemForScope?.label || scope} />
              </main>
          </div>
      );
  }
  
  const viewProps = {
    session,
    isLoading,
    ...restOfData,
    isAnalyticsView: scope === 'social-media/analytics', // Prop for multi-purpose components
  };

  return (
    <div className='flex h-svh w-full'>
        <ShareSidebar />
        <main className='flex-1 overflow-auto flex w-full'>
            <PageComponent {...viewProps} />
        </main>
    </div>
  );
}
