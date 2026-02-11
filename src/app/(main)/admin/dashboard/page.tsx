'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { Task, User, SocialMediaPost, WebArticle, WorkItem, WorkflowStatus } from '@/lib/types';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Loader2,
  Users,
  Share2,
  Globe,
  FileText
} from 'lucide-react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { TeamWorkloadChart } from '@/components/reports/team-workload-chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';

// --- Generic Chart Components ---
const StatusPieChart = ({ items, statuses, title }: { items: WorkItem[], statuses: WorkflowStatus[], title: string }) => {
  const chartData = useMemo(() => statuses.map(status => ({
    name: status.name,
    value: items.filter(item => (item.statusInternal || item.status) === status.name).length,
    fill: status.color,
  })).filter(item => item.value > 0), [items, statuses]);

  const chartConfig = useMemo(() => Object.fromEntries(
    statuses.map(status => [status.name, { label: status.name, color: status.color }])
  ), [statuses]);

  if (items.length === 0) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available.</div>;
  }

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Distribution of items in each status.</CardDescription>
      </CardHeader>
      <CardContent className='h-[250px]'>
        <ChartContainer config={chartConfig} className="h-full w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

const WorkItemTypePieChart = ({ tasks, socialMediaPosts, webArticles }: { tasks: number, socialMediaPosts: number, webArticles: number }) => {
  const chartData = [
    { name: 'Project Tasks', value: tasks, fill: 'hsl(var(--chart-1))' },
    { name: 'Social Media', value: socialMediaPosts, fill: 'hsl(var(--chart-2))' },
    { name: 'Web Articles', value: webArticles, fill: 'hsl(var(--chart-3))' },
  ].filter(item => item.value > 0);

  const chartConfig = {
    'Project Tasks': { label: 'Project Tasks', color: 'hsl(var(--chart-1))' },
    'Social Media': { label: 'Social Media', color: 'hsl(var(--chart-2))' },
    'Web Articles': { label: 'Web Articles', color: 'hsl(var(--chart-3))' },
  };

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Work Item Distribution</CardTitle>
        <CardDescription>Breakdown of all active work items by type.</CardDescription>
      </CardHeader>
      <CardContent className='h-[250px]'>
        <ChartContainer config={chartConfig} className="h-full w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}


// --- Main Dashboard Page ---
export default function AdminDashboardPage() {
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const [activeTab, setActiveTab] = useState('overview');

  // --- Data Fetching ---
  const managerBrandFilter = useMemo(() => {
    if (profile?.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
      return where('brandId', 'in', profile.brandIds);
    }
    return null;
  }, [profile]);
  
  const baseWorkItemQuery = (collectionName: string) => {
    if (!firestore || !companyId || !profile) return null;
    let constraints = [where('companyId', '==', companyId)];
    if (managerBrandFilter) constraints.push(managerBrandFilter);
    return query(collection(firestore, collectionName), ...constraints);
  }

  const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(baseWorkItemQuery('tasks'));
  const { data: socialMediaPosts, isLoading: areSocialPostsLoading } = useCollection<SocialMediaPost>(baseWorkItemQuery('socialMediaPosts'));
  const { data: webArticles, isLoading: areWebArticlesLoading } = useCollection<WebArticle>(baseWorkItemQuery('webArticles'));
  
  const { data: allCompanyUsers, isLoading: isAllUsersLoading } = useCollection<User>(
      useMemo(() => (firestore && companyId ? query(collection(firestore, 'users'), where('companyId', '==', companyId)) : null), [firestore, companyId])
  );
  
  const { data: taskStatuses, isLoading: areTaskStatusesLoading } = useCollection<WorkflowStatus>(useMemo(() => firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null, [firestore]));
  const { data: socialStatuses, isLoading: areSocialStatusesLoading } = useCollection<WorkflowStatus>(useMemo(() => firestore ? query(collection(firestore, 'socialMediaStatuses'), orderBy('order')) : null, [firestore]));
  const { data: webStatuses, isLoading: areWebStatusesLoading } = useCollection<WorkflowStatus>(useMemo(() => firestore ? query(collection(firestore, 'webStatuses'), orderBy('order')) : null, [firestore]));

  // --- Loading State ---
  const isLoading = isProfileLoading || areTasksLoading || areSocialPostsLoading || areWebArticlesLoading || isAllUsersLoading || areTaskStatusesLoading || areSocialStatusesLoading || areWebStatusesLoading;

  const usersForWorkload = useMemo(() => {
    if (profile?.role === 'Manager') {
        return allCompanyUsers?.filter(u => u.managerId === profile.id) || [];
    }
    return allCompanyUsers || [];
  }, [allCompanyUsers, profile]);


  // --- Memoized Data for Display ---
  const { total, completed, inProgress, cardIcons, cardLabels, chartItems, chartStatuses } = useMemo(() => {
    const allWorkItems = [...(tasks || []), ...(socialMediaPosts || []), ...(webArticles || [])];

    switch(activeTab) {
      case 'tasks':
        return {
          total: tasks?.length || 0,
          completed: tasks?.filter(t => t.status === 'Done').length || 0,
          inProgress: tasks?.filter(t => t.status === 'Doing').length || 0,
          cardIcons: { total: ClipboardList, completed: CheckCircle2, inProgress: CircleDashed },
          cardLabels: { total: 'Total Tasks', completed: 'Completed Tasks', inProgress: 'Tasks In Progress' },
          chartItems: tasks,
          chartStatuses: taskStatuses,
        };
      case 'social':
        return {
          total: socialMediaPosts?.length || 0,
          completed: socialMediaPosts?.filter(p => p.status === 'Posted').length || 0,
          inProgress: socialMediaPosts?.filter(p => p.status === 'Doing' || p.status === 'Scheduled').length || 0,
          cardIcons: { total: Share2, completed: CheckCircle2, inProgress: CircleDashed },
          cardLabels: { total: 'Total Posts', completed: 'Posted', inProgress: 'Active Posts' },
          chartItems: socialMediaPosts,
          chartStatuses: socialStatuses,
        };
      case 'web':
        return {
          total: webArticles?.length || 0,
          completed: webArticles?.filter(w => w.statusInternal === 'Done').length || 0,
          inProgress: webArticles?.filter(w => w.statusInternal === 'Doing').length || 0,
          cardIcons: { total: Globe, completed: CheckCircle2, inProgress: CircleDashed },
          cardLabels: { total: 'Total Articles', completed: 'Completed Articles', inProgress: 'Articles In Progress' },
          chartItems: webArticles,
          chartStatuses: webStatuses,
        };
      case 'overview':
      default:
        return {
          total: allWorkItems.length || 0,
          completed: allWorkItems.filter(item => item.status === 'Done' || item.status === 'Posted' || item.statusInternal === 'Done').length || 0,
          inProgress: allWorkItems.filter(item => item.status === 'Doing' || item.status === 'Scheduled' || item.statusInternal === 'Doing').length || 0,
          cardIcons: { total: FileText, completed: CheckCircle2, inProgress: CircleDashed },
          cardLabels: { total: 'Total Work Items', completed: 'Completed Items', inProgress: 'Items In Progress' },
          chartItems: allWorkItems,
          chartStatuses: [],
        };
    }
  }, [activeTab, tasks, socialMediaPosts, webArticles, taskStatuses, socialStatuses, webStatuses]);
  
  const TotalUsersIcon = Users;
  const TotalIcon = cardIcons.total;
  const CompletedIcon = cardIcons.completed;
  const InProgressIcon = cardIcons.inProgress;

  return (
    <div className="flex h-svh flex-col bg-background">
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
             <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Project Tasks</TabsTrigger>
                <TabsTrigger value="social">Social Media</TabsTrigger>
                <TabsTrigger value="web">Web Content</TabsTrigger>
            </TabsList>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <TotalUsersIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allCompanyUsers?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {profile?.role === 'Manager' ? `(${usersForWorkload?.length || 0} in your team)` : 'registered in the system'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{cardLabels.total}</CardTitle>
                  <TotalIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{total}</div>
                   <p className="text-xs text-muted-foreground">{profile?.role === 'Manager' ? 'in your managed brands' : 'across all projects'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{cardLabels.completed}</CardTitle>
                  <CompletedIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completed}</div>
                  <p className="text-xs text-muted-foreground">out of {total} total items</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{cardLabels.inProgress}</CardTitle>
                  <InProgressIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inProgress}</div>
                   <p className="text-xs text-muted-foreground">currently active</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="pt-6">
              <h2 className="text-2xl font-bold tracking-tight">Data Visualization</h2>
              <p className="text-muted-foreground">
                Deeper insights into your team's performance and project status.
              </p>
              {activeTab === 'overview' && (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                      <Card className="lg:col-span-2">
                          <CardHeader><CardTitle>Team Workload (Tasks Only)</CardTitle><CardDescription>Number of active tasks assigned to each team member.</CardDescription></CardHeader>
                          <CardContent className='h-[250px]'><TeamWorkloadChart tasks={tasks || []} users={usersForWorkload || []} /></CardContent>
                      </Card>
                      <WorkItemTypePieChart tasks={tasks?.length || 0} socialMediaPosts={socialMediaPosts?.length || 0} webArticles={webArticles?.length || 0} />
                  </div>
              )}
               {activeTab === 'tasks' && (
                   <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                       <Card className="lg:col-span-2">
                           <CardHeader><CardTitle>Team Workload</CardTitle><CardDescription>Number of active tasks assigned to each team member.</CardDescription></CardHeader>
                           <CardContent className='h-[250px]'><TeamWorkloadChart tasks={chartItems || []} users={usersForWorkload || []} /></CardContent>
                       </Card>
                       <StatusPieChart items={chartItems || []} statuses={chartStatuses || []} title="Task Status"/>
                   </div>
               )}
               {(activeTab === 'social' || activeTab === 'web') && (
                  <div className="grid gap-6 md:grid-cols-1 mt-4">
                      <StatusPieChart items={chartItems || []} statuses={chartStatuses || []} title={`${activeTab === 'social' ? 'Social Media' : 'Web Content'} Status`} />
                  </div>
               )}
            </div>
          </Tabs>
        )}
      </main>
    </div>
  );
}
