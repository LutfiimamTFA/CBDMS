// src/lib/firebase-admin.ts
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: ReturnType<Storage['bucket']>;

const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_NAME;

if (!getApps().length) {
  try {
    adminApp = initializeApp({
      storageBucket,
    });
  } catch (e: any) {
    console.error('Firebase Admin SDK initialization failed:', e.message);
    throw new Error(
      'Firebase Admin SDK initialization failed. Check your service account configuration.'
    );
  }
} else {
  adminApp = getApps()[0];
}

adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);

if (!storageBucket) {
  throw new Error(
    'Firebase Storage bucket is not configured. Add FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in Vercel Environment Variables.'
  );
}

adminStorage = getStorage(adminApp).bucket(storageBucket);

export { adminApp, adminAuth, adminDb, adminStorage };
