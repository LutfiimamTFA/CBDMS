
'use client';

import React, { useState, useMemo, useRef } from 'react';
import { TaskCard } from './task-card';
import type { Task, User, WorkflowStatus, SharedLink } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';

interface KanbanColumnProps {
  status: WorkflowStatus;
  tasks: Task[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  canDrag: boolean;
  draggingTaskId: string | null;
  permissions?: SharedLink['permissions'] | null;
}

const getDragAfterElement = (container: HTMLElement, y: number): HTMLElement | null => {
    const draggableElements = Array.from(container.querySelectorAll('[draggable="true"]:not([data-dragging="true"])')) as HTMLElement[];

    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        },
        { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }
    ).element;
};


export function KanbanColumn({
  status,
  tasks,
  onDrop,
  onDragStart,
  onDragEnd,
  canDrag,
  draggingTaskId,
  permissions = null,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const router = useRouter();
  const columnRef = useRef<HTMLDivElement>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    e.preventDefault();
    setIsDragOver(true);

    if (columnRef.current) {
        const afterElement = getDragAfterElement(columnRef.current, e.clientY);
        if (afterElement) {
             const index = Array.from(columnRef.current.querySelectorAll('[draggable="true"]')).indexOf(afterElement);
             setDropIndicatorIndex(index);
        } else {
            setDropIndicatorIndex(tasks.length);
        }
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setDropIndicatorIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    setIsDragOver(false);
    setDropIndicatorIndex(null);
    onDrop(e, status.name);
  };
  
  const handleCardClick = (path: string) => {
    const canViewDetails = permissions ? permissions.canViewDetails : true;
    if (!canViewDetails) return;
    router.push(path);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex h-full w-80 shrink-0 flex-col rounded-lg bg-secondary/50 transition-colors",
        isDragOver && canDrag && "border-2 border-dashed border-primary bg-primary/10"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {status.name === 'Preview' ? (
              <Eye className="h-4 w-4" style={{ color: status.color }}/>
          ) : (
             <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }}></div>
          )}
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
      <ScrollArea 
        className={`flex-1`}
      >
        <div ref={columnRef} className="flex flex-col gap-3 p-4">
          {tasks.map((task, index) => {
            const isDragging = draggingTaskId === task.id;
            // The path is now constructed in the parent (KanbanBoard)
            // and passed down to TaskCard. This component doesn't need to know the context.
            return (
                <React.Fragment key={task.id}>
                    {dropIndicatorIndex === index && (
                        <div className="h-24 rounded-lg bg-primary/20 border-2 border-dashed border-primary transition-all duration-200" />
                    )}
                    <div 
                      draggable={canDrag}
                      onDragStart={(e) => onDragStart(e, task.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => handleCardClick(`/tasks/${task.id}`)}
                      className={cn(
                        "transition-opacity", 
                        isDragging && "opacity-30",
                        (permissions && !permissions.canViewDetails) ? 'cursor-default' : 'cursor-pointer'
                      )}
                      data-dragging={isDragging}
                    >
                      <TaskCard 
                          task={task} 
                          draggable={canDrag}
                      />
                    </div>
                </React.Fragment>
            );
          })}
          {dropIndicatorIndex === tasks.length && (
               <div className="h-24 rounded-lg bg-primary/20 border-2 border-dashed border-primary transition-all duration-200" />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
