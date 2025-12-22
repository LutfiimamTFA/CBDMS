
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { Task, Brand, WorkflowStatus, User, SharedTask } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';

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
    const auth = getAuth(app);

    // 1. Authenticate the request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (e: any) {
        return NextResponse.json({ message: 'Unauthorized: Invalid token.' }, { status: 401 });
    }
    const creatorId = decodedToken.uid;

    const { taskId, password, expiresAt } = await request.json();

    // 2. Validate Inputs
    if (!taskId) {
      return NextResponse.json({ message: 'Bad Request: Missing taskId.' }, { status: 400 });
    }

    const [taskSnap, creatorSnap] = await Promise.all([
      db.collection('tasks').doc(taskId).get(),
      db.collection('users').doc(creatorId).get(),
    ]);

    if (!taskSnap.exists) {
      return NextResponse.json({ message: 'Task not found.' }, { status: 404 });
    }
    if (!creatorSnap.exists()) {
      // This should theoretically never happen if the token is valid
      return NextResponse.json({ message: 'Creator (user) not found.' }, { status: 404 });
    }
    
    const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
    const creator = creatorSnap.data() as User;
    
    if (!creator.role) {
         return NextResponse.json({ message: 'Forbidden: Creator role is not defined.' }, { status: 403 });
    }

    // 3. Define Permissions based on Creator's Role
    let allowedStatuses: string[];
    let allowedActions: SharedTask['allowedActions'];

    if (creator.role === 'Manager' || creator.role === 'Super Admin') {
        allowedStatuses = ['To Do', 'Doing', 'Preview', 'Revisi', 'Done']; // All statuses
        allowedActions = ['view', 'comment', 'upload', 'changeStatus', 'edit'];
    } else { // Employee, PIC, Client
        allowedStatuses = ['To Do', 'Doing', 'Preview']; // Limited statuses
        allowedActions = ['view', 'comment', 'upload', 'changeStatus'];
    }

    // 4. Fetch necessary data for snapshot
    const brandSnap = task.brandId ? await db.collection('brands').doc(task.brandId).get() : null;
    const statusesSnap = await db.collection('statuses').where('companyId', '==', task.companyId).get();

    const snapshot: SharedTask['snapshot'] = {
      task,
      brand: brandSnap?.exists ? { id: brandSnap.id, ...(brandSnap.data() as Brand) } : null,
      statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as WorkflowStatus) })),
    };
    
    // 5. Build the final, validated payload
    const shareData: Omit<SharedTask, 'id'> = {
      taskId: task.id,
      companyId: task.companyId,
      allowedActions,
      allowedStatuses,
      creatorUserId: creator.id,
      creatorName: creator.name || 'Unknown User',
      creatorRole: creator.role,
      createdAt: Timestamp.now(),
      snapshot,
      ...(password && { password }), // Only add password if it exists
      ...(expiresAt && { expiresAt: Timestamp.fromDate(new Date(expiresAt)) }), // Only add expiresAt if it exists
    };

    const docRef = await db.collection('sharedTasks').add(shareData);

    return NextResponse.json({ shareId: docRef.id }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating share task link:', error); // Server-side logging
    
    let message = 'An internal server error occurred.';
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        message = 'Authentication token has expired or is invalid. Please log in again.';
    }
    
    return NextResponse.json({ message, error: error.message }, { status: 500 });
  }
}
