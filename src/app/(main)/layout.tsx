
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
  Shield,
  ChevronDown,
  User,
  Icon as LucideIcon,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';

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
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, isLoading: isUserLoading } = useUserProfile();
  const firestore = useFirestore();

  const navItemsCollectionRef = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
  );

  const { data: navItemsFromDB, isLoading: isNavItemsLoading } =
    useCollection<NavigationItem>(navItemsCollectionRef);

  const { navItems, itemMap, childMap } = useMemo(() => {
    if (!navItemsFromDB) return { navItems: [], itemMap: new Map(), childMap: new Map() };
    const items = navItemsFromDB.map(item => ({...item, label: t(item.label as any) || item.label}));
    const itemMap = new Map(items.map(item => [item.id, item]));
    const childMap = new Map<string, NavigationItem[]>();

    items.forEach(item => {
      const parentId = item.path.startsWith('/admin/settings') ? 'nav_settings' : item.path.startsWith('/admin') ? 'nav_admin' : null;
      if (parentId) {
        if (!childMap.has(parentId)) {
          childMap.set(parentId, []);
        }
        childMap.get(parentId)!.push(item);
      }
    });
    
    // Add top-level items that are folders
    if (childMap.has('nav_admin')) itemMap.set('nav_admin', { id: 'nav_admin', label: t('nav.admin'), path: '', icon: 'Shield', order: 10, roles: ['Super Admin', 'Manager'], parentId: null });
    if (childMap.has('nav_settings')) itemMap.set('nav_settings', { id: 'nav_settings', label: t('nav.settings'), path: '', icon: 'Settings', order: 20, roles: ['Super Admin'], parentId: null });
    
    return { navItems: Array.from(itemMap.values()), itemMap, childMap };
  }, [navItemsFromDB, t]);


  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const sections: Record<string, boolean> = {};
    if (pathname.startsWith('/admin/settings')) {
      sections.nav_settings = true;
    } else if (pathname.startsWith('/admin')) {
      sections.nav_admin = true;
    }
    return sections;
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const filteredNavItems = useMemo(() => {
    if (!profile || navItems.length === 0) return [];
    return navItems.filter(item => item.roles.includes(profile.role));
  }, [profile, navItems]);


  const renderNavItems = useCallback(
    (items: NavigationItem[], parentId: string | null = null) => {
      return items
        .filter((item) => {
           const itemParentId = item.path.startsWith('/admin/settings') ? 'nav_settings' : item.path.startsWith('/admin') ? 'nav_admin' : null;
           return (parentId === null && itemParentId === null && !childMap.has(item.id)) || itemParentId === parentId;
        })
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const children = childMap.get(item.id) || [];
          const isActive = pathname === item.path || (item.path !== '/' && item.path.length > 1 && pathname.startsWith(item.path));

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
                      {renderNavItems(filteredNavItems, item.id)}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem key={item.id}>
              <Link href={item.path} passHref>
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
    [filteredNavItems, childMap, pathname, openSections, t]
  );

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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>{renderNavItems(filteredNavItems)}</SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
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
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
