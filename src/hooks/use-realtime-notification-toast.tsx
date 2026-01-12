
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { useToast } from './use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

// This hook now uses .tsx extension to allow JSX syntax.
export function useRealtimeNotificationToast() {
  const { user } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Use a ref to track the timestamp of the last notification shown in a toast.
  const lastShownNotificationTimestamp = useRef<Timestamp | null>(null);

  // Memoize the query to prevent re-creating it on every render.
  const notificationsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(5) // Fetch a few to handle potential batch writes
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(notificationsQuery);

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latestNotification = notifications[0];

      // Ensure the notification has a valid timestamp.
      if (!latestNotification.createdAt?.toDate) {
        return;
      }

      const newNotificationTimestamp = latestNotification.createdAt as Timestamp;

      // Determine if the notification is new and should be shown.
      const isNew =
        !lastShownNotificationTimestamp.current ||
        newNotificationTimestamp.toMillis() > lastShownNotificationTimestamp.current.toMillis();

      const isFromAnotherUser = latestNotification.createdBy.id !== user?.uid;

      // Show toast only if it's a new notification from someone else.
      if (isNew && isFromAnotherUser) {
        toast({
          title: latestNotification.title,
          description: latestNotification.message,
          action: latestNotification.taskId ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${latestNotification.taskId}`)}>
              Open
            </Button>
          ) : undefined,
        });

        // Update the ref to prevent showing the same toast again.
        lastShownNotificationTimestamp.current = newNotificationTimestamp;
      } else if (!lastShownNotificationTimestamp.current) {
        // On initial load, set the timestamp of the latest notification.
        lastShownNotificationTimestamp.current = newNotificationTimestamp;
      }
    }
  }, [notifications, toast, router, user?.uid]);

  // This hook does not render anything.
  return null;
}
