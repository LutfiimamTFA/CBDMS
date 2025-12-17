'use client';

import React, { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, Brand, WorkflowStatus } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Loader2, Link as LinkIcon, Calendar, Building2, User as UserIcon } from 'lucide-react';
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
  const router = useRouter();

  const [popoverState, setPopoverState] = useState<{
    open: boolean;
    target: HTMLElement | null;
    task: Task | null;
  }>({ open: false, target: null, task: null });

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
  
  const brandsQuery = useMemo(() => (firestore && companyId ? query(collection(firestore, 'brands'), where('companyId', '==', companyId)) : null), [firestore, companyId]);
  const { data: allBrands } = useCollection<Brand>(brandsQuery);

  const statusesQuery = useMemo(() => (firestore && companyId ? query(collection(firestore, 'statuses'), where('companyId', '==', companyId)) : null), [firestore, companyId]);
  const { data: allStatuses } = useCollection<WorkflowStatus>(statusesQuery);
  
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
    
    const viewDetailsPath = `/tasks/${task.id}`;

    return (
      <PopoverContent className="w-80" side="bottom" align="start">
        <div className="space-y-4">
            <div className='space-y-1.5'>
                {brand && <Badge style={{ backgroundColor: getBrandColor(brand.id) }} className="text-white font-semibold flex items-center gap-2 w-fit"><Building2 className='h-3 w-3'/>{brand.name}</Badge>}
                <h4 className="font-bold text-base">{task.title}</h4>
                {task.description && <p className="text-sm text-muted-foreground line-clamp-3">{task.description}</p>}
            </div>

            <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-2.5">
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
                <div className='pt-3 border-t'>
                    <h5 className='text-sm font-medium mb-2'>Assigned Team</h5>
                    <div className='flex items-center gap-2'>
                        {assignees.map(assignee => (
                            <Avatar key={assignee.id} className="h-8 w-8">
                                <AvatarImage src={assignee.avatarUrl} />
                                <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        ))}
                    </div>
                </div>
            )}
            
            <div className='pt-3 border-t text-xs text-muted-foreground flex items-center gap-2'>
                <UserIcon className='h-4 w-4'/>
                <span>Created by {task.createdBy.name}</span>
            </div>
            
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
                    eventClassNames="cursor-pointer border-none px-2 py-0.5 text-xs rounded-md font-medium"
                />
                <PopoverContentDetails />
            </Popover>
          </div>
        )}
      </main>
    </div>
  );
}
