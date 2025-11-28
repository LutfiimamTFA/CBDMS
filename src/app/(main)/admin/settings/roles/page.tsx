
'use client';

import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDoc, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PermissionSettings } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Header } from '@/components/layout/header';

const defaultPermissions: PermissionSettings = {
  Manager: {
    canManageUsers: true,
    canDeleteUsers: false,
    canCreateTasks: true,
    canDeleteTasks: true,
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


export default function RoleSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const permsDocRef = useMemo(
    () => (firestore ? doc(firestore, 'permissions', 'roles') : null),
    [firestore]
  );
  
  const { data: permissions, isLoading, error } = useDoc<PermissionSettings>(permsDocRef);

  useEffect(() => {
    // If the document doesn't exist, create it with default values
    if (!isLoading && !permissions && permsDocRef) {
        setDoc(permsDocRef, defaultPermissions).catch(e => console.error("Failed to initialize permissions", e));
    }
  }, [isLoading, permissions, permsDocRef]);


  const handlePermissionChange = (
    role: keyof PermissionSettings,
    permission: string,
    value: boolean
  ) => {
    if (!permsDocRef || !permissions) return;
    
    const updatedPermissions = {
        ...permissions,
        [role]: {
            ...permissions[role],
            [permission]: value,
        },
    };

    setDoc(permsDocRef, updatedPermissions, { merge: true })
      .then(() => {
        toast({
          title: 'Permission Updated',
          description: `Permission "${permission}" for ${role} has been set to ${value}.`,
        });
      })
      .catch((e) => {
        console.error(e);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'Could not save the permission change.',
        });
      });
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  if (error) {
    return <div className="text-destructive p-8">Error loading permissions: {error.message}</div>
  }

  const PermissionSwitch = ({ role, permissionKey, label }: { role: keyof PermissionSettings, permissionKey: string, label: string }) => (
    <div className="flex items-center justify-between space-x-2 rounded-md p-3 hover:bg-secondary/50">
        <Label htmlFor={`${role}-${permissionKey}`} className="font-normal">{label}</Label>
        <Switch
            id={`${role}-${permissionKey}`}
            checked={(permissions?.[role] as any)?.[permissionKey] ?? false}
            onCheckedChange={(value) => handlePermissionChange(role, permissionKey, value)}
        />
    </div>
  );

  return (
    <div className="h-svh flex flex-col bg-background">
      <Header title="Roles & Permissions" />
      <main className='flex-1 overflow-auto p-4 md:p-6'>
       <div>
            <h2 className="text-2xl font-bold tracking-tight">Roles & Permissions</h2>
            <p className="text-muted-foreground">
                Fine-tune what each user role can see and do. Changes are saved automatically.
            </p>
        </div>
      <div className="mx-auto max-w-4xl space-y-8 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Manager</CardTitle>
            <CardDescription>Controls project and team management capabilities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <PermissionSwitch role="Manager" permissionKey="canManageUsers" label="Can Manage Users (Invite, Edit)"/>
            <PermissionSwitch role="Manager" permissionKey="canDeleteUsers" label="Can Delete Users"/>
            <Separator/>
            <PermissionSwitch role="Manager" permissionKey="canCreateTasks" label="Can Create Tasks"/>
            <PermissionSwitch role="Manager" permissionKey="canDeleteTasks" label="Can Delete Tasks"/>
            <Separator/>
            <PermissionSwitch role="Manager" permissionKey="canViewReports" label="Can View Reports"/>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee</CardTitle>
            <CardDescription>Core permissions for daily task execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <PermissionSwitch role="Employee" permissionKey="canCreateTasks" label="Can Create Tasks"/>
            <PermissionSwitch role="Employee" permissionKey="canChangeTaskStatus" label="Can Change Task Status"/>
            <PermissionSwitch role="Employee" permissionKey="canTrackTime" label="Can Track Time on Tasks"/>
            <PermissionSwitch role="Employee" permissionKey="canCreateDailyReports" label="Can Create Daily Reports"/>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
            <CardDescription>Permissions for external stakeholders to review progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <PermissionSwitch role="Client" permissionKey="canViewAssignedTasks" label="Can View Assigned Company Tasks"/>
            <PermissionSwitch role="Client" permissionKey="canCommentOnTasks" label="Can Comment on Tasks"/>
            <PermissionSwitch role="Client" permissionKey="canApproveContent" label="Can Approve Final Content"/>
          </CardContent>
        </Card>

      </div>
    </main>
    </div>
  );
}
