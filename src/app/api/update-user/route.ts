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
    const { uid, name, role } = await request.json();

    if (!uid || !name || !role) {
      return NextResponse.json({ message: 'Missing required fields (uid, name, role).' }, { status: 400 });
    }

    const auth = getAuth(app);
    const firestore = getFirestore(app);
    
    // Update Firestore document
    await firestore.collection('users').doc(uid).update({
      name,
      role,
    });
    
    // Update Auth display name
    await auth.updateUser(uid, {
        displayName: name
    });

    // Set custom claims for role-based access
    await auth.setCustomUserClaims(uid, { role });

    return NextResponse.json({ message: 'User updated successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating user:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;

    if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found.';
        statusCode = 404;
    } else if (error.message?.includes('credential')) {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
