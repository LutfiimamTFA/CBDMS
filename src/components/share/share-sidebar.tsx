
'use client';

import React, { useMemo } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as lucideIcons from 'lucide-react';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicLogo } from '@/components/share/public-logo';
import { Badge } from '@/components/ui/badge';
import type { SharedLink, Company, NavigationItem } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof lucideIcons.Icon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

const getScopeFromPath = (path: string): string | undefined => {
    if (!path) return undefined;
    const itemScope = path.startsWith('/') ? path.substring(1) : path;
    return itemScope;
};

interface ShareSidebarProps {
    session: SharedLink | null;
    navItems: NavigationItem[];
}

export function ShareSidebar({ session, navItems }: ShareSidebarProps) {
  const pathname = usePathname();
  const firestore = useFirestore();

  const {data: company, isLoading: isCompanyLoading } = useDoc<Company>(useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    return doc(firestore, 'companies', session.companyId);
  }, [firestore, session?.companyId]));
  
  const isLoading = !session || isCompanyLoading;
  
  const handleExit = () => {
    if (session) {
      sessionStorage.removeItem(`share_token_${session.id}`);
    }
    window.location.href = '/login';
  };

  const allowedNavIds = new Set(session?.allowedNavItems || []);
  const visibleNavItems = navItems.filter(item => allowedNavIds.has(item.id) && item.path);

  return (
    <Sidebar>
      <SidebarHeader>
        <PublicLogo company={company} isLoading={isLoading} />
        <Badge variant="outline" className="w-fit">
          <ShieldAlert className="h-3 w-3 mr-1.5" />
          Preview Mode
        </Badge>
      </SidebarHeader>
      <SidebarContent>
        {isLoading ? (
          <div className='flex justify-center p-4'>
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <SidebarMenu>
            {visibleNavItems.map(item => {
              const scope = getScopeFromPath(item.path);
              if (!scope) return null;

              const linkPath = `/share/${session?.id}/${scope}`;
              const isActive = pathname === linkPath;
              return (
                <SidebarMenuItem key={item.id}>
                  <Link href={linkPath}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
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
  );
}
