'use client';

import React from 'react';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SharedLink } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import halaman-halaman yang akan dirender secara dinamis
import SharedDashboardPage from '../dashboard/page';
import SharedTasksPage from '../tasks/page';
import SharedCalendarPage from '../calendar/page';
import SharedReportsPage from '../reports/page';

// Komponen untuk fallback jika halaman tidak ada di scope
const NotFoundComponent = () => {
    React.useEffect(() => {
        notFound();
    }, []);
    return null;
}

const AccessDeniedComponent = () => {
     return (
        <div className="flex h-full items-center justify-center p-8">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-destructive"/>
                        Akses Ditolak
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Anda tidak memiliki izin untuk melihat halaman ini melalui link yang Anda gunakan.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};


// Map untuk merender komponen berdasarkan scope
const pageComponents: { [key: string]: React.ComponentType<any> } = {
  'dashboard': SharedDashboardPage,
  'tasks': SharedTasksPage,
  'calendar': SharedCalendarPage,
  'reports': SharedReportsPage,
};

const navIdToScope: { [key: string]: string } = {
    'nav_task_board': 'dashboard',
    'nav_list': 'tasks',
    'nav_calendar': 'calendar',
    'nav_performance_analysis': 'reports'
}


export default function ShareScopePage() {
  const params = useParams();
  const { linkId, scope } = params as { linkId: string; scope: string[] };
  const currentScope = scope?.[0] || '';

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

  if (error || !sharedLink) {
    notFound();
    return null;
  }
  
  // Validasi izin akses berdasarkan scope
  const isScopeAllowed = sharedLink.allowedNavItems.some(navId => navIdToScope[navId] === currentScope);

  if (!isScopeAllowed) {
    return <AccessDeniedComponent />;
  }

  const PageComponent = pageComponents[currentScope] || NotFoundComponent;

  return <PageComponent />;
}
