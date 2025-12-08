
'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { RecurringTaskTemplate, DailyReport } from '@/lib/types';
import { collection, query, where, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '../ui/card';

export function DailyChecklist() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();

  const today = useMemo(() => startOfDay(new Date()), []);
  
  const templatesQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
        collection(firestore, 'recurringTaskTemplates'), 
        where('companyId', '==', profile.companyId)
    );
  }, [firestore, profile]);
  const { data: templates, isLoading: templatesLoading } = useCollection<RecurringTaskTemplate>(templatesQuery);

  const dateTimestamp = useMemo(() => Timestamp.fromDate(today), [today]);
  
  const dailyReportsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'dailyReports'),
      where('userId', '==', profile.id),
      where('date', '==', dateTimestamp)
    );
  }, [firestore, profile, dateTimestamp]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(dailyReportsQuery);

  const completedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    dailyReports?.forEach(report => {
      map.set(report.templateId, report.isCompleted);
    });
    return map;
  }, [dailyReports]);

  const handleCheckChange = async (templateId: string, isChecked: boolean) => {
    if (!firestore || !profile) return;
    
    const reportId = `${format(today, 'yyyy-MM-dd')}_${profile.id}_${templateId}`;
    const reportRef = doc(firestore, 'dailyReports', reportId);

    try {
      const batch = writeBatch(firestore);
      batch.set(reportRef, {
          userId: profile.id,
          userName: profile.name,
          templateId,
          date: dateTimestamp,
          isCompleted: isChecked,
          companyId: profile.companyId,
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

  const isLoading = profileLoading || templatesLoading || reportsLoading;

  const relevantTemplates = useMemo(() => {
      if (!templates || !profile) return [];
      return templates.filter(t => t.defaultAssigneeIds.includes(profile.id));
  }, [templates, profile]);
  
  if (relevantTemplates.length === 0 && !isLoading) {
    return null; // Don't render the component if there's nothing to show
  }

  return (
    <div>
        <h3 className="text-xl font-bold tracking-tight mb-4">Daily Checklist</h3>
        <Card>
            <CardContent className="p-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {relevantTemplates.length > 0 ? relevantTemplates.map(template => (
                          <div key={template.id} className="flex items-center gap-3">
                              <Checkbox 
                                id={`checklist-${template.id}`}
                                checked={completedMap.get(template.id) || false}
                                onCheckedChange={(checked) => handleCheckChange(template.id, !!checked)}
                                className="h-5 w-5"
                              />
                              <label htmlFor={`checklist-${template.id}`} className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {template.title}
                              </label>
                          </div>
                        )) : (
                           <p className="text-sm text-muted-foreground text-center py-4">No daily recurring tasks assigned to you.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
