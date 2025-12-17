
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { useSharedSession } from '@/context/shared-session-provider';
import { notFound } from 'next/navigation';

export default function SharedReportsPage() {
  const { session, isLoading } = useSharedSession();
  
  // Security check: If this page is not in the allowed list, deny access.
  if (!isLoading && session && !session.allowedNavItems.includes('nav_performance_analysis')) {
    return notFound();
  }
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Reports" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
            <CardContent className="p-12 text-center">
                <h3 className="text-lg font-semibold">Feature Not Available in Preview</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                   The full reports page is not accessible in this shared view.
                </p>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
