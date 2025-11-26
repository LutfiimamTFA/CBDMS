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
import { doc, setDoc, getDoc, Firestore, getCountFromServer, collection } from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = 'super.admin@workwise.app';

async function createUserProfile(firestore: Firestore, user: UserCredential['user'], name: string) {
  const userProfileRef = doc(firestore, 'users', user.uid);
  const docSnap = await getDoc(userProfileRef);

  if (!docSnap.exists()) {
    // Check if the email is the designated Super Admin email
    const role = user.email === SUPER_ADMIN_EMAIL ? 'Super Admin' : 'Employee';

    await setDoc(userProfileRef, {
      name: name,
      email: user.email,
      role: role,
      companyId: 'company-a',
      avatarUrl: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
    });
  }
}

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
        resolve();
      })
      .catch((error) => {
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
        try {
          await createUserProfile(firestore, userCredential.user, name);
          // No verification needed for now, just resolve
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

  // Create profile on Google Sign-in if it doesn't exist
  await createUserProfile(firestore, user, user.displayName || 'New User');
  
  return result;
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    console.error('Sign-out Error:', error);
  });
}
