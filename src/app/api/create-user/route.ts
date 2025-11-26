import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Function to safely initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (!process.env.FIREBASE_ADMIN_KEY) {
    throw new Error('FIREBASE_ADMIN_KEY environment variable is not set.');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    const auth = getAuth(app);
    const firestore = getFirestore(app);

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create user profile in Firestore
    await firestore.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      name,
      email,
      role,
      companyId: 'company-a', // Default company
      avatarUrl: `https://i.pravatar.cc/150?u=${userRecord.uid}`,
    });

    // Optionally set custom claims for role-based access if needed in the future
    await auth.setCustomUserClaims(userRecord.uid, { role });

    return NextResponse.json({ message: 'User created successfully', uid: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    let errorMessage = 'An unexpected error occurred.';
    let statusCode = 500;
    
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'The email address is already in use by another account.';
      statusCode = 409;
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = 'The password must be a string with at least six characters.';
      statusCode = 400;
    } else if (error.message?.includes('FIREBASE_ADMIN_KEY')) {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }
    
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: statusCode });
  }
}
