
'use client';

import React, { useMemo } from 'react';
import type { Task, SharedLink, SocialMediaPost, WebArticle } from '@/lib/types';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { parseISO } from 'date-fns';
import { getBrandColor } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

type WorkItem = Task | SocialMediaPost | WebArticle;

interface SharedScheduleViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  socialMediaPosts: SocialMediaPost[] | null;
  webArticles: WebArticle[] | null;
  isLoading: boolean;
  workstream: 'tasks' | 'socialMediaPosts' | 'webArticles';
}

export function SharedScheduleView({ session, tasks, socialMediaPosts, webArticles, isLoading, workstream }: SharedScheduleViewProps) {
    const router = useRouter();
    const params = useParams();
    const linkId = params.linkId as string;

    const items = useMemo(() => {
      switch(workstream) {
        case 'socialMediaPosts': return socialMediaPosts;
        case 'webArticles': return webArticles;
        case 'tasks':
        default:
          return tasks;
      }
    }, [workstream, tasks, socialMediaPosts, webArticles]);

    const calendarEvents = useMemo(() => {
        if (!items) return [];
        return items
        .filter((item) => {
            if (workstream === 'socialMediaPosts') return !!(item as SocialMediaPost).scheduledAt;
            return !!item.dueDate;
        })
        .map((item) => {
            const dateValue = workstream === 'socialMediaPosts' ? (item as SocialMediaPost).scheduledAt : item.dueDate;
            const brandColor = getBrandColor(item.brandId);
            const eventDate = parseISO(dateValue!);
            return {
            id: item.id,
            title: item.title,
            start: eventDate,
            end: eventDate,
            allDay: true,
            backgroundColor: brandColor,
            borderColor: brandColor,
            };
        });
    }, [items, workstream]);

    const handleEventClick = (clickInfo: any) => {
        if (session.accessLevel) {
            let basePath = 'tasks';
            if (workstream === 'socialMediaPosts') basePath = 'social-media/posts';
            if (workstream === 'webArticles') basePath = 'web/articles';
            router.push(`/share/${linkId}/${basePath}/${clickInfo.event.id}`);
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
                eventClassNames={session.accessLevel ? "cursor-pointer border-none px-2 py-0.5 text-xs rounded-md font-medium" : "border-none px-2 py-0.5 text-xs rounded-md font-medium"}
            />
          </div>
        )}
      </main>
    </div>
  );
}
