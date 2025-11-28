
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Notification } from '@/lib/types';
import {
  collection,
  query,
  orderBy,
  limit,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';

type GroupedNotifications = {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
};

export function NotificationBell() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUserProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationsQuery = useMemo(
    () =>
      user && firestore
        ? query(
            collection(firestore, `users/${user.uid}/notifications`),
            orderBy('createdAt', 'desc'),
            limit(20) // Fetch more notifications for better grouping
          )
        : null,
    [user, firestore]
  );

  const { data: notifications, isLoading } =
    useCollection<Notification>(notificationsQuery);

  useEffect(() => {
    if (notifications) {
      setUnreadCount(notifications.filter((n) => !n.isRead).length);
    }
  }, [notifications]);

  const groupedNotifications = useMemo(() => {
    if (!notifications) return null;

    const groups: GroupedNotifications = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    notifications.forEach((notif) => {
      if (notif.createdAt?.toDate) {
        const notifDate = notif.createdAt.toDate();
        if (isToday(notifDate)) {
          groups.today.push(notif);
        } else if (isYesterday(notifDate)) {
          groups.yesterday.push(notif);
        } else if (isThisWeek(notifDate, { weekStartsOn: 1 })) {
          groups.thisWeek.push(notif);
        } else {
          groups.older.push(notif);
        }
      }
    });

    return groups;
  }, [notifications]);

  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen && unreadCount > 0 && firestore && user && notifications) {
      const unreadNotifications = notifications.filter((n) => !n.isRead);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(firestore);
      unreadNotifications.forEach((notification) => {
        const notifRef = doc(
          firestore,
          `users/${user.uid}/notifications`,
          notification.id
        );
        batch.update(notifRef, { isRead: true });
      });

      try {
        await batch.commit();
        setUnreadCount(0);
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    }
  };

  const handleNotificationClick = (taskId: string) => {
    if (!taskId) return;
    router.push(`/tasks/${taskId}`);
  };

  const renderNotificationGroup = (
    title: string,
    notifs: Notification[]
  ) => {
    if (notifs.length === 0) return null;

    return (
      <>
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pt-2">
          {title}
        </DropdownMenuLabel>
        {notifs.map((notif) => (
          <DropdownMenuItem
            key={notif.id}
            className="flex items-start gap-3"
            onClick={() => handleNotificationClick(notif.taskId)}
            disabled={!notif.taskId}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={notif.createdBy.avatarUrl} />
              <AvatarFallback>
                {notif.createdBy.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm leading-tight">{notif.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {notif.createdAt?.toDate &&
                  formatDistanceToNow(notif.createdAt.toDate(), {
                    addSuffix: true,
                  })}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </>
    );
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {isLoading ? (
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
              <Loader2 className="h-full w-full animate-spin text-xs" />
            </div>
          ) : (
            unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 justify-center rounded-full p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notifications && notifications.length > 0 && groupedNotifications ? (
          <div className="max-h-96 overflow-y-auto">
            {renderNotificationGroup('Today', groupedNotifications.today)}
            {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
            {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
            {renderNotificationGroup('Older', groupedNotifications.older)}
          </div>
        ) : (
          <p className="p-4 text-center text-sm text-muted-foreground">
            You're all caught up!
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
