
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SharedHeader } from './shared-header';

export function SharedGuideView() {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Guide" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold">Feature Not Available in Preview</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The guide page is not available in a shared view.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
