'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { PermissionSettings } from '@/lib/types';
import { doc } from 'firebase/firestore';

// Default permissions, used as a fallback during loading or if the document doesn't exist.
const defaultPermissions: PermissionSettings = {
  Manager: {
    canCreateTasks: true,
    canDeleteTasks: false,
    canManageUsers: true,
    canDeleteUsers: false,
    canViewReports: true,
  },
  Employee: {
    canCreateTasks: false,
    canChangeTaskStatus: true,
    canTrackTime: true,
    canCreateDailyReports: true,
  },
  Client: {
    canViewAssignedTasks: true,
    canCommentOnTasks: true,
    canApproveContent: true,
  },
};

interface PermissionsContextType {
  permissions: PermissionSettings;
  isLoading: boolean;
  error: Error | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();

  // Memoize the document reference to prevent re-renders.
  const permsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'permissions', 'roles') : null),
    [firestore]
  );

  // Use the useDoc hook to get real-time permission settings.
  const {
    data: dynamicPermissions,
    isLoading,
    error,
  } = useDoc<PermissionSettings>(permsDocRef);

  // Memoize the context value.
  // If data is loading or doesn't exist, use the fallback defaultPermissions.
  const value = useMemo(
    () => ({
      permissions: dynamicPermissions || defaultPermissions,
      isLoading,
      error,
    }),
    [dynamicPermissions, isLoading, error]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
