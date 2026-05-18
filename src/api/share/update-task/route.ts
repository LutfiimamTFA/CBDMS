
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

    const { linkId, taskId, updates, revisionItems, newComment } = await request.json();

    if (!linkId || !taskId) {
      return NextResponse.json({ message: 'Missing required fields linkId or taskId.' }, { status: 400 });
    }

    const linkRef = db.collection('sharedLinks').doc(linkId);
    const taskRef = db.collection('tasks').doc(taskId);

    let finalUpdatedTask: Task | null = null;

    await db.runTransaction(async (transaction) => {
        const linkSnap = await transaction.get(linkRef);
        const taskSnap = await transaction.get(taskRef);

        if (!linkSnap.exists) throw new Error('Share link not found.');
        if (!taskSnap.exists) throw new Error('Task not found.');

        const sharedLink = linkSnap.data() as SharedLink;
        const initialTask = taskSnap.data() as Task;
        const sharedActor = createSharedActor(sharedLink);
        
        const creatorIsEmployee = sharedLink.creatorRole === 'Employee' || sharedLink.creatorRole === 'PIC';
        const taskIsFromManager = initialTask.createdBy.id !== sharedLink.creatorId;

        // Determine which fields can be updated based on access level and context.
        const permittedFieldsBase = {
            'view': [],
            'status': ['status'],
            'limited-edit': ['status', 'dueDate', 'priority'],
        }[sharedLink.accessLevel] || [];
        
        // If the link creator is an Employee AND they are sharing a task created by a Manager,
        // we downgrade their 'limited-edit' permission to just 'status' for this specific task.
        const finalPermittedFields = (creatorIsEmployee && taskIsFromManager && sharedLink.accessLevel === 'limited-edit')
            ? ['status'] 
            : permittedFieldsBase;

        if (updates) {
            const requestedUpdateKeys = Object.keys(updates);
            if (!requestedUpdateKeys.every(key => finalPermittedFields.includes(key))) {
                return Promise.reject(new Error(`Forbidden: Your access level is "${sharedLink.accessLevel}", but permissions are restricted for this specific task. You cannot update: ${requestedUpdateKeys.join(', ')}`));
            }
        }
        
        const finalUpdates: any = { ...(updates || {}), updatedAt: Timestamp.now() };

        let actionDescription: string | null = null;
        let notificationTitle: string = `Update on: ${initialTask.title}`;
        let notificationMessage: string = `${sharedActor.name} made changes to a task.`;

        // Handle Status Change
        if (updates?.status && updates.status !== initialTask.status) {
            const newStatus = updates.status;

            // --- CRITICAL SECURITY CHECK ---
            // If the link creator is an employee, block them from setting status to Done or Revisi.
            if (creatorIsEmployee && (newStatus === 'Done' || newStatus === 'Revisi')) {
                return Promise.reject(new Error(`Forbidden: Your role does not allow changing the status to '${newStatus}'.`));
            }

            const allowedStatuses = sharedLink.snapshot.statuses?.map(s => s.name) || [];
            if (!allowedStatuses.includes(newStatus)) {
                return Promise.reject(new Error(`Forbidden: Status "${newStatus}" is not allowed for this shared link.`));
            }
            actionDescription = `changed status from "${initialTask.status}" to "${newStatus}"`;
            notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName}) changed status to ${newStatus}.`;
            notificationTitle = `Status Changed: ${initialTask.title}`;
        }

        // Handle Revision Request
        if (revisionItems && Array.isArray(revisionItems) && revisionItems.length > 0) {
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
        
        // Handle new comment
        if (newComment?.text) {
          const commentObject = {
              id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              user: { id: sharedActor.id, name: sharedActor.name, avatarUrl: '' },
              text: newComment.text,
              timestamp: Timestamp.now(),
              replies: [],
          };
          finalUpdates.comments = [...(initialTask.comments || []), commentObject];
          actionDescription = 'left a comment';
          notificationTitle = `New Comment on: ${initialTask.title}`;
          notificationMessage = `${sharedActor.name} (via link by ${sharedLink.creatorName}) commented: "${newComment.text.substring(0, 50)}..."`;
        }

        // --- Due Date & Priority Change Validation based on Creator's Role ---
        if (updates.dueDate || updates.priority) {
            const creatorIsManagerOrAdmin = sharedLink.creatorRole === 'Manager' || sharedLink.creatorRole === 'Super Admin';
            const creatorIsTaskOwner = sharedLink.createdBy === initialTask.createdBy.id;
            
            // Allow if creator is Manager/Admin OR if creator is the owner of the task (for Employee-created tasks)
            if (!creatorIsManagerOrAdmin && !creatorIsTaskOwner) {
                throw new Error("The link creator does not have permission to change the due date or priority for this task.");
            }
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
        
        finalUpdatedTask = { ...initialTask, ...finalUpdates };

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

    return NextResponse.json({ message: 'Task updated successfully.', updatedTask: finalUpdatedTask }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating shared task:', error);
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
