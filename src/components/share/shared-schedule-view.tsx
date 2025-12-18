'use client';

import React, { useMemo } from 'react';
import type { Task, SharedLink } from '@/lib/types';
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
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedScheduleView({ session, tasks, isLoading }: SharedScheduleViewProps) {
  const router = useRouter();

  const calendarEvents = useMemo(() => {
    if (!tasks) return [];
    return tasks
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
  }, [tasks]);

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
        {isLoading ? (
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
