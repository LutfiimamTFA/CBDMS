'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  const isConfigured = getApps().length > 0;
  const firebaseApp = isConfigured ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  if (process.env.NODE_ENV !== 'production') {
      // It's safe to use localhost here because the Workstation environment
      // will port forward the domains automatically.
      try {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
      } catch (e) {
        //This can happen in cases of hot-reloading, page refreshes, etc.
        //where the emulators are already connected.
      }
  }

  return { firebaseApp, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
