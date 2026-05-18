'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { priorityInfo, cn, getBrandColor, formatLateness } from '@/lib/utils';
import {
  Calendar,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Star,
  History,
  Circle,
  CircleDashed,
  Eye,
  HelpCircle,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import {
  format,
  parseISO,
  isAfter,
  formatDistanceToNow,
  endOfDay,
} from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ShareTaskDialog } from './share-task-dialog';

interface TaskCardProps {
  task: Task;
  draggable?: boolean;
}

const statusConfig: Record<
  string,
  { color: string; icon: React.ElementType; label: string }
> = {
  'To Do': {
    color: 'bg-gray-400 border-gray-400 text-white',
    icon: Circle,
    label: 'To Do',
  },
  Doing: {
    color: 'bg-blue-500 border-blue-500 text-white',
    icon: CircleDashed,
    label: 'Doing',
  },
  Preview: {
    color: 'bg-purple-500 border-purple-500 text-white',
    icon: Eye,
    label: 'Preview',
  },
  Revisi: {
    color: 'bg-orange-500 border-orange-500 text-white',
    icon: RefreshCcw,
    label: 'Revisi',
  },
  Done: {
    color: 'bg-green-500 border-green-500 text-white',
    icon: CheckCircle2,
    label: 'Done',
  },
};

export function TaskCard({ task, draggable = false }: TaskCardProps) {
  const router = useRouter();
  useUserProfile();

  const [isShareTaskOpen, setIsShareTaskOpen] = useState(false);

  const PriorityIcon = priorityInfo[task.priority]?.icon || HelpCircle;
  const priorityColor = priorityInfo[task.priority]?.color || 'text-muted-foreground';

  const completionStatus = useMemo(() => {
    if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) {
      return null;
    }

    const completionDate = parseISO(task.actualCompletionDate);
    const dueDate = endOfDay(parseISO(task.dueDate));

    if (isAfter(completionDate, dueDate)) {
      return {
        status: 'Late',
        duration: formatLateness(dueDate, completionDate),
      };
    }

    return {
      status: 'On Time',
      duration: null,
    };
  }, [task.status, task.actualCompletionDate, task.dueDate]);

  const brandColor = getBrandColor(task.brandId);
  const assignees = task.assignees || [];
  const creatorId = task.createdBy?.id;

  const statusStyling = statusConfig[task.status] || {
    color: 'bg-gray-400 border-gray-400 text-white',
    icon: HelpCircle,
    label: task.status,
  };

  const StatusIcon = statusStyling.icon;

  const lastActivityText = useMemo(() => {
    if (!task.lastActivity) return null;

    const { user, action, timestamp } = task.lastActivity;

    const timeAgo = timestamp
      ? formatDistanceToNow(
          timestamp.toDate ? timestamp.toDate() : new Date(timestamp),
          { addSuffix: true }
        )
      : '';

    return `${user.name} ${action} ${timeAgo}`;
  }, [task.lastActivity]);

  const isCreatorEmployeeOrPIC = ['Employee', 'PIC', 'Client'].includes(
    task.createdBy?.role || ''
  );

  return (
    <>
      <Card
        className={cn(
          'relative w-full transition-shadow duration-200 hover:shadow-xl',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        )}
      >
        <div
          className={cn(
            'absolute bottom-0 left-0 top-0 w-1.5 rounded-l-lg',
            brandColor
          )}
        />

        <CardContent
          className="space-y-3 p-4 pl-6"
          onClick={() => router.push(`/tasks/${task.id}`)}
        >
          <div className="flex items-start justify-between">
            <div className="cursor-pointer pr-2 font-medium">
              <h3 className="font-headline break-words text-base font-semibold leading-tight">
                {task.title}
              </h3>
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
                    <PriorityIcon
                      className={cn('h-5 w-5 shrink-0', priorityColor)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{priorityInfo[task.priority]?.label || task.priority}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-2 h-6 w-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
                  {isCreatorEmployeeOrPIC && (
                    <ShareTaskDialog
                      task={task}
                      open={isShareTaskOpen}
                      onOpenChange={setIsShareTaskOpen}
                    >
                      <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Task
                      </DropdownMenuItem>
                    </ShareTaskDialog>
                  )}

                  <DropdownMenuItem onClick={() => router.push(`/tasks/${task.id}`)}>
                    View Details
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {lastActivityText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="w-full">
                  <div className="flex items-center gap-2 text-left text-xs text-muted-foreground">
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
                    {assignees.slice(0, 2).map((assignee) => {
                      const isCreatorAssignee = assignee.id === creatorId;

                      return (
                        <div key={assignee.id} className="relative">
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarImage
                              src={assignee.avatarUrl}
                              alt={assignee.name}
                            />
                            <AvatarFallback>
                              {assignee.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>

                          {isCreatorAssignee && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-500" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{assignee.name} is the task creator.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      );
                    })}

                    {assignees.length > 2 && (
                      <Avatar className="h-7 w-7 border-2 border-background">
                        <AvatarFallback>+{assignees.length - 2}</AvatarFallback>
                      </Avatar>
                    )}
                  </TooltipTrigger>

                  <TooltipContent>
                    <div className="flex flex-col gap-1 p-1">
                      <p className="text-xs font-semibold">Assigned to:</p>
                      {assignees.map((assignee) => (
                        <p key={assignee.id} className="text-sm">
                          {assignee.name}
                        </p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              {completionStatus &&
                (completionStatus.status === 'On Time' ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Completed On Time</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Badge variant="destructive" className="gap-1.5 font-normal">
                    <AlertCircle className="h-3 w-3" />
                    {completionStatus.duration} late
                  </Badge>
                ))}

              {task.subtasks && task.subtasks.length > 0 && (
                <span className="flex items-center gap-1">
                  <ListTodo className="h-3.5 w-3.5" />
                  {task.subtasks.filter((subtask) => subtask.completed).length}/
                  {task.subtasks.length}
                </span>
              )}

              {task.dueDate && !completionStatus && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(parseISO(task.dueDate), 'MMM d')}
                </Badge>
              )}

              <Badge
                variant="outline"
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium',
                  statusStyling.color
                )}
              >
                <StatusIcon className="h-3 w-3" />
                <span>{statusStyling.label}</span>
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
