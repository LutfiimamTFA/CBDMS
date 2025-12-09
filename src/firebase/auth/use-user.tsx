
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
 * profile document from Firestore. It is also aware of shared sessions.
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

  const { session, isLoading: isSessionLoading, error: sessionError } = useSharedSession();

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
  const isLoading = isAuthLoading || isProfileLoading || isSessionLoading;
  const error = authError || profileError || sessionError;

  // The final profile and companyId can come from either a logged-in user
  // or a shared session. The shared session takes priority.
  const { profile, companyId } = useMemo(() => {
    if (session) {
      // In a shared session, we create a virtual profile
      const virtualProfile: WithId<UserProfile> = {
        id: 'shared-session-user',
        name: `${session.role} Guest`,
        email: 'guest@example.com',
        role: session.role,
        companyId: session.companyId,
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      };
      return { profile: virtualProfile, companyId: session.companyId };
    }
    // In a normal session, use the logged-in user's profile
    return { profile: loggedInProfile, companyId: loggedInProfile?.companyId || null };
  }, [session, loggedInProfile]);

  return { user, profile, companyId, isLoading, error };
}
