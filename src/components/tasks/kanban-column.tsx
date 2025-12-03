
'use client';

import { TaskCard } from './task-card';
import type { Task, User, WorkflowStatus } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/context/i18n-provider';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useMemo } from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { useUserProfile } from '@/firebase';

interface KanbanColumnProps {
  status: WorkflowStatus;
  tasks: Task[];
}

export function KanbanColumn({
  status,
  tasks,
}: KanbanColumnProps) {
  const { profile } = useUserProfile();

  const isDropDisabled = useMemo(() => {
    if (!profile) return true;
    if (profile.role === 'Client') return true;
    return false;
  }, [profile]);


  const uniqueAssignees = useMemo(() => {
    const assignees = new Map<string, User>();
    tasks.forEach((task) => {
      task.assignees?.forEach((assignee) => {
        if (assignee && !assignees.has(assignee.id)) {
          assignees.set(assignee.id, assignee);
        }
      });
    });
    return Array.from(assignees.values());
  }, [tasks]);

  return (
    <div
      className="flex h-full w-80 shrink-0 flex-col rounded-lg bg-secondary/50"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${status.color}`}></div>
          <h2 className="font-headline font-semibold">{status.name}</h2>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {tasks.length}
          </span>
        </div>
        <div className="flex -space-x-2">
          <TooltipProvider>
            {uniqueAssignees.slice(0, 3).map((assignee) => (
              <Tooltip key={assignee.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-secondary">
                    <AvatarImage
                      src={assignee.avatarUrl}
                      alt={assignee.name}
                    />
                    <AvatarFallback>
                      {assignee.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{assignee.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          {uniqueAssignees.length > 3 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-secondary">
                    <AvatarFallback>
                      +{uniqueAssignees.length - 3}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{uniqueAssignees.length - 3} more users</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <Droppable droppableId={status.name} isDropDisabled={isDropDisabled}>
        {(provided, snapshot) => (
          <ScrollArea 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`}
          >
            <div className="flex flex-col gap-3 p-4">
              {tasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} />
              ))}
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  );
}
