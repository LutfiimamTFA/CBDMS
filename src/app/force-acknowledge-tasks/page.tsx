
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCollection, useFirestore, useUserProfile, useAuth, initiateSignOut } from '@/firebase';
import type { Task } from '@/lib/types';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { BellRing, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ForceAcknowledgeTasksPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const { toast } = useToast();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = Timestamp.fromDate(todayStart);

  const tasksQuery = React.useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', profile.id),
      where('isMandatory', '==', true),
      where('createdAt', '>=', todayTimestamp)
    );
  }, [firestore, profile, todayTimestamp]);

  const { data: newTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const handleAcknowledge = async () => {
    if (!profile || !auth) return;
    setIsAcknowledging(true);
    
    try {
      const response = await fetch('/api/acknowledge-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: profile.id }),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Server failed to acknowledge tasks.');
      }
      
      // If API call is successful, proceed to sign out.
      // The `onAuthStateChanged` listener will handle redirecting to login.
      await initiateSignOut(auth);
      toast({
          title: "Acknowledgment Successful",
          description: "Please log in again to continue.",
      });

    } catch (error: any) {
      console.error("API call to acknowledge-tasks failed:", error);
      toast({
          variant: "destructive",
          title: "Acknowledgment Failed",
          description: error.message || "Could not complete acknowledgment. Please try again.",
      });
      // Even if it fails, try to log out to reset state
      await initiateSignOut(auth);
    } finally {
        setIsAcknowledging(false);
        // Force a redirect to login as a final fallback.
        router.push('/login');
    }
  };
  
  const isLoading = isProfileLoading || isTasksLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BellRing className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">Tugas Wajib Baru!</CardTitle>
          <CardDescription className="mt-2 text-base text-muted-foreground">
            Anda memiliki tugas rutin baru yang wajib dikerjakan. Mohon periksa daftar di bawah ini sebelum melanjutkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : newTasks && newTasks.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto rounded-lg border p-4">
                    {newTasks.map(task => (
                        <div key={task.id} className="p-3 bg-background rounded-md">
                            <h4 className="font-semibold">{task.title}</h4>
                            <p className="text-sm text-muted-foreground">
                                Prioritas: {task.priority}
                                {task.dueDate && ` | Tenggat: ${format(new Date(task.dueDate), 'dd MMM yyyy')}`}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground">Tidak ada tugas baru yang ditemukan untuk hari ini.</p>
            )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleAcknowledge}
            disabled={isAcknowledging || isLoading}
            className="w-full"
          >
            {isAcknowledging && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Saya Mengerti, Lanjutkan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
