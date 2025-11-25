'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import type React from 'react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '../ui/button';
import { Bell, Plus } from 'lucide-react';
import { LanguageSwitcher } from '../language-switcher';
import { UserNav } from './user-nav';
import { AddTaskDialog } from '../tasks/add-task-dialog';
import { useI18n } from '@/context/i18n-provider';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          {title}
        </h1>
        <div className="ml-4">
          <AddTaskDialog>
            <Button>
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </AddTaskDialog>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Button variant="ghost" size="icon">
            <Bell className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
