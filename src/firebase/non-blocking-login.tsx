'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  FirebaseError,
} from 'firebase/auth';
import { doc, setDoc, Firestore } from 'firebase/firestore';


/**
 * Initiates an email/password sign-in. This function ONLY attempts to sign in.
 * It no longer automatically creates an account on failure to prevent request loops.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
      signInWithEmailAndPassword(authInstance, email, password)
        .then(() => {
          resolve();
        })
        .catch((error: FirebaseError) => {
          // Log any sign-in error to the console for debugging.
          console.error("Sign-in Error:", error.code, error.message);
          reject(error);
        });
  });
}

/**
 * Initiates an email/password sign-up. Creates a new user and a corresponding
 * user profile in Firestore.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignUp(authInstance: Auth, firestore: Firestore, email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
        createUserWithEmailAndPassword(authInstance, email, password)
        .then(userCredential => {
            const user = userCredential.user;
            const userProfileRef = doc(firestore, 'users', user.uid);
            
            // Create a user profile document
            setDoc(userProfileRef, {
                name: email.split('@')[0], // Default name from email
                email: user.email,
                role: 'Employee', // Default role
                companyId: 'company-a', // Default company
                avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`
            }).then(() => {
                resolve();
            }).catch(profileError => {
                console.error("Error creating user profile:", profileError);
                reject(profileError);
            });
        })
        .catch(createError => {
            // Handle sign-up errors (e.g., email already in use, weak password)
            console.error("Sign-up Error:", createError.code, createError.message);
            reject(createError);
        });
    });
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch(error => {
      console.error("Sign-out Error:", error);
  });
}
