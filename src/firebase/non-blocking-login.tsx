'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithRedirect,
  GoogleAuthProvider,
  sendEmailVerification,
  getRedirectResult,
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

          // Sign the user out immediately after registration
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
 * Initiates a Google Sign-In flow using redirect.
 */
export function initiateGoogleSignIn(
  auth: Auth
): void {
  const provider = new GoogleAuthProvider();
  signInWithRedirect(auth, provider).catch(error => {
    // This initial catch is for immediate errors, e.g., config issues.
    // The main result is handled by getRedirectResult on page load.
    console.error("Google Sign-In Redirect Error:", error);
  });
}

/**
 * Handles the result of a Google sign-in redirect.
 * If the user is new, it creates a profile in Firestore.
 * Returns a promise that resolves with the UserCredential or null.
 */
export function handleRedirectSignIn(
  auth: Auth,
  firestore: Firestore
): Promise<UserCredential | null> {
  return new Promise((resolve, reject) => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) {
          // This means the page loaded without a redirect result.
          resolve(null);
          return;
        }

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
            resolve(result);
          } catch (profileError) {
            reject(profileError);
          }
        } else {
          // User already exists, just resolve
          resolve(result);
        }
      })
      .catch((error) => {
        // Handle errors from getRedirectResult, e.g., account-exists-with-different-credential
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
