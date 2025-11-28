
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

// Function to generate a random, more memorable temporary password
function generateTemporaryPassword(): string {
    const easyToSayWords = ["Apple", "River", "Sunny", "Forest", "Magic", "Ocean", "Happy"];
    const specialChars = "!@#$%^&*";
    const randomNumber = Math.floor(100 + Math.random() * 900); // 3-digit number
    
    const word = easyToSayWords[Math.floor(Math.random() * easyToSayWords.length)];
    const char = specialChars[Math.floor(Math.random() * specialChars.length)];
    
    return `${word}${char}${randomNumber}`;
}


export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ message: 'User ID (uid) is required.' }, { status: 400 });
    }
    
    const auth = getAuth(app);
    const tempPassword = generateTemporaryPassword();

    // Update user's password in Firebase Auth
    await auth.updateUser(uid, {
      password: tempPassword,
    });
    
    // Set a custom claim to force password change on next login
    await auth.setCustomUserClaims(uid, { mustChangePassword: true });

    return NextResponse.json({ tempPassword }, { status: 200 });

  } catch (error: any) {
    console.error('Error generating temporary password:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;

    if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found.';
        statusCode = 404;
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
