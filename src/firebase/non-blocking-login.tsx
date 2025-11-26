'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getSdks } from '@/firebase';


/**
 * Initiates an email/password sign-in. If the user does not exist, it automatically
 * creates a new account and a corresponding user profile in Firestore.
 */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error) => {
      // If user not found, create a new account
      if (error.code === 'auth/user-not-found') {
        console.log("User not found, creating a new account...");
        createUserWithEmailAndPassword(authInstance, email, password)
          .then(userCredential => {
            // After creating the user, create their profile in Firestore.
            const { firestore } = getSdks(authInstance.app);
            const user = userCredential.user;
            const userProfileRef = doc(firestore, 'users', user.uid);
            
            // Set a default profile.
            // This write operation is also non-blocking.
            setDoc(userProfileRef, {
              name: email.split('@')[0], // Use email prefix as default name
              email: user.email,
              role: 'Employee', // Default role for new sign-ups
              companyId: 'company-a', // Default company
              avatarUrl: `https://i.pravatar.cc/150?u=${user.uid}`
            }).catch(profileError => {
              // This error should be handled by the global error listener
              console.error("Error creating user profile:", profileError);
            });
          })
          .catch(createError => {
             // Handle errors during account creation (e.g., weak password)
             // The onAuthStateChanged listener will catch this as a userError
             console.error("Error during account creation:", createError);
          });
      }
      // Other login errors (like invalid-credential) will be caught by the
      // onAuthStateChanged listener and surfaced via the useFirebase hook.
    });
}


/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance);
}
