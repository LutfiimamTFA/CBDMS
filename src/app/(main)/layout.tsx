
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

  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith('/admin') && !pathname.startsWith('/admin/settings'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/admin/settings'));
  
  const navItemsCollectionRef = useMemo(() => 
    firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
  [firestore]);

  const { data: navItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const filteredNavItems = useMemo(() => {
    if (!profile || !navItems) return { mainItems: [], adminItems: [], settingsItems: [] };
    
    return {
      mainItems: navItems.filter(item => !item.path.startsWith('/admin') && item.roles.includes(profile.role)),
      adminItems: navItems.filter(item => item.path.startsWith('/admin') && !item.path.startsWith('/admin/settings') && item.roles.includes(profile.role)),
      settingsItems: navItems.filter(item => item.path.startsWith('/admin/settings') && item.roles.includes(profile.role)),
    };
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
  
  const hasAdminItems = filteredNavItems.adminItems.length > 0;
  const hasSettingsItems = filteredNavItems.settingsItems.length > 0;

  const translatedNavItems = useMemo(() => {
    const translate = (items: NavigationItem[]) => items.map(item => ({...item, label: t(item.label as any) || item.label}));
    return {
      mainItems: translate(filteredNavItems.mainItems),
      adminItems: translate(filteredNavItems.adminItems),
      settingsItems: translate(filteredNavItems.settingsItems),
    }
  }, [filteredNavItems, t]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {translatedNavItems.mainItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <Link href={item.path}>
                  <SidebarMenuButton isActive={pathname.startsWith(item.path)} tooltip={item.label}>
                    <Icon name={item.icon}/>
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}

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
                    {translatedNavItems.adminItems.map((item) => (
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
            
            {hasSettingsItems && (
              <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith('/admin/settings')}
                      className="w-full justify-between"
                      tooltip={t('nav.settings')}
                    >
                      <div className="flex items-center gap-2">
                        <SettingsIcon />
                        <span>{t('nav.settings')}</span>
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
                      {translatedNavItems.settingsItems.map((item) => (
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
