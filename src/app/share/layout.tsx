'use client';

import { AppProviders } from '@/components/app-providers';
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { useSharedSession } from '@/context/shared-session-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { NavigationItem } from '@/lib/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as lucideIcons from 'lucide-react';
import { Loader2 } from 'lucide-react';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof lucideIcons.Icon>) => {
    const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
    if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
    return <LucideIconComponent {...props} />;
};


export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const firestore = useFirestore();
  const pathname = usePathname();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  
  const navItemsQuery = React.useMemo(
    () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
    [firestore]
  );
  const { data: allNavItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsQuery);

  const allowedItems = React.useMemo(() => {
    if (!session || !allNavItems) return [];
    return allNavItems
        .filter(item => session.allowedNavItems.includes(item.id) && item.parentId === null)
        .sort((a,b) => a.order - b.order);
  }, [session, allNavItems]);
  
  const isLoading = isSessionLoading || isNavItemsLoading;


  return (
    <AppProviders>
        <SidebarProvider isSharedView>
          <Sidebar>
            <SidebarHeader>
              <Logo />
            </SidebarHeader>
            <SidebarContent>
              {isLoading ? (
                <div className='flex justify-center p-4'>
                    <Loader2 className="animate-spin"/>
                </div>
              ) : (
                <SidebarMenu>
                    {allowedItems.map(item => {
                       const path = `/share/${session?.id}${item.path}`;
                       const isActive = pathname === path;
                        return (
                           <SidebarMenuItem key={item.id}>
                               <Link href={path}>
                                <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                                    <Icon name={item.icon}/>
                                    <span>{item.label.startsWith('nav.') ? item.label.split('.')[1].replace(/_/g, ' ') : item.label}</span>
                                </SidebarMenuButton>
                               </Link>
                           </SidebarMenuItem>
                        )
                    })}
                </SidebarMenu>
              )}
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            {children}
          </SidebarInset>
        </SidebarProvider>
    </AppProviders>
  );
}
