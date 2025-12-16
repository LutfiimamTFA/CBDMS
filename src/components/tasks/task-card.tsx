
'use client';
import { useMemo } from 'react';
import type { Task, User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, cn, getBrandColor } from '@/lib/utils';
import { Calendar, Link as LinkIcon, ListTodo, CheckCircle2, AlertCircle, RefreshCcw, Star } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '../ui/progress';
import { useI18n } from '@/context/i18n-provider';
import Link from 'next/link';
import { Badge } from '../ui/badge';

interface TaskCardProps {
  task: Task;
  draggable?: boolean;
}

export function TaskCard({ task, draggable = false }: TaskCardProps) {

  const PriorityIcon = priorityInfo[task.priority].icon;
  const priorityColor = priorityInfo[task.priority].color;
  const { t } = useI18n();

  const timeTrackingProgress = task.timeEstimate && task.timeTracked
    ? (task.timeTracked / task.timeEstimate) * 100
    : 0;
  
  const priorityTranslationKey = `priority.${task.priority.toLowerCase()}` as any;
  
  const completionStatus = useMemo(() => {
    if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) return null;
    const isLate = isAfter(parseISO(task.actualCompletionDate), parseISO(task.dueDate));
    return isLate ? 'Late' : 'On Time';
  }, [task.status, task.actualCompletionDate, task.dueDate]);

  const brandColor = getBrandColor(task.brandId);

  const assignees = task.assignees || [];
  const creatorId = task.createdBy.id;

  return (
    <Card
      className={cn(
        "transition-shadow duration-200 hover:shadow-lg w-full relative",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg", brandColor)}></div>
      <CardContent className="p-4 pl-6 space-y-3">
        <div className="flex items-start justify-between">
          <div className="font-medium cursor-pointer pr-2">
            <h3 className="font-headline text-base font-semibold leading-tight">{task.title}</h3>
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
                        <p>{t(priorityTranslationKey)}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      
      {(task.timeTracked !== undefined && task.timeEstimate !== undefined) && (
          <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Time Tracking</span>
                  <span>{formatHours(task.timeTracked)} / {task.timeEstimate}h</span>
              </div>
              <Progress value={timeTrackingProgress} className="h-1" />
          </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-3">
              {completionStatus && (
                  <TooltipProvider>
                      <Tooltip>
                          <TooltipTrigger>
                              {completionStatus === 'On Time' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                          </TooltipTrigger>
                          <TooltipContent>
                              <p>Completed {completionStatus}</p>
                          </TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                  <span className="flex items-center gap-1">
                      <ListTodo className="h-3.5 w-3.5" /> {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                  </span>
              )}
              {task.dueDate && (
                  <Badge variant="outline" className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseISO(task.dueDate), 'MMM d')}
                  </Badge>
              )}
          </div>
      </div>
      </CardContent>
    </Card>
  );
}

function formatHours(hours: number = 0) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
};
