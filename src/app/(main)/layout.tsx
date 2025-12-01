
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
  Settings as SettingsIcon,
  Loader2,
  Shield,
  ChevronDown,
  User,
  Icon as LucideIcon,
  KeyRound,
  SlidersHorizontal,
  Palette,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) {
    return <lucideIcons.HelpCircle {...props} />; // Fallback Icon
  }
  return <LucideIconComponent {...props} />;
};


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, isLoading: isUserLoading } = useUserProfile();
  const firestore = useFirestore();

  const isAdminRoute = pathname.startsWith('/admin');
  const [isAdminOpen, setIsAdminOpen] = useState(isAdminRoute);
  
  const isSettingsRoute = pathname.startsWith('/admin/settings');
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsRoute);
  
  const navItemsCollectionRef = useMemo(() => 
    firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
  [firestore]);

  const { data: navItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const filteredNavItems = useMemo(() => {
    if (!profile || !navItems) return [];
    return navItems.filter(item => item.roles.includes(profile.role));
  }, [profile, navItems]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const isLoading = isUserLoading || isNavItemsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const isAdminOrManager = profile?.role === 'Super Admin' || profile?.role === 'Manager';

  if (!isAdminOrManager && isAdminRoute) {
    router.push('/dashboard');
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
            {isAdminOrManager && (
               <SidebarMenuItem>
                <Link href='/admin/dashboard'>
                  <SidebarMenuButton
                    isActive={pathname === '/admin/dashboard'}
                    tooltip='Dashboard'
                  >
                    <LayoutDashboard/>
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
            
            {filteredNavItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <Link href={item.path}>
                  <SidebarMenuButton
                    isActive={pathname === item.path}
                    tooltip={item.label}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}

            {isAdminOrManager && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isAdminRoute && !isSettingsRoute && pathname !== '/admin/dashboard'}
                      className="w-full justify-between"
                      tooltip='Admin'
                    >
                      <div className="flex items-center gap-2">
                        <Shield />
                        <span>Admin</span>
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
                    <SidebarMenuItem>
                      <Link href='/admin/users'>
                        <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith('/admin/users')} className="w-full justify-start">
                          <Users/>
                          <span>Users</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                     {profile?.role === 'Super Admin' && (
                       <SidebarMenuItem>
                        <Link href='/admin/data'>
                          <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith('/admin/data')} className="w-full justify-start">
                            <Database/>
                            <span>Data</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                     )}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}

            {isAdminOrManager && (
              <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isSettingsRoute}
                      className="w-full justify-between"
                      tooltip='Settings'
                    >
                      <div className="flex items-center gap-2">
                        <SettingsIcon />
                        <span>Settings</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isSettingsOpen && 'rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-6">
                  <SidebarMenu>
                     {profile?.role === 'Super Admin' && (
                        <SidebarMenuItem>
                            <Link href='/admin/settings'>
                                <SidebarMenuButton variant="ghost" size="sm" isActive={pathname === '/admin/settings'} className="w-full justify-start">
                                    <Icon name="Building" />
                                    <span>Company</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                     )}
                     <SidebarMenuItem>
                      <Link href='/admin/settings/roles'>
                        <SidebarMenuButton variant="ghost" size="sm" isActive={pathname === '/admin/settings/roles'} className="w-full justify-start">
                          <KeyRound/>
                          <span>Roles & Permissions</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <Link href='/admin/settings/navigation'>
                        <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith('/admin/settings/navigation')} className="w-full justify-start">
                          <SlidersHorizontal/>
                          <span>Navigation</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    {profile?.role === 'Super Admin' && (
                        <SidebarMenuItem>
                            <Link href='/admin/settings/theme'>
                                <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith('/admin/settings/theme')} className="w-full justify-start">
                                    <Palette />
                                    <span>Theme</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    )}
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
