'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  add,
  sub,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SocialMediaPost, SharedLink } from '@/lib/types';
import { SocialPostCard } from '@/components/social-media/social-post-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PostPerformanceChart } from '@/components/social-media/post-performance-chart';
import { ImpressionsCard } from '@/components/social-media/impressions-card';
import { PostTypeChart } from '@/components/social-media/post-type-chart';
import { EngagementCard } from '@/components/social-media/engagement-card';
import { SharedHeader } from './shared-header';

interface SharedSocialMediaViewProps {
  session: SharedLink;
  isAnalyticsView?: boolean;
  posts: SocialMediaPost[] | null;
  isLoading: boolean;
}

export function SharedSocialMediaView({ session, isAnalyticsView, posts, isLoading }: SharedSocialMediaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    let calendarEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 0});
    const totalDaysInView = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    if (totalDaysInView.length / 7 < 6) {
        calendarEnd = add(calendarEnd, { weeks: 6 - (totalDaysInView.length / 7) });
    }
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const postsByDay = useMemo(() => {
    if (!posts) return new Map();
    const map = new Map<string, SocialMediaPost[]>();
    posts.forEach(post => {
      if (post.scheduledAt) {
        try {
          const postDate = parseISO(post.scheduledAt);
          if (isWithinInterval(postDate, { start: calendarGrid.start, end: calendarEnd })) {
            const dayKey = format(postDate, 'yyyy-MM-dd');
            if (!map.has(dayKey)) {
              map.set(dayKey, []);
            }
            map.get(dayKey)?.push(post);
          }
        } catch (e) {
          console.warn(`Invalid date format for post ${post.id}: ${post.scheduledAt}`);
        }
      }
    });
    return map;
  }, [posts, calendarGrid.start, calendarGrid.end]);

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(0, i), 'MMMM'),
  }));

  const nextMonth = () => setCurrentDate(add(currentDate, { months: 1 }));
  const prevMonth = () => setCurrentDate(sub(currentDate, { months: 1 }));
  
  const handleMonthChange = (month: string) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(month, 10)));
  };

  const handleYearChange = (year: string) => {
    setCurrentDate(new Date(parseInt(year, 10), currentDate.getMonth()));
  };

  if (isAnalyticsView) {
    return (
       <div className="flex h-svh flex-col bg-background">
        <SharedHeader title="Social Media Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Content Performance</h2>
                <p className="text-muted-foreground">
                  An overview of your content pipeline and simulated performance metrics.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <ImpressionsCard />
                <PostTypeChart posts={posts || []} />
                <EngagementCard />
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed">
                    <Button variant="ghost" className="text-muted-foreground">
                        <Plus className="mr-2 h-4 w-4"/>
                        Add metric
                    </Button>
                </div>
              </div>

              <PostPerformanceChart posts={posts || []} />
            </>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <SharedHeader title="Social Media Calendar" />
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Social Media Calendar</h2>
          <p className="text-muted-foreground">
            An overview of all scheduled social media posts.
          </p>
        </div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
                <Select value={String(currentDate.getFullYear())} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-28 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(currentDate.getMonth())} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-36 font-bold text-lg"><SelectValue/></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentDate(new Date())}>
                    Today
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-7 flex-shrink-0 border-t border-l border-r rounded-t-lg">
            {daysOfWeek.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-r last:border-r-0">
                    {day}
                </div>
            ))}
        </div>
        <ScrollArea className="flex-1 border-b border-x rounded-b-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
        <div className="grid grid-cols-7 auto-rows-fr">
          {calendarGrid.days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const postsForDay = postsByDay.get(dayKey) || [];
            return (
              <div 
                  key={day.toString()} 
                  className={cn(
                      "relative flex flex-col border-r border-t min-h-[120px]",
                      !isSameMonth(day, currentDate) && "bg-muted/30 text-muted-foreground/50"
                  )}
              >
                  <span className={cn( "absolute top-1.5 right-1.5 font-semibold text-xs", isSameDay(day, new Date()) && "flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground")}>
                      {format(day, 'd')}
                  </span>
                    <div className="flex flex-col gap-1.5 p-1 pt-8">
                      {postsForDay.map(post => (
                        <SocialPostCard key={post.id} post={post} />
                      ))}
                    </div>
              </div>
            )
          })}
        </div>
        )}
        </ScrollArea>
      </main>
    </div>
  );
}
