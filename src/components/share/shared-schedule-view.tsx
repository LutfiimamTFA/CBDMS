'use client';

import React from 'react';
import type { Task, SharedLink } from '@/lib/types';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedScheduleViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedScheduleView(props: SharedScheduleViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
