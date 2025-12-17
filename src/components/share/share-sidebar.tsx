
'use client';

import React from 'react';
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
import type { SharedLink } from '@/lib/types';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof lucideIcons.Icon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

const getScopeFromPath = (path: string): string | undefined => {
    if (!path) return undefined;
    const parts = path.split('/');
    return parts[parts.length -1];
};

interface ShareSidebarProps {
    session: SharedLink | null;
}

export function ShareSidebar({ session }: ShareSidebarProps) {
  const pathname = usePathname();
  
  const company = session?.company || null;
  const isLoading = !session;
  
  const handleExit = () => {
    if (session) {
      sessionStorage.removeItem(`share_token_${session.id}`);
    }
    window.location.href = '/login';
  };

  const allowedNavIds = new Set(session?.allowedNavItems || []);
  const visibleNavItems = (session?.navItems || []).filter(item => allowedNavIds.has(item.id) && item.path);

  return (
    <Sidebar isSharedView={true}>
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
