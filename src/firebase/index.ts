'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length === 0) {
    // Initialize Firebase only if it hasn't been initialized yet.
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    // If it has been initialized, get the existing app.
    firebaseApp = getApp();
  }

  // Get the Auth and Firestore services.
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
  // Ensure storage is initialized with the correct bucket.
  storage = getStorage(firebaseApp);


  return { firebaseApp, auth, firestore, storage };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
export * from './non-blocking-login';
export * from './non-blocking-updates';
export * from './auth/use-user';
