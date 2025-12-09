'use client';
import { useMemo } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useDoc, type WithId } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { useSharedSession } from '@/context/shared-session-provider';

// Define the shape of the user profile stored in Firestore
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'Employee' | 'Client';
  companyId: string;
  avatarUrl?: string;
  createdAt: string;
}

// Define the return type of the hook
interface UseUserProfileResult {
  user: ReturnType<typeof useFirebase>['user'];
  profile: WithId<UserProfile> | null;
  companyId: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * A hook that combines the Firebase Auth user state with their corresponding
 * profile document from Firestore.
 *
 * @returns An object containing the auth user, their Firestore profile,
 *          loading state, and any errors.
 */
export function useUserProfile(): UseUserProfileResult {
  const {
    user,
    isUserLoading: isAuthLoading,
    userError: authError,
    firestore,
  } = useFirebase();
  const { session: sharedSession, isLoading: isSessionLoading } = useSharedSession();


  // Create a memoized reference to the user's profile document.
  const profileDocRef = useMemo(() => {
    // If in a shared session, we don't need to fetch a specific user's profile
    if (sharedSession || !user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user?.uid, firestore, sharedSession]);

  // Use the useDoc hook to fetch the profile data for a logged-in user.
  const {
    data: loggedInProfile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useDoc<UserProfile>(profileDocRef);
  
  // Combine loading states and errors
  const isLoading = isAuthLoading || isProfileLoading || isSessionLoading;
  const error = authError || profileError;

  // Determine the active profile and companyId
  const { profile, companyId } = useMemo(() => {
    // Prioritize shared session context
    if (sharedSession) {
      // Create a virtual profile based on the shared link
      const virtualProfile: WithId<UserProfile> = {
        id: 'shared-session-user',
        name: sharedSession.targetName,
        email: '',
        role: 'Client', // Default virtual role, actual permissions govern actions
        companyId: sharedSession.companyId,
        createdAt: sharedSession.createdAt,
      };
      return { profile: virtualProfile, companyId: sharedSession.companyId };
    }
    // Fallback to logged-in user's profile
    return { profile: loggedInProfile, companyId: loggedInProfile?.companyId || null };
  }, [sharedSession, loggedInProfile]);

  return { user, profile, companyId, isLoading, error };
}
