import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../../../firebase/service-account.json';

// Cast the imported JSON to the expected type
const serviceAccountCert = serviceAccount as any;

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccountCert),
  });
} else {
  app = getApps()[0];
}

export async function POST(request: Request) {
  try {
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
    } else if (error.message?.includes('credential')) {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
