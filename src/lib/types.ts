import type { LucideIcon } from 'lucide-react';

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  email: string;
};

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

export type Status = 'To Do' | 'Doing' | 'Done';

export type Tag = {
  label: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignees: User[];
  startDate?: string;
  dueDate?: string;
  timeEstimate?: number;
  timeTracked?: number; 
  dependencies?: string[];
  subtasks?: Partial<Task>[];
  recurring?: string;
  tags?: Tag[];
};

export type PriorityInfo = {
  label: Priority;
  value: Priority;
  icon: LucideIcon;
  color: string;
};

export type StatusInfo = {
  label: Status;
  value: Status;
  icon: LucideIcon;
};
