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

export default function ShareScopePage() {
  const { session, isLoading, error, ...snapshotData } = useSharedSession();
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

  const navItemForScope = (session.navItems || []).find(item => {
    const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    return itemPath === scope;
  });
  
  const isPageAllowed = navItemForScope && session.allowedNavItems.includes(navItemForScope.id);
  
  const viewProps = {
    session,
    isLoading,
    ...snapshotData,
  };

  const renderContent = () => {
    if (!isPageAllowed) {
        return <AccessDeniedPlaceholder pageName={navItemForScope?.label || scope} />;
    }

    switch (`/${scope}`) {
        case '/dashboard':
            return <SharedDashboardView {...viewProps} />;
        case '/tasks':
            return <SharedTasksView {...viewProps} />;
        case '/calendar':
            return <SharedCalendarView {...viewProps} />;
        case '/schedule':
             return <SharedScheduleView {...viewProps} />;
        case '/social-media':
            return <SharedSocialMediaView {...viewProps} isAnalyticsView={false} />;
        case '/social-media/analytics':
            return <SharedSocialMediaView {...viewProps} isAnalyticsView={true} />;
        default:
            return <AccessDeniedPlaceholder pageName={scope} />;
    }
  };


  return (
    <div className='flex h-svh w-full'>
        <ShareSidebar />
        <main className='flex-1 overflow-auto flex w-full'>
            {renderContent()}
        </main>
    </div>
  );
}
