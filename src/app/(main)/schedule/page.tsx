
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, Brand, WorkflowStatus, User } from '@/lib/types';
import { collection, query, orderBy, where } from 'firebase/firestore';
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
  parseISO,
  isWithinInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from '@/components/tasks/task-card';

export default function SchedulePage() {
  const firestore = useFirestore();
  const { profile: currentUser, companyId } = useUserProfile();
  const [currentDate, setCurrentDate] = useState(new Date());

  const tasksQuery = useMemo(() => {
    if (!firestore || !companyId) return null;
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', companyId));
    if (currentUser?.role === 'Manager') {
      if (!currentUser.brandIds || currentUser.brandIds.length === 0) {
        return query(collection(firestore, 'tasks'), where('__name__', '==', 'dummy-id-to-get-empty-result'));
      }
      q = query(q, where('brandId', 'in', currentUser.brandIds));
    } else if (currentUser?.role === 'Employee' || currentUser?.role === 'PIC') {
      q = query(q, where('assigneeIds', 'array-contains', currentUser.id));
    }
    return q;
  }, [firestore, companyId, currentUser]);

  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const isLoading = isTasksLoading;

  // --- Calendar Grid Logic ---
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(endOfMonth(firstDayOfMonth), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const tasksByDueDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!allTasks) return map;
    
    allTasks.forEach(task => {
      if (task.dueDate) {
        const dueDate = parseISO(task.dueDate);
        if (isWithinInterval(dueDate, { start: calendarGrid.start, end: calendarGrid.end })) {
          const key = format(dueDate, 'yyyy-MM-dd');
          if (!map.has(key)) {
            map.set(key, []);
          }
          map.get(key)?.push(task);
        }
      }
    });
    return map;
  }, [allTasks, calendarGrid]);
  
  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const handleMonthChange = (month: string) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(month, 10)));
  };

  const handleYearChange = (year: string) => {
    setCurrentDate(new Date(parseInt(year, 10), currentDate.getMonth()));
  };
  
  const next = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prev = () => setCurrentDate(sub(currentDate, { months: 1 }));

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex flex-1 flex-col p-4 md:p-6 overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
              <>
                <Select value={String(currentDate.getFullYear())} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(currentDate.getMonth())} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-36 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-t border-l border-border bg-secondary/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-b">
                    <span className="hidden md:inline">{day}</span>
                    <span className="md:hidden">{day.charAt(0)}</span>
                </div>
            ))}
        </div>
        <div className="flex-1 min-h-0">
          {isLoading ? (
             <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
          <ScrollArea className="h-full">
          <div className="grid grid-cols-7 border-l border-border h-full">
              {calendarGrid.days.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDueDate.get(dayKey) || [];

                  return (
                      <div 
                          key={day.toString()} 
                          className={cn(
                              "relative min-h-[12rem] p-2 border-r border-b flex flex-col", 
                              !isSameMonth(day, currentDate) && "bg-muted/30"
                          )}
                      >
                          <span className={cn(
                              "font-semibold text-sm", 
                              isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground",
                               !isSameMonth(day, currentDate) && "text-muted-foreground/50",
                               )}>
                              {format(day, 'd')}
                          </span>
                          <div className="mt-2 flex-1 space-y-1 overflow-auto">
                            {dayTasks.map(task => (
                              <TaskCard key={task.id} task={task} />
                            ))}
                          </div>
                      </div>
                  )
              })}
          </div>
          </ScrollArea>
          )}
        </div>
      </main>
    </div>
  );
}
