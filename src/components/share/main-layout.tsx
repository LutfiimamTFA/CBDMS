
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
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  Loader2,
  Icon as LucideIcon,
  LogOut,
  Ban,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore } from '@/firebase';
import { useEffect, useMemo } from 'react';
import type { NavigationItem } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { useSharedSession } from '@/context/shared-session-provider';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

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

export function MainLayout() {
  const pathname = usePathname();
  const params = useParams();
  const { t } = useI18n();
  const firestore = useFirestore();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const linkId = params.linkId as string;

  const navItemsCollectionRef = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
  );

  const { data: navItemsFromDB, isLoading: isNavItemsLoading } =
    useCollection<NavigationItem>(navItemsCollectionRef);

  const filteredNavItems = useMemo(() => {
    if (!session || !navItemsFromDB) return [];
    
    // Filter nav items based on what's allowed in the shared link, then sort
    return navItemsFromDB
        .filter(item => session.allowedNavItems.includes(item.id))
        .sort((a,b) => a.order - b.order);
        
  }, [session, navItemsFromDB]);

  const isLoading = isSessionLoading || isNavItemsLoading;
  
  // Security Gatekeeper: Check if the current path is allowed.
  const currentNavItem = useMemo(() => {
      if (!navItemsFromDB || !pathname) return null;
      // Find the nav item that matches the current path, excluding the /share/[linkId] part
      return navItemsFromDB.find(item => `/share/${linkId}${item.path}` === pathname);
  }, [navItemsFromDB, pathname, linkId]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!session) {
      return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="text-center">
                <h2 className="text-xl font-bold">Session Invalid</h2>
                <p className="text-muted-foreground">This share link may be expired or invalid.</p>
                <Button variant="link" asChild><Link href="/">Return to App</Link></Button>
            </div>
        </div>
      )
  }

  // If the current route is not in the allowed list, show an access denied message.
  if (currentNavItem && !session.allowedNavItems.includes(currentNavItem.id)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
            <Ban className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
            <Button variant="link" asChild><Link href={`/share/${linkId}`}>Go to shared home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
          <Badge variant="outline" className="mt-2">Preview Mode</Badge>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {filteredNavItems.map(item => (
                 <SidebarMenuItem key={item.id}>
                    <Link href={`/share/${linkId}${item.path}`} passHref>
                        <SidebarMenuButton
                        isActive={pathname.endsWith(item.path)}
                        tooltip={t(item.label as any) || item.label}
                        >
                        <Icon name={item.icon} />
                        <span>{t(item.label as any) || item.label}</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button variant="ghost" onClick={() => window.location.href = '/'}>
              <LogOut className="mr-2 h-4 w-4" /> Exit Preview
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

    