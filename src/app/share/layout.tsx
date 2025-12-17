
'use client';

import React from 'react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { useSharedSession } from '@/context/shared-session-provider';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, orderBy, query, doc } from 'firebase/firestore';
import type { NavigationItem, Company } from '@/lib/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as lucideIcons from 'lucide-react';
import { Loader2, LogOut } from 'lucide-react';
import { FirebaseClientProvider } from '@/firebase';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { Button } from '@/components/ui/button';
import { PublicLogo } from '@/components/share/public-logo';

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
  const pathname = usePathname();
  
  // This lightweight provider setup is ONLY for the share routes.
  const ShareProviders = ({ children }: { children: React.ReactNode }) => (
      <FirebaseClientProvider>
          <SharedSessionProvider>
              {children}
          </SharedSessionProvider>
      </FirebaseClientProvider>
  );

  const ShareSidebar = () => {
    const firestore = useFirestore();
    const { session, isLoading: isSessionLoading } = useSharedSession();
    
    const navItemsQuery = React.useMemo(
      () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
      [firestore]
    );
    const { data: allNavItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsQuery);

    const companyDocRef = React.useMemo(() => {
        if (!firestore || !session?.companyId) return null;
        return doc(firestore, 'companies', session.companyId);
    }, [firestore, session?.companyId]);
    const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyDocRef);


    const allowedItems = React.useMemo(() => {
      if (!session || !allNavItems) return [];
      
      const navIdToScope: { [key: string]: string } = {
          'nav_task_board': 'dashboard',
          'nav_list': 'tasks',
          'nav_calendar': 'calendar',
          'nav_performance_analysis': 'reports',
      };

      return allNavItems
          .filter(item => session.allowedNavItems.includes(item.id) && navIdToScope[item.id])
          .sort((a,b) => a.order - b.order);
    }, [session, allNavItems]);
    
    const isLoading = isSessionLoading || isNavItemsLoading || isCompanyLoading;
    
    const handleExit = () => {
        sessionStorage.removeItem(`share_token_${session?.id}`);
        window.location.href = '/';
    }

    return (
        <SidebarProvider isSharedView>
          <Sidebar>
            <SidebarHeader>
              <PublicLogo company={company} isLoading={isLoading} />
            </SidebarHeader>
            <SidebarContent>
              {isLoading ? (
                <div className='flex justify-center p-4'>
                    <Loader2 className="animate-spin"/>
                </div>
              ) : (
                <SidebarMenu>
                    {allowedItems.map(item => {
                        const navIdToScope: { [key: string]: string } = {
                            'nav_task_board': 'dashboard',
                            'nav_list': 'tasks',
                            'nav_calendar': 'calendar',
                            'nav_performance_analysis': 'reports',
                        };

                       const path = `/share/${session?.id}/${navIdToScope[item.id]}`;
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
             <SidebarFooter>
                 <Button variant="ghost" onClick={handleExit}>
                    <LogOut className="mr-2 h-4 w-4" /> Exit Preview
                 </Button>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            {children}
          </SidebarInset>
        </SidebarProvider>
    )
  }

  return (
    <ShareProviders>
        <ShareSidebar/>
    </ShareProviders>
  );
}

