
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, Brand, WorkflowStatus, User } from '@/lib/types';
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
  isWithinInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  X,
  CheckCircle2,
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
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(task.brandId);
      const userMatch = selectedUsers.length === 0 || task.assigneeIds.some(id => selectedUsers.includes(id));
      const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(task.status);
      const priorityMatch = selectedPriorities.length === 0 || selectedPriorities.includes(task.priority);
      return brandMatch && userMatch && statusMatch && priorityMatch;
    });
  }, [allTasks, selectedBrands, selectedUsers, selectedStatuses, selectedPriorities]);


  // --- Calendar Grid Logic ---
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);
  const startDate = startOfWeek(firstDayOfMonth);
  const endDate = endOfWeek(lastDayOfMonth);
  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate });

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
  
  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));

  // --- Task Processing for Calendar View ---
  const { tasksWithPositions, weekLanes } = useMemo(() => {
    if (!filteredTasks || daysInGrid.length === 0) return { tasksWithPositions: [], weekLanes: {} };

    const localWeekLanes: Record<string, any[][]> = {};
    const gridStart = daysInGrid[0];
    const gridEnd = daysInGrid[daysInGrid.length - 1];
    
    const positioned = filteredTasks
      .map(task => {
        if (!task.startDate || !task.dueDate) return null;

        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.dueDate);
        
        if (taskEnd < gridStart || taskStart > gridEnd) return null;

        const effectiveStart = max([taskStart, gridStart]);
        const effectiveEnd = min([taskEnd, gridEnd]);
        
        const startDayIndex = differenceInDays(effectiveStart, gridStart);
        const duration = differenceInDays(effectiveEnd, effectiveStart) + 1;

        if (startDayIndex < 0 || (startDayIndex + duration) > daysInGrid.length) return null;

        let lane = 0;
        const weekOfTaskStart = startOfWeek(effectiveStart);
        const weekKey = format(weekOfTaskStart, 'yyyy-MM-dd');
        
        if (!localWeekLanes[weekKey]) {
            localWeekLanes[weekKey] = [];
        }

        while (true) {
            if (!localWeekLanes[weekKey][lane]) {
                localWeekLanes[weekKey][lane] = [];
            }

            const isOccupied = localWeekLanes[weekKey][lane].some(occupied => 
                (effectiveStart >= occupied.start && effectiveStart <= occupied.end) ||
                (effectiveEnd >= occupied.start && effectiveEnd <= occupied.end) ||
                (effectiveStart <= occupied.start && effectiveEnd >= occupied.end)
            );

            if (!isOccupied) {
                localWeekLanes[weekKey][lane].push({ start: effectiveStart, end: effectiveEnd });
                break;
            }
            lane++;
        }
        
        return {
          ...task,
          startCol: (startDayIndex % 7) + 1,
          row: Math.floor(startDayIndex / 7) + 2, // +2 because of header row
          span: duration,
          lane,
          color: getBrandColor(task.brandId),
        };
      })
      .filter(Boolean);
      
      return { tasksWithPositions: positioned, weekLanes: localWeekLanes };
  }, [filteredTasks, daysInGrid]);

  const completionMarkers = useMemo(() => {
    if (!tasksWithPositions || daysInGrid.length === 0) return [];
    
    const gridStart = daysInGrid[0];
    const gridEnd = daysInGrid[daysInGrid.length - 1];

    return tasksWithPositions.map(task => {
      if (!task.actualCompletionDate) return null;
      
      const completionDate = parseISO(task.actualCompletionDate);
      if (!isWithinInterval(completionDate, { start: gridStart, end: gridEnd })) return null;
      
      const completionDayIndex = differenceInDays(completionDate, gridStart);
      
      return {
        ...task,
        startCol: (completionDayIndex % 7) + 1,
        row: Math.floor(completionDayIndex / 7) + 2,
      };
    }).filter(Boolean);

  }, [tasksWithPositions, daysInGrid]);


  const filterCount = [selectedBrands, selectedUsers, selectedStatuses, selectedPriorities].reduce((acc, filter) => acc + filter.length, 0);

  const resetFilters = () => {
    setSelectedBrands([]);
    setSelectedUsers([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
  };

  const employeeOptions = useMemo(() => (allUsers || []).filter(u => u.role === 'Employee' || u.role === 'Manager').map(u => ({ value: u.id, label: u.name })), [allUsers]);
  const brandOptions = useMemo(() => (allBrands || []).map(b => ({ value: b.id, label: b.name })), [allBrands]);
  const statusOptions = useMemo(() => (allStatuses || []).map(s => ({ value: s.name, label: s.name })), [allStatuses]);
  const priorityOptions = useMemo(() => Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label })), []);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Team Calendar" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Calendar Header */}
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
        <div className="grid grid-cols-7 grid-rows-[auto] border-t border-l bg-border relative">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-secondary/50 border-r border-b">
                    {day}
                </div>
            ))}
            
            {daysInGrid.map((day) => (
                <div 
                    key={day.toString()}
                    className={cn(
                        "relative min-h-40 bg-background p-2 border-r border-b",
                        !isSameMonth(day, currentDate) && "bg-muted/30"
                    )}
                    style={{ gridRow: `${Math.floor(differenceInDays(day, daysInGrid[0]) / 7) + 2}` }}
                >
                    <span className={cn(
                      "font-semibold",
                      isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                </div>
            ))}
            
            {tasksWithPositions.map((task) => {
              if (!task) return null;
              const PriorityIcon = priorityInfo[task.priority].icon;

              const style = {
                gridRow: `${task.row} / span 1`,
                gridColumn: `${task.startCol} / span ${task.span}`,
                top: `${task.lane * 1.75 + 2.5}rem`,
              };

              return (
                <div key={`${task.id}-${task.row}`} style={style} className="absolute z-10 px-px py-0.5">
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className={cn(
                                'h-6 rounded-md px-2 flex items-center justify-between text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity w-full',
                                task.color
                            )}>
                                <span className="truncate">{task.title}</span>
                                {task.assignees && task.assignees.length > 0 && (
                                    <Avatar className="h-5 w-5 border border-white/50">
                                        <AvatarImage src={task.assignees[0].avatarUrl} />
                                        <AvatarFallback>{task.assignees[0].name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-3">
                                <div className='flex justify-between items-start'>
                                <h4 className="font-bold">{task.title}</h4>
                                <Badge variant="secondary" className={cn(task.color, 'text-white')}>
                                    {allBrands?.find(b => b.id === task.brandId)?.name || 'No Brand'}
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
                                  {(task.assignees || []).map(assignee => (
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
              );
            })}

            {completionMarkers.map((marker) => {
                 if (!marker) return null;
                 const style = {
                    gridRow: `${marker.row} / span 1`,
                    gridColumn: `${marker.startCol} / span 1`,
                    top: `${marker.lane * 1.75 + 2.5 + 0.125}rem`, // Position it over the bar
                 };
                 return (
                    <div key={`${marker.id}-completion`} style={style} className="absolute z-20 flex justify-end pr-1">
                        <CheckCircle2 className="h-5 w-5 text-green-500 bg-white rounded-full border-2 border-white"/>
                    </div>
                 )
            })}
        </div>
      </main>
    </div>
  );
}

