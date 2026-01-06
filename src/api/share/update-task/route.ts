
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SharedLink, Task, User, Activity, Notification, Comment } from '@/lib/types-backend';

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

    const { linkId, taskId, updates, newComment } = await request.json();

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
        
        const permittedFields = {
            'view': [],
            'status': ['status'],
            'limited-edit': ['status', 'dueDate', 'priority'],
        }[sharedLink.accessLevel] || [];

        if (updates) {
            const requestedUpdateKeys = Object.keys(updates);
            if (!requestedUpdateKeys.every(key => permittedFields.includes(key))) {
                throw new Error(`Forbidden: Your access level is "${sharedLink.accessLevel}". You cannot update these fields.`);
            }
        }
        
        const finalUpdates: any = { ...(updates || {}), updatedAt: Timestamp.now() };

        let actionDescription: string | null = null;
        let notificationTitle: string = `Update on: ${initialTask.title}`;
        let notificationMessage: string = `${sharedActor.name} made changes to a task.`;

        // Handle Status Change
        if (updates?.status && updates.status !== initialTask.status) {
            const allowedStatuses = sharedLink.snapshot.statuses?.map(s => s.name) || [];
            if (!allowedStatuses.includes(updates.status)) {
                throw new Error(`Forbidden: Status "${updates.status}" is not allowed for this shared link.`);
            }
            actionDescription = `changed status from "${initialTask.status}" to "${updates.status}"`;
            notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName || 'Unknown'}) changed status to ${updates.status}.`;
        }

        // Handle New Comment / Revision Request
        if (newComment && newComment.text?.trim()) {
            const newCommentObject: Comment = {
                id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                user: sharedActor,
                text: newComment.text,
                timestamp: Timestamp.now(),
                replies: [],
                ...(newComment.attachment && { attachment: newComment.attachment }),
            };
            const currentComments = Array.isArray(initialTask.comments) ? initialTask.comments : [];
            finalUpdates.comments = [...currentComments, newCommentObject];

            if (newComment.isRevisionRequest) {
                finalUpdates.status = 'Revisi';
                actionDescription = `requested revisions via comment`;
                notificationTitle = 'Revisions Requested';
                notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName || 'Unknown'}) requested revisions on "${initialTask.title}".`;
            } else {
                 actionDescription = `commented on the task`;
                 notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName || 'Unknown'}) commented on "${initialTask.title}".`;
            }
        }


        if (actionDescription) {
            const newActivity = createActivity(sharedActor, actionDescription, sharedLink.creatorName || 'Unknown');
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
            const notifiedUserIds = new Set<string>(initialTask.assigneeIds || []);
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
