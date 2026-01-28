
'use client';

import { useMemo, useState } from 'react';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User, SocialMediaPost, WebArticle, WorkItem } from '@/lib/types';
import { Loader2, CheckCircle2, CircleDashed, Clock, Users, ClipboardList, TrendingUp, Timer, Ban, Share2, Globe } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';


// --- Komponen untuk Laporan Personal (Hanya untuk Karyawan) ---
function PersonalReport({ tasks, isLoading }: { tasks: Task[] | null; isLoading: boolean }) {
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

function CompletedItemsTable({ items }: { items: any[] }) {
    if (items.length === 0) {
        return <p className="text-muted-foreground text-center py-4">No completed items in this period.</p>;
    }
    
    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Completed On</TableHead>
                        <TableHead>Result</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map(item => {
                        const completionDate = item.actualCompletionDate || item.postedAt;
                        const dueDate = item.dueDate;
                        let result: 'On Time' | 'Late' | 'N/A' = 'N/A';
                        if (completionDate && dueDate) {
                            result = isAfter(parseISO(completionDate), parseISO(dueDate)) ? 'Late' : 'On Time';
                        }
                        
                        return (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.title}</TableCell>
                                <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                                <TableCell>{completionDate ? format(parseISO(completionDate), 'PP') : '-'}</TableCell>
                                <TableCell>
                                    {result === 'On Time' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">On Time</Badge>}
                                    {result === 'Late' && <Badge variant="destructive">Late</Badge>}
                                    {result === 'N/A' && <span className="text-muted-foreground">-</span>}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Card>
    )
}

// --- Komponen untuk Dasbor Analisis (Super Admin & Manajer) ---
function TeamAnalysisDashboard({
  allTasks,
  allUsers,
  allSocialMediaPosts,
  allWebArticles,
  isLoading,
  role,
}: {
  allTasks: Task[] | null;
  allUsers: User[] | null;
  allSocialMediaPosts: SocialMediaPost[] | null;
  allWebArticles: WebArticle[] | null;
  isLoading: boolean;
  role: 'Super Admin' | 'Manager';
}) {
  const { t } = useI18n();
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const { filteredTasks, filteredSocialPosts, filteredWebArticles } = useMemo(() => {
    let periodDate: Date | null = null;
    if (selectedPeriod !== 'all') {
      periodDate = subDays(new Date(), parseInt(selectedPeriod, 10));
    }

    const filterByUserAndDate = (item: WorkItem) => {
      const isUserMatch = selectedUserId === 'all' || item.assigneeIds.includes(selectedUserId);
      const isPeriodMatch = !periodDate || (item.createdAt?.toDate && isAfter(item.createdAt.toDate(), periodDate));
      return isUserMatch && isPeriodMatch;
    };

    return {
      filteredTasks: (allTasks || []).filter(filterByUserAndDate),
      filteredSocialPosts: (allSocialMediaPosts || []).filter(filterByUserAndDate),
      filteredWebArticles: (allWebArticles || []).filter(filterByUserAndDate),
    };
  }, [allTasks, allSocialMediaPosts, allWebArticles, selectedUserId, selectedPeriod]);

  const {
    completedTasks,
    completedSocialPosts,
    completedWebArticles,
    allCompletedItems,
  } = useMemo(() => {
    const tasks = filteredTasks.filter(t => t.status === 'Done');
    const social = filteredSocialPosts.filter(p => p.status === 'Posted' || p.statusInternal === 'Done');
    const web = filteredWebArticles.filter(a => a.statusInternal === 'Done');
    return {
      completedTasks: tasks,
      completedSocialPosts: social,
      completedWebArticles: web,
      allCompletedItems: [...tasks, ...social, ...web],
    };
  }, [filteredTasks, filteredSocialPosts, filteredWebArticles]);
  
  const allCompletedItemsForTable = useMemo(() => {
    return [
        ...completedTasks.map(t => ({...t, type: 'Task'})),
        ...completedSocialPosts.map(p => ({...p, type: 'Social Post'})),
        ...completedWebArticles.map(a => ({...a, type: 'Web Article'}))
    ].sort((a,b) => {
        const dateA = a.actualCompletionDate || a.postedAt;
        const dateB = b.actualCompletionDate || b.postedAt;
        if (!dateA || !dateB) return 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime()
    });
  }, [completedTasks, completedSocialPosts, completedWebArticles]);

  const onTimeCompletionRate = useMemo(() => {
    const relevantTasks = allCompletedItems.filter(t => t.actualCompletionDate && t.dueDate);
    if (relevantTasks.length === 0) return { rate: 0, onTime: 0, total: 0 };
    
    const onTime = relevantTasks.filter(t => !isAfter(parseISO(t.actualCompletionDate!), parseISO(t.dueDate!))).length;
    return {
      rate: Math.round((onTime / relevantTasks.length) * 100),
      onTime,
      total: relevantTasks.length
    };
  }, [allCompletedItems]);

  const averageCompletionTime = useMemo(() => {
    const relevantTasks = allCompletedItems.filter(t => t.actualCompletionDate && t.actualStartDate);
    if (relevantTasks.length === 0) return "N/A";
    
    const totalDuration = relevantTasks.reduce((acc, task) => {
        const start = parseISO(task.actualStartDate!);
        const end = parseISO(task.actualCompletionDate!);
        return acc + (end.getTime() - start.getTime());
    }, 0);
    
    const avgDurationMs = totalDuration / relevantTasks.length;
    const duration = intervalToDuration({ start: 0, end: avgDurationMs });
    return formatDuration(duration);
  }, [allCompletedItems]);

  const totalHoursTracked = filteredTasks.reduce((acc, t) => acc + (t.timeTracked || 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
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
                {allUsers?.map(user => (
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
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">General tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Social Posts</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedSocialPosts.length}</div>
            <p className="text-xs text-muted-foreground">Completed / Posted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Web Articles</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedWebArticles.length}</div>
            <p className="text-xs text-muted-foreground">Finished articles</p>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.metric.totalHours')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursTracked.toFixed(2)}h</div>
            <p className="text-xs text-muted-foreground">Tracked on general tasks</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h3 className="text-xl font-bold tracking-tight">Completed Work</h3>
        <p className="text-muted-foreground">Detailed list of all completed items in the selected period.</p>
        <div className="mt-4">
            <CompletedItemsTable items={allCompletedItemsForTable} />
        </div>
      </div>
    </>
  );
}


// --- Komponen Utama Halaman Laporan ---
export default function ReportsPage() {
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();

  const tasksQuery = useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', companyId));

    if (profile.role === 'Employee' || profile.role === 'PIC') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    
    return q;
  }, [firestore, companyId, profile]);

  const socialMediaPostsQuery = useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    let q = query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', companyId));
    if (profile.role === 'Employee' || profile.role === 'PIC') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    return q;
  }, [firestore, companyId, profile]);

  const webArticlesQuery = useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    let q = query(collection(firestore, 'webArticles'), where('companyId', '==', companyId));
    if (profile.role === 'Employee' || profile.role === 'PIC') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    return q;
  }, [firestore, companyId, profile]);

  const usersQuery = useMemo(() => {
    if (!firestore || !companyId || !profile || profile.role === 'Employee') return null;

    let q = query(collection(firestore, 'users'), where('companyId', '==', companyId));
    
    if (profile.role === 'Manager') {
        q = query(q, where('managerId', '==', profile.id));
    }
    return q;
  }, [firestore, companyId, profile]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const { data: socialMediaPosts, isLoading: areSocialPostsLoading } = useCollection<SocialMediaPost>(socialMediaPostsQuery);
  const { data: webArticles, isLoading: areWebArticlesLoading } = useCollection<WebArticle>(webArticlesQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  const teamTasks = useMemo(() => {
    if (!profile || profile.role !== 'Manager' || !tasks || !users) return tasks;
    const teamMemberIds = users.map(u => u.id);
    teamMemberIds.push(profile.id); // Include manager's own tasks
    return tasks.filter(task => task.assigneeIds.some(id => teamMemberIds.includes(id)));
  }, [tasks, users, profile]);

  const teamSocialMediaPosts = useMemo(() => {
    if (!profile || profile.role !== 'Manager' || !socialMediaPosts || !users) return socialMediaPosts;
    const teamMemberIds = users.map(u => u.id);
    teamMemberIds.push(profile.id);
    return socialMediaPosts.filter(post => post.assigneeIds.some(id => teamMemberIds.includes(id)));
  }, [socialMediaPosts, users, profile]);

  const teamWebArticles = useMemo(() => {
    if (!profile || profile.role !== 'Manager' || !webArticles || !users) return webArticles;
    const teamMemberIds = users.map(u => u.id);
    teamMemberIds.push(profile.id);
    return webArticles.filter(article => article.assigneeIds.some(id => teamMemberIds.includes(id)));
  }, [webArticles, users, profile]);


  const isLoading = isProfileLoading || isTasksLoading || isUsersLoading || areSocialPostsLoading || areWebArticlesLoading;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    switch (profile?.role) {
      case 'Super Admin':
        return <TeamAnalysisDashboard allTasks={tasks} allUsers={users} allSocialMediaPosts={socialMediaPosts} allWebArticles={webArticles} isLoading={isLoading} role="Super Admin" />;
      case 'Manager':
        return <TeamAnalysisDashboard allTasks={teamTasks} allUsers={users} allSocialMediaPosts={teamSocialMediaPosts} allWebArticles={teamWebArticles} isLoading={isLoading} role="Manager" />;
      case 'Employee':
      case 'PIC':
        return <PersonalReport tasks={tasks} isLoading={isLoading} />;
      default:
        return (
             <div className="flex h-full items-center justify-center">
              <Ban className="h-8 w-8 text-destructive" />
              <p className="ml-4 text-muted-foreground">You do not have permission to view reports.</p>
            </div>
        );
    }
  };

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}
