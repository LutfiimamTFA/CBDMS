

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

// This is a simplified "guest" user object for logging activities from a shared link.
const createSharedActor = (session: SharedLink): User => {
    return {
        id: 'guest',
        name: `Guest (${session.name})`,
        avatarUrl: '', // No avatar for guests
        email: '',
        role: 'Client', // Treat guests as clients for simplicity
        companyId: session.companyId,
    };
};

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
    const taskRef = db.collection('tasks').doc(taskId);

    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        const taskSnap = await transaction.get(taskRef);

        if (!linkSnap.exists) {
            throw new Error('Share link not found.');
        }
        if (!taskSnap.exists) {
            throw new Error('Task not found.');
        }

        const sharedLink = linkSnap.data() as SharedLink;
        const oldTask = taskSnap.data() as Task;
        const sharedActor = createSharedActor(sharedLink);

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
            throw new Error('You do not have permission to perform this update.');
        }

        // --- Workflow Status Identity Locking ---
        if (updates.status) {
            const snapshotStatuses = sharedLink.snapshot.statuses?.map(s => s.name) || [];
            if (!snapshotStatuses.includes(updates.status)) {
                throw new Error(`Invalid status "${updates.status}" for this shared link.`);
            }
        }

        const serverTimestamp = Timestamp.now();

        // --- Prepare Updates for the Original Task Document ---
        const finalUpdates: any = {
            ...updates,
            updatedAt: serverTimestamp,
        };

        let actionDescription: string | null = null;
        if (updates.status && updates.status !== oldTask.status) {
            actionDescription = `changed status from "${oldTask.status}" to "${updates.status}" via share link`;
            const newActivity = createActivity(sharedActor, actionDescription);
            finalUpdates.lastActivity = newActivity;
            finalUpdates.activities = [...(oldTask.activities || []), newActivity];
        }

        // 1. Update the original task document
        transaction.update(taskRef, finalUpdates);

        // 2. Update the snapshot within the sharedLink document
        const snapshotTasks = sharedLink.snapshot.tasks || [];
        const updatedSnapshotTasks = snapshotTasks.map(task => 
            task.id === taskId ? { ...task, ...updates, updatedAt: serverTimestamp.toDate().toISOString() } : task
        );
        transaction.update(linkRef, { 'snapshot.tasks': updatedSnapshotTasks });

        // --- Handle Notifications ---
        if (actionDescription) {
            const notificationTitle = `Status Changed: ${oldTask.title}`;
            const notificationMessage = `${sharedActor.name} changed status to ${updates.status}.`;
            
            const notifiedUserIds = new Set<string>(oldTask.assigneeIds);
             
            notifiedUserIds.forEach(userId => {
                const notifRef = db.collection(`users/${userId}/notifications`).doc();
                const newNotification: Omit<Notification, 'id'> = {
                    userId, title: notificationTitle, message: notificationMessage, taskId: taskId, isRead: false,
                    createdAt: serverTimestamp,
                    createdBy: {
                        id: sharedActor.id,
                        name: sharedActor.name,
                        avatarUrl: sharedActor.avatarUrl || '',
                    },
                };
                transaction.set(notifRef, newNotification);
            });
        }
    });

    return NextResponse.json({ message: 'Task updated successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating shared task:', error);
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
