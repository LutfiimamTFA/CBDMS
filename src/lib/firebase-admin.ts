// src/lib/firebase-admin.ts
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

// This ensures we initialize only once.
if (!getApps().length) {
    try {
        // In a Google Cloud environment (like Firebase App Hosting), 
        // initializeApp() with no arguments will automatically find the credentials.
        adminApp = initializeApp();
    } catch (e: any) {
        console.error("Firebase Admin SDK initialization failed:", e.message);
        // We throw the error to ensure build failures are obvious if configuration is truly broken.
        throw new Error("Firebase Admin SDK initialization failed. Check your service account configuration.");
    }
} else {
  adminApp = getApps()[0];
}

// Export singleton instances of the services.
adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);
adminStorage = getStorage(adminApp).bucket(); // Use default bucket associated with the project

export { adminApp, adminAuth, adminDb, adminStorage };
