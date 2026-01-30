'use client';
import { useMemo } from 'react';
import type { Task, User } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, cn, getBrandColor, formatLateness } from '@/lib/utils';
import { Calendar, Link as LinkIcon, ListTodo, CheckCircle2, AlertCircle, RefreshCcw, Star, History, Circle, CircleDashed, Eye, HelpCircle } from 'lucide-react';
import { format, parseISO, isAfter, formatDistanceToNow, endOfDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '../ui/progress';
import Link from 'next/link';
import { Badge } from '../ui/badge';

interface TaskCardProps {
  task: Task;
  draggable?: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType, label: string }> = {
  'To Do': { color: 'bg-gray-400 border-gray-400 text-white', icon: Circle, label: 'To Do' },
  'Doing': { color: 'bg-blue-500 border-blue-500 text-white', icon: CircleDashed, label: 'Doing' },
  'Preview': { color: 'bg-purple-500 border-purple-500 text-white', icon: Eye, label: 'Preview' },
  'Revisi': { color: 'bg-orange-500 border-orange-500 text-white', icon: RefreshCcw, label: 'Revisi' },
  'Done': { color: 'bg-green-500 border-green-500 text-white', icon: CheckCircle2, label: 'Done' },
};


export function TaskCard({ task, draggable = false }: TaskCardProps) {

  const PriorityIcon = priorityInfo[task.priority].icon;
  const priorityColor = priorityInfo[task.priority].color;

  const timeTrackingProgress = task.timeEstimate && task.timeTracked
    ? (task.timeTracked / task.timeEstimate) * 100
    : 0;
  
  const completionStatus = useMemo(() => {
    if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) return null;
    const completionDate = parseISO(task.actualCompletionDate);
    const dueDate = endOfDay(parseISO(task.dueDate));
    if (isAfter(completionDate, dueDate)) {
        return { status: 'Late', duration: formatLateness(dueDate, completionDate) };
    }
    return { status: 'On Time', duration: null };
  }, [task.status, task.actualCompletionDate, task.dueDate]);

  const brandColor = getBrandColor(task.brandId);

  const assignees = task.assignees || [];
  const creatorId = task.createdBy?.id;
  const statusStyling = statusConfig[task.status] || { color: 'bg-gray-400', icon: HelpCircle, label: task.status };

  const lastActivityText = useMemo(() => {
      if (!task.lastActivity) return null;
      const { user, action, timestamp } = task.lastActivity;
      const timeAgo = timestamp ? formatDistanceToNow(timestamp.toDate ? timestamp.toDate() : new Date(timestamp), { addSuffix: true }) : '';
      return `${user.name} ${action} ${timeAgo}`;
  }, [task.lastActivity]);

  return (
      <Card
        className={cn(
          "transition-shadow duration-200 hover:shadow-xl w-full relative",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg", brandColor)}></div>
        <CardContent className="p-4 pl-6 space-y-3">
          <div className="flex items-start justify-between">
            <div className="font-medium cursor-pointer pr-2">
              <h3 className="font-headline text-base font-semibold leading-tight break-words">{task.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {task.isUnderRevision && (
                  <TooltipProvider>
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <RefreshCcw className="h-4 w-4 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Task is under revision</p>
                          </TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
              )}
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <PriorityIcon className={`h-5 w-5 shrink-0 ${priorityColor}`} />
                      </TooltipTrigger>
                      <TooltipContent>
                          <p>{priorityInfo[task.priority].label}</p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        
        {lastActivityText && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger className="w-full">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground text-left">
                            <History className="h-3 w-3 shrink-0" />
                            <p className="truncate">{lastActivityText}</p>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">
                        <p>{lastActivityText}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center -space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center -space-x-2">
                    {assignees.slice(0, 2).map(assignee => {
                      const isCreator = assignee.id === creatorId;
                      return (
                        <div key={assignee.id} className="relative">
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {isCreator && (
                              <TooltipProvider>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                              <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-400" />
                                          </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>{assignee.name} is the task creator.</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          )}
                        </div>
                      )
                    })}
                    {assignees.length > 2 && (
                      <Avatar className="h-7 w-7 border-2 border-background">
                        <AvatarFallback>+{assignees.length - 2}</AvatarFallback>
                      </Avatar>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex flex-col gap-1 p-1">
                      <p className="font-semibold text-xs">Assigned to:</p>
                      {assignees.map(a => <p key={a.id} className="text-sm">{a.name}</p>)}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center flex-shrink-0 gap-2">
                {completionStatus && (
                    completionStatus.status === 'On Time' ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </TooltipTrigger>
                                <TooltipContent><p>Completed On Time</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <Badge variant="destructive" className="font-normal gap-1.5">
                            <AlertCircle className="h-3 w-3" />
                            {completionStatus.duration} late
                        </Badge>
                    )
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                    <span className="flex items-center gap-1">
                        <ListTodo className="h-3.5 w-3.5" /> {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                    </span>
                )}
                {task.dueDate && !completionStatus && (
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(task.dueDate), 'MMM d')}
                    </Badge>
                )}
                <Badge variant="outline" className={cn('flex items-center gap-1.5 text-xs font-medium', statusStyling.color)}>
                    <statusStyling.icon className="h-3 w-3" />
                    <span>{statusStyling.label}</span>
                </Badge>
            </div>
        </div>
        </CardContent>
      </Card>
  );
}
