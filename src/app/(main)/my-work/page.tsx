
'use client';

import React, { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { Loader2, HelpCircle, Eye, ClipboardList, Calendar } from 'lucide-react';
import { ActionItems } from '@/components/my-work/action-items';
import { TodaysFocus } from '@/components/my-work/todays-focus';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { MyTasksDataTable } from '@/components/my-work/my-tasks-data-table';
import { Card, CardContent } from '@/components/ui/card';
import { DailyChecklist } from '@/components/my-work/daily-checklist';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { SharedMyWorkView } from '@/components/share/shared-my-work-view';

export default function MyWorkPage() {
  const { profile, isLoading: isProfileLoading, user } = useUserProfile();
  const firestore = useFirestore();

  const usersQuery = useMemo(() => {
    if (!firestore || !profile || profile.role !== 'Manager') return null;
    return query(collection(firestore, 'users'), where('managerId', '==', profile.id));
  }, [firestore, profile]);
  const { data: teamUsers, isLoading: isTeamLoading } = useCollection<User>(usersQuery);

  const teamMemberIds = useMemo(() => {
    if (profile?.role !== 'Manager' || !teamUsers) return [];
    return teamUsers.filter(u => u.managerId === profile.id).map(u => u.id);
  }, [profile, teamUsers]);

  const tasksQuery = useMemo(() => {
      if (!firestore || !user || !profile) return null;

      if (profile.role === 'Manager') {
          const allRelevantIds = Array.from(new Set([profile.id, ...teamMemberIds]));
          if (allRelevantIds.length === 0) return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
          return query(
              collection(firestore, 'tasks'),
              where('assigneeIds', 'array-contains-any', allRelevantIds)
          );
      }
      
      // For Employee or other roles
      return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', user.uid));

  }, [firestore, user, profile, teamMemberIds]);
    
  const { data: allTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);

  const isLoading = isProfileLoading || tasksLoading || (profile?.role === 'Manager' && isTeamLoading);

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SharedMyWorkView
      name={profile?.name || ''}
      tasks={allTasks || []}
      teamUsers={teamUsers || []}
      profile={profile}
    />
  );
}
