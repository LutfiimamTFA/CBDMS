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
 * Initiates an email/password sign-in. If the user does not exist,
 * it automatically attempts to create a new user account.
 */
export function initiateEmailSignIn(authInstance: Auth, firestore: Firestore, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error: FirebaseError) => {
      // If sign-in fails because the user is not found, try to sign them up.
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        initiateEmailSignUp(authInstance, firestore, email, password);
      } else {
        // For other errors (network, etc.), log them.
        console.error("Sign-in Error:", error);
      }
    });
}

/**
 * Initiates an email/password sign-up. Creates a new user and a corresponding
 * user profile in Firestore.
 */
export function initiateEmailSignUp(authInstance: Auth, firestore: Firestore, email: string, password: string): void {
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
      }).catch(profileError => {
        console.error("Error creating user profile:", profileError);
      });
    })
    .catch(createError => {
      // Handle sign-up errors (e.g., email already in use, weak password)
      console.error("Sign-up Error:", createError);
    });
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch(error => {
      console.error("Sign-out Error:", error);
  });
}
