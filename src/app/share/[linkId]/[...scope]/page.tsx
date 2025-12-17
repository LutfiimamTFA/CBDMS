'use client';

import React from 'react';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SharedLink } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
                        <ShieldAlert className="h-6 w-6 text-destructive"/>
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

// Map URL scopes to their corresponding components
const pageComponents: { [key: string]: React.ComponentType<any> } = {
  'dashboard': SharedDashboardView,
  'tasks': SharedTasksView,
  'calendar': SharedCalendarView,
  'reports': SharedReportsView,
};

// Map Navigation Item IDs (from the database) to URL scopes
const navIdToScope: { [key: string]: string } = {
    'nav_task_board': 'dashboard',
    'nav_list': 'tasks',
    'nav_calendar': 'calendar',
    'nav_performance_analysis': 'reports'
};

export default function ShareScopePage() {
  const params = useParams();
  const { linkId, scope } = params as { linkId: string; scope: string[] };
  const currentScope = scope?.[0] || 'dashboard'; // Default to dashboard if no scope

  const firestore = useFirestore();
  
  const linkDocRef = React.useMemo(() => {
    if (!firestore || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading, error } = useDoc<SharedLink>(linkDocRef);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If the link itself doesn't exist, show a 404
  if (error || !sharedLink) {
    notFound();
    return null;
  }
  
  // Check if the requested page scope is allowed by the share link's permissions
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

  // Render the correct component based on the URL scope
  return <PageComponent permissions={sharedLink.permissions} companyId={sharedLink.companyId} />;
}
