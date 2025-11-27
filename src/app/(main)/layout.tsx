'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  FileText,
  User,
  ClipboardList,
  Loader2,
  Users,
  Shield,
  ChevronDown,
  Database,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useUserProfile } from '@/firebase';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, isLoading } = useUserProfile();
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith('/admin'));

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const baseNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('nav.board') },
    { href: '/tasks', icon: ClipboardList, label: t('nav.list') },
    { href: '/reports', icon: FileText, label: t('nav.reports') },
  ];

  const adminNavItems = {
    label: 'Admin',
    icon: Shield,
    subItems: [
      {
        href: '/admin/dashboard',
        icon: LayoutDashboard,
        label: 'Overview',
      },
      { href: '/admin/users', icon: Users, label: 'User Management' },
      { href: '/admin/data', icon: Database, label: 'Data Management' },
      {
        href: '/admin/settings',
        icon: SettingsIcon,
        label: 'App Settings',
      },
    ],
  };

  const navItems = [...baseNavItems];

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
            {!isLoading && profile?.role === 'Super Admin' && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith('/admin')}
                      className="w-full justify-between"
                      tooltip={adminNavItems.label}
                    >
                      <div className="flex items-center gap-2">
                        <adminNavItems.icon />
                        <span>{adminNavItems.label}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isAdminOpen && 'rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-6">
                  <SidebarMenu>
                    {adminNavItems.subItems.map((subItem) => (
                      <SidebarMenuItem key={subItem.href}>
                        <Link href={subItem.href}>
                          <SidebarMenuButton
                            variant="ghost"
                            size="sm"
                            isActive={pathname === subItem.href}
                            className="w-full justify-start"
                          >
                            <subItem.icon />
                            <span>{subItem.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings">
                <SidebarMenuButton
                  isActive={pathname === '/settings'}
                  tooltip={'Profile'}
                >
                  <User />
                  <span>{'Profile'}</span>
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
