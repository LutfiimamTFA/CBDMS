'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  FileText,
  Settings,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { AddTaskDialog } from '@/components/tasks/add-task-dialog';
import { Button } from '@/components/ui/button';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/tasks', icon: ClipboardList, label: t('nav.tasks') },
    { href: '/reports', icon: FileText, label: t('nav.reports') },
  ];
  
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
           <div className="p-2">
            <AddTaskDialog>
              <SidebarMenuButton asChild tooltip="Create Task" className="w-full justify-center">
                <Button>
                  <Plus />
                  <span>Create Task</span>
                </Button>
              </SidebarMenuButton>
            </AddTaskDialog>
          </div>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings">
                <SidebarMenuButton
                  isActive={pathname === '/settings'}
                  tooltip={t('nav.settings')}
                >
                  <Settings />
                  <span>{t('nav.settings')}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
