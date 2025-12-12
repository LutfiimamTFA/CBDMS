'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useAuth } from '@/firebase';
import { getIdTokenResult } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, isUserLoading } = useFirebase();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) {
      return;
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    // This is the critical part that needs to be robust.
    // It must handle the case where the user has just logged in and their
    // token claims need to be checked.
    if (auth?.currentUser) {
      // Force refresh the token to get the latest custom claims.
      // This is essential after an admin has set a claim like `mustChangePassword`.
      getIdTokenResult(auth.currentUser, true)
        .then((idTokenResult) => {
          if (idTokenResult.claims.mustChangePassword) {
            router.replace('/force-password-change');
          } else if (idTokenResult.claims.mustAcknowledgeTasks) {
            router.replace('/force-acknowledge-tasks');
          } else {
            router.replace('/my-work');
          }
        })
        .catch(() => {
          // If getting the token fails, it's safest to send them to login.
          router.replace('/login');
        });
    } else {
      // If there's no currentUser object available for some reason,
      // the safest fallback is to go to the login page.
      router.replace('/login');
    }
  }, [user, isUserLoading, auth, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
