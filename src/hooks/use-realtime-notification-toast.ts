
'use client';

import { useEffect, useRef } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { useToast } from './use-toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function useRealtimeNotificationToast() {
  const { user } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Use a ref to store the timestamp of the last shown notification
  // This persists across re-renders without causing them.
  const lastShownNotificationTimestamp = useRef<Timestamp | null>(null);

  // Query for the latest notification
  const notificationsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(notificationsQuery);

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latestNotification = notifications[0];
      
      // Ensure we have a valid timestamp to compare
      if (!latestNotification.createdAt?.toDate) {
        return;
      }
      
      const newNotificationTimestamp = latestNotification.createdAt as Timestamp;

      // Check if this notification is new
      const isNew = !lastShownNotificationTimestamp.current || newNotificationTimestamp.toMillis() > lastShownNotificationTimestamp.current.toMillis();
      
      // Also check if it's not the user's own action
      const isFromAnotherUser = latestNotification.createdBy.id !== user?.uid;

      if (isNew && isFromAnotherUser) {
        // Show the toast
        toast({
          title: latestNotification.title,
          description: latestNotification.message,
          action: latestNotification.taskId ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${latestNotification.taskId}`)}>
              Open
            </Button>
          ) : undefined,
        });

        // Update the ref to the timestamp of this notification
        lastShownNotificationTimestamp.current = newNotificationTimestamp;
      } else if (!lastShownNotificationTimestamp.current) {
        // On initial load, set the timestamp of the latest notification
        // so we don't show it as "new" on the first render.
        lastShownNotificationTimestamp.current = newNotificationTimestamp;
      }
    }
  }, [notifications, toast, router, user?.uid]);

  // This hook does not render anything.
  return null;
}
