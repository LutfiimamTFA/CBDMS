
'use client';
import { useMemo, useState } from 'react';
import type { Task, User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, cn, getBrandColor } from '@/lib/utils';
import { Calendar, Link as LinkIcon, ListTodo, CheckCircle2, AlertCircle, RefreshCcw, Star, History, MoreHorizontal, Share2 } from 'lucide-react';
import { format, parseISO, isAfter, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ShareTaskDialog } from './share-task-dialog';


interface TaskCardProps {
  task: Task;
  draggable?: boolean;
}

export function TaskCard({ task, draggable = false }: TaskCardProps) {
  const router = useRouter();
  const { profile: currentUser } = useUserProfile();
  const [isShareTaskOpen, setIsShareTaskOpen] = useState(false);

  const PriorityIcon = priorityInfo[task.priority].icon;
  const priorityColor = priorityInfo[task.priority].color;

  const completionStatus = useMemo(() => {
    if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) return null;
    const isLate = isAfter(parseISO(task.actualCompletionDate), parseISO(task.dueDate));
    return isLate ? 'Late' : 'On Time';
  }, [task.status, task.actualCompletionDate, task.dueDate]);

  const brandColor = getBrandColor(task.brandId);

  const assignees = task.assignees || [];
  const creatorId = task.createdBy.id;

  const lastActivityText = useMemo(() => {
      if (!task.lastActivity) return null;
      const { user, action, timestamp } = task.lastActivity;
      const timeAgo = timestamp ? formatDistanceToNow(timestamp.toDate ? timestamp.toDate() : new Date(timestamp), { addSuffix: true }) : '';
      return `${user.name} ${action} ${timeAgo}`;
  }, [task.lastActivity]);
  
  const isCreatorEmployeeOrPIC = ['Employee', 'PIC', 'Client'].includes(task.createdBy.role);


  return (
      <>
      <Card
        className={cn(
          "transition-shadow duration-200 hover:shadow-lg w-full relative group/card",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg", brandColor)}></div>
        
        <CardContent className="p-4 pl-6 space-y-3" onClick={() => router.push(`/tasks/${task.id}`)}>
          <div className="flex items-start justify-between">
            <div className="font-medium cursor-pointer pr-8">
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
                          <p>{priorityInfo[task.priority].label}</p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
               <DropdownMenu onOpenChange={(e) => e.stopPropagation()}>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                     {isCreatorEmployeeOrPIC && (
                        <ShareTaskDialog task={task} open={isShareTaskOpen} onOpenChange={setIsShareTaskOpen}>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Share2 className="mr-2 h-4 w-4"/> Share Task
                          </DropdownMenuItem>
                        </ShareTaskDialog>
                     )}
                    <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}`)}>View Details</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center -space-x-2">
                    {assignees.slice(0, 2).map(assignee => {
                      const isCreatorAssignee = assignee.id === creatorId;
                      return (
                        <div key={assignee.id} className="relative">
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {isCreatorAssignee && (
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
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(task.dueDate), 'MMM d')}
                    </span>
                )}
            </div>
        </div>
        </CardContent>
      </Card>
      </>
  );
}
