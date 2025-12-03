
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
  isSameMonth,
  startOfMonth,
  startOfWeek,
  add,
  sub,
  isSameDay,
  parseISO,
  differenceInDays,
  max,
  min,
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
  if (!brandId) return 'bg-gray-500';
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
    if (!tasks || daysInGrid.length === 0) return [];
    
    const sortedTasks = [...tasks].sort((a,b) => {
        const startA = a.startDate ? parseISO(a.startDate).getTime() : 0;
        const startB = b.startDate ? parseISO(b.startDate).getTime() : 0;
        return startA - startB;
    });

    const weekLanes: Record<string, any[][]> = {};

    return sortedTasks.map((task) => {
        if (!task.startDate || !task.dueDate) return { ...task };

        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.dueDate);

        const actualStart = max([taskStart, startDate]);
        const actualEnd = min([taskEnd, endDate]);

        const startDayIndex = daysInGrid.findIndex(day => isSameDay(day, actualStart));
        if (startDayIndex === -1) return { ...task };

        const weekKey = format(startOfWeek(actualStart), 'yyyy-MM-dd');
        if (!weekLanes[weekKey]) {
            weekLanes[weekKey] = [];
        }

        let lane = 0;
        while (true) {
            if (!weekLanes[weekKey][lane]) {
                weekLanes[weekKey][lane] = [];
            }
            
            const isOccupied = weekLanes[weekKey][lane].some(occupiedTask => 
                (actualStart >= occupiedTask.start && actualStart <= occupiedTask.end) ||
                (actualEnd >= occupiedTask.start && actualEnd <= occupiedTask.end)
            );

            if (!isOccupied) {
                weekLanes[weekKey][lane].push({ start: actualStart, end: actualEnd });
                break;
            }
            lane++;
        }

        const startCol = startDayIndex % 7;
        const duration = differenceInDays(actualEnd, actualStart) + 1;
        const startRow = Math.floor(startDayIndex / 7) + 2; // +2 for header row and 1-based indexing

        return {
            ...task,
            lane: lane,
            startDayIndex: startDayIndex,
            gridProps: {
                gridRowStart: startRow,
                gridColumnStart: startCol + 1,
                gridColumnEnd: `span ${duration}`,
            },
            style: {
                gridRow: `${startRow}`,
                gridColumn: `${startCol + 1} / span ${duration}`,
                top: `${lane * 1.75 + 2.5}rem`,
            },
            color: getBrandColor(task.brandId),
        };
    }).filter(t => t.style);
  }, [tasks, daysInGrid, startDate, endDate]);


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
        <div className="relative grid grid-cols-7 grid-rows-[auto] gap-px rounded-lg border-t border-l overflow-hidden bg-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-secondary/50">
                    {day}
                </div>
            ))}
            
            {daysInGrid.map((day) => (
                <div 
                    key={day.toString()}
                    className={cn(
                        "relative min-h-40 bg-background p-2",
                        !isSameMonth(day, currentDate) && "bg-muted/30"
                    )}
                >
                    <span className={cn(
                      "font-semibold",
                      isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                </div>
            ))}
            
            {/* Render Task Bars */}
            {tasksWithPositions.map(task => {
                if (!task.style) return null;
                const PriorityIcon = priorityInfo[task.priority].icon;

                return (
                    <div
                      key={task.id}
                      style={task.style}
                      className="absolute z-10 p-px"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "h-6 rounded-md px-2 flex items-center justify-between text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity w-full",
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
                          </div>
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
                    </div>
                )
            })}
        </div>
      </main>
    </div>
  );
}
