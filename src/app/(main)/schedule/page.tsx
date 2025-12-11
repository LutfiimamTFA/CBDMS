
'use client';

import React, { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { useSharedSession } from '@/context/shared-session-provider';
import type { Task, Brand, WorkflowStatus, User } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Loader2, Link as LinkIcon, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getBrandColor, priorityInfo } from '@/lib/utils';
import { parseISO, format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

export default function SchedulePage() {
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const router = useRouter();

  const [popoverState, setPopoverState] = useState<{
    open: boolean;
    target: HTMLElement | null;
    task: Task | null;
  }>({ open: false, target: null, task: null });

  const activeCompanyId = session ? session.companyId : companyId;

  const tasksQuery = useMemo(() => {
    if (!firestore || !activeCompanyId) return null;
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId));
    if (!session && profile?.role === 'Employee') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    return q;
  }, [firestore, activeCompanyId, profile, session]);
  
  const brandsQuery = useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'brands'), where('companyId', '==', activeCompanyId)) : null), [firestore, activeCompanyId]);
  const { data: allBrands } = useCollection<Brand>(brandsQuery);

  const statusesQuery = useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'statuses'), where('companyId', '==', activeCompanyId)) : null), [firestore, activeCompanyId]);
  const { data: allStatuses } = useCollection<WorkflowStatus>(statusesQuery);
  
  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const isLoading = isTasksLoading || isProfileLoading || isSessionLoading;

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
          start: task.startDate ? parseISO(task.startDate) : eventDate,
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
    clickInfo.jsEvent.preventDefault(); // Prevent default browser action
    const taskId = clickInfo.event.id;
    const task = allTasks?.find(t => t.id === taskId);

    if (task) {
        setPopoverState({
            open: true,
            target: clickInfo.el,
            task: task,
        });
    }
  };

  const onPopoverOpenChange = (open: boolean) => {
    if (!open) {
        setPopoverState({ open: false, target: null, task: null });
    }
  }

  const PopoverContentDetails = () => {
    if (!popoverState.task) return null;
    const task = popoverState.task;
    const brand = allBrands?.find(b => b.id === task.brandId);
    const status = allStatuses?.find(s => s.name === task.status);
    const priority = priorityInfo[task.priority];
    const assignees = task.assignees || [];
    
    const viewDetailsPath = session ? `/share/${session.id}/${task.id}` : `/tasks/${task.id}`;

    return (
      <PopoverContent className="w-80" side="bottom" align="start">
        <div className="space-y-4">
            <div className='space-y-1'>
                {brand && <Badge style={{ backgroundColor: getBrandColor(brand.id) }} className="text-white font-semibold">{brand.name}</Badge>}
                <h4 className="font-bold text-base">{task.title}</h4>
                {task.description && <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>}
            </div>

            <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Start Date</span>
              </div>
              <div className="font-medium">
                {task.startDate ? format(parseISO(task.startDate), 'MMM d, yyyy') : 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Due Date</span>
              </div>
              <div className="font-medium">
                {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                 <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status?.color }}></div>
                <span>Status</span>
              </div>
              <div className="font-medium">{task.status}</div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <priority.icon className={`h-4 w-4 ${priority.color}`} />
                <span>Priority</span>
              </div>
              <div className="font-medium">{task.priority}</div>
            </div>

            {assignees.length > 0 && (
                <div className='flex items-center gap-2 pt-2 border-t'>
                    {assignees.slice(0, 3).map(assignee => (
                         <Avatar key={assignee.id} className="h-7 w-7">
                            <AvatarImage src={assignee.avatarUrl} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ))}
                    {assignees.length > 3 && <Badge variant="secondary">+{assignees.length - 3}</Badge>}
                </div>
            )}
            
            <Button asChild size="sm" className="w-full">
                <Link href={viewDetailsPath}>
                    <LinkIcon className="mr-2 h-4 w-4"/>
                    View Full Details
                </Link>
            </Button>
        </div>
      </PopoverContent>
    );
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
             <Popover open={popoverState.open} onOpenChange={onPopoverOpenChange}>
                <PopoverTrigger asChild>
                    {/* This is a virtual trigger. The actual trigger is setting the popover state in handleEventClick */}
                    <div style={{ position: 'fixed', top: popoverState.target?.getBoundingClientRect().bottom, left: popoverState.target?.getBoundingClientRect().left }}></div>
                </PopoverTrigger>
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
                    eventClassNames="cursor-pointer border-none p-1 text-xs rounded-md font-medium"
                />
                <PopoverContentDetails />
            </Popover>
          </div>
        )}
      </main>
    </div>
  );
}
