import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Function to safely initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (!process.env.FIREBASE_ADMIN_KEY) {
    throw new Error('FIREBASE_ADMIN_KEY environment variable is not set.');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ message: 'User ID (uid) is required.' }, { status: 400 });
    }
    
    const auth = getAuth(app);
    const firestore = getFirestore(app);

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
    } else if (error.message?.includes('FIREBASE_ADMIN_KEY')) {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
