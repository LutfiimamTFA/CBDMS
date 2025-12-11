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
    
    // Generate the password reset link
    await auth.generatePasswordResetLink(email);
    
    // While the link is generated, Firebase's email handler (if enabled)
    // will send the email automatically.
    
    return NextResponse.json({ message: 'Password reset email sent successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
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
