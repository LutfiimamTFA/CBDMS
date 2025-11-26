
import type { LucideIcon } from 'lucide-react';

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'Employee' | 'Client';
};

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

export type Status = 'To Do' | 'Doing' | 'Done';

export type Tag = {
  label: string;
  color: string;
};

export type TimeLog = {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // in seconds
  description?: string;
};

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Comment = {
    id: string;
    user: User;
    text: string;
    timestamp: string;
    replies: Comment[];
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
  timeEstimate?: number; // in hours
  timeTracked?: number; // in hours
  timeLogs?: TimeLog[];
  dependencies?: string[];
  subtasks?: Subtask[];
  recurring?: string;
  tags?: Tag[];
  comments?: Comment[];
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
