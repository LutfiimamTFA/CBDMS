
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
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
  Ban,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore, useUserProfile, useAuth } from '@/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { useSharedSession } from '@/context/shared-session-provider';
import { getIdTokenResult } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


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

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, isLoading: isUserLoading } = useUserProfile();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const firestore = useFirestore();
  const auth = useAuth();
  
  const isSharedView = !!params.linkId;

  // This effect handles initial authentication and redirection.
  useEffect(() => {
    if (isUserLoading || isSessionLoading) return;
    
    if (!isSharedView && !user) {
      router.replace('/login');
      return;
    }
  
    if (!isSharedView && auth?.currentUser) {
      getIdTokenResult(auth.currentUser, true)
        .then((idTokenResult) => {
          if (idTokenResult.claims.mustChangePassword) {
            router.replace('/force-password-change');
          } else if (idTokenResult.claims.mustAcknowledgeTasks) {
            router.replace('/force-acknowledge-tasks');
          }
        })
        .catch(() => {
          router.replace('/login');
        });
    }

  }, [user, isUserLoading, auth, router, isSharedView, isSessionLoading]);


  const navItemsCollectionRef = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
  );

  const { data: navItemsFromDB, isLoading: isNavItemsLoading } =
    useCollection<NavigationItem>(navItemsCollectionRef);

  const { itemMap, childMap } = useMemo(() => {
    if (!navItemsFromDB) return { itemMap: new Map(), childMap: new Map() };
    const items = navItemsFromDB.map(item => ({...item, label: t(item.label as any) || item.label}));
    const itemMap = new Map(items.map(item => [item.id, item]));
    const childMap = new Map<string, NavigationItem[]>();

    items.forEach(item => {
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
    
    if (childMap.has('nav_admin')) itemMap.set('nav_admin', { id: 'nav_admin', label: t('nav.admin'), path: '', icon: 'Shield', order: 10, roles: ['Super Admin', 'Manager'], parentId: null });
    if (childMap.has('nav_settings')) itemMap.set('nav_settings', { id: 'nav_settings', label: t('nav.settings'), path: '', icon: 'Settings', order: 20, roles: ['Super Admin', 'Manager'], parentId: null });
    if (childMap.has('nav_social_media')) itemMap.set('nav_social_media', { id: 'nav_social_media', label: t('nav.social_media'), path: '', icon: 'Share2', order: 6, roles: ['Super Admin', 'Manager', 'Employee'], parentId: null });
    
    return { itemMap, childMap };
  }, [navItemsFromDB, t]);

  const allNavItems = Array.from(itemMap.values());

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const sections: Record<string, boolean> = {};
    if (pathname.startsWith('/admin/settings')) sections.nav_settings = true;
    else if (pathname.startsWith('/admin')) sections.nav_admin = true;
    else if (pathname.startsWith('/social-media')) sections.nav_social_media = true;
    return sections;
  });
  
  const currentRole = profile?.role;

  const filteredNavItems = useMemo(() => {
    if (isSharedView && session) {
        return allNavItems.filter(item => session.allowedNavItems.includes(item.id));
    }
    if (!currentRole || allNavItems.length === 0) return [];
    return allNavItems.filter(item => item.roles.includes(currentRole));
  }, [currentRole, allNavItems, session, isSharedView]);


  const renderNavItems = useCallback(
    (items: NavigationItem[], parentId: string | null = null) => {
      return items
        .filter((item) => {
           let itemParentId: string | null = null;
           if (item.path.startsWith('/admin/settings') && item.id !== 'nav_settings') itemParentId = 'nav_settings';
           else if (item.path.startsWith('/admin') && item.id !== 'nav_admin') itemParentId = 'nav_admin';
           else if (item.path.startsWith('/social-media') && item.id !== 'nav_social_media') itemParentId = 'nav_social_media';

           return (parentId === null && itemParentId === null && !childMap.has(item.id)) || itemParentId === parentId;
        })
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const children = childMap.get(item.id)?.filter(child => filteredNavItems.some(i => i.id === child.id)) || [];
          const path = isSharedView && session ? `/share/${session.id}${item.path}` : item.path;
          const isActive = pathname === path || (path.length > 1 && pathname.startsWith(path));

          if (children.length > 0) {
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
    [filteredNavItems, childMap, pathname, openSections, session, t, isSharedView]
  );

  const isLoading = isUserLoading || isNavItemsLoading || isSessionLoading;

  if (isLoading || (!isSharedView && !user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider isSharedView={isSharedView}>
      <Sidebar collapsible={isSharedView ? 'offcanvas' : 'icon'}>
        <SidebarHeader>
          <Logo />
           {isSharedView && session && (
              <div className="flex flex-col gap-2 items-start">
                  <Badge variant="outline">Preview Mode</Badge>
                  <p className="text-xs text-muted-foreground p-2 bg-secondary rounded-md">
                      You are viewing a shared link named <span className="font-semibold text-foreground">"{session.name}"</span>.
                  </p>
              </div>
            )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>{renderNavItems(filteredNavItems)}</SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
            {isSharedView ? (
                 <Button variant="ghost" onClick={() => window.location.href = '/'}>
                    <LogOut className="mr-2 h-4 w-4" /> Exit Preview
                 </Button>
            ) : (
                <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/settings">
                    <SidebarMenuButton
                        isActive={pathname === '/settings'}
                        tooltip={t('nav.profile')}
                    >
                        <User />
                        <span>{t('nav.profile')}</span>
                    </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                </SidebarMenu>
            )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
