'use client';

import React, { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, Brand, WorkflowStatus, User, Activity } from '@/lib/types';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  differenceInCalendarDays,
  getDay,
  max,
  min,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, priorityInfo } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MultiSelect } from '@/components/ui/multi-select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';


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


type RenderSegment = {
  task: Task;
  startCol: number;
  span: number;
  level: number;
  isStart: boolean;
  isEnd: boolean;
};

type ViewMode = 'month' | 'week';

export default function CalendarPage() {
  const firestore = useFirestore();
  const { profile: currentUser } = useUserProfile();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // --- Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  // --- Data Fetching ---
  const tasksQuery = useMemo(() => (firestore ? query(collection(firestore, 'tasks')) : null), [firestore]);
  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const usersQuery = useMemo(() => (firestore ? query(collection(firestore, 'users'), orderBy('name')) : null), [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const brandsQuery = useMemo(() => (firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null), [firestore]);
  const { data: allBrands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const statusesQuery = useMemo(() => (firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null), [firestore]);
  const { data: allStatuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const isLoading = isTasksLoading || areUsersLoading || areBrandsLoading || areStatusesLoading;

  // --- Filtering Logic ---
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(task => {
      const brandMatch = selectedBrands.length === 0 || (task.brandId && selectedBrands.includes(task.brandId));
      const userMatch = selectedUsers.length === 0 || task.assigneeIds.some(id => selectedUsers.includes(id));
      const statusMatch = selectedStatuses.length === 0 || (task.status && selectedStatuses.includes(task.status));
      const priorityMatch = selectedPriorities.length === 0 || (task.priority && selectedPriorities.includes(task.priority));
      return brandMatch && userMatch && statusMatch && priorityMatch;
    });
  }, [allTasks, selectedBrands, selectedUsers, selectedStatuses, selectedPriorities]);


  // --- Calendar Grid Logic ---
  const calendarGrid = useMemo(() => {
    if (viewMode === 'month') {
      const firstDayOfMonth = startOfMonth(currentDate);
      const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(endOfMonth(firstDayOfMonth), { weekStartsOn: 0 });
      const weeks = [];
      let currentWeekStart = calendarStart;
      while(currentWeekStart <= calendarEnd) {
        const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
        weeks.push({
            start: currentWeekStart,
            end: weekEnd,
            days: eachDayOfInterval({start: currentWeekStart, end: weekEnd})
        });
        currentWeekStart = add(currentWeekStart, { weeks: 1 });
      }
      return { start: calendarStart, end: calendarEnd, weeks };
    } else { // week view
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return {
        start: weekStart,
        end: weekEnd,
        weeks: [{
            start: weekStart,
            end: weekEnd,
            days: eachDayOfInterval({ start: weekStart, end: weekEnd })
        }]
      };
    }
  }, [currentDate, viewMode]);
  
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
  
  const next = () => setCurrentDate(add(currentDate, viewMode === 'month' ? { months: 1 } : { weeks: 1 }));
  const prev = () => setCurrentDate(sub(currentDate, viewMode === 'month' ? { months: 1 } : { weeks: 1 }));

  const filterCount = [selectedBrands, selectedUsers, selectedStatuses, selectedPriorities].reduce((acc, filter) => acc + filter.length, 0);

  const resetFilters = () => {
    setSelectedBrands([]);
    setSelectedUsers([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
  };

  const employeeOptions = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role === 'Employee').map(u => ({ value: u.id, label: u.name }));
  }, [allUsers]);

  const brandOptions = useMemo(() => {
    if (!allBrands) return [];
    return allBrands.map(b => ({ value: b.id, label: b.name }));
  }, [allBrands]);
  
  const statusOptions = useMemo(() => {
    if (!allStatuses) return [];
    return allStatuses.map(s => ({ value: s.name, label: s.name }));
  }, [allStatuses]);

  const priorityOptions = useMemo(() => {
    return Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label }));
  }, []);

  const weeklyRenderSegments = useMemo(() => {
    if (!filteredTasks) return [];

    return calendarGrid.weeks.map(week => {
      const weekTasks = filteredTasks
        .map(task => {
          const taskStart = task.startDate ? parseISO(task.startDate) : (task.dueDate ? parseISO(task.dueDate) : null);
          const taskEnd = task.dueDate ? parseISO(task.dueDate) : taskStart;
          
          if (!taskStart || !taskEnd) return null;
          
          return { ...task, start: taskStart, end: taskEnd < taskStart ? taskStart : taskEnd };
        })
        .filter((t): t is Task & { start: Date; end: Date } => {
          if (!t) return false;
          const weekInterval = { start: week.start, end: week.end };
          return isWithinInterval(t.start, weekInterval) || isWithinInterval(t.end, weekInterval) || (t.start < week.start && t.end > week.end);
        });
        
      const segments: RenderSegment[] = [];
      const levelOccupancy: { endCol: number, level: number }[][] = Array(7).fill(0).map(() => []);

      weekTasks
        .sort((a,b) => {
            const aDuration = differenceInCalendarDays(a.end, a.start);
            const bDuration = differenceInCalendarDays(b.end, b.start);
            if(aDuration !== bDuration) return bDuration - aDuration;
            return a.start.getTime() - b.start.getTime();
        })
        .forEach(task => {
          const effectiveStart = max([task.start, week.start]);
          const effectiveEnd = min([task.end, week.end]);

          if (effectiveStart > effectiveEnd) return;
          
          const startCol = getDay(effectiveStart);
          const endCol = getDay(effectiveEnd);
          const span = endCol - startCol + 1;

          if (span <= 0) return;
          
          let level = 0;
          while (true) {
            let isOccupied = false;
            for (let i = startCol; i <= endCol; i++) {
              if (levelOccupancy[i].some(occupant => occupant.level === level)) {
                isOccupied = true;
                break;
              }
            }
            if (!isOccupied) break;
            level++;
          }
          
          for (let i = startCol; i <= endCol; i++) {
            levelOccupancy[i].push({ level, endCol });
          }

          segments.push({
            task,
            startCol,
            span,
            level,
            isStart: isSameDay(task.start, effectiveStart),
            isEnd: isSameDay(task.end, effectiveEnd),
          });
        });

      return { segments, maxLevel: Math.max(...levelOccupancy.flat().map(o => o.level), -1) };
    });
  }, [filteredTasks, calendarGrid.weeks]);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    // Prevent dragging if the task is done
    if (task.status === 'Done') {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({
      taskId: task.id,
      originalStartDate: task.startDate || task.dueDate,
    }));
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!firestore || !currentUser) return;

    const droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
    const { taskId, originalStartDate } = droppedData;
    const targetDateStr = e.currentTarget.dataset.date;
    
    if (!taskId || !targetDateStr) return;

    const task = allTasks?.find(t => t.id === taskId);
    if (!task) return;

    const originalStart = parseISO(originalStartDate);
    const originalEnd = task.dueDate ? parseISO(task.dueDate) : originalStart;
    const durationDays = differenceInCalendarDays(originalEnd, originalStart);

    const newStartDate = new Date(targetDateStr);
    const newDueDate = add(newStartDate, { days: durationDays });

    const taskRef = doc(firestore, 'tasks', taskId);

      const createActivity = (user: User, action: string): Activity => {
        return {
          id: `act-${Date.now()}`,
          user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
          action: action,
          timestamp: new Date().toISOString(),
        };
      };
      
      const oldDateFormatted = format(originalStart, 'MMM d');
      const newDateFormatted = format(newStartDate, 'MMM d');
      const newActivity = createActivity(currentUser, `rescheduled task from ${oldDateFormatted} to ${newDateFormatted}`);

    try {
      await updateDoc(taskRef, {
        startDate: newStartDate.toISOString(),
        dueDate: newDueDate.toISOString(),
        updatedAt: serverTimestamp(),
        activities: [...(task.activities || []), newActivity],
        lastActivity: newActivity,
      });
      toast({
        title: "Task Rescheduled",
        description: `"${task.title}" has been moved.`
      });
    } catch (error) {
      console.error("Failed to update task date:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not reschedule the task. Please try again."
      });
    }
  };


  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Team Calendar" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {viewMode === 'month' && (
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
            )}
             {viewMode === 'week' && (
              <h2 className="text-xl font-bold">
                {format(calendarGrid.start, 'MMM d')} - {format(calendarGrid.end, 'MMM d, yyyy')}
              </h2>
            )}

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
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)} className='hidden md:flex'>
              <ToggleGroupItem value="month">Month</ToggleGroupItem>
              <ToggleGroupItem value="week">Week</ToggleGroupItem>
            </ToggleGroup>
          </div>
           <div className='flex items-center gap-2'>
            <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="h-9">
                        <Filter className="mr-2 h-4 w-4"/> Filter
                        {filterCount > 0 && <Badge variant="secondary" className="ml-2">{filterCount}</Badge>}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <div className='mt-2 p-4 border rounded-lg bg-card w-full flex-col lg:flex-row flex gap-4'>
                        {isLoading ? <Loader2 className="animate-spin" /> : (
                          <>
                            <div className='flex-1 space-y-2'>
                                <Label>Brands</Label>
                                <MultiSelect options={brandOptions} onValueChange={setSelectedBrands} defaultValue={selectedBrands} placeholder="Select brands..."/>
                            </div>
                            <div className='flex-1 space-y-2'>
                                <Label>Employees</Label>
                                <MultiSelect options={employeeOptions} onValueChange={setSelectedUsers} defaultValue={selectedUsers} placeholder="Select employees..."/>
                            </div>
                            <div className='flex-1 space-y-2'>
                                <Label>Statuses</Label>
                                <MultiSelect options={statusOptions} onValueChange={setSelectedStatuses} defaultValue={selectedStatuses} placeholder="Select statuses..."/>
                            </div>
                             <div className='flex-1 space-y-2'>
                                <Label>Priorities</Label>
                                <MultiSelect options={priorityOptions} onValueChange={setSelectedPriorities} defaultValue={selectedPriorities} placeholder="Select priorities..."/>
                            </div>
                          </>
                        )}
                        {filterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={resetFilters} className="self-end"><X className="mr-2 h-4 w-4"/>Reset</Button>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
           </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-t border-l border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-secondary/50 border-r border-b">
                    <span className="hidden md:inline">{day}</span>
                    <span className="md:hidden">{day.charAt(0)}</span>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 border-l border-border">
            {calendarGrid.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 relative border-b" style={{ minHeight: `${(weeklyRenderSegments[weekIndex]?.maxLevel + 1) * 1.75 + 4}rem`}}>
                     <div className="absolute top-8 left-0 right-0 bottom-0 grid grid-cols-7">
                        {weeklyRenderSegments[weekIndex]?.segments.map(segment => {
                            const { task, startCol, span, level, isStart, isEnd } = segment;
                            const priority = task.priority ? priorityInfo[task.priority] : null;
                            const PriorityIcon = priority?.icon;
                            const taskColor = getBrandColor(task.brandId);
                            const isDraggable = task.status !== 'Done';

                            return (
                                <Popover key={`${task.id}-${week.start.toString()}`}>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <PopoverTrigger asChild>
                                                <TooltipTrigger asChild>
                                                <div
                                                    draggable={isDraggable}
                                                    onDragStart={(e) => handleDragStart(e, task)}
                                                    className={cn(
                                                        'absolute h-6 px-2 flex items-center text-white text-xs font-medium transition-all z-10',
                                                        taskColor,
                                                        isStart ? 'rounded-l-md' : '',
                                                        isEnd ? 'rounded-r-md' : '',
                                                        isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                                        'hover:opacity-80',
                                                        task.status === 'Done' && 'opacity-60'
                                                    )}
                                                    style={{
                                                        top: `${level * 1.75}rem`,
                                                        left: `${(startCol / 7) * 100}%`,
                                                        width: `calc(${(span / 7) * 100}% - 4px)`,
                                                        marginLeft: '2px',
                                                        marginRight: '2px',
                                                    }}
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {PriorityIcon && (
                                                            <PriorityIcon className="h-3.5 w-3.5 shrink-0" />
                                                        )}
                                                        <span className="truncate">{task.title}</span>
                                                    </div>
                                                </div>
                                                </TooltipTrigger>
                                            </PopoverTrigger>
                                            <TooltipContent><p>{task.title}</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <PopoverContent className="w-80">
                                        <div className="space-y-3">
                                            <Link href={`/tasks/${task.id}`} className="hover:underline">
                                                <h4 className="font-bold">{task.title}</h4>
                                            </Link>
                                            <div className='flex justify-between items-start'>
                                                <Badge variant="secondary" className={cn(taskColor, 'text-white')}>
                                                {allBrands?.find(b => b.id === task.brandId)?.name || 'No Brand'}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                <p>Start: {task.startDate ? format(parseISO(task.startDate), 'MMM d, yyyy') : 'N/A'}</p>
                                                <p>Due: {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}</p>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <div className='flex items-center gap-2'>
                                                {priority && (
                                                    <>
                                                    <priority.icon className={`h-4 w-4 ${priority.color}`} />
                                                    <span>{task.priority}</span>
                                                    </>
                                                )}
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                <span className={cn("h-2 w-2 rounded-full")} style={{ backgroundColor: allStatuses?.find(s => s.name === task.status)?.color || 'bg-gray-400' }}></span>
                                                <span>{task.status}</span>
                                                </div>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                {task.assignees?.map(assignee => (
                                                <TooltipProvider key={assignee.id}>
                                                    <Tooltip>
                                                    <TooltipTrigger>
                                                        <Avatar className="h-7 w-7">
                                                        <AvatarImage src={assignee.avatarUrl} />
                                                        <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>{assignee.name}</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            );
                        })}
                    </div>
                    {week.days.map((day) => (
                        <div 
                            key={day.toString()} 
                            className={cn("p-2 border-r relative pt-8", viewMode === 'month' && !isSameMonth(day, currentDate) && "bg-muted/30")}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            data-date={day.toISOString()}
                        >
                            <span className={cn( "absolute top-1.5 left-1.5 font-semibold text-sm", isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground")}>
                                {format(day, 'd')}
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
      </main>
    </div>
  );
}
