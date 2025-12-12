'use server';
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'User email is required.' }, { status: 400 });
    }
    
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(email);

    // Set custom claim to force password change on next login
    const currentClaims = user.customClaims || {};
    await auth.setCustomUserClaims(user.uid, { ...currentClaims, mustChangePassword: true });
    
    // IMPORTANT: We are NOT sending an email anymore.
    // The user will be prompted to change password upon their next successful login with their OLD password.
    
    return NextResponse.json({ message: 'User flagged for password change on next login.' }, { status: 200 });
  } catch (error: any) {
    console.error('Error flagging user for password reset:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found with that email address.";
        statusCode = 404;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
