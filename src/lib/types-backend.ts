
// This file is intended for server-side type definitions only.
// Do not import this file in any client-side components.
// It exists to prevent circular dependencies between server and client modules.

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

export type Task = {
  id: string;
  title: string;
  assigneeIds: string[];
  status: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  activities?: Activity[];
  [key: string]: any;
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
  postType?: 'Post' | 'Reels';
};

export type SocialMediaConnection = {
    id: string;
    platform: 'instagram';
    userId: string;
    companyId: string;
    instagramUserId: string;
    instagramUsername: string;
    accessToken: string;
    expiresIn: number;
    connectedAt: any;
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
  defaultPriority: 'Urgent' | 'High' | 'Medium' | 'Low';
  defaultBrandId: string;
  companyId: string;
  lastGeneratedAt?: any; // Can be Firestore Timestamp
  createdAt: any; // Can be Firestore Timestamp
};

export type SharedLink = {
  id: string;
  name: string;
  companyId: string;
  creatorRole: User['role'];
  [key: string]: any; // Allow other properties
};
