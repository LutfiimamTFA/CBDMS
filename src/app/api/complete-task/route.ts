
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { Task, Notification, Activity, User } from '@/lib/types';

// Initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const firestore = getFirestore(app);
    const { taskId, userId } = await request.json();

    if (!taskId || !userId) {
      return NextResponse.json({ message: 'Task ID and User ID are required.' }, { status: 400 });
    }

    const taskRef = firestore.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ message: 'Task not found.' }, { status: 404 });
    }

    const taskData = taskDoc.data() as Task;

    // Security check: ensure user is an assignee
    if (!taskData.assigneeIds.includes(userId)) {
        return NextResponse.json({ message: 'User is not assigned to this task.'}, { status: 403 });
    }

    // Security check: ensure task is not already done
    if (taskData.status === 'Done') {
        return NextResponse.json({ message: 'Task is already completed.' }, { status: 400 });
    }

    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
        return NextResponse.json({ message: 'Completing user not found.' }, { status: 404 });
    }
    const currentUser = userDoc.data() as User;


    const batch = firestore.batch();
    const completionDate = new Date();
    const isLate = taskData.dueDate
      ? completionDate > new Date(taskData.dueDate)
      : false;

    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl || '',
      },
      action: `completed the task ${isLate ? '(Late)' : '(On Time)'}`,
      timestamp: Timestamp.fromDate(completionDate),
    };

    const updatedActivities = [...(taskData.activities || []), newActivity];

    const updateData: any = {
      status: 'Done',
      actualCompletionDate: completionDate.toISOString(),
      lastActivity: newActivity,
      activities: updatedActivities,
    };
    
    batch.update(taskRef, updateData);

    // CRITICAL FIX: Notify creator only if they exist and are not the one completing the task.
    if (taskData.createdBy?.id && currentUser.id !== taskData.createdBy.id) {
      const managerNotifRef = firestore.collection('users').doc(taskData.createdBy.id).collection('notifications').doc();
      const notifMessage = `${currentUser.name} has completed the task: "${taskData.title}".`;
      const notifTitle = isLate
        ? `Task Completed (Late)`
        : `Task Completed (On Time)`;

      const managerNotification: Omit<Notification, 'id'> = {
        userId: taskData.createdBy.id,
        title: notifTitle,
        message: notifMessage,
        taskId: taskData.id,
        taskTitle: taskData.title,
        isRead: false,
        createdAt: Timestamp.now(),
        createdBy: {
          id: currentUser.id,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl || '',
        },
      };
      batch.set(managerNotifRef, managerNotification);
    }
    
    await batch.commit();

    return NextResponse.json({ message: 'Task completed successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error in complete-task function:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
        errorMessage = 'Firebase Admin SDK initialization failed.';
    }
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: 500 });
  }
}
