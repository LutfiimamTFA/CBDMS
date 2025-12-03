
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, Brand, WorkflowStatus } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDate,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  add,
  sub,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { priorityInfo } from '@/lib/utils';

// Helper to generate a consistent, visually distinct color for each brand
const brandColors = [
  'bg-cyan-500', 'bg-purple-500', 'bg-amber-500', 'bg-lime-500', 
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500'
];
const getBrandColor = (brandId: string) => {
  let hash = 0;
  for (let i = 0; i < brandId.length; i++) {
    hash = brandId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % brandColors.length);
  return brandColors[index];
};


export default function CalendarPage() {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Data Fetching ---
  const tasksQuery = useMemo(
    () => (firestore ? query(collection(firestore, 'tasks')) : null),
    [firestore]
  );
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const brandsQuery = useMemo(
    () => (firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null),
    [firestore]
  );
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const statusesQuery = useMemo(
    () => (firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null),
    [firestore]
  );
  const { data: allStatuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);

  // --- Calendar Grid Logic ---
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);
  const startDate = startOfWeek(firstDayOfMonth);
  const endDate = endOfWeek(lastDayOfMonth);
  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));

  // --- Task Processing for Calendar View ---
  const tasksWithPositions = useMemo(() => {
    if (!tasks) return [];
    
    // Sort tasks to ensure consistent layout
    const sortedTasks = [...tasks].sort((a,b) => parseISO(a.startDate!).getTime() - parseISO(b.startDate!).getTime());
    const weekLaneOccupancy: Record<string, number[]> = {};

    return sortedTasks.map((task) => {
      if (!task.startDate || !task.dueDate) return { ...task, top: 0, left: 0, width: 0, color: 'bg-gray-500' };

      const taskStart = parseISO(task.startDate);
      const taskEnd = parseISO(task.dueDate);
      const weekKey = format(startOfWeek(taskStart), 'yyyy-MM-dd');
      
      if (!weekLaneOccupancy[weekKey]) {
        weekLaneOccupancy[weekKey] = [];
      }

      // Find the first available lane (vertical position) for this task's duration
      let lane = 0;
      while (true) {
        const intervalToCheck = eachDayOfInterval({start: taskStart, end: taskEnd}).map(d => getDate(d));
        
        const isLaneOccupied = weekLaneOccupancy[weekKey]
            .some(occupiedLane => (occupiedLane as any).lane === lane && (occupiedLane as any).days.some((d: number) => intervalToCheck.includes(d)));

        if (!isLaneOccupied) {
          weekLaneOccupancy[weekKey].push({ lane, days: intervalToCheck } as any);
          break;
        }
        lane++;
      }
      
      const gridStartIndex = daysInGrid.findIndex(day => isSameDay(day, taskStart));
      const gridEndIndex = daysInGrid.findIndex(day => isSameDay(day, taskEnd));
      
      const left = (gridStartIndex % 7) * (100 / 7);
      const width = ((gridEndIndex % 7) - (gridStartIndex % 7) + 1) * (100 / 7);
      const top = Math.floor(gridStartIndex / 7);
      
      return {
        ...task,
        top: top, // The week row index
        lane: lane, // The vertical lane within the week
        left: left,
        width: width,
        color: getBrandColor(task.brandId),
      };
    });
  }, [tasks, daysInGrid]);


  const isLoading = isTasksLoading || areBrandsLoading || areStatusesLoading;
  
  if (isLoading) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <Header title="Team Calendar" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Team Calendar" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
           <div className='flex items-center gap-2'>
            {/* Future filter controls can go here */}
           </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-t border-l rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-r bg-secondary/50">
                    {day}
                </div>
            ))}
            
            {daysInGrid.map((day, index) => {
              const tasksOnThisDay = tasksWithPositions.filter(task => 
                  task.startDate && task.dueDate &&
                  isSameDay(day, parseISO(task.startDate))
              );

              return (
                <div 
                    key={day.toString()}
                    className={cn(
                        "relative h-40 border-b border-r p-2",
                        !isSameMonth(day, currentDate) && "bg-muted/30"
                    )}
                >
                    <span className={cn(
                      "font-semibold",
                      isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Render Task Bars */}
                    <div className="absolute top-10 left-0 right-0 h-28 space-y-1 overflow-hidden">
                       {tasksOnThisDay.map(task => {
                         const PriorityIcon = priorityInfo[task.priority].icon;

                         return (
                          <Popover key={task.id} trigger="hover">
                            <PopoverTrigger asChild>
                              <Link href={`/tasks/${task.id}`}
                                style={{
                                  position: 'absolute',
                                  top: `${task.lane! * 1.75}rem`, // 1.75rem height per lane
                                  left: `${task.left}%`,
                                  width: `${task.width}%`,
                                }}
                                className={cn(
                                  "h-6 rounded-md px-2 flex items-center justify-between text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                  task.color
                                )}
                              >
                               <span className="truncate">{task.title}</span>
                               <div className='flex items-center gap-1.5'>
                                {task.assignees && task.assignees.length > 0 && (
                                  <Avatar className="h-5 w-5 border border-white/50">
                                    <AvatarImage src={task.assignees[0].avatarUrl} />
                                    <AvatarFallback>{task.assignees[0].name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                )}
                               </div>
                              </Link>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="space-y-3">
                                  <div className='flex justify-between items-start'>
                                    <h4 className="font-bold">{task.title}</h4>
                                    <Badge variant="secondary" className={cn(task.color, "text-white")}>
                                      {brands?.find(b => b.id === task.brandId)?.name || 'No Brand'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className='flex items-center gap-2'>
                                      <PriorityIcon className={`h-4 w-4 ${priorityInfo[task.priority].color}`} />
                                      <span>{task.priority}</span>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                      <span className={cn("h-2 w-2 rounded-full", allStatuses?.find(s => s.name === task.status)?.color || 'bg-gray-400')}></span>
                                      <span>{task.status}</span>
                                    </div>
                                  </div>
                                  <div className='flex items-center gap-2'>
                                     {task.assignees?.map(assignee => (
                                        <div key={assignee.id} className='flex items-center gap-2'>
                                          <Avatar className="h-7 w-7">
                                              <AvatarImage src={assignee.avatarUrl} />
                                              <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm font-medium">{assignee.name}</span>
                                        </div>
                                     ))}
                                  </div>
                                </div>
                            </PopoverContent>
                          </Popover>
                         )
                       })}
                    </div>
                </div>
              )
            })}
        </div>
      </main>
    </div>
  );
}
