

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
      'limited-edit': ['status', 'dueDate', 'priority'],
    };

    const requestedUpdateKeys = Object.keys(updates);
    const permittedFields = allowedUpdates[sharedLink.accessLevel] || [];

    const isUpdateAllowed = requestedUpdateKeys.every(key => permittedFields.includes(key));

    if (!isUpdateAllowed) {
      return NextResponse.json({ message: 'You do not have permission to perform this update.' }, { status: 403 });
    }

    // --- Update Logic ---
    const taskRef = db.collection('tasks').doc(taskId);
    const finalUpdates = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await taskRef.update(finalUpdates);

    return NextResponse.json({ message: 'Task updated successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating shared task:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}
