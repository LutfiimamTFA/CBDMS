'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Firestore } from 'firebase/firestore';

/**
 * Initiates an email/password sign-in and checks for email verification.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignIn(
  authInstance: Auth,
  email: string,
  password: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    signInWithEmailAndPassword(authInstance, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        if (!user.emailVerified) {
          // If email is not verified, sign out immediately and reject.
          signOut(authInstance);
          const error = new Error('Email not verified.');
          (error as any).code = 'auth/email-not-verified';
          reject(error);
          return;
        }
        // If email is verified, resolve the promise.
        resolve();
      })
      .catch((error) => {
        // Catch other errors like invalid credentials.
        reject(error);
      });
  });
}

/**
 * Initiates an email/password sign-up, creates a user profile in Firestore,
 * and sends a verification email.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignUp(
  authInstance: Auth,
  firestore: Firestore,
  name: string,
  email: string,
  password: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    createUserWithEmailAndPassword(authInstance, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        const userProfileRef = doc(firestore, 'users', user.uid);

        try {
          // Send verification email
          await sendEmailVerification(user);

          // Create user profile in Firestore
          await setDoc(userProfileRef, {
            name: name,
            email: user.email,
            role: 'Employee',
            companyId: 'company-a',
            avatarUrl:
              user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
          });

          // Sign the user out immediately after registration
          await signOut(authInstance);
          
          resolve();
        } catch (setupError) {
          console.error(
            'Error sending verification or creating profile:',
            setupError
          );
          reject(setupError);
        }
      })
      .catch((createError) => {
        reject(createError);
      });
  });
}

/**
 * Initiates a Google Sign-In flow. If the user is new, it creates a
 * profile in Firestore.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateGoogleSignIn(
  auth: Auth,
  firestore: Firestore
): Promise<void> {
  const provider = new GoogleAuthProvider();
  return new Promise((resolve, reject) => {
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        const userProfileRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(userProfileRef);

        // Create profile only if it doesn't exist
        if (!docSnap.exists()) {
          try {
            await setDoc(userProfileRef, {
              name: user.displayName || 'New User',
              email: user.email,
              role: 'Employee',
              companyId: 'company-a',
              avatarUrl:
                user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
            });
            resolve();
          } catch (profileError) {
            reject(profileError);
          }
        } else {
          // User already exists, just resolve
          resolve();
        }
      })
      .catch((error) => {
        // Reject the promise to be handled by the caller
        reject(error);
      });
  });
}

/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    console.error('Sign-out Error:', error);
  });
}
