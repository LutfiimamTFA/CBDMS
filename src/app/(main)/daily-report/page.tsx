'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { RecurringTaskTemplate, DailyReport, User } from '@/lib/types';
import { collection, query, where, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function DailyReportPage() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (profile && !selectedUser) {
      setSelectedUser(profile as User);
    }
  }, [profile, selectedUser]);
  
  const templatesQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(collection(firestore, 'recurringTaskTemplates'), where('companyId', '==', profile.companyId));
  }, [firestore, profile]);
  const { data: templates, isLoading: templatesLoading } = useCollection<RecurringTaskTemplate>(templatesQuery);

  const usersQuery = useMemo(() => {
    if (!firestore || !profile || profile.role === 'Employee') return null;
    return query(collection(firestore, 'users'), where('companyId', '==', profile.companyId), where('role', '==', 'Employee'));
  }, [firestore, profile]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const dateTimestamp = useMemo(() => Timestamp.fromDate(selectedDate), [selectedDate]);
  
  const dailyReportsQuery = useMemo(() => {
    if (!firestore || !selectedUser) return null;
    return query(
      collection(firestore, 'dailyReports'),
      where('userId', '==', selectedUser.id),
      where('date', '==', dateTimestamp)
    );
  }, [firestore, selectedUser, dateTimestamp]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(dailyReportsQuery);

  const completedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    dailyReports?.forEach(report => {
      map.set(report.templateId, report.isCompleted);
    });
    return map;
  }, [dailyReports]);

  const handleCheckChange = async (templateId: string, isChecked: boolean) => {
    if (!firestore || !selectedUser) return;
    
    const reportId = `${format(selectedDate, 'yyyy-MM-dd')}_${selectedUser.id}_${templateId}`;
    const reportRef = doc(firestore, 'dailyReports', reportId);

    try {
      const batch = writeBatch(firestore);
      batch.set(reportRef, {
          userId: selectedUser.id,
          userName: selectedUser.name,
          templateId,
          date: dateTimestamp,
          isCompleted: isChecked,
          companyId: selectedUser.companyId,
          completedAt: isChecked ? Timestamp.now() : null
        }, { merge: true });
      
      await batch.commit();

    } catch (error) {
      console.error("Failed to update daily report:", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your progress. Please try again.'
      });
    }
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const canCheck = profile?.id === selectedUser?.id && isToday;

  const isLoading = profileLoading || templatesLoading || reportsLoading || (profile?.role !== 'Employee' && usersLoading);
  
  const employeeUsers = useMemo(() => {
    const userList = users || [];
    if (profile?.role === 'Employee' && profile) {
      return [profile as User];
    }
    return userList;
  }, [users, profile]);


  const relevantTemplates = useMemo(() => {
      if (!templates || !selectedUser) return [];
      return templates.filter(t => t.defaultAssigneeIds.includes(selectedUser.id));
  }, [templates, selectedUser]);

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Daily Task Checklist</h2>
            <p className="text-muted-foreground">
              {profile?.role === 'Employee' 
                ? "Check off your routine tasks for the day." 
                : "Monitor the daily task completion for your team."}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {(profile?.role === 'Manager' || profile?.role === 'Super Admin') && (
              <Select onValueChange={(userId) => setSelectedUser(users?.find(u => u.id === userId) || null)} value={selectedUser?.id}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {usersLoading ? <div className='p-2'><Loader2 className="animate-spin h-4 w-4" /></div> : employeeUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-[280px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
        ) : relevantTemplates && relevantTemplates.length > 0 ? (
          <div className="space-y-4">
            {relevantTemplates.map(template => (
              <Card key={template.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox 
                    id={`task-${template.id}`}
                    checked={completedMap.get(template.id) || false}
                    onCheckedChange={(checked) => handleCheckChange(template.id, !!checked)}
                    disabled={!canCheck}
                    className="h-6 w-6"
                  />
                  <div className="flex-1">
                    <label htmlFor={`task-${template.id}`} className="font-semibold text-base block">{template.title}</label>
                    <p className="text-sm text-muted-foreground">{template.description || "No description."}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="mt-2 text-sm text-muted-foreground">
                { selectedUser ? `No recurring tasks assigned to ${selectedUser.name}.` : `No recurring task templates have been configured for your company.`}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
