'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, Firestore } from 'firebase/firestore';


/**
 * Initiates an email/password sign-in. If the user does not exist, it automatically
 * creates a new account and a corresponding user profile in Firestore.
 */
export function initiateEmailSignIn(authInstance: Auth, firestore: Firestore, email: string, password: string): void {
  // Check if a user is already signed in. If so, do nothing.
  if (authInstance.currentUser) {
    return;
  }

  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error) => {
      // If user not found, create a new account
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        createUserWithEmailAndPassword(authInstance, email, password)
          .then(userCredential => {
            const user = userCredential.user;
            const userProfileRef = doc(firestore, 'users', user.uid);
            
            setDoc(userProfileRef, {
              name: email.split('@')[0],
              email: user.email,
              role: 'Employee',
              companyId: 'company-a',
              avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`
            }).catch(profileError => {
              console.error("Error creating user profile:", profileError);
            });
          })
          .catch(createError => {
             console.error("Error during account creation:", createError);
          });
      } else {
        // For other errors, let the global listener handle them.
        console.error("Login Error:", error);
      }
    });
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance);
}
