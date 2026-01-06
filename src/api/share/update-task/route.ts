
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SharedLink, Task, User, Activity, Notification, RevisionItem } from '@/lib/types-backend';

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

const createActivity = (actor: User, action: string, creatorName: string): Activity => {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    user: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl || '' },
    action: `${action} (via link by ${creatorName})`,
    timestamp: Timestamp.now(),
  };
};

export async function POST(request: Request) {
  try {
    const db = adminDb;

    const { linkId, taskId, updates, revisionItems } = await request.json();

    if (!linkId || !taskId) {
      return NextResponse.json({ message: 'Missing required fields linkId or taskId.' }, { status: 400 });
    }

    const linkRef = db.collection('sharedLinks').doc(linkId);
    const taskRef = db.collection('tasks').doc(taskId);

    await db.runTransaction(async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        const taskSnap = await transaction.get(taskRef);

        if (!linkSnap.exists) throw new Error('Share link not found.');
        if (!taskSnap.exists) throw new Error('Task not found.');

        const sharedLink = linkSnap.data() as SharedLink;
        const initialTask = taskSnap.data() as Task;
        const sharedActor = createSharedActor(sharedLink);
        
        // --- Enhanced Permission Validation ---
        const creatorIsEmployee = sharedLink.creatorRole === 'Employee' || sharedLink.creatorRole === 'PIC';
        const taskIsFromManager = initialTask.createdBy.id !== sharedLink.creatorId;

        const permittedFieldsBase = {
            'view': [],
            'status': ['status'],
            'limited-edit': ['status', 'dueDate', 'priority'],
        }[sharedLink.accessLevel] || [];
        
        // If an employee shares a manager's task, downgrade permissions for this specific update.
        const finalPermittedFields = (creatorIsEmployee && taskIsFromManager && sharedLink.accessLevel === 'limited-edit')
            ? ['status'] 
            : permittedFieldsBase;


        if (updates) {
            const requestedUpdateKeys = Object.keys(updates);
            if (!requestedUpdateKeys.every(key => finalPermittedFields.includes(key))) {
                return Promise.reject(new Error(`Forbidden: Your access level is "${sharedLink.accessLevel}", but permissions are restricted for this specific task.`));
            }
        }
        
        const finalUpdates: any = { ...(updates || {}), updatedAt: Timestamp.now() };

        let actionDescription: string | null = null;
        let notificationTitle: string = `Update on: ${initialTask.title}`;
        let notificationMessage: string = `${sharedActor.name} made changes to a task.`;

        // Handle Status Change
        if (updates?.status && updates.status !== initialTask.status) {
            const allowedStatusesByRole = creatorIsEmployee 
                ? sharedLink.snapshot.statuses?.map(s => s.name).filter(name => name !== 'Done' && name !== 'Revisi') || []
                : sharedLink.snapshot.statuses?.map(s => s.name) || [];

            if (!allowedStatusesByRole.includes(updates.status)) {
                return Promise.reject(new Error(`Forbidden: Status "${updates.status}" is not allowed for your role.`));
            }
            actionDescription = `changed status from "${initialTask.status}" to "${updates.status}"`;
            notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName}) changed status to ${updates.status}.`;
        }

        // Handle Revision Request
        if (revisionItems && Array.isArray(revisionItems) && revisionItems.length > 0) {
            // Employee-created links cannot request revisions.
            if (creatorIsEmployee) {
                return Promise.reject(new Error(`Forbidden: You cannot request revisions via this link.`));
            }

            finalUpdates.status = 'Revisi';
            finalUpdates.revisionItems = revisionItems.map((item: any) => ({
                id: `rev-${crypto.randomUUID()}`,
                text: item.text,
                completed: false,
            }));
            actionDescription = `requested revisions`;
            notificationTitle = 'Revisions Requested';
            notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName}) requested revisions on "${initialTask.title}".`;
        }

        if (actionDescription) {
            const newActivity = createActivity(sharedActor, actionDescription, sharedLink.creatorName);
            const currentActivities = Array.isArray(initialTask.activities) ? initialTask.activities : [];
            finalUpdates.activities = [...currentActivities, newActivity];
            finalUpdates.lastActivity = newActivity;
        }

        transaction.update(taskRef, finalUpdates);
        
        const snapshotTasks = sharedLink.snapshot.tasks || [];
        const updatedSnapshotTasks = snapshotTasks.map(task => 
            task.id === taskId ? { ...task, ...finalUpdates, updatedAt: Timestamp.now().toDate().toISOString() } : task
        );
        transaction.update(linkRef, { 'snapshot.tasks': updatedSnapshotTasks });

        if (actionDescription) {
            const notifiedUserIds = new Set<string>(initialTask.assigneeIds);
            if (sharedLink.creatorId) {
                notifiedUserIds.add(sharedLink.creatorId);
            }

            notifiedUserIds.forEach(userId => {
                if (!userId) return;
                const notifRef = db.collection(`users/${userId}/notifications`).doc();
                const newNotification: Omit<Notification, 'id'> = {
                    userId,
                    title: notificationTitle,
                    message: notificationMessage,
                    taskId: taskId,
                    isRead: false,
                    createdAt: Timestamp.now(),
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
