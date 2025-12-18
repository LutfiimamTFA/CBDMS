
'use client';

import React, { useMemo } from 'react';
import type { Task, SharedLink } from '@/lib/types';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, type Query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getBrandColor } from '@/lib/utils';
import { parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { SharedHeader } from './shared-header';

interface SharedScheduleViewProps {
  session: SharedLink;
}

export function SharedScheduleView({ session }: SharedScheduleViewProps) {
  const firestore = useFirestore();
  const router = useRouter();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    
    let q: Query = query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
    
    // This is the critical security filter.
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('brandId', 'in', session.brandIds));
    }

    return q;
  }, [firestore, session]);

  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

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
          backgroundColor: brandColor,
          borderColor: brandColor,
        };
      });
  }, [allTasks]);

  const handleEventClick = (clickInfo: any) => {
    if (session?.permissions.canViewDetails) {
      clickInfo.jsEvent.preventDefault();
      router.push(`/tasks/${clickInfo.event.id}?shared=true`);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Schedule" />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {isTasksLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="h-full">
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
