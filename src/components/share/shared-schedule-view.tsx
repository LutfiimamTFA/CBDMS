'use client';

import React from 'react';
import type { Task, SharedLink, WorkflowStatus, Brand, User } from '@/lib/types';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedScheduleViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedScheduleView(props: SharedScheduleViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
