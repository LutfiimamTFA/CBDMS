
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

    if (auth?.currentUser) {
      getIdTokenResult(auth.currentUser, true) // Force refresh token
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
          router.replace('/login');
        });
    } else {
      router.replace('/login');
    }
  }, [user, isUserLoading, auth, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
