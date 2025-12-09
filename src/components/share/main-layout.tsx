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
  User,
  Icon as LucideIcon,
  LogOut,
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
    return navItemsFromDB.filter(item => 
      !item.path.startsWith('/admin') && item.roles.includes(session.sharedAsRole)
    );
  }, [session, navItemsFromDB]);


  const isLoading = isSessionLoading || isNavItemsLoading;

  if (isLoading) {
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
      {/* The content is rendered by Next.js's router based on the URL */}
      <SidebarInset />
    </SidebarProvider>
  );
}
