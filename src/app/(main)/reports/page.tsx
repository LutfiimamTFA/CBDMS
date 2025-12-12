
'use client';

import { useMemo, useState } from 'react';
import { useUserProfile, useCollection, useFirestore, useSharedSession } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Loader2, CheckCircle2, CircleDashed, Clock, Users, ClipboardList, TrendingUp, Timer, Ban } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoursByPriorityChart } from '@/components/reports/hours-by-priority-chart';
import { TeamWorkloadChart } from '@/components/reports/team-workload-chart';
import { TaskStatusChart } from '@/components/reports/task-status-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, isAfter, parseISO, intervalToDuration } from 'date-fns';
import { Label } from '@/components/ui/label';
import { formatDuration } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { notFound } from 'next/navigation';


// --- Komponen untuk Laporan Karyawan ---
function EmployeeReport({ tasks, isLoading }: { tasks: Task[] | null; isLoading: boolean }) {
  const { t } = useI18n();

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
          <h2 className="text-2xl font-bold">{t('reports.employee.title')}</h2>
          <p className="text-muted-foreground">{t('reports.employee.description')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.completedTasks')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.completedTasks.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.activeTasks')}</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.activeTasks.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.totalHours')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.totalHours.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.onTimeRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimeCompletionRate.rate}%</div>
            <p className="text-xs text-muted-foreground">
                {onTimeCompletionRate.onTime} {t('reports.metric.onTimeRate.sub.onTime')} {onTimeCompletionRate.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.avgCompletion')}</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCompletionTime}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.avgCompletion.sub')}</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.chart.hoursByPriority.title')}</CardTitle>
            <CardDescription>{t('reports.chart.hoursByPriority.description.employee')}</CardDescription>
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
  const { t } = useI18n();
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];

    let periodDate: Date | null = null;
    if (selectedPeriod !== 'all') {
      periodDate = subDays(new Date(), parseInt(selectedPeriod, 10));
    }

    return allTasks.filter(task => {
      const isUserMatch = selectedUserId === 'all' || task.assigneeIds.includes(selectedUserId);
      const isPeriodMatch = !periodDate || (task.createdAt?.toDate && isAfter(task.createdAt.toDate(), periodDate));
      return isUserMatch && isPeriodMatch;
    });
  }, [allTasks, selectedUserId, selectedPeriod]);
  
  const filteredUsers = useMemo(() => {
    if (selectedUserId === 'all') return allUsers;
    return allUsers?.filter(u => u.id === selectedUserId) || [];
  }, [allUsers, selectedUserId]);

  const totalHoursTracked = filteredTasks.reduce((acc, t) => acc + (t.timeTracked || 0), 0);

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
          <h2 className="text-2xl font-bold tracking-tight">{t('reports.admin.title')}</h2>
          <p className="text-muted-foreground">{t('reports.admin.description')}</p>
      </div>

       <div className="mb-6 p-4 border rounded-lg bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="user-filter">{t('reports.filter.employee')}</Label>
                 <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user-filter">
                        <SelectValue placeholder={t('reports.filter.employee.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('reports.filter.employee.all')}</SelectItem>
                        {allUsers?.filter(user => user.role === 'Employee').map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                 <Label htmlFor="period-filter">{t('reports.filter.period')}</Label>
                 <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger id="period-filter">
                        <SelectValue placeholder={t('reports.filter.period.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('reports.filter.period.all')}</SelectItem>
                        <SelectItem value="7">{t('reports.filter.period.7')}</SelectItem>
                        <SelectItem value="30">{t('reports.filter.period.30')}</SelectItem>
                        <SelectItem value="180">{t('reports.filter.period.180')}</SelectItem>
                        <SelectItem value="365">{t('reports.filter.period.365')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.onTimeRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimeCompletionRate.rate}%</div>
            <p className="text-xs text-muted-foreground">
              {onTimeCompletionRate.onTime} {t('reports.metric.onTimeRate.sub.onTime')} {onTimeCompletionRate.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.avgCompletion')}</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCompletionTime}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.avgCompletion.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.totalTasks')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.totalTasks.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.completedTasks')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.fromTotal', { total: totalTasks })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.activeTasks')}</CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.activeTasks.sub')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.totalHours')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">{t('reports.metric.totalHours.sub.admin')}</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h3 className="text-xl font-bold tracking-tight">{t('reports.admin.section.team.title')}</h3>
        <p className="text-muted-foreground">{t('reports.admin.section.team.description')}</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('reports.chart.teamWorkload.title')}</CardTitle>
              <CardDescription>{t('reports.chart.teamWorkload.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamWorkloadChart tasks={filteredTasks || []} users={filteredUsers || []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('reports.chart.taskStatus.title')}</CardTitle>
              <CardDescription>{t('reports.chart.taskStatus.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskStatusChart tasks={filteredTasks || []} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
             <CardHeader>
                <CardTitle>{t('reports.chart.hoursByPriority.title')}</CardTitle>
                <CardDescription>{t('reports.chart.hoursByPriority.description.admin')}</CardDescription>
            </CardHeader>
            <CardContent>
                <HoursByPriorityChart tasks={filteredTasks || []} />
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
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { session, isLoading: isSessionLoading } = useSharedSession();
  
  const activeCompanyId = session ? session.companyId : companyId;

  const isSuperAdminOrManager = useMemo(() => {
    if (session) {
      return true;
    }
    return profile?.role === 'Super Admin' || profile?.role === 'Manager';
  }, [profile, session]);

  const tasksQuery = useMemo(() => {
    if (!firestore || !activeCompanyId || !profile) return null;
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId));

    if (profile.role === 'Manager') {
        if (!profile.brandIds || profile.brandIds.length === 0) {
            return null; // Manager with no brands sees no tasks
        }
        q = query(q, where('brandId', 'in', profile.brandIds));
    } else if (profile.role === 'Employee') {
        q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    return q;
  }, [firestore, activeCompanyId, profile]);
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const usersQuery = useMemo(() => {
      if (!firestore || !activeCompanyId || !profile) return null;
      let q = query(collection(firestore, 'users'), where('companyId', '==', activeCompanyId));

      // Manager can only see their direct reports in the dropdown
      if (profile.role === 'Manager') {
        q = query(q, where('managerId', '==', profile.id));
      }
      return q;
  }, [firestore, activeCompanyId, profile]);
  const { data: allUsers, isLoading: isAdminUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = isProfileLoading || isTasksLoading || (isSuperAdminOrManager && isAdminUsersLoading) || isSessionLoading;

  if (session && !session.allowedNavItems.includes('nav_performance_analysis')) {
    return notFound();
  }
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Performance Analysis" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isSuperAdminOrManager ? (
          <AdminAnalysisDashboard allTasks={tasks} allUsers={allUsers} isLoading={isLoading} />
        ) : (
          <EmployeeReport tasks={tasks} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
}

    