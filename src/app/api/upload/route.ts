
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import type { Task, Attachment } from '@/lib/types';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadType = searchParams.get('uploadType'); // 'profile' or 'attachment'
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('taskId') as string | null;
    const fileType = formData.get('fileType') as 'attachment' | 'deliverable' | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: 'File exceeds 15MB limit.' }, { status: 413 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    let filePath: string;
    
    // Determine file path based on upload type
    if (uploadType === 'profile') {
        filePath = `avatars/${uid}/${uuidv4()}-${file.name}`;
    } else if (taskId && fileType) {
        filePath = `attachments/${taskId}/${fileType}/${uuidv4()}-${file.name}`;
    } else {
        return NextResponse.json({ message: 'Missing required parameters (taskId and fileType) for this upload.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const bucketFile = adminStorage.file(filePath);

    await bucketFile.save(fileBuffer, {
      metadata: { contentType: file.type },
    });

    // Make the file public and get its URL
    await bucketFile.makePublic();
    const publicUrl = bucketFile.publicUrl();

    // If it's a profile picture, update the user's document in Firestore
    if (uploadType === 'profile') {
        const userRef = adminDb.collection('users').doc(uid);
        await userRef.update({ avatarUrl: publicUrl });
    } else if(taskId && fileType) {
        // For task attachments, update the task document
        const taskRef = adminDb.collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            return NextResponse.json({ message: 'Task not found' }, { status: 404 });
        }
        
        const taskData = taskDoc.data() as Task;
        const newAttachment: Attachment = {
            id: uuidv4(),
            name: file.name,
            url: publicUrl,
            type: 'local',
        };

        const fieldToUpdate = fileType === 'deliverable' ? 'deliverables' : 'attachments';
        const updatedAttachments = [...(taskData[fieldToUpdate] || []), newAttachment];
        
        await taskRef.update({ [fieldToUpdate]: updatedAttachments });
    }

    return NextResponse.json({ message: 'File uploaded successfully', url: publicUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Upload Error:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ message: 'Unauthorized. Please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
