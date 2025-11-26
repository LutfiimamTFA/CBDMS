'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Firestore } from 'firebase/firestore';


/**
 * Initiates an email/password sign-in. This function ONLY attempts to sign in.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
      signInWithEmailAndPassword(authInstance, email, password)
        .then(() => {
          resolve();
        })
        .catch((error) => {
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
            
            setDoc(userProfileRef, {
                name: user.displayName || email.split('@')[0], 
                email: user.email,
                role: 'Employee', 
                companyId: 'company-a', 
                avatarUrl: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`
            }).then(() => {
                resolve();
            }).catch(profileError => {
                console.error("Error creating user profile:", profileError);
                reject(profileError);
            });
        })
        .catch(createError => {
            console.error("Sign-up Error:", createError.code, createError.message);
            reject(createError);
        });
    });
}

/**
 * Initiates a Google Sign-In flow. If the user is new, it creates a
 * profile in Firestore.
 * Returns a promise that resolves on success and rejects on failure.
 */
export function initiateGoogleSignIn(auth: Auth, firestore: Firestore): Promise<void> {
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
              avatarUrl: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
            });
            resolve();
          } catch (profileError) {
            console.error("Error creating user profile after Google sign-in:", profileError);
            reject(profileError);
          }
        } else {
          // User already exists, just resolve
          resolve();
        }
      })
      .catch((error) => {
        // Handle Errors here.
        console.error("Google Sign-In Error:", error.code, error.message);
        reject(error);
      });
  });
}

/** Initiate sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch(error => {
      console.error("Sign-out Error:", error);
  });
}
