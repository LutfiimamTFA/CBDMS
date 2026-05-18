
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Task, Brand, WorkflowStatus, User, SharedTask } from '@/lib/types-backend';

export async function POST(request: Request) {
  try {
    const db = adminDb;
    const auth = adminAuth;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (e: any) {
        return NextResponse.json({ message: 'Unauthorized: Invalid token.', error: e.message }, { status: 401 });
    }
    
    const creatorId = decodedToken.uid;
    const { taskId, password, expiresAt } = await request.json();

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
    if (!creatorSnap.exists) {
      return NextResponse.json({ message: 'Creator (user) could not be found in database.' }, { status: 404 });
    }
    
    const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
    const creator = creatorSnap.data() as User;
    
    const creatorRole = creator.role;
    if (!creatorRole) {
         return NextResponse.json({ message: 'Forbidden: Creator role is not defined.' }, { status: 403 });
    }

    let allowedStatuses: string[];
    let allowedActions: ('view' | 'comment' | 'upload' | 'changeStatus')[];

    const isPrivilegedRole = creatorRole === 'Manager' || creatorRole === 'Super Admin';
    
    if (isPrivilegedRole) {
        const statusesSnap = await db.collection('statuses').where('companyId', '==', task.companyId).get();
        allowedStatuses = statusesSnap.docs.map(doc => doc.data().name);
        allowedActions = ['view', 'comment', 'upload', 'changeStatus'];
    } else { 
        allowedStatuses = ['To Do', 'Doing', 'Preview']; 
        allowedActions = ['view', 'comment', 'upload', 'changeStatus'];
    }
    
    const brandSnap = task.brandId ? await db.collection('brands').doc(task.brandId).get() : null;
    const statusesSnap = await db.collection('statuses').where('companyId', '==', task.companyId).get();

    const snapshot: SharedTask['snapshot'] = {
      task,
      brand: brandSnap?.exists ? { id: brandSnap.id, ...(brandSnap.data() as Brand) } : null,
      statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as WorkflowStatus) })),
    };
    
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
      ...(password && { password }),
      ...(expiresAt && { expiresAt: Timestamp.fromDate(new Date(expiresAt)) }),
    };

    const docRef = await db.collection('sharedTasks').add(shareData);

    return NextResponse.json({ shareId: docRef.id }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating share task link:', error); 
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
