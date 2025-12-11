
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';

// Function to safely initialize Firebase Admin
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
    const { uid, name, email, role, managerId, brandIds } = await request.json();

    if (!uid || !name || !role || !email) {
      return NextResponse.json({ message: 'Missing required fields (uid, name, email, role).' }, { status: 400 });
    }

    const auth = getAuth(app);
    const firestore = getFirestore(app);
    
    const userDataToUpdate: any = {
      name,
      email,
      role,
    };
    
    if (role === 'Employee' && managerId) {
      userDataToUpdate.managerId = managerId;
    } else {
      userDataToUpdate.managerId = null; 
    }

    if (role === 'Manager' && Array.isArray(brandIds)) {
        userDataToUpdate.brandIds = brandIds;
    } else {
        userDataToUpdate.brandIds = null;
    }

    // Update Firestore document
    await firestore.collection('users').doc(uid).update(userDataToUpdate);
    
    // Update Auth display name and email
    await auth.updateUser(uid, {
        displayName: name,
        email: email,
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
    } else if (error.code === 'auth/email-already-exists') {
        errorMessage = 'The new email address is already in use by another account.';
        statusCode = 400;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
