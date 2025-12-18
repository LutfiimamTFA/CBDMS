
'use client';

import React from 'react';
import type { Task, SharedLink } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedHeader } from './shared-header';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { priorityInfo } from '@/lib/utils';

interface SharedSimpleTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedSimpleTasksView({ session, tasks, isLoading }: SharedSimpleTasksViewProps) {
  
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Shared Tasks" />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold">No Tasks to Display</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no tasks associated with this shared view.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{session.name}</CardTitle>
              <CardDescription>A shared view of tasks created by {session.creatorRole}.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-20rem)]">
                    <div className="space-y-3 pr-4">
                    {tasks.map((task) => {
                        const priority = priorityInfo[task.priority];
                        return (
                        <div key={task.id} className="p-3 border rounded-lg flex items-center justify-between gap-4">
                            <div className="flex-1 truncate">
                            <p className="font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{task.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <Badge variant="outline" className="font-normal w-24 justify-center">
                                    <priority.icon className={`h-4 w-4 mr-2 ${priority.color}`} />
                                    <span>{priority.label}</span>
                                </Badge>
                                <Badge variant="secondary" className="w-28 justify-center">{task.status}</Badge>
                            </div>
                        </div>
                        );
                    })}
                    </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
