'use client';
import type { Task, SharedLink } from '@/lib/types';
import { SharedHeader } from './shared-header';
import { Loader2 } from 'lucide-react';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedDashboardViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedDashboardView(props: SharedDashboardViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
