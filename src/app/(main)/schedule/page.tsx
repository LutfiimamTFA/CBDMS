
'use client';

import React, { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCollection, useFirestore, useUserProfile, useSharedSession } from '@/firebase';
import type { Task } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getBrandColor } from '@/lib/utils';
import { priorityInfo } from '@/lib/utils';

export default function SchedulePage() {
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const router = useRouter();

  const activeCompanyId = session ? session.companyId : companyId;

  const tasksQuery = useMemo(() => {
    if (!firestore || !activeCompanyId) return null;

    let q = query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId));
    
    if (!session && profile?.role === 'Employee') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    return q;

  }, [firestore, activeCompanyId, profile, session]);

  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const isLoading = isTasksLoading || isProfileLoading || isSessionLoading;

  const calendarEvents = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.map(task => {
      const priorityColor = priorityInfo[task.priority]?.color || 'text-gray-500';
      const brandColor = getBrandColor(task.brandId);

      return {
        id: task.id,
        title: task.title,
        start: task.startDate ? new Date(task.startDate) : new Date(task.createdAt.toDate()),
        end: task.dueDate ? new Date(task.dueDate) : null,
        allDay: true,
        extendedProps: {
            priority: task.priority,
        },
        // We use inline styles here because FullCalendar's class management can be tricky
        // and this ensures our colors are applied reliably.
        backgroundColor: brandColor.replace('bg-', '#'), // This is a trick to convert tailwind bg to hex
        borderColor: brandColor.replace('bg-', '#'),
      };
    });
  }, [allTasks]);

  const handleEventClick = (clickInfo: any) => {
    const taskId = clickInfo.event.id;
    if (session) {
      if(session.permissions.canViewDetails) {
        router.push(`/share/${session.id}/${taskId}`);
      }
    } else {
      router.push(`/tasks/${taskId}`);
    }
  };

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Schedule" />
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek,dayGridDay'
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="100%"
              eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short'
              }}
              eventDisplay="block"
              // The class names below are to integrate FullCalendar's look and feel with ShadCN/Tailwind theme
              dayHeaderClassNames="bg-muted"
              viewClassNames="bg-card"
              eventClassNames="cursor-pointer border-none p-1 text-xs rounded-md font-medium"
            />
          </div>
        )}
      </main>
    </div>
  );
}
