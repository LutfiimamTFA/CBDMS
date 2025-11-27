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
  LayoutDashboard,
  Users,
  Database,
  Settings,
  Loader2,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useUserProfile } from '@/firebase';
import { useEffect } from 'react';
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
    { href: '/admin/users', icon: KeyRound, label: 'User Management' },
    { href: '/admin/data', icon: Database, label: 'Data Management' },
    { href: '/admin/settings', icon: Settings, label: 'App Settings' },
  ];

  if (isLoading || !profile || profile.role !== 'Super Admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  const isUserManagementPage = pathname.startsWith('/admin/users') || pathname.startsWith('/admin/settings/roles');

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
                        isActive={item.href === '/admin/users' ? isUserManagementPage : pathname.startsWith(item.href)}
                        tooltip={item.label}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            ))}
            {isUserManagementPage && (
                 <div className="pl-6 mt-2 space-y-1">
                    <Link href="/admin/users">
                        <div className={cn("flex items-center gap-2 text-sm p-2 rounded-md hover:bg-sidebar-accent", pathname === '/admin/users' && "bg-sidebar-accent font-semibold")}>
                            <Users className="h-4 w-4" />
                            <span>Users</span>
                        </div>
                    </Link>
                    <Link href="/admin/settings/roles">
                        <div className={cn("flex items-center gap-2 text-sm p-2 rounded-md hover:bg-sidebar-accent", pathname === '/admin/settings/roles' && "bg-sidebar-accent font-semibold")}>
                            <KeyRound className="h-4 w-4" />
                            <span>Roles</span>
                        </div>
                    </Link>
                 </div>
            )}
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
