
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import type React from 'react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LanguageSwitcher } from '../language-switcher';
import { UserNav } from './user-nav';
import { NotificationBell } from './notification-bell';
import { ShareDialog } from '../share-dialog';
import { useSharedSession } from '@/context/shared-session-provider';
import { Badge } from '../ui/badge';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  const { session } = useSharedSession();
  
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          {title}
        </h1>
        {session && <Badge variant="outline">Preview Mode</Badge>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="flex items-center gap-2">
          {!session && (
            <>
              <ShareDialog />
              <LanguageSwitcher />
              <ThemeSwitcher />
              <NotificationBell />
              <UserNav />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
