
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

// Function to generate a random, memorable password
function generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Temp-${password}!`;
}

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ message: 'User ID (uid) is required.' }, { status: 400 });
    }
    
    const auth = adminAuth;
    
    const temporaryPassword = generateTemporaryPassword();

    // 1. Update user password in Auth
    await auth.updateUser(uid, {
        password: temporaryPassword
    });

    // 2. Set custom claim to force password change on next login
    const user = await auth.getUser(uid);
    const currentClaims = user.customClaims || {};
    await auth.setCustomUserClaims(uid, { ...currentClaims, mustChangePassword: true });
    
    // 3. Return the temporary password to the admin
    return NextResponse.json({ 
        message: 'User password has been reset. Please provide the temporary password to the user.',
        temporaryPassword: temporaryPassword 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error resetting user password:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found.";
        statusCode = 404;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }

    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
