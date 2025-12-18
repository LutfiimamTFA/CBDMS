'use client';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedTasksView(props: SharedTasksViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
