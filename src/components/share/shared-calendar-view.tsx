'use client';

import React from 'react';
import type { Task, SharedLink, WorkflowStatus, Brand, User } from '@/lib/types';
import { SharedHeader } from './shared-header';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedCalendarViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedCalendarView(props: SharedCalendarViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
