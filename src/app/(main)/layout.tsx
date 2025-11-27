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
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  FileText,
  User,
  ClipboardList,
  Loader2,
  Users,
  Shield,
  ChevronDown,
  Database,
  Settings as SettingsIcon,
  Icon as LucideIcon,
} from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import {
  useUserProfile,
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '@/lib/types';
import {
  collection,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { defaultNavItems } from '@/lib/navigation-items';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIcon = (lucideIcons as Record<string, any>)[name];
  if (!LucideIcon) {
    return <lucideIcons.HelpCircle {...props} />; // Fallback Icon
  }
  return <LucideIcon {...props} />;
};


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const router = useRouter();
  const firestore = useFirestore();
  const { user, profile, isLoading } = useUserProfile();
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith('/admin'));

  // --- Dynamic Navigation ---
  const navItemsRef = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
  );
  const { data: navItemsData, isLoading: isNavLoading } =
    useCollection<NavigationItem>(navItemsRef);
  
  // Seed initial navigation data if collection is empty
  useEffect(() => {
    if (firestore && profile?.role === 'Super Admin' && navItemsData?.length === 0) {
      const seedNavData = async () => {
        const querySnapshot = await getDocs(collection(firestore, 'navigationItems'));
        if (querySnapshot.empty) {
          console.log('Seeding navigation items...');
          const batch = writeBatch(firestore);
          defaultNavItems.forEach((item) => {
            const docRef = collection(firestore, 'navigationItems');
            batch.set(doc(docRef, item.id), item);
          });
          await batch.commit();
          console.log('Navigation items seeded.');
        }
      };
      seedNavData().catch(console.error);
    }
  }, [firestore, profile, navItemsData]);


  const filteredNavItems = useMemo(() => {
    if (!navItemsData || !profile) return [];
    return navItemsData.filter(item => item.roles.includes(profile.role));
  }, [navItemsData, profile]);
  // --- End Dynamic Navigation ---


  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);


  const adminNavItems = {
    label: 'Admin',
    icon: Shield,
    subItems: [
      {
        href: '/admin/dashboard',
        icon: LayoutDashboard,
        label: 'Overview',
      },
      { href: '/admin/users', icon: Users, label: 'User Management' },
      { href: '/admin/data', icon: Database, label: 'Data Management' },
      {
        href: '/admin/settings',
        icon: SettingsIcon,
        label: 'App Settings',
      },
    ],
  };

  if (isLoading || isNavLoading || !user) {
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
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {filteredNavItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <Link href={item.path}>
                  <SidebarMenuButton
                    isActive={pathname === item.path}
                    tooltip={item.label}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
            {!isLoading && profile?.role === 'Super Admin' && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={pathname.startsWith('/admin')}
                      className="w-full justify-between"
                      tooltip={adminNavItems.label}
                    >
                      <div className="flex items-center gap-2">
                        <adminNavItems.icon />
                        <span>{adminNavItems.label}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isAdminOpen && 'rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent className="pl-6">
                  <SidebarMenu>
                    {adminNavItems.subItems.map((subItem) => (
                      <SidebarMenuItem key={subItem.href}>
                        <Link href={subItem.href}>
                          <SidebarMenuButton
                            variant="ghost"
                            size="sm"
                            isActive={pathname === subItem.href}
                            className="w-full justify-start"
                          >
                            <subItem.icon />
                            <span>{subItem.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings">
                <SidebarMenuButton
                  isActive={pathname === '/settings'}
                  tooltip={'Profile'}
                >
                  <User />
                  <span>{'Profile'}</span>
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

    