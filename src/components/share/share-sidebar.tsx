
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
import { useSharedSession } from '@/context/shared-session-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as lucideIcons from 'lucide-react';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicLogo } from '@/components/share/public-logo';
import { Badge } from '@/components/ui/badge';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof lucideIcons.Icon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

export function ShareSidebar() {
  const pathname = usePathname();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  
  const company = session?.company || null;
  const isLoading = isSessionLoading || !session;
  
  const handleExit = () => {
    if (session) {
      sessionStorage.removeItem(`share_token_${session.id}`);
    }
    window.location.href = '/login'; // Redirect to login page
  };

  const navPathToScope = (path: string) => {
    const mapping: { [key:string]: string } = {
        '/dashboard': 'dashboard',
        '/tasks': 'tasks',
        '/calendar': 'calendar',
        '/reports': 'reports'
    }
    return mapping[path] || 'dashboard';
  }

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
            {(session?.navItems || []).map(item => {
              const scope = navPathToScope(item.path);
              const linkPath = `/share/${session?.id}/${scope}`;
              const isActive = pathname === linkPath;
              return (
                <SidebarMenuItem key={item.id}>
                  <Link href={linkPath}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                      <Icon name={item.icon} />
                      <span>{item.label.startsWith('nav.') ? item.label.split('.')[1].replace(/_/g, ' ') : item.label}</span>
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
