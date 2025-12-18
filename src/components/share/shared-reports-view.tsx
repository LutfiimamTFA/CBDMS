
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { SharedHeader } from './shared-header';

export function SharedReportsView() {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Reports" />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
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
