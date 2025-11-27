
'use client';

import { useMemo, useState } from 'react';
import { useUserProfile, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Loader2, CheckCircle2, CircleDashed, Clock, Users, ClipboardList, FileDown, Calendar as CalendarIcon } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoursByPriorityChart } from '@/components/reports/hours-by-priority-chart';
import { TeamWorkloadChart } from '@/components/reports/team-workload-chart';
import { TaskStatusChart } from '@/components/reports/task-status-chart';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { addDays, format, parseISO, isWithinInterval, startOfDay, endOfDay, subMonths, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';


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
      <div className="mb-4">
          <h2 className="text-2xl font-bold">Laporan Kinerja Anda</h2>
          <p className="text-muted-foreground">Ringkasan aktivitas dan kontribusi Anda.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Selesai</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">dari total tugas Anda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sedang Dikerjakan</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">tugas aktif saat ini</p>
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
    const [date, setDate] = useState<DateRange | undefined>({
        from: addDays(new Date(), -7),
        to: new Date(),
    });

    const filteredTasks = useMemo(() => {
        if (!allTasks || !date?.from) return [];
        // Ensure the end of the day is included in the interval
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
        const from = startOfDay(date.from);

        return allTasks.filter(task => {
            if (!task.createdAt) return false;
            
            let taskDate: Date;
            if (task.createdAt instanceof Timestamp) {
                taskDate = task.createdAt.toDate();
            } else if (typeof task.createdAt === 'string') {
                taskDate = parseISO(task.createdAt);
            } else if (task.createdAt && typeof task.createdAt === 'object' && 'seconds' in task.createdAt) {
                // Handle plain object representation of Timestamp after serialization
                taskDate = new Timestamp(task.createdAt.seconds, task.createdAt.nanoseconds).toDate();
            }
            else {
                return false;
            }

            return isWithinInterval(taskDate, { start: from, end: to });
        });
    }, [allTasks, date]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUsers = allUsers?.length || 0;
  const totalTasks = filteredTasks.length || 0;
  const completedTasks = filteredTasks.filter((t) => t.status === 'Done').length || 0;
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'Doing').length || 0;

  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Pusat Analisis Kinerja</h2>
            <p className="text-muted-foreground">Analisis data operasional untuk pengambilan keputusan strategis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setDate({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}>Hari Ini</Button>
            <Button size="sm" variant="outline" onClick={() => setDate({ from: startOfDay(addDays(new Date(), -6)), to: endOfDay(new Date()) })}>7 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => setDate({ from: startOfDay(addDays(new Date(), -29)), to: endOfDay(new Date()) })}>30 Hari</Button>
            <Button size="sm" variant="outline" onClick={() => setDate({ from: startOfDay(subMonths(new Date(), 6)), to: endOfDay(new Date()) })}>6 Bulan</Button>
            <Button size="sm" variant="outline" onClick={() => setDate({ from: startOfDay(subYears(new Date(), 1)), to: endOfDay(new Date()) })}>1 Tahun</Button>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    size="sm"
                    variant={"outline"}
                    className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                    date.to ? (
                        <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(date.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pilih tanggal</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" disabled>
                <FileDown className="mr-2 h-4 w-4" />
                Ekspor ke PDF
            </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">pengguna terdaftar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tugas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">dalam rentang waktu terpilih</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tugas Selesai</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">dalam rentang waktu terpilih</p>
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
              <CardDescription>Jumlah tugas aktif yang ditugaskan kepada setiap anggota tim dalam rentang waktu terpilih.</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamWorkloadChart tasks={filteredTasks || []} users={allUsers || []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distribusi Status Tugas</CardTitle>
              <CardDescription>Proporsi tugas dalam setiap kategori status dalam rentang waktu terpilih.</CardDescription>
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
      <Header title="Laporan" />
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
