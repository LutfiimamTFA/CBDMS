
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, limit, type Timestamp } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { useToast } from './use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const LAST_SHOWN_ID_KEY = "lastShownNotifId";

export function useRealtimeNotificationToast() {
  const { user } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Ref to track if the initial load is done to prevent showing old notifications on mount.
  const didInitRef = useRef(false);
  // Ref to hold the ID of the last notification that triggered a toast.
  const lastShownIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem(LAST_SHOWN_ID_KEY) : null
  );

  const notificationsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(notificationsQuery);

  useEffect(() => {
    if (!notifications || notifications.length === 0) {
        return;
    }
    
    const latestNotification = notifications[0];

    // On initial load, just set the state and don't show any toast.
    if (!didInitRef.current) {
        didInitRef.current = true;
        lastShownIdRef.current = latestNotification.id;
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SHOWN_ID_KEY, latestNotification.id);
        }
        return;
    }

    // From now on, only react to new notifications.
    if (latestNotification.id !== lastShownIdRef.current) {
        // Don't show toasts for actions the user performed themselves.
        if (latestNotification.createdBy.id !== user?.uid) {
            toast({
                title: latestNotification.title,
                description: latestNotification.message,
                action: latestNotification.taskId ? (
                  <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${latestNotification.taskId}`)}>
                    Open
                  </Button>
                ) : undefined,
            });
        }
        
        // Update refs and localStorage to prevent showing this toast again.
        lastShownIdRef.current = latestNotification.id;
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SHOWN_ID_KEY, latestNotification.id);
        }
    }

  }, [notifications, toast, router, user?.uid]);

  // This hook does not render anything.
  return null;
}
