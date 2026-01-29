
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
import { SharedReportsView } from '@/components/share/shared-reports-view';

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
    return itemPath === scope;
  });
  
  const isPageAllowed = navItemForScope && session.allowedNavItems.includes(navItemForScope.id);
  
  const viewProps = {
    session,
    isLoading,
    tasks: snapshotData.tasks || [],
    socialMediaPosts: snapshotData.socialMediaPosts || [],
    webArticles: snapshotData.webArticles || [],
    statuses: snapshotData.statuses || [],
    brands: snapshotData.brands || [],
    users: snapshotData.users || [],
  };

  const renderContent = () => {
    if (!isPageAllowed) {
        return <AccessDeniedPlaceholder pageName={navItemForScope?.label || scope} />;
    }

    switch (`/${scope}`) {
        case '/dashboard':
            return <SharedDashboardView {...viewProps} />;
        case '/tasks':
            return <SharedTasksView {...viewProps} workstream="tasks" />;
        case '/tasks/schedule':
             return <SharedScheduleView {...viewProps} workstream="tasks" />;
        case '/social-media/posts':
            return <SharedTasksView {...viewProps} workstream="socialMediaPosts" />;
        case '/social-media/calendar':
            return <SharedSocialMediaView {...viewProps} />;
        case '/social-media/schedule':
             return <SharedScheduleView {...viewProps} workstream="socialMediaPosts" />;
        case '/social-media/analytics':
             return <SharedReportsView {...viewProps} posts={snapshotData.socialMediaPosts || []} />;
        case '/web/articles':
             return <SharedTasksView {...viewProps} workstream="webArticles" />;
        case '/web/schedule':
             return <SharedScheduleView {...viewProps} workstream="webArticles" />;
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
