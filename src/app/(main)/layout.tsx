
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
  SidebarMenuSub,
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
  ChevronDown,
  User,
  Icon as LucideIcon,
  LogOut,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore, useUserProfile, useAuth } from '@/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { getIdTokenResult } from 'firebase/auth';
import { AppProviders } from '@/components/app-providers';
import { Header } from '@/components/layout/header';
import { useIdleTimer } from '@/hooks/use-idle-timer';


const Icon = ({
  name,
  ...props
}: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) {
    return <lucideIcons.HelpCircle {...props} />; // Fallback Icon
  }
  return <LucideIconComponent {...props} />;
};

function MainAppLayout({
  children,
  finalNavItems,
}: {
  children: React.ReactNode;
  finalNavItems: NavigationItem[];
}) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    if(auth) {
        auth.signOut();
        router.push('/login');
    }
  }

  useIdleTimer({ onIdle: handleLogout, idleTime: 60 });


  const { childMap } = useMemo(() => {
    const itemMap = new Map(finalNavItems.map(item => [item.id, item]));
    const childMap = new Map<string, NavigationItem[]>();

    finalNavItems.forEach(item => {
      let parentId: string | null = null;
      if (item.path.startsWith('/admin/settings')) parentId = 'nav_settings';
      else if (item.path.startsWith('/admin')) parentId = 'nav_admin';
      else if (item.path.startsWith('/social-media')) parentId = 'nav_social_media';

      if (parentId && item.id !== parentId) {
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(item);
      }
    });

    return { itemMap, childMap };
  }, [finalNavItems]);
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const sections: Record<string, boolean> = {};
    if (pathname.startsWith('/admin/settings')) sections.nav_settings = true;
    else if (pathname.startsWith('/admin')) sections.nav_admin = true;
    else if (pathname.startsWith('/social-media')) sections.nav_social_media = true;
    return sections;
  });

  const renderNavItems = useCallback(
    (items: NavigationItem[], parentId: string | null = null) => {
      return items
        .filter((item) => {
           let itemParentId: string | null = null;
           if (item.path.startsWith('/admin/settings') && item.id !== 'nav_settings') itemParentId = 'nav_settings';
           else if (item.path.startsWith('/admin') && item.id !== 'nav_admin') itemParentId = 'nav_admin';
           else if (item.path.startsWith('/social-media') && item.id !== 'nav_social_media') itemParentId = 'nav_social_media';

           return (parentId === null && itemParentId === null) || itemParentId === parentId;
        })
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const children = childMap.get(item.id) || [];
          const path = item.path;
          const isActive = pathname === path || (path.length > 1 && pathname.startsWith(path));
          
          const hasVisibleChildren = children.some(child => finalNavItems.some(i => i.id === child.id));

          if (hasVisibleChildren) {
            return (
              <SidebarMenuItem key={item.id}>
                <Collapsible
                  open={openSections[item.id] || false}
                  onOpenChange={(isOpen) =>
                    setOpenSections((prev) => ({ ...prev, [item.id]: isOpen }))
                  }
                >
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1">
                    <SidebarMenuSub>
                      {renderNavItems(children, item.id)}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            );
          }

          if (!item.path) return null; // Don't render folders without visible children

          return (
            <SidebarMenuItem key={item.id}>
              <Link href={path} passHref>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  variant={parentId ? 'ghost' : 'default'}
                  size={parentId ? 'sm' : 'default'}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          );
        });
    },
    [finalNavItems, childMap, pathname, openSections]
  );
  
  const headerTitle = useMemo(() => {
    const activeItem = finalNavItems.find(item => item.path === pathname);
    return activeItem?.label || 'Dashboard';
  }, [pathname, finalNavItems]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>{renderNavItems(finalNavItems)}</SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
            <SidebarMenu>
            <SidebarMenuItem>
                <Link href="/settings">
                <SidebarMenuButton
                    isActive={pathname === '/settings'}
                    tooltip="Profile"
                >
                    <User />
                    <span>Profile</span>
                </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
         <Header title={headerTitle} navItems={finalNavItems} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading: isUserLoading } = useUserProfile();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const firestore = useFirestore();

  useEffect(() => {
    if (isUserLoading) return;
    
    // If there's no user, and we are on a protected route, redirect to login.
    if (!user && pathname !== '/login') {
      router.replace('/login');
      return;
    }

    if (auth?.currentUser) {
      getIdTokenResult(auth.currentUser, true)
        .then((idTokenResult) => {
          if (idTokenResult.claims.mustChangePassword) {
            router.replace('/force-password-change');
          } else if (idTokenResult.claims.mustAcknowledgeTasks) {
            router.replace('/force-acknowledge-tasks');
          }
        })
        .catch(() => router.replace('/login'));
    }
  }, [user, profile, isUserLoading, auth, router, pathname]);

  const navItemsCollectionRef = useMemo(
    () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
    [firestore]
  );
  const { data: navItemsFromDB, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);
  
  const finalNavItems = useMemo(() => {
    if (!profile || !navItemsFromDB) return [];
    
    const translatedItems = navItemsFromDB.map(item => ({...item, label: t(item.label as any) || item.label}));
    const itemMap = new Map(translatedItems.map(item => [item.id, item]));

    // Add pseudo-items for folders if they have children
    const childMap = new Map<string, NavigationItem[]>();
    translatedItems.forEach(item => {
      let parentId: string | null = null;
      if (item.path.startsWith('/admin/settings')) parentId = 'nav_settings';
      else if (item.path.startsWith('/admin')) parentId = 'nav_admin';
       else if (item.path.startsWith('/social-media')) parentId = 'nav_social_media';
      if (parentId && item.id !== parentId) {
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        childMap.get(parentId)!.push(item);
      }
    });
     if (childMap.has('nav_admin')) itemMap.set('nav_admin', { id: 'nav_admin', label: t('nav.admin'), path: '', icon: 'Shield', order: 10, roles: ['Super Admin', 'Manager'], parentId: null });
    if (childMap.has('nav_settings')) itemMap.set('nav_settings', { id: 'nav_settings', label: t('nav.settings'), path: '', icon: 'Settings', order: 20, roles: ['Super Admin', 'Manager'], parentId: null });
    if (childMap.has('nav_social_media')) itemMap.set('nav_social_media', { id: 'nav_social_media', label: t('nav.social_media'), path: '', icon: 'Share2', order: 6, roles: ['Super Admin', 'Manager', 'Employee'], parentId: null });

    return Array.from(itemMap.values()).filter(item => item.roles.includes(profile.role));
  }, [profile, navItemsFromDB, t]);

  const isLoading = isUserLoading || isNavItemsLoading;
  
  if (isLoading || !user || !profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <MainAppLayout finalNavItems={finalNavItems}>{children}</MainAppLayout>;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <MainLayoutWrapper>{children}</MainLayoutWrapper>
    </AppProviders>
  );
}
