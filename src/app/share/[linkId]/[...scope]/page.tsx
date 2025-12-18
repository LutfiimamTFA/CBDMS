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
  
  // Define which component to render based on the scope
  let PageComponent: React.ComponentType<any> | null = null;
  if (isPageAllowed) {
    if (scope.startsWith('social-media')) {
      PageComponent = SharedSocialMediaView;
    } else {
      PageComponent = SharedSimpleTasksView;
    }
  }


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
    isAnalyticsView: scope === 'social-media/analytics',
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
