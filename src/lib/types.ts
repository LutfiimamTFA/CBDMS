'use client';
import type { LucideIcon } from 'lucide-react';
import type { jsPDF } from 'jspdf';

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'Employee' | 'Client';
  createdAt?: string;
  companyId: string;
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

export type Attachment = {
  id: string;
  name: string;
  type: 'local' | 'gdrive';
  url: string; 
};


export type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignees: User[];
  assigneeIds: string[];
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
  attachments?: Attachment[];
  createdAt: any;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  companyId: string;
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

export type PermissionSettings = {
  Manager: {
    // Action Permissions
    canManageUsers: boolean;
    canDeleteUsers: boolean;
    canCreateTasks: boolean;
    canDeleteTasks: boolean;
    canViewReports: boolean;
  };
  Employee: {
    // Action Permissions
    canCreateTasks: boolean;
    canChangeTaskStatus: boolean;
    canTrackTime: boolean;
    canCreateDailyReports: boolean;
  };
  Client: {
    // Action Permissions
    canViewAssignedTasks: boolean;
    canCommentOnTasks: boolean;
    canApproveContent: true,
  };
};

export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: string;
  order: number;
  roles: ('Super Admin' | 'Manager' | 'Employee' | 'Client')[];
}

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  taskId: string;
  taskTitle: string;
  isRead: boolean;
  createdAt: any;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};
