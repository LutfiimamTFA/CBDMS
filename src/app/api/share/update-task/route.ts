
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { SharedLink, Task } from '@/lib/types';

function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// This API is now responsible ONLY for updating the task fields.
// Activity logging and notifications are handled by a separate, client-triggered API (/api/create-activity).
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
    
    // --- Workflow Status Identity Locking ---
    if (updates.status) {
        const snapshotStatuses = sharedLink.snapshot.statuses?.map(s => s.name) || [];
        if (!snapshotStatuses.includes(updates.status)) {
            return NextResponse.json({ message: `Invalid status "${updates.status}" for this shared link.` }, { status: 403 });
        }
    }

    const taskRef = db.collection('tasks').doc(taskId);
    
    const finalUpdates: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // The update operation is simplified. No more activity or notification logic here.
    await taskRef.update(finalUpdates);

    return NextResponse.json({ message: 'Task updated successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating shared task:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}
