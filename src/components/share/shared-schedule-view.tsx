'use client';

import React, { useState, useMemo } from 'react';
import type { Task, SharedLink, SocialMediaPost, WebArticle, User } from '@/lib/types';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  add,
  sub,
  isSameDay,
  isWithinInterval,
  parseISO,
  isPast
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from '../tasks/task-card';
import { SocialPostCard } from '../social-media/social-post-card';
import { normalizeSocialPost } from '@/lib/social-media-utils';
import { useRouter, useParams } from 'next/navigation';

type WorkItem = Task | SocialMediaPost | WebArticle;

interface SharedScheduleViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  socialMediaPosts: SocialMediaPost[] | null;
  webArticles: WebArticle[] | null;
  isLoading: boolean;
  workstream: 'tasks' | 'socialMediaPosts' | 'webArticles';
}


export function SharedScheduleView({ session, tasks, socialMediaPosts, webArticles, isLoading, workstream }: SharedScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;

  const allUsers = useMemo(() => session?.snapshot?.users || [], [session]);

  const items = useMemo(() => {
    switch(workstream) {
      case 'socialMediaPosts': return socialMediaPosts || [];
      case 'webArticles': return webArticles || [];
      case 'tasks':
      default:
        return tasks || [];
    }
  }, [workstream, tasks, socialMediaPosts, webArticles]);

  const normalizedItems = useMemo(() => {
    if (!items) return [];
    
    const dummyUser = allUsers[0] || {} as User;

    if (workstream === 'socialMediaPosts') {
      return items.map(item => normalizeSocialPost(item as SocialMediaPost, dummyUser));
    }
    return items;
  }, [items, workstream, allUsers]);

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(endOfMonth(firstDayOfMonth), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const itemsByDueDate = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    if (!normalizedItems) return map;
    
    normalizedItems.forEach(item => {
      const dateValue = item.dueDate || (item as SocialMediaPost).scheduledAt;
      if (dateValue) {
        try {
          const dueDate = parseISO(dateValue);
          if (isWithinInterval(dueDate, { start: calendarGrid.start, end: calendarGrid.end })) {
            const key = format(dueDate, 'yyyy-MM-dd');
            if (!map.has(key)) {
              map.set(key, []);
            }
            map.get(key)?.push(item);
          }
        } catch (e) {
          // ignore invalid dates
        }
      }
    });
    return map;
  }, [normalizedItems, calendarGrid.start, calendarGrid.end]);
  
  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const handleMonthChange = (month: string) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(month, 10)));
  };

  const handleYearChange = (year: string) => {
    setCurrentDate(new Date(parseInt(year, 10), currentDate.getMonth()));
  };
  
  const next = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prev = () => setCurrentDate(sub(currentDate, { months: 1 }));

  const handleCardClick = (itemId: string) => {
    let basePath = workstream;
    if (workstream === 'socialMediaPosts') basePath = 'social-media/posts';
    else if (workstream === 'webArticles') basePath = 'web/articles';
    const path = `/share/${linkId}/${basePath}/${itemId}`;
    router.push(path);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex flex-1 flex-col p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
              <>
                <Select value={String(currentDate.getFullYear())} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(currentDate.getMonth())} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-36 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-l border-border bg-secondary/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-b">
                    <span className="hidden md:inline">{day}</span>
                    <span className="md:hidden">{day.charAt(0)}</span>
                </div>
            ))}
        </div>
        <div className="flex-1 min-h-0">
          {isLoading ? (
             <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
          <ScrollArea className="h-full">
          <div className="grid grid-cols-7 border-l border-border h-full">
              {calendarGrid.days.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayItems = itemsByDueDate.get(dayKey) || [];

                  return (
                      <div 
                          key={day.toString()} 
                          className={cn(
                              "relative min-h-[12rem] p-2 border-r border-b flex flex-col", 
                              !isSameMonth(day, currentDate) && "bg-muted/30"
                          )}
                      >
                          <span className={cn(
                              "font-semibold text-sm", 
                              isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground",
                               !isSameMonth(day, currentDate) && "text-muted-foreground/50",
                               (isPast(day) && !isSameDay(day, new Date())) && "text-destructive"
                               )}>
                              {format(day, 'd')}
                          </span>
                          <div className="mt-2 flex-1 space-y-1 overflow-auto">
                            {dayItems.map(item => {
                               if (workstream === 'socialMediaPosts') {
                                  return <SocialPostCard key={item.id} post={item as SocialMediaPost} allUsers={allUsers || []} />
                               }
                               
                               return (
                                   <div key={item.id} onClick={() => handleCardClick(item.id)} className="cursor-pointer">
                                       <TaskCard task={item as Task} />
                                   </div>
                               );
                            })}
                          </div>
                      </div>
                  )
              })}
          </div>
          </ScrollArea>
          )}
        </div>
      </main>
    </div>
  );
}
