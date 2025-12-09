
'use client';
import { useMemo } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useDoc, type WithId } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';

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

  // Create a memoized reference to the user's profile document.
  const profileDocRef = useMemo(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user?.uid, firestore]);

  // Use the useDoc hook to fetch the profile data for a logged-in user.
  const {
    data: loggedInProfile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useDoc<UserProfile>(profileDocRef);

  // Combine loading states and errors
  const isLoading = isAuthLoading || isProfileLoading;
  const error = authError || profileError;

  const companyId = useMemo(() => {
    return loggedInProfile?.companyId || null;
  }, [loggedInProfile]);

  return { user, profile: loggedInProfile, companyId, isLoading, error };
}
