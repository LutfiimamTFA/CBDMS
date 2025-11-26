'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  LayoutDashboard,
  FileText,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useI18n } from '@/context/i18n-provider';
import { useAuth, useUser, setDocumentNonBlocking } from '@/firebase';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in.
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        
        // For this simple case, we set a default role and companyId upon first login.
        // In a real app, this would be managed by an admin.
        setDocumentNonBlocking(userRef, {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous User',
            email: firebaseUser.email || `anon-${firebaseUser.uid}@example.com`,
            role: 'Employee', // Assign a default role
            companyId: 'company-a' // Assign a default company
        }, { merge: true });

      } else if (!isUserLoading) {
        // User is signed out, and we are not in a loading state.
        initiateAnonymousSignIn(auth);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore, isUserLoading]);


  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: t('nav.board') },
    { href: '/tasks', icon: ClipboardList, label: t('nav.list') },
    { href: '/reports', icon: FileText, label: t('nav.reports') },
  ];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings">
                <SidebarMenuButton
                  isActive={pathname === '/settings'}
                  tooltip={t('nav.settings')}
                >
                  <Settings />
                  <span>{t('nav.settings')}</span>
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

    