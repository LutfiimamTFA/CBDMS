'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  UserCredential,
} from 'firebase/auth';

/**
 * Initiates an email/password sign-in.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignIn(
  authInstance: Auth,
  email: string,
  password: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    signInWithEmailAndPassword(authInstance, email, password)
      .then(() => {
        resolve(); // Resolve on successful login
      })
      .catch((error) => {
        reject(error); // Reject with the error on failure
      });
  });
}

/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    // This is generally a safe operation, but we log errors just in case.
    console.error('Sign-out Error:', error);
  });
}
