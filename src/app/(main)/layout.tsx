
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
  FolderKanban,
  Calendar,
  AreaChart,
  Home,
  FileText,
  Share2,
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

  const [isTasksOpen, setIsTasksOpen] = useState(pathname.startsWith('/tasks'));
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith('/admin') && !pathname.startsWith('/admin/settings'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/admin/settings'));
  
  const navItemsCollectionRef = useMemo(() => 
    firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
  [firestore]);

  const { data: navItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const filteredNavItems = useMemo(() => {
    if (!profile || !navItems) return { mainItems: [], tasksGroup: [], contentGroup: [], analysisGroup: [], adminItems: [], settingsItems: [] };
    
    const mainItems: NavigationItem[] = [];
    const tasksGroup: NavigationItem[] = [];
    const contentGroup: NavigationItem[] = [];
    const analysisGroup: NavigationItem[] = [];
    const adminItems: NavigationItem[] = [];
    const settingsItems: NavigationItem[] = [];

    const groupMapping: Record<string, NavigationItem[]> = {
        tasks: tasksGroup,
        dashboard: tasksGroup,
        'daily-report': tasksGroup,
        calendar: contentGroup,
        'social-media': contentGroup,
        reports: analysisGroup,
        admin: adminItems,
    };

    for (const item of navItems) {
      if (!item.roles.includes(profile.role)) continue;
      
      const mainPath = item.path.split('/')[1];

      if(item.path.startsWith('/admin/settings')) {
          settingsItems.push(item);
          continue;
      }

      if(groupMapping[mainPath]) {
          groupMapping[mainPath].push(item);
      } else {
          mainItems.push(item);
      }
    }
    
    return { mainItems, tasksGroup, contentGroup, analysisGroup, adminItems, settingsItems };
  }, [profile, navItems]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
  useEffect(() => {
    if(pathname.startsWith('/tasks') || pathname === '/dashboard' || pathname === '/daily-report'){
      setIsTasksOpen(true);
    }
  }, [pathname]);

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
  
  const hasMainItems = filteredNavItems.mainItems.length > 0;
  const hasTasksGroup = filteredNavItems.tasksGroup.length > 0;
  const hasContentGroup = filteredNavItems.contentGroup.length > 0;
  const hasAnalysisGroup = filteredNavItems.analysisGroup.length > 0;
  const hasAdminItems = filteredNavItems.adminItems.length > 0;
  const hasSettingsItems = filteredNavItems.settingsItems.length > 0;
  
  const renderGroup = (
    title: string,
    icon: React.ElementType,
    items: NavigationItem[],
    isOpen: boolean,
    setIsOpen: (open: boolean) => void
  ) => {
    if (items.length === 0) return null;
    const IconComponent = icon;
    
    // Check if any item in the group is currently active
    const isGroupActive = items.some(item => pathname.startsWith(item.path));

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={isGroupActive}
              className="w-full justify-between"
              tooltip={title}
            >
              <div className="flex items-center gap-2">
                <IconComponent />
                <span>{title}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
        <CollapsibleContent className="pl-6">
          <SidebarMenu>
            {items.sort((a, b) => a.order - b.order).map((item) => (
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
    );
  };


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            
            {renderGroup("Tasks", FolderKanban, filteredNavItems.tasksGroup, isTasksOpen, setIsTasksOpen)}
            {renderGroup("Content", Calendar, filteredNavItems.contentGroup, pathname.startsWith('/calendar') || pathname.startsWith('/social-media'), (open) => {})}
            {renderGroup("Analysis", AreaChart, filteredNavItems.analysisGroup, pathname.startsWith('/reports'), (open) => {})}
            
            {/* Admin Section */}
            {hasAdminItems && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith('/admin') && !pathname.startsWith('/admin/settings')}
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
                      isActive={pathname.startsWith('/admin/settings')}
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

    