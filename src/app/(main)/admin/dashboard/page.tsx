'use client';

import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Task, User } from '@/lib/types';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Loader2,
  Users,
} from 'lucide-react';
import { collection } from 'firebase/firestore';

export default function AdminDashboardPage() {
  const firestore = useFirestore();

  const usersCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } =
    useCollection<User>(usersCollectionRef);

  const tasksCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'tasks') : null),
    [firestore]
  );
  const { data: tasks, isLoading: isTasksLoading } =
    useCollection<Task>(tasksCollectionRef);

  const isLoading = isUsersLoading || isTasksLoading;

  const totalUsers = users?.length || 0;
  const totalTasks = tasks?.length || 0;
  const completedTasks =
    tasks?.filter((t) => t.status === 'Done').length || 0;
  const inProgressTasks =
    tasks?.filter((t) => t.status === 'Doing').length || 0;

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Admin Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
          <p className="text-muted-foreground">
            A quick look at the current state of your application.
          </p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-xs text-muted-foreground">
                  registered in the system
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tasks
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <p className="text-xs text-muted-foreground">
                  across all projects
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed Tasks
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedTasks}</div>
                <p className="text-xs text-muted-foreground">
                  out of {totalTasks} tasks
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tasks In Progress
                </CardTitle>
                <CircleDashed className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressTasks}</div>
                <p className="text-xs text-muted-foreground">
                  currently active
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
