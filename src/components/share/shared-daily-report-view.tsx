
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SharedHeader } from './shared-header';

export function SharedDailyReportView() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <SharedHeader title="Daily Report" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold">Feature Not Available in Preview</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The daily report checklist is specific to a logged-in user and is not available in a shared view.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
