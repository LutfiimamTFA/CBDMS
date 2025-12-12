
'use client';

import React, { useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserProfile, useAuth, useFirestore, useStorage } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
  confirmPassword: z.string().min(6, 'Please confirm your new password.'),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});


type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, profile, isLoading: isProfileLoading } = useUserProfile();
  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile?.name || '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    }
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !storage || !firestore) return;

    setIsUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, { avatarUrl: photoURL });
      
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { photoURL });
      }

      toast({
        title: 'Photo Updated',
        description: 'Your new profile picture has been saved.',
      });
    } catch (error) {
      console.error('Photo Upload Error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'Could not upload your new photo. Please try again.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !firestore) return;
    setIsSavingProfile(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, { name: data.name });

      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { displayName: data.name });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your name has been successfully updated.',
      });
    } catch (error) {
       console.error('Profile Update Error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your profile. Please try again.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onChangePasswordSubmit = async (data: PasswordFormValues) => {
    if (!auth?.currentUser || !auth.currentUser.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }
    setIsChangingPassword(true);

    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, data.currentPassword);
        
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        await updatePassword(auth.currentUser, data.newPassword);

        toast({
            title: 'Password Changed',
            description: 'Your password has been successfully updated.',
        });
        passwordForm.reset();

    } catch (error: any) {
        let description = 'An unexpected error occurred.';
        if (error.code === 'auth/wrong-password') {
            description = 'The current password you entered is incorrect.';
        } else if (error.code === 'auth/too-many-requests') {
            description = 'Too many attempts. Please try again later.';
        }
        toast({
            variant: 'destructive',
            title: 'Password Change Failed',
            description: description,
        });
    } finally {
        setIsChangingPassword(false);
    }
  };


  const getInitials = (name?: string | null) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  if (isProfileLoading) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <Header title="Profile" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Profile" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                This is how others will see you on the site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                 <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile?.avatarUrl} key={profile?.avatarUrl} />
                      <AvatarFallback>{getInitials(profile?.name)}</AvatarFallback>
                    </Avatar>
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                 </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">{profile?.name}</h3>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      className="hidden"
                      accept="image/png, image/jpeg"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                    >
                        {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                    </Button>
                </div>
              </div>
              <Form {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Profile Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password. Make sure it's a strong one!
              </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onChangePasswordSubmit)} className="space-y-4">
                        <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <Button type="submit" disabled={isChangingPassword}>
                            {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Change Password
                        </Button>
                    </form>
                </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
