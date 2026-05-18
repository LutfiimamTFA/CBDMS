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
  SidebarCollapsibleItem,
} from '@/components/ui/sidebar';
import {
  Loader2,
  User,
  Icon as LucideIcon,
  LogOut,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore, useUserProfile, useAuth, initiateSignOut, useDoc } from '@/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem, CompanySettings } from '@/lib/types';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { getIdTokenResult } from 'firebase/auth';
import { Header } from '@/components/layout/header';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import { SidebarInset } from '@/components/ui/sidebar';
import { BrandedLoader } from '@/components/branded-loader';

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
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isLoading: isUserLoading, companyId } = useUserProfile();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const firestore = useFirestore();
  const [isReady, setIsReady] = useState(false);

  const companySettingsDocRef = useMemo(() => {
    if (!firestore || !companyId) return null;
    return doc(firestore, 'companySettings', companyId);
  }, [firestore, companyId]);

  const { data: companySettings, isLoading: isSettingsLoading } = useDoc<CompanySettings>(companySettingsDocRef);

  useEffect(() => {
    // If the authentication state is still loading, do nothing yet.
    if (isUserLoading || isSettingsLoading) {
      return;
    }
    
    if (companySettings?.maintenanceSettings?.isEnabled && profile?.role !== 'Super Admin' && pathname !== '/maintenance') {
      router.replace('/maintenance');
      return;
    }
    
    if (profile?.role === 'Super Admin' && pathname === '/maintenance') {
        router.replace('/admin/settings/maintenance');
        return;
    }

    // If loading is finished and there's no user, redirect to login immediately.
    // Allow access only to the explicit login and related public pages.
    const publicPaths = ['/login', '/check-email'];
    if (!user && !publicPaths.includes(pathname)) {
      router.replace(`/login?next=${pathname}`);
      return;
    }

    // If there is a user, handle post-login logic.
    if (user && profile) {
      // Logic for forced actions (password change, task acknowledgment)
      getIdTokenResult(user, true)
        .then((idTokenResult) => {
          const claims = idTokenResult.claims;
          if (claims.mustChangePassword && pathname !== '/force-password-change') {
            router.replace('/force-password-change');
          } else if (claims.mustAcknowledgeTasks && pathname !== '/force-acknowledge-tasks') {
            router.replace('/force-acknowledge-tasks');
          } else {
             // If no forced actions are needed, we can consider the layout ready.
            setIsReady(true);
          }
        })
        .catch(() => {
          // If token verification fails, the user is effectively logged out.
          router.replace('/login');
        });
    } else if (!user) {
        // If there's no user, and we are on a public page, the content is ready to be shown.
        setIsReady(true);
    }
  }, [user, profile, isUserLoading, auth, router, pathname, companySettings, isSettingsLoading]);
  
  const handleLogout = async () => {
    if(auth) {
        await initiateSignOut(auth);
        router.push('/');
    }
  }

  useIdleTimer({ onIdle: handleLogout, idleTime: 60 });
  
  const navItemsCollectionRef = useMemo(
    () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
    [firestore]
  );
  const { data: navItemsFromDB, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);
  
  const finalNavItems = useMemo(() => {
    if (!profile || !navItemsFromDB) return [];
    
    return navItemsFromDB
      .filter(item => item.roles.includes(profile.role))
      .map(item => ({...item, label: t(item.label as any) || item.label}));

  }, [profile, navItemsFromDB, t]);

  const { itemMap, childMap } = useMemo(() => {
    const itemMap = new Map(finalNavItems.map(item => [item.id, item]));
    const childMap = new Map<string, NavigationItem[]>();

    finalNavItems.forEach(item => {
      if (item.parentId) {
        if (!childMap.has(item.parentId)) {
          childMap.set(item.parentId, []);
        }
        childMap.get(item.parentId)!.push(item);
      }
    });

    return { itemMap, childMap };
  }, [finalNavItems]);
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const sections: Record<string, boolean> = {};
    if (pathname.startsWith('/admin/settings')) sections.nav_settings = true;
    else if (pathname.startsWith('/admin')) sections.nav_admin = true;
    else if (pathname.startsWith('/social-media')) sections.nav_social_media_group = true;
    else if (pathname.startsWith('/web')) sections.nav_web_group = true;
    else if (pathname.startsWith('/tasks') || pathname === '/dashboard') sections.nav_project_group = true;
    return sections;
  });

  const renderNavItems = useCallback(
    (items: NavigationItem[], parentId: string | null = null) => {
      return items
        .filter((item) => item.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const children = childMap.get(item.id) || [];
          const path = item.path;
          const isActive = path ? (pathname === path || (path.length > 1 && pathname.startsWith(path))) : false;
          
          const hasVisibleChildren = children.length > 0;

          if (hasVisibleChildren) {
            return (
              <SidebarCollapsibleItem
                key={item.id}
                item={item}
                isActive={isActive}
                isOpen={openSections[item.id] || false}
                onOpenChange={(isOpen) => setOpenSections((prev) => ({ ...prev, [item.id]: isOpen }))}
                subItems={renderNavItems(children, item.id)}
              />
            );
          }

          if (!item.path) return null; // Don't render folders without path and without visible children

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

  const isLoading = isUserLoading || isNavItemsLoading || isSettingsLoading;
  
  if (isLoading || !isReady) {
    return <BrandedLoader />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>{renderNavItems(finalNavItems, null)}</SidebarMenu>
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // This component now solely acts as the provider wrapper for the main authenticated app section.
  return <MainAppLayout>{children}</MainAppLayout>;
}
