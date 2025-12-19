
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { serviceAccount } from '@/firebase/service-account';
import type { Task, User, Activity, Notification } from '@/lib/types';

function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`,
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
    const app = initializeAdminApp();
    const db = getFirestore(app);
    const auth = getAuth(app);

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
