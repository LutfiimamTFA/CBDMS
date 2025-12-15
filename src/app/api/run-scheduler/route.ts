
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { RecurringTaskTemplate, Task, SocialMediaPost } from '@/lib/types';

// Initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Helper to check if a recurring task should be generated today
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

async function runSocialMediaPoster(firestore: FirebaseFirestore.Firestore) {
    const now = new Date().toISOString();
    const postsToPublishSnapshot = await firestore
      .collection('socialMediaPosts')
      .where('status', '==', 'Scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    if (postsToPublishSnapshot.empty) {
      return 0; // No posts published
    }

    const batch = firestore.batch();
    let postsPublishedCount = 0;

    postsToPublishSnapshot.forEach(doc => {
      const postRef = doc.ref;
      batch.update(postRef, {
        status: 'Posted',
        postedAt: Timestamp.now(),
      });
      postsPublishedCount++;
    });

    await batch.commit();
    return postsPublishedCount;
}

async function runRecurringTaskGenerator(firestore: FirebaseFirestore.Firestore, auth: any) {
    const templatesSnapshot = await firestore.collection('recurringTaskTemplates').get();
    if (templatesSnapshot.empty) {
      return { created: 0, flagged: 0 };
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
          status: 'To Do',
          priority: template.defaultPriority,
          assigneeIds: template.defaultAssigneeIds,
          assignees: [], 
          companyId: template.companyId,
          isMandatory: template.isMandatory || false,
          createdBy: { id: 'system', name: 'Scheduler', avatarUrl: '' },
          startDate: new Date().toISOString(),
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
      return { created: 0, flagged: 0 };
    }

    const batch = firestore.batch();

    tasksToCreate.forEach(taskData => {
      const taskRef = firestore.collection('tasks').doc();
      batch.set(taskRef, { ...taskData, createdAt: Timestamp.now() });
    });

    templatesToUpdate.forEach(update => {
      const templateRef = firestore.collection('recurringTaskTemplates').doc(update.id);
      batch.update(templateRef, { lastGeneratedAt: update.lastGeneratedAt });
    });
    
    await batch.commit();

    for (const userId of Object.keys(usersToFlag)) {
      try {
        const user = await auth.getUser(userId);
        const currentClaims = user.customClaims || {};
        await auth.setCustomUserClaims(userId, { ...currentClaims, mustAcknowledgeTasks: true });
      } catch (error: any) {
        console.error(`Failed to set claim for user ${userId}:`, error.message);
      }
    }

    return { created: tasksToCreate.length, flagged: Object.keys(usersToFlag).length };
}


export async function GET(request: Request) {
  // This single endpoint now runs all scheduled jobs.
  // Optional: Add a secret key check for security
  // const { searchParams } = new URL(request.url);
  // if (searchParams.get('secret') !== process.env.SCHEDULER_SECRET) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }
  
  try {
    const app = initializeAdminApp();
    const firestore = getFirestore(app);
    const auth = getAuth(app);

    const [socialResult, taskResult] = await Promise.all([
      runSocialMediaPoster(firestore),
      runRecurringTaskGenerator(firestore, auth)
    ]);

    const messages = [];
    if (socialResult > 0) {
      messages.push(`Published ${socialResult} social media post(s).`);
    } else {
      messages.push('No social media posts to publish.');
    }
    if (taskResult.created > 0) {
      messages.push(`Generated ${taskResult.created} recurring task(s) and flagged ${taskResult.flagged} user(s).`);
    } else {
      messages.push('No recurring tasks to generate.');
    }

    return NextResponse.json(
      {
        message: `Scheduler finished. ${messages.join(' ')}`,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error in main scheduler:', error);
    let errorMessage = 'An unexpected error occurred during scheduled job execution.';
     if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json(
      { message: errorMessage, error: error.message },
      { status: 500 }
    );
  }
}
