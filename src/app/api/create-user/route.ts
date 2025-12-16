

import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { serviceAccount } from "@/firebase/service-account";

// Function to safely initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

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
    const { name, email, password, role, companyId, managerId, brandIds } = data;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ message: 'Name, email, password, and role are required.' }), { status: 400 });
    }

    // Buat user di Firebase Auth
    const userRecord = await auth.createUser({ 
        email, 
        password,
        displayName: name,
    });
    
    // Set custom claims for role
    await auth.setCustomUserClaims(userRecord.uid, { role });

    const userData: any = {
      id: userRecord.uid,
      name,
      email,
      role,
      companyId: companyId || 'company-a', // Use provided companyId or default
      avatarUrl: `https://i.pravatar.cc/150?u=${userRecord.uid}`,
      createdAt: new Date().toISOString()
    };

    if ((role === 'Employee' || role === 'PIC') && managerId) {
      userData.managerId = managerId;
    }

    if (role === 'Manager' && Array.isArray(brandIds)) {
        userData.brandIds = brandIds;
    }

    // Simpan data user di Firestore
    await db.collection("users").doc(userRecord.uid).set(userData);

    return new Response(JSON.stringify({ uid: userRecord.uid }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    let errorMessage = "An error occurred.";
    if (error.code === 'auth/email-already-exists') {
        errorMessage = "The email address is already in use by another account.";
    } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials in environment variables.';
    }
    
    return new Response(JSON.stringify({ message: errorMessage, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

    
