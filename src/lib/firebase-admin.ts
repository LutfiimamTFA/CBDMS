
// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { serviceAccount } from '@/firebase/service-account';

const BUCKET_NAME = "studio-3200695440-bed4a.firebasestorage.app";

let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: BUCKET_NAME,
  });
} else {
  adminApp = getApps()[0];
}

const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);
const adminStorage: ReturnType<Storage['bucket']> = getStorage(adminApp).bucket();

export { adminApp, adminAuth, adminDb, adminStorage };
