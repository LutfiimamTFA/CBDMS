
'use client';

import { useMemo } from 'react';
import { useUserProfile, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Loader2, CheckCircle2, CircleDashed, Clock, Users, ClipboardList } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoursByPriorityChart } from '@/components/reports/hours-by-priority-chart';
import { TeamWorkloadChart } from '@/components/reports/team-workload-chart';
import { TaskStatusChart } from '@/components/reports/task-status-chart';

// --- Komponen untuk Laporan Karyawan ---
function EmployeeReport({ tasks, isLoading }: { tasks: Task[] | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedTasks = (tasks || []).filter((t) => t.status === 'Done').length;
  const inProgressTasks = (tasks || []).filter((t) => t.status === 'Doing').length;
  const totalHoursTracked = (tasks || []).reduce((acc, t) => acc + (t.timeTracked || 0), 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">in total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">across all your tasks</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Hours by Priority</CardTitle>
            <CardDescription>A breakdown of hours you've tracked against different priorities.</CardDescription>
          </CardHeader>
          <CardContent>
            <HoursByPriorityChart tasks={tasks || []} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Komponen untuk Dasbor Admin/Manager ---
function AdminDashboard({ allTasks, allUsers, isLoading }: { allTasks: Task[] | null; allUsers: User[] | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUsers = allUsers?.length || 0;
  const totalTasks = allTasks?.length || 0;
  const completedTasks = allTasks?.filter((t) => t.status === 'Done').length || 0;
  const inProgressTasks = allTasks?.filter((t) => t.status === 'Doing').length || 0;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
        <p className="text-muted-foreground">A quick look at the current state of your application.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">registered in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">out of {totalTasks} tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks In Progress</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">currently active</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h2 className="text-2xl font-bold tracking-tight">Data Visualization</h2>
        <p className="text-muted-foreground">Deeper insights into your team's performance and project status.</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Team Workload</CardTitle>
              <CardDescription>Number of active tasks assigned to each team member.</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamWorkloadChart tasks={allTasks || []} users={allUsers || []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Task Status Distribution</CardTitle>
              <CardDescription>Proportion of tasks in each status category.</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskStatusChart tasks={allTasks || []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// --- Komponen Utama Halaman Laporan ---
export default function ReportsPage() {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();

  const isSuperAdminOrManager = useMemo(() => {
    return profile?.role === 'Super Admin' || profile?.role === 'Manager';
  }, [profile]);

  // Kueri untuk karyawan: hanya tugas yang ditugaskan kepada mereka
  const employeeTasksQuery = useMemoFirebase(() => {
    if (!firestore || !profile || isSuperAdminOrManager) return null;
    return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
  }, [firestore, profile, isSuperAdminOrManager]);
  const { data: employeeTasks, isLoading: isEmployeeTasksLoading } = useCollection<Task>(employeeTasksQuery);

  // Kueri untuk Admin/Manager: semua tugas
  const allTasksQuery = useMemoFirebase(() => {
    if (!firestore || !isSuperAdminOrManager) return null;
    return collection(firestore, 'tasks');
  }, [firestore, isSuperAdminOrManager]);
  const { data: allTasks, isLoading: isAdminTasksLoading } = useCollection<Task>(allTasksQuery);
  
  // Kueri untuk Admin/Manager: semua pengguna
  const allUsersQuery = useMemoFirebase(() => {
      if (!firestore || !isSuperAdminOrManager) return null;
      return collection(firestore, 'users');
  }, [firestore, isSuperAdminOrManager]);
  const { data: allUsers, isLoading: isAdminUsersLoading } = useCollection<User>(allUsersQuery);

  const isLoading = isProfileLoading || (isSuperAdminOrManager ? (isAdminTasksLoading || isAdminUsersLoading) : isEmployeeTasksLoading);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Work Reports" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isSuperAdminOrManager ? (
          <AdminDashboard allTasks={allTasks} allUsers={allUsers} isLoading={isLoading} />
        ) : (
          <EmployeeReport tasks={employeeTasks} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
}
