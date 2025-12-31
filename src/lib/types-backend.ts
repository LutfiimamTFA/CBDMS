// This file is intended for server-side type definitions only.
// Do not import this file in any client-side components.
// It exists to prevent circular dependencies between server and client modules.
import { FirebaseFirestore } from 'firebase-admin/firestore';

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
  timestamp: FirebaseFirestore.Timestamp;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  taskId: string;
  isRead: boolean;
  createdAt: FirebaseFirestore.Timestamp;
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
  status: 'Draft' | 'Needs Approval' | 'Scheduled' | 'Publishing' | 'Posted' | 'Error';
  scheduledAt: string;
  postedAt?: FirebaseFirestore.Timestamp;
  createdBy: string;
  companyId: string;
  postType?: 'Post' | 'Reels';
  errorDetails?: string;
};

export type SocialMediaConnection = {
    platform: 'instagram';
    userId: string; // Firebase UID of user who set up/updated
    companyId: string;
    instagramUserId: string;
    instagramUsername: string;
    accessToken: string;
    expiresAt: FirebaseFirestore.Timestamp;
    connectedAt: FirebaseFirestore.Timestamp;
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
  lastGeneratedAt?: FirebaseFirestore.Timestamp; // Can be Firestore Timestamp
  createdAt: FirebaseFirestore.Timestamp; // Can be Firestore Timestamp
};

export type SharedLink = {
  id: string;
  name: string;
  companyId: string;
  creatorRole: User['role'];
  [key: string]: any; // Allow other properties
};

export type SystemSettings = {
    socialMedia?: {
        instagramAppId: string;
        instagramAppSecret: string;
    }
}

export type Brand = any;
export type WorkflowStatus = any;
export type SharedTask = any;
