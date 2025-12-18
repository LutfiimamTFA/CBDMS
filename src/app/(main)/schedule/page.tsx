
'use client';

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getBrandColor } from '@/lib/utils';
import { parseISO } from 'date-fns';

export default function SchedulePage() {
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const router = useRouter();

  const tasksQuery = useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    
    // For Managers, filter tasks by the brands they are assigned to.
    if (profile.role === 'Manager') {
      if (!profile.brandIds || profile.brandIds.length === 0) {
        return null; // Manager has no brands, so they see no tasks.
      }
      return query(
        collection(firestore, 'tasks'), 
        where('companyId', '==', companyId),
        where('brandId', 'in', profile.brandIds)
      );
    }

    // For Employees, show only tasks assigned to them.
    if (profile.role === 'Employee') {
      return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
    }
    
    // For Super Admin and other general cases.
    return query(collection(firestore, 'tasks'), where('companyId', '==', companyId));

  }, [firestore, companyId, profile]);
  
  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const isLoading = isTasksLoading || isProfileLoading;

  const calendarEvents = useMemo(() => {
    if (!allTasks) return [];
    return allTasks
      .filter((task) => !!task.dueDate)
      .map((task) => {
        const brandColor = getBrandColor(task.brandId);
        const eventDate = parseISO(task.dueDate!);
        return {
          id: task.id,
          title: task.title,
          start: eventDate,
          end: eventDate,
          allDay: true,
          extendedProps: {
            ...task,
          },
          backgroundColor: brandColor,
          borderColor: brandColor,
        };
      });
  }, [allTasks]);

  const handleEventClick = (clickInfo: any) => {
    const taskId = clickInfo.event.id;
    router.push(`/tasks/${taskId}`);
  };

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex flex-1 flex-col p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Project Schedule</h2>
                <p className="text-muted-foreground">High-level overview of all project timelines. Click any event to view details.</p>
            </div>
        </div>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
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
                dayHeaderClassNames="bg-muted"
                viewClassNames="bg-card"
                eventClassNames="cursor-pointer border-none px-2 py-0.5 text-xs rounded-md font-medium"
            />
          </div>
        )}
      </main>
    </div>
  );
}
