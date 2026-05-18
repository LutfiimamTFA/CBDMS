
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import type { Task, User, Activity, Notification } from '@/lib/types-backend';

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: Timestamp.now() as any,
  };
};

// This API is called fire-and-forget from the client after a successful
// status update in a shared view. It logs the activity and sends notifications
// under the identity of the user who created the share link.
export async function POST(request: Request) {
  try {
    const db = adminDb;
    const auth = adminAuth;

    const { taskId, actionText, linkCreatorId } = await request.json();

    if (!taskId || !actionText || !linkCreatorId) {
      return NextResponse.json({ message: 'Missing required fields: taskId, actionText, linkCreatorId' }, { status: 400 });
    }

    const [taskSnap, creatorSnap] = await Promise.all([
      db.collection('tasks').doc(taskId).get(),
      db.collection('users').doc(linkCreatorId).get()
    ]);

    if (!taskSnap.exists) {
      return NextResponse.json({ message: 'Task not found.' }, { status: 404 });
    }
     if (!creatorSnap.exists()) {
      return NextResponse.json({ message: 'Link creator not found.' }, { status: 404 });
    }

    const task = taskSnap.data() as Task;
    const linkCreator = creatorSnap.data() as User;
    
    const batch = db.batch();
    const taskRef = taskSnap.ref;

    const newActivity = createActivity(linkCreator, actionText);
    const currentActivities = Array.isArray(task.activities) ? task.activities : [];
    
    batch.update(taskRef, {
        activities: [...currentActivities, newActivity],
        lastActivity: newActivity,
    });

    const notificationTitle = `Status Changed: ${task.title}`;
    const notificationMessage = `A guest ${actionText}.`;

    task.assigneeIds.forEach(assigneeId => {
      const notifRef = db.collection(`users/${assigneeId}/notifications`).doc();
      const newNotification: Omit<Notification, 'id'> = {
        userId: assigneeId,
        title: notificationTitle,
        message: notificationMessage,
        taskId: task.id,
        isRead: false,
        createdAt: Timestamp.now() as any,
        createdBy: newActivity.user,
      };
      batch.set(notifRef, newNotification);
    });

    await batch.commit();

    return NextResponse.json({ message: 'Activity logged and notifications sent.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}
