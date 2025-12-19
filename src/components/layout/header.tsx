
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import type React from 'react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LanguageSwitcher } from '../language-switcher';
import { UserNav } from './user-nav';
import { NotificationBell } from './notification-bell';
import type { NavigationItem } from '@/lib/types';
import { ShareViewDialog } from '../share/share-view-dialog';
import { usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { Share2 } from 'lucide-react';
import { useUserProfile } from '@/firebase';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
  isSharedView?: boolean;
  navItems?: NavigationItem[];
}

export function Header({ title, actions, isSharedView = false, navItems = [] }: HeaderProps) {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const shareableViews = ['/tasks', '/dashboard', '/calendar', '/schedule', '/social-media'];
  const canShowShareButton = !isSharedView && profile && shareableViews.includes(pathname);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="flex items-center gap-2">
            {!isSharedView ? (
              <>
                {canShowShareButton && (
                  <ShareViewDialog navItems={navItems}>
                    <Button variant="outline" size="sm">
                      <Share2 className="mr-2" /> Share View
                    </Button>
                  </ShareViewDialog>
                )}
                <LanguageSwitcher />
                <ThemeSwitcher />
                <NotificationBell />
                <UserNav />
              </>
            ) : (
              <ThemeSwitcher />
            )}
        </div>
      </div>
    </header>
  );
}
