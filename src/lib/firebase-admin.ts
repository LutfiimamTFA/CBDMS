
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { serviceAccount } from '@/firebase/service-account';

const BUCKET_NAME = "studio-3200695440-bed4a.firebasestorage.app";

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

// Singleton pattern to initialize Firebase Admin SDK
if (!getApps().length) {
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
