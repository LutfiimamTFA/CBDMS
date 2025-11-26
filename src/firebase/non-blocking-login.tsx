'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  UserCredential,
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

          // Sign the user out immediately after registration to force verification
          await signOut(authInstance);
          
          resolve();
        } catch (setupError) {
          reject(setupError);
        }
      })
      .catch((createError) => {
        reject(createError);
      });
  });
}


/**
 * Initiates a Google Sign-In flow using a popup.
 * If the user is new, it creates a profile in Firestore.
 * Returns a promise that resolves with the UserCredential.
 */
export async function initiateGoogleSignIn(
  auth: Auth,
  firestore: Firestore
): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if the user is new by trying to get their profile
  const userProfileRef = doc(firestore, 'users', user.uid);
  const docSnap = await getDoc(userProfileRef);

  if (!docSnap.exists()) {
    // User is new, create a profile document
    await setDoc(userProfileRef, {
      name: user.displayName || 'New User',
      email: user.email,
      role: 'Employee',
      companyId: 'company-a',
      avatarUrl: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
    });
  }
  
  return result;
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    console.error('Sign-out Error:', error);
  });
}
