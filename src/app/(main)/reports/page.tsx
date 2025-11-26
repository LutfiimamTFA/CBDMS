'use client';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HoursByPriorityChart } from '@/components/reports/hours-by-priority-chart';
import { useCollection, useFirebase, useFirestore, useMemoFirebase } from '@/firebase';
import type { Task } from '@/lib/types';
import { CheckCircle2, CircleDashed, Clock, Loader2 } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';

export default function ReportsPage() {
  const firestore = useFirestore();
  const { user } = useFirebase();

  const tasksCollectionRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksCollectionRef);
  
  if (isTasksLoading) {
    return (
       <div className="flex h-svh flex-col bg-background">
        <Header title="Work Reports" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  const completedTasks = (tasks || []).filter((t) => t.status === 'Done').length;
  const inProgressTasks = (tasks || []).filter((t) => t.status === 'Doing').length;
  const totalHoursTracked = (tasks || []).reduce((acc, t) => acc + (t.timeTracked || 0), 0);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Work Reports" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks}</div>
              <p className="text-xs text-muted-foreground">
                in total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <CircleDashed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">
                currently active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
              <p className="text-xs text-muted-foreground">
                across all tasks
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Hours by Priority</CardTitle>
              <CardDescription>
                A breakdown of hours tracked against tasks of different priorities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoursByPriorityChart tasks={tasks || []} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
