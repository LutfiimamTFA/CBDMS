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
import type { NavigationItem } from '@/lib/types';
import { useSharedSession } from '@/context/shared-session-provider';
import { useSidebar } from '@/components/ui/sidebar';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof lucideIcons.Icon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

const getScopeFromPath = (path: string): string => {
    if (!path) return '';
    // Return the path segment after the initial slash
    const segments = path.split('/').filter(Boolean);
    return segments.join('/');
};


export function ShareSidebar() {
  const pathname = usePathname();
  const { session, company, isLoading } = useSharedSession();
  const { state } = useSidebar();
  
  const handleExit = () => {
    if (session) {
      sessionStorage.removeItem(`share_token_${session.id}`);
    }
    window.location.href = '/login';
  };

  const visibleNavItems = useMemo(() => {
    if (!session || !session.navItems) return [];

    const allowedIds = new Set(session.allowedNavItems || []);

    return session.navItems
        .filter(item => allowedIds.has(item.id))
        .sort((a, b) => a.order - b.order);

  }, [session]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <PublicLogo company={company} isLoading={isLoading} />
        {state === 'expanded' && (
          <Badge variant="outline" className="w-fit">
            <ShieldAlert className="h-3 w-3 mr-1.5" />
            Preview Mode
          </Badge>
        )}
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
        <SidebarMenuButton onClick={handleExit} tooltip="Exit Preview">
          <LogOut /> <span>Exit Preview</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
