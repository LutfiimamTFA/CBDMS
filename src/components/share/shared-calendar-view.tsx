
'use client';

import React, { useState, useMemo } from 'react';
import type { Task, SharedLink } from '@/lib/types';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  add,
  sub,
  isSameDay,
  isWithinInterval,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getBrandColor } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SharedHeader } from './shared-header';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, type Query } from 'firebase/firestore';

interface SharedCalendarViewProps {
  session: SharedLink;
}

export function SharedCalendarView({ session }: SharedCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    
    let q: Query = query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
    
    // This is the critical security filter.
    if (session.brandIds && session.brandIds.length > 0) {
        q = query(q, where('brandId', 'in', session.brandIds));
    }
    
    return q;
  }, [firestore, session]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    let calendarEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 0});
    const totalDaysInView = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    if (totalDaysInView.length / 7 < 6) {
        calendarEnd = add(calendarEnd, { weeks: 6 - (totalDaysInView.length / 7) });
    }
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const tasksByDay = useMemo(() => {
    if (!tasks) return new Map();
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.dueDate) {
        try {
          const postDate = parseISO(task.dueDate);
          if (isWithinInterval(postDate, { start: calendarGrid.start, end: calendarEnd })) {
            const dayKey = format(postDate, 'yyyy-MM-dd');
            if (!map.has(dayKey)) {
              map.set(dayKey, []);
            }
            map.get(dayKey)?.push(task);
          }
        } catch (e) {
          console.warn(`Invalid date format for task ${task.id}: ${task.dueDate}`);
        }
      }
    });
    return map;
  }, [tasks, calendarGrid.start, calendarGrid.end]);
  
  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Calendar" />
      <header className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">{format(currentDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-7 flex-shrink-0 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
            {day}
          </div>
        ))}
      </div>
       {isTasksLoading ? (
        <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
      <div className="grid grid-cols-7 grid-rows-6 flex-1 overflow-hidden">
        {calendarGrid.days.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const tasksForDay = tasksByDay.get(dayKey) || [];
          return (
            <div 
              key={day.toString()} 
              className={cn(
                "relative flex flex-col border-r border-b",
                !isSameMonth(day, currentDate) && "bg-muted/30",
                (index + 1) % 7 === 0 && "border-r-0",
                index >= 35 && "border-b-0"
              )}
            >
              <span className={cn(
                "p-1.5 font-semibold text-sm",
                !isSameMonth(day, currentDate) && "text-muted-foreground/50",
                isSameDay(day, new Date()) && "rounded-full bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center m-1"
              )}>
                {format(day, 'd')}
              </span>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-1">
                  {tasksForDay.map(task => {
                    const canClick = session.permissions.canViewDetails;

                     const content = (
                        <div
                            className={cn(
                            'w-full px-1.5 py-0.5 rounded text-white text-xs font-medium truncate',
                            canClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                            getBrandColor(task.brandId)
                            )}
                        >
                            {task.title}
                        </div>
                     );

                    return canClick ? (
                        <div key={task.id} onClick={() => router.push(`/tasks/${task.id}?shared=true`)}>
                           {content}
                        </div>
                    ) : (
                        <Popover key={task.id}>
                            <PopoverTrigger asChild>
                                {content}
                            </PopoverTrigger>
                            <PopoverContent className="w-60 text-sm">
                                To view task details, ask the sender to enable the "View Full Task Details" permission for this link.
                            </PopoverContent>
                        </Popover>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
