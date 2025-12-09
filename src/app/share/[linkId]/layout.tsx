
'use client';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { MainLayout } from '@/components/share/main-layout';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SharedSessionProvider>
        <MainLayout>
            {children}
        </MainLayout>
    </SharedSessionProvider>
  );
}

    