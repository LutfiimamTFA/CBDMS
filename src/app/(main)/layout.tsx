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
  Loader2,
  Shield,
  ChevronDown,
  User,
  Icon as LucideIcon,
  Settings as SettingsIcon,
  Repeat,
  KanbanSquare,
  LayoutDashboard,
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

  const isTasksRoute = pathname.startsWith('/tasks') || pathname.startsWith('/calendar') || pathname.startsWith('/reports');
  const [isTasksOpen, setIsTasksOpen] = useState(isTasksRoute);
  
  const isAdminRoute = pathname.startsWith('/admin') && !pathname.startsWith('/admin/settings');
  const [isAdminOpen, setIsAdminOpen] = useState(isAdminRoute);
  
  const isSettingsRoute = pathname.startsWith('/admin/settings');
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsRoute);
  
  const navItemsCollectionRef = useMemo(() => 
    firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
  [firestore]);

  const { data: navItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const filteredNavItems = useMemo(() => {
    if (!profile || !navItems) return { mainItems: [], adminItems: [], settingsItems: [], taskBoard: null, adminDashboard: null };
    
    const mainItems: NavigationItem[] = [];
    const adminItems: NavigationItem[] = [];
    const settingsItems: NavigationItem[] = [];
    let taskBoard: NavigationItem | null = null;
    let adminDashboard: NavigationItem | null = null;

    for (const item of navItems) {
      if (!item.roles.includes(profile.role)) continue;
      
      if (item.id === 'nav_task_board') {
        taskBoard = item;
      } else if (item.id === 'nav_admin_dashboard') {
        adminDashboard = item;
      } else if (item.path.startsWith('/admin/settings')) {
        settingsItems.push(item);
      } else if (item.path.startsWith('/admin')) {
        adminItems.push(item);
      } else {
        mainItems.push(item);
      }
    }
    
    return { mainItems, adminItems, settingsItems, taskBoard, adminDashboard };
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
  
  const hasTasksGroup = filteredNavItems.mainItems.length > 0;
  const hasAdminItems = filteredNavItems.adminItems.length > 0;
  const hasSettingsItems = filteredNavItems.settingsItems.length > 0;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {/* Standalone Task Board */}
            {filteredNavItems.taskBoard && (
              <SidebarMenuItem>
                <Link href={filteredNavItems.taskBoard.path}>
                  <SidebarMenuButton
                    isActive={pathname === filteredNavItems.taskBoard.path}
                    tooltip={filteredNavItems.taskBoard.label}
                  >
                    <Icon name={filteredNavItems.taskBoard.icon} />
                    <span>{filteredNavItems.taskBoard.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {/* Standalone Admin Dashboard */}
            {filteredNavItems.adminDashboard && (
              <SidebarMenuItem>
                <Link href={filteredNavItems.adminDashboard.path}>
                  <SidebarMenuButton
                    isActive={pathname === filteredNavItems.adminDashboard.path}
                    tooltip={filteredNavItems.adminDashboard.label}
                  >
                    <Icon name={filteredNavItems.adminDashboard.icon} />
                    <span>{filteredNavItems.adminDashboard.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
            
            {/* Other Tasks Navigation Group */}
            {hasTasksGroup && (
              <Collapsible open={isTasksOpen} onOpenChange={setIsTasksOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isTasksRoute}
                      className="w-full justify-between"
                      tooltip='Tasks'
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="ClipboardList" />
                        <span>Tasks</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isTasksOpen && 'rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-6">
                  <SidebarMenu>
                    {filteredNavItems.mainItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                          <Link href={item.path}>
                            <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith(item.path)} className="w-full justify-start">
                              <Icon name={item.icon}/>
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </Link>
                        </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Admin Section */}
            {hasAdminItems && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isAdminRoute}
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
                    {filteredNavItems.adminItems.map((item) => (
                       <SidebarMenuItem key={item.id}>
                          <Link href={item.path}>
                            <SidebarMenuButton variant="ghost" size="sm" isActive={pathname.startsWith(item.path)} className="w-full justify-start">
                              <Icon name={item.icon}/>
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </Link>
                        </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Settings Section */}
            {hasSettingsItems && (
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
                      {filteredNavItems.settingsItems.map((item) => (
                         <SidebarMenuItem key={item.id}>
                          <Link href={item.path}>
                            <SidebarMenuButton variant="ghost" size="sm" isActive={pathname === item.path} className="w-full justify-start">
                                <Icon name={item.icon} />
                                <span>{item.label}</span>
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
