
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
    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword) {
      return NextResponse.json(
        { message: 'User ID and new password are required.' },
        { status: 400 }
      );
    }

    const auth = getAuth(app);
    const firestore = getFirestore(app);

    // 1. Update user's password
    await auth.updateUser(uid, {
      password: newPassword,
    });

    // 2. Remove the 'mustChangePassword' custom claim
    const user = await auth.getUser(uid);
    const { mustChangePassword, ...currentClaims } = user.customClaims || {};
    await auth.setCustomUserClaims(uid, currentClaims);

    // 3. Create a confirmation notification for the user
    const userNotifRef = firestore.collection('users').doc(uid).collection('notifications').doc();
    await userNotifRef.set({
      title: 'Security Update: Password Changed',
      message: 'Your password has been successfully changed.',
      isRead: false,
      createdAt: new Date(),
      createdBy: {
        id: 'system',
        name: 'System Security',
        avatarUrl: '',
      },
      taskId: '', // No task associated
      taskTitle: 'Account Security'
    });

    return NextResponse.json(
      { message: 'Password updated successfully.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in force-change-password:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'User not found.';
      statusCode = 404;
    } else if (
      error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') ||
      error.code === 'app/invalid-credential'
    ) {
      errorMessage =
        'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json(
      { message: errorMessage, error: error.message },
      { status: statusCode }
    );
  }
}
