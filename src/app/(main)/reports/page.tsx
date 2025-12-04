
'use client';

import { useMemo, useState } from 'react';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Loader2, CheckCircle2, CircleDashed, Clock, Users, ClipboardList, TrendingUp, Timer } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoursByPriorityChart } from '@/components/reports/hours-by-priority-chart';
import { TeamWorkloadChart } from '@/components/reports/team-workload-chart';
import { TaskStatusChart } from '@/components/reports/task-status-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, isAfter, parseISO, intervalToDuration } from 'date-fns';
import { Label } from '@/components/ui/label';
import { formatDuration } from '@/lib/utils';


// --- Komponen untuk Laporan Karyawan ---
function EmployeeReport({ tasks, isLoading }: { tasks: Task[] | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedTasks = (tasks || []).filter((t) => t.status === 'Done');
  const inProgressTasks = (tasks || []).filter((t) => t.status === 'Doing').length;
  const totalHoursTracked = (tasks || []).reduce((acc, t) => acc + (t.timeTracked || 0), 0);

  const onTimeCompletionRate = useMemo(() => {
    const relevantTasks = completedTasks.filter(t => t.actualCompletionDate && t.dueDate);
    if (relevantTasks.length === 0) return { rate: 0, onTime: 0, total: 0 };
    
    const onTime = relevantTasks.filter(t => !isAfter(parseISO(t.actualCompletionDate!), parseISO(t.dueDate!))).length;
    return {
      rate: Math.round((onTime / relevantTasks.length) * 100),
      onTime,
      total: relevantTasks.length
    };
  }, [completedTasks]);
  
  const averageCompletionTime = useMemo(() => {
    const relevantTasks = completedTasks.filter(t => t.actualCompletionDate && t.actualStartDate);
    if (relevantTasks.length === 0) return "N/A";
    
    const totalDuration = relevantTasks.reduce((acc, task) => {
        const start = parseISO(task.actualStartDate!);
        const end = parseISO(task.actualCompletionDate!);
        return acc + (end.getTime() - start.getTime());
    }, 0);
    
    const avgDurationMs = totalDuration / relevantTasks.length;
    const duration = intervalToDuration({ start: 0, end: avgDurationMs });
    return formatDuration(duration);

  }, [completedTasks]);


  return (
    <>
      <div className="mb-4">
          <h2 className="text-2xl font-bold">Laporan Kinerja Anda</h2>
          <p className="text-muted-foreground">Ringkasan aktivitas dan kontribusi Anda.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Selesai</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">dari total tugas Anda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Aktif</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">sedang dikerjakan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jam Kerja</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">tercatat di semua tugas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimeCompletionRate.rate}%</div>
            <p className="text-xs text-muted-foreground">
                {onTimeCompletionRate.onTime} tugas tepat waktu dari {onTimeCompletionRate.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCompletionTime}</div>
            <p className="text-xs text-muted-foreground">per tugas selesai</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Jam Kerja Berdasarkan Prioritas</CardTitle>
            <CardDescription>Rincian jam kerja Anda pada berbagai tingkat prioritas tugas.</CardDescription>
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
function AdminAnalysisDashboard({ allTasks, allUsers, isLoading }: { allTasks: Task[] | null; allUsers: User[] | null; isLoading: boolean }) {
  
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];

    let periodDate: Date | null = null;
    switch (selectedPeriod) {
        case '7': periodDate = subDays(new Date(), 7); break;
        case '30': periodDate = subDays(new Date(), 30); break;
        case '180': periodDate = subDays(new Date(), 180); break;
        case '365': periodDate = subDays(new Date(), 365); break;
        default: periodDate = null;
    }

    return allTasks.filter(task => {
      const isUserMatch = selectedUserId === 'all' || task.assigneeIds.includes(selectedUserId);
      const isPeriodMatch = !periodDate || (task.createdAt && isAfter(task.createdAt.toDate(), periodDate));
      return isUserMatch && isPeriodMatch;
    });
  }, [allTasks, selectedUserId, selectedPeriod]);
  
  const filteredUsers = useMemo(() => {
    if (selectedUserId === 'all') return allUsers;
    return allUsers?.filter(u => u.id === selectedUserId) || [];
  }, [allUsers, selectedUserId]);

  const onTimeCompletionRate = useMemo(() => {
    const completed = filteredTasks.filter(t => t.status === 'Done' && t.actualCompletionDate && t.dueDate);
    if (completed.length === 0) return { rate: 0, onTime: 0, total: 0 };
    
    const onTime = completed.filter(t => !isAfter(parseISO(t.actualCompletionDate!), parseISO(t.dueDate!))).length;
    return {
      rate: Math.round((onTime / completed.length) * 100),
      onTime,
      total: completed.length
    };
  }, [filteredTasks]);

  const averageCompletionTime = useMemo(() => {
    const completed = filteredTasks.filter(t => t.status === 'Done' && t.actualCompletionDate && t.actualStartDate);
    if (completed.length === 0) return "N/A";
    
    const totalDuration = completed.reduce((acc, task) => {
        const start = parseISO(task.actualStartDate!);
        const end = parseISO(task.actualCompletionDate!);
        return acc + (end.getTime() - start.getTime());
    }, 0);
    
    const avgDurationMs = totalDuration / completed.length;
    const duration = intervalToDuration({ start: 0, end: avgDurationMs });
    return formatDuration(duration);

  }, [filteredTasks]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalTasks = filteredTasks.length || 0;
  const completedTasks = filteredTasks?.filter((t) => t.status === 'Done').length || 0;
  const inProgressTasks = filteredTasks?.filter((t) => t.status === 'Doing').length || 0;

  return (
    <>
      <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Pusat Analisis Kinerja</h2>
          <p className="text-muted-foreground">Analisis data operasional untuk pengambilan keputusan strategis.</p>
      </div>

       <div className="mb-6 p-4 border rounded-lg bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="user-filter">Filter by Employee</Label>
                 <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user-filter">
                        <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {allUsers?.filter(user => user.role === 'Employee').map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                 <Label htmlFor="period-filter">Filter by Period</Label>
                 <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger id="period-filter">
                        <SelectValue placeholder="Select a period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="180">Last 6 Months</SelectItem>
                        <SelectItem value="365">Last 1 Year</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimeCompletionRate.rate}%</div>
            <p className="text-xs text-muted-foreground">
              {onTimeCompletionRate.onTime} tugas tepat waktu dari {onTimeCompletionRate.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCompletionTime}</div>
            <p className="text-xs text-muted-foreground">
              from start to done
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tugas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">(terfilter)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Selesai</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">dari {totalTasks} tugas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Aktif</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">sedang dikerjakan</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h3 className="text-xl font-bold tracking-tight">Analisis Tim & Proyek</h3>
        <p className="text-muted-foreground">Visualisasi data untuk wawasan performa tim dan status proyek.</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Beban Kerja Tim</CardTitle>
              <CardDescription>Jumlah tugas aktif yang ditugaskan kepada setiap anggota tim.</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamWorkloadChart tasks={filteredTasks || []} users={filteredUsers || []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distribusi Status Tugas</CardTitle>
              <CardDescription>Proporsi tugas dalam setiap kategori status.</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskStatusChart tasks={filteredTasks || []} />
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
  const employeeTasksQuery = useMemo(() => {
    if (!firestore || !profile || isSuperAdminOrManager) return null;
    return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
  }, [firestore, profile, isSuperAdminOrManager]);
  const { data: employeeTasks, isLoading: isEmployeeTasksLoading } = useCollection<Task>(employeeTasksQuery);

  // Kueri untuk Admin/Manager: semua tugas
  const allTasksQuery = useMemo(() => {
    if (!firestore || !isSuperAdminOrManager) return null;
    return collection(firestore, 'tasks');
  }, [firestore, isSuperAdminOrManager]);
  const { data: allTasks, isLoading: isAdminTasksLoading } = useCollection<Task>(allTasksQuery);
  
  // Kueri untuk Admin/Manager: semua pengguna
  const allUsersQuery = useMemo(() => {
      if (!firestore || !isSuperAdminOrManager) return null;
      return collection(firestore, 'users');
  }, [firestore, isSuperAdminOrManager]);
  const { data: allUsers, isLoading: isAdminUsersLoading } = useCollection<User>(allUsersQuery);

  const isLoading = isProfileLoading || (isSuperAdminOrManager ? (isAdminTasksLoading || isAdminUsersLoading) : isEmployeeTasksLoading);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Performance Analysis" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isSuperAdminOrManager ? (
          <AdminAnalysisDashboard allTasks={allTasks} allUsers={allUsers} isLoading={isLoading} />
        ) : (
          <EmployeeReport tasks={employeeTasks} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
}
