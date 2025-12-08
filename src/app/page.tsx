'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useFirebase, useAuth } from '@/firebase';
import { getIdTokenResult } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, isUserLoading } = useFirebase();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If the path is for a shared link, do nothing and let the dedicated page handle it.
    if (pathname.startsWith('/share/')) {
      return;
    }

    // Wait until the initial user loading state is resolved.
    if (isUserLoading) {
      return;
    }

    if (!user) {
      // If no user, redirect to login.
      router.replace('/login');
      return;
    }

    // If there is a user, check their token for custom claims.
    if (auth?.currentUser) {
      // Force a token refresh to get the latest claims.
      // The `true` argument is critical here.
      getIdTokenResult(auth.currentUser, true)
        .then((idTokenResult) => {
          if (idTokenResult.claims.mustChangePassword) {
            // If the claim exists, force redirect to the change password page.
            router.replace('/force-change-password');
          } else if (idTokenResult.claims.mustAcknowledgeTasks) {
            // If recurring tasks claim exists, redirect to acknowledgment page.
            router.replace('/force-acknowledge-tasks');
          } else {
            // Otherwise, proceed to the "My Work" page.
            router.replace('/my-work');
          }
        })
        .catch(() => {
          // If token check fails, fall back to login.
          router.replace('/login');
        });
    } else {
      // Fallback for edge cases where user object exists but currentUser doesn't.
      router.replace('/login');
    }
  }, [user, isUserLoading, auth, router, pathname]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
