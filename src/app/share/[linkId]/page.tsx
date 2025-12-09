
'use client';

import { notFound, usePathname, useRouter } from 'next/navigation';
import { useSharedSession } from '@/context/shared-session-provider';
import { Loader2 } from 'lucide-react';
import MainLayout from '@/app/(main)/layout';
import DashboardPage from '@/app/(main)/dashboard/page';

export default function SharedLinkPage({ params }: { params: { linkId: string } }) {
  const { session, isLoading, error } = useSharedSession();
  const router = useRouter();
  const pathname = usePathname();

  // Handle expired link or other errors from the session provider
  if (!isLoading && (error || !session)) {
    return notFound();
  }
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // The magic happens here: we render the MainLayout, which will now use
  // the session context to display the correct sidebar and content.
  // We can default to showing the dashboard page for the shared role.
  return (
      <MainLayout>
        <DashboardPage />
      </MainLayout>
  );
}
