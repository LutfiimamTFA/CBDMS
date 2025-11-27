import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Function to safely initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const firebaseKey = process.env.FIREBASE_ADMIN_KEY;
  if (!firebaseKey) {
    throw new Error('FIREBASE_ADMIN_KEY environment variable is not set.');
  }

  const serviceAccount = JSON.parse(firebaseKey);

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Endpoint API Next.js 13+
export async function POST(req: Request) {
  try {
    const app = initializeAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const data = await req.json();
    const { name, email, password, role } = data;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'Name, email, password, and role are required.' }), { status: 400 });
    }

    // Buat user di Firebase Auth
    const userRecord = await auth.createUser({ 
        email, 
        password,
        displayName: name,
    });
    
    // Set custom claims for role
    await auth.setCustomUserClaims(userRecord.uid, { role });

    // Simpan data user di Firestore
    await db.collection("users").doc(userRecord.uid).set({
      id: userRecord.uid,
      name,
      email,
      role,
      companyId: 'company-a', // Default company ID
      avatarUrl: `https://i.pravatar.cc/150?u=${userRecord.uid}`,
      createdAt: new Date().toISOString()
    });

    return new Response(JSON.stringify({ uid: userRecord.uid }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.code === 'auth/email-already-exists') {
        errorMessage = "The email address is already in use by another account.";
    } else if (error.message?.includes('FIREBASE_ADMIN_KEY')) {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
