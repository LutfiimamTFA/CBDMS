
'use client';
import { useMemo } from 'react';
import type { Task } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, formatHours } from '@/lib/utils';
import { Calendar, Link as LinkIcon, ListTodo, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '../ui/progress';
import { useI18n } from '@/context/i18n-provider';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
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


  return (
      <Link href={`/tasks/${task.id}`} className="block">
          <Card
              className={`cursor-pointer transition-shadow duration-200 hover:shadow-lg w-full`}
          >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <h3 className="font-headline text-base font-semibold leading-tight pr-2">{task.title}</h3>
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

                {task.tags && task.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <div key={tag.label} className={`px-2 py-0.5 text-xs font-medium rounded-full ${tag.color}`}>
                        {tag.label}
                      </div>
                    ))}
                  </div>
                )}
              
              {(task.timeTracked !== undefined && task.timeEstimate !== undefined) && (
                  <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Time Tracking</span>
                          <span>{formatHours(task.timeTracked)} / {task.timeEstimate}h</span>
                      </div>
                      <Progress value={timeTrackingProgress} className="h-1" />
                  </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center -space-x-2">
                  <TooltipProvider>
                      {task.assignees?.map((assignee) => (
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
                  </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                      {task.dependencies && task.dependencies.length > 0 && (
                          <span className="flex items-center gap-1">
                              <LinkIcon className="h-3.5 w-3.5" /> {task.dependencies.length}
                          </span>
                      )}
                      {task.dueDate && (
                          <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(parseISO(task.dueDate), 'MMM d')}
                          </span>
                      )}
                  </div>
              </div>
              </CardContent>
          </Card>
      </Link>
  );
}
