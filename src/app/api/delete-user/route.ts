
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ message: 'User ID (uid) is required.' }, { status: 400 });
    }
    
    const auth = adminAuth;
    const firestore = adminDb;

    // Delete from Auth
    await auth.deleteUser(uid);
    
    // Delete from Firestore
    await firestore.collection('users').doc(uid).delete();
    
    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found. They may have already been deleted.";
        statusCode = 404;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
