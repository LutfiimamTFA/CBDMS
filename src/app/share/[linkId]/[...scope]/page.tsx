'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSharedSession } from '@/context/shared-session-provider';
import { Loader2, ShieldAlert, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Import the new simplified view and other necessary components
import { ShareSidebar } from '@/components/share/share-sidebar';
import { SharedSimpleTasksView } from '@/components/share/shared-simple-tasks-view';

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
// We now point all task-related views to the new simple component.
const pageComponents: { [key: string]: React.ComponentType<any> } = {
  'my-work': SharedSimpleTasksView,
  'dashboard': SharedSimpleTasksView,
  'tasks': SharedSimpleTasksView,
  'daily-report': SharedSimpleTasksView,
  'schedule': SharedSimpleTasksView,
  'calendar': SharedSimpleTasksView,
  'social-media': SharedSimpleTasksView,
  'social-media/analytics': SharedSimpleTasksView,
  'reports': SharedSimpleTasksView,
  'guide': SharedSimpleTasksView,
  'admin/settings/recurring': SharedSimpleTasksView,
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

  const navItemForScope = (navItems || []).find(item => {
    const itemPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    return itemPath === scope;
  });
  
  const isPageAllowed = navItemForScope && session.allowedNavItems.includes(navItemForScope.id);
  
  // Use the simple tasks view for any allowed task-related scope.
  const PageComponent = isPageAllowed ? SharedSimpleTasksView : null;

  if (!PageComponent) {
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
