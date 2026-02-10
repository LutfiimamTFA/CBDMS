
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { serviceAccount } from '@/firebase/service-account';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

// This ensures we initialize only once.
if (!getApps().length) {
    try {
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
          // Fallback for local development or if FIREBASE_CONFIG is not set
          // This assumes a standard naming convention.
          const projectId = serviceAccount.project_id;
          if (projectId) {
            storageBucketName = `${projectId}.appspot.com`;
          } else {
            throw new Error("Could not determine Storage Bucket name from service account.");
          }
        }

        adminApp = initializeApp({
            credential: cert(serviceAccount as any),
            storageBucket: storageBucketName,
        });

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
adminStorage = getStorage(adminApp).bucket();

export { adminApp, adminAuth, adminDb, adminStorage };
