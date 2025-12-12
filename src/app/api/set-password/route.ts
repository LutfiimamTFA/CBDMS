
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
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'User ID (uid) and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters long.' }, { status: 400 });
    }
    
    const auth = getAuth(app);

    // Update user password in Auth
    await auth.updateUser(uid, {
        password: password
    });

    // Remove the custom claim after successful password change
    const user = await auth.getUser(uid);
    const { mustChangePassword, ...currentClaims } = user.customClaims || {};
    await auth.setCustomUserClaims(uid, currentClaims);
    
    // Revoke refresh tokens to force re-authentication with new claims
    await auth.revokeRefreshTokens(uid);
    
    return NextResponse.json({ message: 'Password updated successfully. Please log in again.' }, { status: 200 });
  } catch (error: any) {
    console.error('Error setting password:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found.";
        statusCode = 404;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
