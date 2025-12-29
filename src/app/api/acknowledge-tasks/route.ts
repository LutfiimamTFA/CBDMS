
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { message: 'User ID (uid) is required.' },
        { status: 400 }
      );
    }

    const auth = adminAuth;
    const user = await auth.getUser(uid);
    const { mustAcknowledgeTasks, ...currentClaims } = user.customClaims || {};

    // Only proceed if the claim actually exists
    if (mustAcknowledgeTasks) {
        await auth.setCustomUserClaims(uid, currentClaims);
    }
    
    // Revoke refresh tokens regardless of whether the claim was present.
    // This is a robust way to ensure the client gets a fresh token.
    await auth.revokeRefreshTokens(uid);
    
    return NextResponse.json(
      { message: 'Task acknowledgment successful. User token revoked to force re-authentication.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in acknowledge-tasks:', error);
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
