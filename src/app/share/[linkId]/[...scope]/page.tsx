'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSharedSession } from '@/context/shared-session-provider';
import { Loader2, ShieldAlert, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShareSidebar } from '@/components/share/share-sidebar';
import { SharedDashboardView } from '@/components/share/shared-dashboard-view';
import { SharedTasksView } from '@/components/share/shared-tasks-view';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';
import { SharedScheduleView } from '@/components/share/shared-schedule-view';
import { SharedSocialMediaView } from '@/components/share/shared-social-media-view';
import { SidebarInset } from '@/components/ui/sidebar';
import { SharedHeader } from '@/components/share/shared-header';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';

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

const LinkNotFoundComponent = ({ isMisconfigured = false, message }: { isMisconfigured?: boolean, message?: string }) => (
    <div className="flex h-full items-center justify-center p-8 w-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
            <FileWarning className="h-6 w-6"/>
             {isMisconfigured ? "Link is Misconfigured" : "Link Not Found or Expired"}
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">{message}</p>
            <Button variant="link" asChild className='mt-4'>
                <a href="/login">Return to Login</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);

export default function ShareScopePage() {
  const { session, isLoading, error } = useSharedSession();
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
    return <LinkNotFoundComponent message={error?.message || "The share link you are trying to access is invalid or has been disabled."} />;
  }

  const snapshotData = session.snapshot;
  
  // Runtime validation to prevent rendering a broken UI if the snapshot is incomplete
  const isWorkflowValid = snapshotData.statuses && snapshotData.statuses.length >= 2;
  
  if (!isWorkflowValid) {
      return (
        <>
            <ShareSidebar />
            <SidebarInset>
                <SharedHeader title={'Misconfigured Link'} />
                 <LinkNotFoundComponent 
                    isMisconfigured={true}
                    message="This shared link is missing a valid workflow configuration. Please contact the person who sent you this link."
                 />
            </SidebarInset>
        </>
      )
  }
  
  const navItemForScope = (session.navItems || []).find(item => {
    const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    return itemPath === scope.split('/')[0]; // Compare with base path
  });
  
  const isPageAllowed = navItemForScope && session.allowedNavItems.includes(navItemForScope.id);
  
  const viewProps = {
    session,
    isLoading,
    tasks: snapshotData.tasks || [],
    statuses: snapshotData.statuses || [],
    brands: snapshotData.brands || [],
    users: snapshotData.users || [],
    socialMediaPosts: (snapshotData as any).socialMediaPosts || [],
  };

  const renderContent = () => {
    if (!isPageAllowed) {
        return <AccessDeniedPlaceholder pageName={navItemForScope?.label || scope} />;
    }

    // Always render the base page content, the sheet will overlay it if taskId exists
    switch (`/${scope.split('/')[0]}`) {
        case '/dashboard':
            return <SharedDashboardView {...viewProps} />;
        case '/tasks':
            return <SharedTasksView {...viewProps} />;
        case '/calendar':
            return <SharedCalendarView {...viewProps} />;
        case '/schedule':
             return <SharedScheduleView {...viewProps} />;
        case '/social-media':
            return <SharedSocialMediaView {...viewProps} isAnalyticsView={scope.includes('analytics')} />;
        default:
            return <AccessDeniedPlaceholder pageName={scope} />;
    }
  };


  return (
    <>
      <ShareSidebar />
      <SidebarInset>
        <SharedHeader title={navItemForScope?.label || 'Shared View'} />
        {renderContent()}
      </SidebarInset>
    </>
  );
}
