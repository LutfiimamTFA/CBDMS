'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import type React from 'react';
import { ThemeSwitcher } from '@/components/theme-switcher';

interface SharedHeaderProps {
  title: string;
}

export function SharedHeader({ title }: SharedHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
      </div>
    </header>
  );
}
