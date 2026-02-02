'use client';

import { Loader2 } from 'lucide-react';
import { Logo } from './logo';

export function BrandedLoader() {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-background min-h-[100dvh] md:min-h-screen gap-4">
      <Logo />
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
