
'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { useSharedSession } from '@/context/shared-session-provider';
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
  isAfter,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, priorityInfo, getBrandColor } from '@/lib/utils';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { notFound } from 'next/navigation';
import { ShareViewDialog } from '@/components/share/share-view-dialog';

type ViewMode = 'month' | 'week';

export default function CalendarPage() {
  const firestore = useFirestore();
  const { profile: currentUser, companyId } = useUserProfile();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // --- Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  
  const activeCompanyId = session ? session.companyId : companyId;

  // --- Data Fetching (Role-aware) ---
  const tasksQuery = useMemo(() => {
    if (!firestore || !activeCompanyId) return null;

    let q = query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId));
    
    // In a normal session, employees only see their own tasks
    if (!session && currentUser?.role === 'Employee') {
      q = query(q, where('assigneeIds', 'array-contains', currentUser.id));
    }
    return q;

  }, [firestore, activeCompanyId, currentUser, session]);

  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const usersQuery = useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'users'), where('companyId', '==', activeCompanyId), orderBy('name')) : null), [firestore, activeCompanyId]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const brandsQuery = useMemo(() => {
    if (!firestore || !activeCompanyId) return null;
    let q = query(collection(firestore, 'brands'), orderBy('name'));

    // If Manager, only fetch the brands they are assigned to, if any
    if (currentUser?.role === 'Manager' && currentUser.brandIds && currentUser.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', currentUser.brandIds));
    } else if (currentUser?.role === 'Manager') {
        return null; // Manager with no brands sees no brands.
    }
    
    // For other roles, fetch all brands for the company
    if (currentUser?.role !== 'Manager') {
      q = query(q, where('companyId', '==', activeCompanyId));
    }

    return q;
  }, [firestore, activeCompanyId, currentUser]);
  const { data: allBrands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const statusesQuery = useMemo(() => (firestore && activeCompanyId ? query(collection(firestore, 'statuses'), where('companyId', '==', activeCompanyId), orderBy('order')) : null), [firestore, activeCompanyId]);
  const { data: allStatuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const isLoading = isTasksLoading || areUsersLoading || areBrandsLoading || areStatusesLoading || isSessionLoading;

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
      const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
      return { start: calendarStart, end: calendarEnd, days };
    } else { // week view
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return { start: weekStart, end: weekEnd, days: eachDayOfInterval({ start: weekStart, end: weekEnd }) };
    }
  }, [currentDate, viewMode]);

  const tasksByDueDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!filteredTasks) return map;
    
    filteredTasks.forEach(task => {
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
  }, [filteredTasks, calendarGrid]);
  
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

  if (session && !session.allowedNavItems.includes('nav_calendar')) {
    return notFound();
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
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
            <ShareViewDialog
                allowedNavItems={['nav_calendar', 'nav_list']}
                viewFilters={{brandIds: selectedBrands}}
              >
                  <Button variant="outline" className="h-9">
                      <Share2 className="mr-2 h-4 w-4" /> Share View
                  </Button>
              </ShareViewDialog>
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
        <ScrollArea className="flex-1">
        <div className="grid grid-cols-7 border-l border-border h-full">
            {calendarGrid.days.map((day, index) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDueDate.get(dayKey) || [];

                return (
                    <div 
                        key={day.toString()} 
                        className={cn(
                            "relative min-h-[8rem] p-2 border-r border-b flex flex-col", 
                            viewMode === 'month' && !isSameMonth(day, currentDate) && "bg-muted/30"
                        )}
                    >
                        <span className={cn(
                            "font-semibold text-sm", 
                            isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground",
                             viewMode === 'month' && !isSameMonth(day, currentDate) && "text-muted-foreground/50",
                             )}>
                            {format(day, 'd')}
                        </span>
                        <div className="mt-2 flex-1 space-y-1 overflow-auto">
                          {dayTasks.map(task => {
                            const brandColor = getBrandColor(task.brandId);
                            const priority = priorityInfo[task.priority];

                            const completionStatus = (() => {
                                if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) return null;
                                const isLate = isAfter(parseISO(task.actualCompletionDate), parseISO(task.dueDate));
                                return isLate ? 'Late' : 'On Time';
                            })();

                            const firstAssignee = task.assignees?.[0];

                            return (
                                <Popover key={task.id}>
                                    <PopoverTrigger asChild>
                                        <div
                                            className={cn(
                                                'w-full px-2 py-1 rounded-md cursor-pointer hover:opacity-80 text-white text-xs font-medium truncate',
                                                brandColor
                                            )}
                                            >
                                            {task.title}
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <Badge variant="secondary" className={cn(brandColor, 'text-white font-semibold')}>
                                                    {allBrands?.find(b => b.id === task.brandId)?.name || 'No Brand'}
                                                </Badge>
                                                <Link href={`/tasks/${task.id}`} className="hover:underline">
                                                    <h4 className="font-bold text-base">{task.title}</h4>
                                                </Link>
                                            </div>
                                            
                                            <div className="text-sm text-muted-foreground">
                                                <p>Due: {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}</p>
                                            </div>

                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
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
                                                {completionStatus && (
                                                    <Badge variant={completionStatus === 'Late' ? 'destructive' : 'default'} className={cn(completionStatus === 'On Time' && 'bg-green-600 hover:bg-green-700')}>
                                                        {completionStatus === 'On Time' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                                                        {completionStatus}
                                                    </Badge>
                                                )}
                                            </div>

                                            {firstAssignee && <div className='flex items-center gap-2 pt-2 border-t'>
                                                <Avatar className="h-7 w-7">
                                                <AvatarImage src={firstAssignee.avatarUrl} />
                                                <AvatarFallback>{firstAssignee.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium">{firstAssignee.name}</span>
                                                {task.assignees.length > 1 && (
                                                    <Badge variant="secondary">+{task.assignees.length - 1}</Badge>
                                                )}
                                            </div>}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            );
                          })}
                        </div>
                    </div>
                )
            })}
        </div>
        </ScrollArea>
      </main>
    </div>
  );

    
}
