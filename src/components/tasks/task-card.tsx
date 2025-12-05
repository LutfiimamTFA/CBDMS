'use client';
import { useMemo } from 'react';
import type { Task } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, formatHours, cn, getBrandColor } from '@/lib/utils';
import { Calendar, Link as LinkIcon, ListTodo, CheckCircle2, AlertCircle } from 'lucide-react';
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
          <div className="flex items-center -space-x-2">
            <TooltipProvider>
              {task.assignees?.slice(0, 2).map((assignee) => (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{assignee.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {task.assignees && task.assignees.length > 2 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarFallback>+{task.assignees.length - 2}</AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                        {task.assignees.slice(2).map(a => <p key={a.id}>{a.name}</p>)}
                    </TooltipContent>
                </Tooltip>
              )}
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
