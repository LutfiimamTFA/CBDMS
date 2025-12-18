
'use client';
import type { LucideIcon } from 'lucide-react';

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'PIC' | 'Employee' | 'Client';
  createdAt?: string;
  companyId: string;
  managerId?: string;
  brandIds?: string[];
};

export type Company = {
    id: string;
    name: string;
    logoUrl?: string;
};

export type CompanySettings = {
    id: string;
    emergencyAdminUserId?: string | null;
}

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

export type Status = string;

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
  assignee?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

export type Comment = {
    id: string;
    user: User;
    text: string;
    timestamp: string;
    replies: Comment[];
    attachment?: {
      name: string;
      url: string;
    };
};

export type Attachment = {
  id: string;
  name: string;
  type: 'local' | 'gdrive';
  url: string; 
};

export type WorkflowStatus = {
  id: string;
  name: string;
  order: number;
  color: string; // e.g., '#3b82f6'
  companyId: string;
};

export type Brand = {
  id: string;
  name: string;
  createdAt: any;
};

export type Activity = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  action: string;
  timestamp: any;
};

export type RecurringTaskTemplate = {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  dayOfMonth?: number;
  isMandatory?: boolean;
  defaultAssigneeIds: string[];
  defaultPriority: Priority;
  defaultBrandId: string;
  companyId: string;
  lastGeneratedAt?: any;
  createdAt: any;
};

export type DailyReport = {
  id: string;
  userId: string;
  userName: string;
  templateId: string;
  date: any; // Firestore Timestamp
  isCompleted: boolean;
  completedAt: any; // Firestore Timestamp
  companyId: string;
};

export type SharedLink = {
  id: string;
  name: string;
  companyId: string;
  creatorRole: User['role'];
  brandIds?: string[];
  allowedNavItems: string[];
  password?: string;
  expiresAt?: any;
  permissions: {
    canViewDetails: boolean;
    canComment: boolean;
    canChangeStatus: boolean;
    canEditContent: boolean;
    canAssignUsers: boolean;
  };
  createdBy: string;
  createdAt: any;
};


export type RevisionItem = {
    id: string;
    text: string;
    completed: boolean;
}

export type RevisionCycle = {
    cycleNumber: number;
    requestedAt: any; // Timestamp
    requestedBy: {
        id: string;
        name: string;
        avatarUrl: string;
    };
    items: RevisionItem[];
}

export type Task = {
  id: string;
  title: string;
  brandId: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignees: User[];
  assigneeIds: string[];
  startDate?: string;
  dueDate?: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  currentSessionStartTime?: string; 
  isUnderRevision?: boolean; 
  timeEstimate?: number; 
  timeTracked?: number;
  timeLogs?: TimeLog[];
  dependencies?: string[];
  subtasks?: Subtask[];
  revisionItems?: RevisionItem[];
  revisionHistory?: RevisionCycle[];
  recurring?: string;
  isMandatory?: boolean;
  tags?: Tag[];
  comments?: Comment[];
  attachments?: Attachment[];
  activities?: Activity[];
  lastActivity?: Activity | null;
  createdAt: any;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  companyId: string;
};

export type SocialMediaPost = {
  id: string;
  platform: string;
  caption: string;
  mediaUrl?: string;
  status: 'Draft' | 'Needs Approval' | 'Scheduled' | 'Posted' | 'Error';
  scheduledAt: string;
  postedAt?: string;
  createdBy: string;
  companyId: string;
  comments?: Comment[];
  brandId?: string;
  creator?: {
    name: string;
    avatarUrl: string;
  };
  postType?: 'Post' | 'Reels';
  objectPosition?: number;
  revisionItems?: RevisionItem[];
  revisionHistory?: RevisionCycle[];
};


export type PriorityInfo = {
  label: Priority;
  value: Priority;
  icon: LucideIcon;
  color: string;
};

export type StatusInfo = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export type PermissionSettings = {
  Manager: {
    canManageUsers: boolean;
    canDeleteUsers: boolean;
    canCreateTasks: boolean;
    canDeleteTasks: boolean;
    canViewReports: boolean;
  };
  Employee: {
    canCreateTasks: boolean;
    canChangeTaskStatus: boolean;
    canTrackTime: boolean;
    canCreateDailyReports: boolean;
  };
  Client: {
    canViewAssignedTasks: boolean;
    canCommentOnTasks: boolean;
    canApproveContent: true;
  };
};

export type NavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: string;
  order: number;
  roles: ('Super Admin' | 'Manager' | 'PIC' | 'Employee' | 'Client')[];
  parentId: string | null;
}

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  taskId: string;
  isRead: boolean;
  createdAt: any;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};
