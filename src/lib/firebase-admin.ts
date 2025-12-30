// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

// This ensures we initialize only once.
if (!getApps().length) {
    let serviceAccount;
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            // The service account key is stored as a JSON string in the environment variable.
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
             // The private_key in the JSON often has newline characters escaped as '\n'.
            // We need to replace them with actual newlines for the library to parse it correctly.
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
        } else {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
        }
    } catch (e: any) {
        console.error("Failed to parse or find FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
        throw new Error("Firebase Admin SDK initialization failed due to a missing or invalid service account key.");
    }
  
    // Dynamically get the storage bucket from the system-provided Firebase config.
    // This is safer than hardcoding and avoids "bucket not found" errors.
    let storageBucketName: string | undefined;
    if (process.env.FIREBASE_CONFIG) {
        try {
            const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
            storageBucketName = firebaseConfig.storageBucket;
        } catch (e) {
            console.error("Failed to parse FIREBASE_CONFIG:", e);
        }
    }

    if (!storageBucketName) {
        throw new Error("Could not determine Storage Bucket name. Make sure Firebase Storage is enabled for this project.");
    }

    adminApp = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: storageBucketName, // Use the dynamically retrieved bucket name
    });

} else {
  adminApp = getApps()[0];
}

// Export singleton instances of the services.
adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);
adminStorage = getStorage(adminApp).bucket();

export { adminApp, adminAuth, adminDb, adminStorage };
