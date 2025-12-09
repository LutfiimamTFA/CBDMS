
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn, getBrandColor } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useRouter, useParams } from 'next/navigation';

interface SharedCalendarViewProps {
  tasks: Task[];
  permissions?: SharedLink['permissions'] | null;
}

export function SharedCalendarView({ tasks, permissions = null }: SharedCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;

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
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.dueDate) {
        const postDate = parseISO(task.dueDate);
         if (isWithinInterval(postDate, { start: calendarGrid.start, end: calendarGrid.end })) {
          const dayKey = format(postDate, 'yyyy-MM-dd');
          if (!map.has(dayKey)) {
            map.set(dayKey, []);
          }
          map.get(dayKey)?.push(task);
        }
      }
    });
    return map;
  }, [tasks, calendarGrid.start, calendarGrid.end]);
  
  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));

  const handleCardClick = (taskId: string) => {
    if (permissions?.canViewDetails) {
      router.push(`/share/${linkId}/${taskId}`);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full border rounded-lg">
      <div className="flex items-center justify-between p-2 border-b">
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
      </div>
      <div className="grid grid-cols-7 flex-shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-b last:border-r-0">
            {day}
          </div>
        ))}
      </div>
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
                  {tasksForDay.map(task => (
                    <Popover key={task.id}>
                      <PopoverTrigger asChild>
                        <div
                          onClick={() => handleCardClick(task.id)}
                          className={cn(
                            'w-full px-1.5 py-0.5 rounded text-white text-xs font-medium truncate',
                            permissions?.canViewDetails ? 'cursor-pointer' : 'cursor-default',
                            getBrandColor(task.brandId)
                          )}
                        >
                          {task.title}
                        </div>
                      </PopoverTrigger>
                       {permissions?.canViewDetails && (
                        <PopoverContent className="w-60">
                          <div className="space-y-2">
                            <h4 className="font-semibold">{task.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              Status: <Badge variant="secondary">{task.status}</Badge>
                            </p>
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

    