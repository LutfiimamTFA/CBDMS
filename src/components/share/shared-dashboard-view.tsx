'use client';
import type { Task, SharedLink, WorkflowStatus, Brand, User } from '@/lib/types';
import { SharedSimpleTasksView } from './shared-simple-tasks-view';

interface SharedDashboardViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedDashboardView(props: SharedDashboardViewProps) {
  return <SharedSimpleTasksView {...props} />;
}
