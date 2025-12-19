
'use client';

import React, { useMemo } from 'react';
import type { Task, SharedLink } from '@/lib/types';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { parseISO } from 'date-fns';
import { getBrandColor } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

interface SharedScheduleViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedScheduleView({ session, tasks, isLoading }: SharedScheduleViewProps) {
    const router = useRouter();
    const params = useParams();
    const linkId = params.linkId as string;

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
        if (session?.permissions?.canViewDetails) {
            router.push(`/share/${linkId}/tasks/${clickInfo.event.id}`);
        }
    }

  return (
     <div className="flex h-full flex-col bg-background">
      <main className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
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
                eventClassNames={session?.permissions?.canViewDetails ? "cursor-pointer border-none px-2 py-0.5 text-xs rounded-md font-medium" : "border-none px-2 py-0.5 text-xs rounded-md font-medium"}
            />
          </div>
        )}
      </main>
    </div>
  );
}
