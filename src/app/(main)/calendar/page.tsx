
'use client';

import React, { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Calendar } from '@/components/ui/calendar';
import { useCollection, useFirestore } from '@/firebase';
import type { Task, User } from '@/lib/types';
import { collection, query } from 'firebase/firestore';
import { parseISO, isSameDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Link from 'next/link';

export default function CalendarPage() {
  const firestore = useFirestore();

  const tasksQuery = useMemo(
    () => (firestore ? query(collection(firestore, 'tasks')) : null),
    [firestore]
  );
  const { data: tasks, isLoading: isTasksLoading } =
    useCollection<Task>(tasksQuery);

  const tasksByDueDate = useMemo(() => {
    const groupedTasks = new Map<string, Task[]>();
    if (!tasks) return groupedTasks;

    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateStr = parseISO(task.dueDate).toDateString();
        if (!groupedTasks.has(dateStr)) {
          groupedTasks.set(dateStr, []);
        }
        groupedTasks.get(dateStr)?.push(task);
      }
    });
    return groupedTasks;
  }, [tasks]);

  const DayContent = (props: { date: Date }) => {
    const tasksForDay = tasksByDueDate.get(props.date.toDateString());

    if (!tasksForDay || tasksForDay.length === 0) {
      return <div>{props.date.getDate()}</div>;
    }

    const allAssignees = tasksForDay.flatMap((task) => task.assignees || []);
    const uniqueAssignees = Array.from(new Map(allAssignees.map(a => [a.id, a])).values());

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="relative h-full w-full">
            <div>{props.date.getDate()}</div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex -space-x-1">
              {uniqueAssignees.slice(0, 2).map((assignee) => (
                <Avatar key={assignee.id} className="h-4 w-4 border">
                  <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                  <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
              {uniqueAssignees.length > 2 && (
                 <Avatar className="h-4 w-4 border bg-muted text-muted-foreground">
                    <AvatarFallback className="text-[8px] leading-none">+{uniqueAssignees.length - 2}</AvatarFallback>
                 </Avatar>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <h4 className="font-semibold">{props.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
            <div className="space-y-3 max-h-64 overflow-auto">
              {tasksForDay.map(task => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block p-2 rounded-md hover:bg-accent">
                    <p className="font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {task.assignees?.map(assignee => (
                            <TooltipProvider key={assignee.id}>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{assignee.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </Link>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Team Calendar" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4">
            <h2 className="text-2xl font-bold">Team Calendar</h2>
            <p className="text-muted-foreground">
                Visual overview of all task deadlines. Click a date with avatars to see details.
            </p>
        </div>
        {isTasksLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="rounded-lg border">
            <Calendar
              mode="single"
              className="w-full p-0"
              classNames={{
                months: "flex flex-col sm:flex-row",
                month: "w-full",
                head_row: "grid grid-cols-7",
                row: "grid grid-cols-7 w-full mt-2",
                day: "h-24 w-auto rounded-none p-1 text-left align-top",
                cell: "relative text-sm h-24 w-auto rounded-none p-1 text-left align-top focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg",
              }}
              components={{
                DayContent: (props) => <DayContent {...props} />,
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
