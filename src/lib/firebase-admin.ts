// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

const BUCKET_NAME = "studio-3200695440-bed4a.appspot.com";

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

if (!getApps().length) {
    let serviceAccount;
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const parsedKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            if (parsedKey.private_key) {
                parsedKey.private_key = parsedKey.private_key.replace(/\\n/g, '\n');
            }
            serviceAccount = parsedKey;
        } else {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
        }
    } catch (e) {
        console.error("Failed to parse or find FIREBASE_SERVICE_ACCOUNT_KEY:", e);
        throw new Error("Firebase Admin SDK initialization failed due to missing or invalid service account key.");
    }
  
    adminApp = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: BUCKET_NAME,
    });
} else {
  adminApp = getApps()[0];
}

adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);
adminStorage = getStorage(adminApp).bucket();

export { adminApp, adminAuth, adminDb, adminStorage };
