

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
        name: `Guest via ${session.name}`,
        avatarUrl: '', // No avatar for guests
        email: '',
        role: 'Client', // Treat guests as clients for simplicity
        companyId: session.companyId,
    };
};

const createActivity = (actor: User, action: string, sharedBy: { id: string, role: string }): Activity => {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    user: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl || '' },
    action: `${action} (shared by ${sharedBy.id} - ${sharedBy.role})`,
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
        const initialTask = taskSnap.data() as Task;
        const sharedActor = createSharedActor(sharedLink);

        // --- Permission Validation based on creator's role at time of link creation ---
        const allowedUpdates: Record<string, string[]> = {
            'view': [],
            'status': ['status'],
            'limited-edit': ['status', 'dueDate', 'priority', 'revisionItems'],
        };
        const permittedFields = allowedUpdates[sharedLink.accessLevel] || [];
        const requestedUpdateKeys = Object.keys(updates);
        const isUpdateAllowed = requestedUpdateKeys.every(key => permittedFields.includes(key));
        
        if (!isUpdateAllowed) {
            return Promise.reject(new Error(`Forbidden: Your access level is "${sharedLink.accessLevel}". You cannot update these fields.`));
        }

        // --- Workflow Status Identity Locking ---
        if (updates.status) {
            // Determine allowed statuses based on the creator's role, not the task owner's.
            const creatorIsPrivileged = sharedLink.creatorRole === 'Super Admin' || sharedLink.creatorRole === 'Manager';
            const allowedStatuses = creatorIsPrivileged
                ? sharedLink.snapshot.statuses?.map(s => s.name) || []
                : ['To Do', 'Doing', 'Preview'];
            
            if (!allowedStatuses.includes(updates.status)) {
                return Promise.reject(new Error(`Forbidden: Status "${updates.status}" is not allowed for this shared link.`));
            }
        }

        const serverTimestamp = Timestamp.now();

        // --- Prepare Updates for the Original Task Document ---
        const finalUpdates: any = {
            ...updates,
            updatedAt: serverTimestamp,
        };

        let actionDescription: string | null = null;
        if (updates.status && updates.status !== initialTask.status) {
            actionDescription = `changed status from "${initialTask.status}" to "${updates.status}"`;
            const newActivity = createActivity(sharedActor, actionDescription, { id: sharedLink.createdBy, role: sharedLink.creatorRole });
            const currentActivities = Array.isArray(initialTask.activities) ? initialTask.activities : [];
            finalUpdates.activities = [...currentActivities, newActivity];
            finalUpdates.lastActivity = newActivity;
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
            const notificationTitle = `Status Changed: ${initialTask.title}`;
            const notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorRole}) changed status to ${updates.status}.`;
            
            const notifiedUserIds = new Set<string>(initialTask.assigneeIds);
            notifiedUserIds.add(sharedLink.createdBy); // Also notify the person who created the link
             
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
