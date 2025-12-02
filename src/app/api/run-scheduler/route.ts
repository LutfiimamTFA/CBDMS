
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { RecurringTaskTemplate, Task } from '@/lib/types';

// Initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Helper to check if a task should be generated today
function shouldGenerateTask(template: RecurringTaskTemplate): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const lastGenerated = template.lastGeneratedAt?.toDate();
  if (lastGenerated) {
    const lastGeneratedDate = new Date(lastGenerated.getFullYear(), lastGenerated.getMonth(), lastGenerated.getDate());
    if (lastGeneratedDate.getTime() === today.getTime()) {
      return false; // Already generated today
    }
  }

  const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' }) as any;
  
  switch (template.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return template.daysOfWeek?.includes(dayOfWeek) || false;
    case 'monthly':
      // dayOfMonth is 1-based, getDate() is 1-based
      return template.dayOfMonth === today.getDate();
    default:
      return false;
  }
}

export async function GET(request: Request) {
  // Optional: Add a secret key to prevent unauthorized runs
  // const { searchParams } = new URL(request.url);
  // if (searchParams.get('secret') !== process.env.SCHEDULER_SECRET) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const app = initializeAdminApp();
    const firestore = getFirestore(app);
    const auth = getAuth(app);

    const templatesSnapshot = await firestore.collection('recurringTaskTemplates').get();
    if (templatesSnapshot.empty) {
      return NextResponse.json({ message: 'No recurring task templates found.' }, { status: 200 });
    }

    const tasksToCreate: Omit<Task, 'id'>[] = [];
    const usersToFlag: { [userId: string]: boolean } = {};
    const templatesToUpdate: { id: string; lastGeneratedAt: Timestamp }[] = [];

    templatesSnapshot.forEach(doc => {
      const template = { id: doc.id, ...doc.data() } as RecurringTaskTemplate;
      if (shouldGenerateTask(template)) {
        
        const newTask: Omit<Task, 'id' | 'createdAt'> = {
          title: template.title,
          description: template.description || '',
          brandId: template.defaultBrandId,
          status: 'To Do', // Always start as 'To Do'
          priority: template.defaultPriority,
          assigneeIds: template.defaultAssigneeIds,
          // We can't resolve assignees object here, it will be done on client
          assignees: [], 
          companyId: template.companyId,
          isMandatory: template.isMandatory || false, // CRITICAL FIX: Ensure isMandatory is carried over
          createdBy: { id: 'system', name: 'Scheduler', avatarUrl: '' },
          // Fields from Task that are not in template
          startDate: new Date().toISOString(),
          // Optional: Add logic for due date based on creation
        };
        tasksToCreate.push(newTask);

        if (template.isMandatory) {
          template.defaultAssigneeIds.forEach(userId => {
            usersToFlag[userId] = true;
          });
        }
        
        templatesToUpdate.push({ id: template.id, lastGeneratedAt: Timestamp.now() });
      }
    });

    if (tasksToCreate.length === 0) {
      return NextResponse.json({ message: 'No tasks to generate today.' }, { status: 200 });
    }

    // Use a batch to write all changes atomically
    const batch = firestore.batch();

    // Create new tasks
    tasksToCreate.forEach(taskData => {
      const taskRef = firestore.collection('tasks').doc();
      batch.set(taskRef, { ...taskData, createdAt: Timestamp.now() });
    });

    // Update lastGeneratedAt for templates
    templatesToUpdate.forEach(update => {
      const templateRef = firestore.collection('recurringTaskTemplates').doc(update.id);
      batch.update(templateRef, { lastGeneratedAt: update.lastGeneratedAt });
    });
    
    await batch.commit();

    // Set custom claims for mandatory tasks
    for (const userId of Object.keys(usersToFlag)) {
      try {
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};
        await auth.setCustomUserClaims(userId, { ...currentClaims, mustAcknowledgeTasks: true });
      } catch (error: any) {
        console.error(`Failed to set claim for user ${userId}:`, error.message);
      }
    }

    return NextResponse.json(
      {
        message: `Successfully generated ${tasksToCreate.length} tasks and flagged ${Object.keys(usersToFlag).length} users.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in scheduler:', error);
    let errorMessage = 'An unexpected error occurred.';
     if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json(
      { message: errorMessage, error: error.message },
      { status: 500 }
    );
  }
}
