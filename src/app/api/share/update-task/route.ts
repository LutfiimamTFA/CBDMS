

import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { SharedLink, Task, User, Activity, Notification } from '@/lib/types';

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

export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const db = getFirestore(app);

    const { linkId, taskId, updates } = await request.json();

    if (!linkId || !taskId || !updates) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    const linkRef = db.collection('sharedLinks').doc(linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) {
      return NextResponse.json({ message: 'Share link not found.' }, { status: 404 });
    }

    const sharedLink = linkSnap.data() as SharedLink;

    // --- Permission Validation ---
    const allowedUpdates: Record<string, string[]> = {
      'view': [],
      'status': ['status'],
      'limited-edit': ['status', 'dueDate', 'priority', 'revisionItems'],
    };

    const requestedUpdateKeys = Object.keys(updates);
    const permittedFields = allowedUpdates[sharedLink.accessLevel] || [];

    const isUpdateAllowed = requestedUpdateKeys.every(key => permittedFields.includes(key));

    if (!isUpdateAllowed) {
      return NextResponse.json({ message: 'You do not have permission to perform this update.' }, { status: 403 });
    }

    // --- Update Logic ---
    const taskRef = db.collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
        return NextResponse.json({ message: 'Task not found.' }, { status: 404 });
    }
    const oldTask = taskSnap.data() as Task;
    
    const creatorRef = db.collection('users').doc(sharedLink.createdBy);
    const creatorSnap = await creatorRef.get();
    if (!creatorSnap.exists()) {
        return NextResponse.json({ message: 'Link creator not found.' }, { status: 404 });
    }
    const creator = creatorSnap.data() as User;

    const finalUpdates: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    const batch = db.batch();
    
    let actionDescription: string | null = null;
    if (updates.status && updates.status !== oldTask.status) {
        actionDescription = `changed status from "${oldTask.status}" to "${updates.status}" via share link`;
    }
    
    if (actionDescription) {
        const newActivity = createActivity(creator, actionDescription);
        finalUpdates.lastActivity = newActivity;
        finalUpdates.activities = [...(oldTask.activities || []), newActivity];

        const notificationTitle = `Status Changed: ${oldTask.title}`;
        const notificationMessage = `${creator.name} (via share link) changed status to ${updates.status}.`;
        
        const notifiedUserIds = new Set<string>();
        oldTask.assigneeIds.forEach(assigneeId => {
            if (assigneeId !== creator.id) notifiedUserIds.add(assigneeId);
        });
        if (oldTask.createdBy.id !== creator.id) notifiedUserIds.add(oldTask.createdBy.id);

        notifiedUserIds.forEach(userId => {
            const notifRef = db.collection(`users/${userId}/notifications`).doc();
            const newNotification: Omit<Notification, 'id'> = {
                userId, title: notificationTitle, message: notificationMessage, taskId: oldTask.id, isRead: false,
                createdAt: Timestamp.now() as any, createdBy: newActivity.user,
            };
            batch.set(notifRef, newNotification);
        });
    }

    batch.update(taskRef, finalUpdates);
    await batch.commit();

    return NextResponse.json({ message: 'Task updated successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating shared task:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}
