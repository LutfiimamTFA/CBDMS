import { NextResponse } from 'next/server';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    },
  });
} else {
  app = getApps()[0];
}

export async function POST(request: Request) {
  try {
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
    }
    
    return NextResponse.json({ message: errorMessage }, { status: statusCode });
  }
}
