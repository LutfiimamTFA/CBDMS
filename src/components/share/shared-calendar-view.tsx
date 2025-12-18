
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
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SocialPostCard } from '@/components/social-media/social-post-card'; // Using the same card for consistency
import { ScrollArea } from '@/components/ui/scroll-area';
import { SharedHeader } from './shared-header';
import { TaskCard } from '../tasks/task-card';

interface SharedCalendarViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedCalendarView({ session, tasks, isLoading }: SharedCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    let calendarEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 0 });
    const totalDaysInView = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    if (totalDaysInView.length / 7 < 6) {
      calendarEnd = add(calendarEnd, { weeks: 6 - (totalDaysInView.length / 7) });
    }
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!tasks) return map;

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
  
  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));
  
  const handleMonthChange = (month: string) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(month, 10)));
  };

  const handleYearChange = (year: string) => {
    setCurrentDate(new Date(parseInt(year, 10), currentDate.getMonth()));
  };
  
  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
                <Select value={String(currentDate.getFullYear())} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(currentDate.getMonth())} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-36 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentDate(new Date())}>
                    Today
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-7 flex-shrink-0 border-t border-l border-r rounded-t-lg">
            {daysOfWeek.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-r last:border-r-0">
                    {day}
                </div>
            ))}
        </div>
        <ScrollArea className="flex-1 border-b border-x rounded-b-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
        <div className="grid grid-cols-7 auto-rows-fr">
          {calendarGrid.days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const tasksForDay = tasksByDay.get(dayKey) || [];
            return (
              <div 
                  key={day.toString()} 
                  className={cn(
                      "relative flex flex-col border-r border-t min-h-[120px]",
                      !isSameMonth(day, currentDate) && "bg-muted/30 text-muted-foreground/50"
                  )}
              >
                  <span className={cn( "absolute top-1.5 right-1.5 font-semibold text-xs", isSameDay(day, new Date()) && "flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground")}>
                      {format(day, 'd')}
                  </span>
                    <div className="flex flex-col gap-1.5 p-1 pt-8">
                      {tasksForDay.map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
              </div>
            )
          })}
        </div>
        )}
        </ScrollArea>
      </main>
    </div>
  );
}
