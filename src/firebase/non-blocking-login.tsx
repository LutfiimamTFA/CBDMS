'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

/**
 * Initiates an email/password sign-in with session persistence control.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignIn(
  authInstance: Auth,
  email: string,
  password: string,
  rememberMe: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Set persistence level based on the "Remember Me" checkbox
    const persistence = rememberMe
      ? browserLocalPersistence // Persists across browser sessions
      : browserSessionPersistence; // Clears on browser close

    setPersistence(authInstance, persistence)
      .then(() => {
        // Once persistence is set, proceed with sign-in
        return signInWithEmailAndPassword(authInstance, email, password);
      })
      .then(() => {
        resolve(); // Resolve on successful login
      })
      .catch((error) => {
        reject(error); // Reject with any error from persistence or sign-in
      });
  });
}


/** Initiate sign-out (now blocking/awaitable). */
export async function initiateSignOut(authInstance: Auth): Promise<void> {
  try {
    await signOut(authInstance);
  } catch (error) {
    // This is generally a safe operation, but we log errors just in case.
    console.error('Sign-out Error:', error);
    // Propagate the error.
    throw error;
  }
}
