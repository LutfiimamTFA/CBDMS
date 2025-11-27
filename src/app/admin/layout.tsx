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
  Users,
  Database,
  Settings,
  Loader2,
  ArrowLeft,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUserProfile } from '@/firebase';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, isLoading } = useUserProfile();

  const isUserManagementPage =
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/settings/roles');
    
  const [isUserManagementOpen, setIsUserManagementOpen] =
    useState(isUserManagementPage);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile && profile.role !== 'Super Admin') {
        toast({
          variant: 'destructive',
          title: 'Unauthorized Access',
          description: 'You do not have permission to view the admin area.',
        });
        router.push('/dashboard');
      }
    }
  }, [user, profile, isLoading, router, toast]);

  const navItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { href: '/admin/data', icon: Database, label: 'Data Management' },
    { href: '/admin/settings', icon: Settings, label: 'App Settings' },
  ];

  const userManagementNav = {
    label: 'User Management',
    icon: KeyRound,
    subItems: [
      { href: '/admin/users', icon: Users, label: 'Users' },
      { href: '/admin/settings/roles', icon: KeyRound, label: 'Roles' },
    ],
  };

  if (isLoading || !profile || profile.role !== 'Super Admin') {
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
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}

            <Collapsible open={isUserManagementOpen} onOpenChange={setIsUserManagementOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isUserManagementPage}
                      className="w-full justify-between"
                      tooltip={userManagementNav.label}
                    >
                      <div className="flex items-center gap-2">
                        <userManagementNav.icon />
                        <span>{userManagementNav.label}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isUserManagementOpen && 'rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-6">
                  <SidebarMenu>
                    {userManagementNav.subItems.map((subItem) => (
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

          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/dashboard">
                <SidebarMenuButton tooltip={'Back to App'}>
                  <ArrowLeft />
                  <span>{'Back to App'}</span>
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
