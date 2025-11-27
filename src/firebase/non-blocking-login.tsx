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
import { doc, setDoc, getDoc, Firestore, serverTimestamp } from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = 'super.admin@workwise.app';

async function createUserProfile(firestore: Firestore, user: UserCredential['user'], name: string) {
  const userProfileRef = doc(firestore, 'users', user.uid);
  const docSnap = await getDoc(userProfileRef);

  // Only create a profile if it doesn't already exist (e.g. from Google sign-in)
  if (!docSnap.exists()) {
    // Check if the email is the designated Super Admin email
    // This is a simple way to bootstrap the first admin user.
    const role = user.email === SUPER_ADMIN_EMAIL ? 'Super Admin' : 'Employee';

    await setDoc(userProfileRef, {
      id: user.uid,
      name: name,
      email: user.email,
      role: role,
      companyId: 'company-a', // Default company for all new users
      avatarUrl: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
      createdAt: serverTimestamp(),
    });
  }
}

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

  // Create profile on Google Sign-in if it doesn't exist.
  // The name is taken from the Google account.
  await createUserProfile(firestore, user, user.displayName || 'New Google User');
  
  return result;
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    // This is generally a safe operation, but we log errors just in case.
    console.error('Sign-out Error:', error);
  });
}
