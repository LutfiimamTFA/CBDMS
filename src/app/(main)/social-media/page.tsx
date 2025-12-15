
'use client';

import React, { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreatePostDialog } from '@/components/social-media/create-post-dialog';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { SocialMediaPost } from '@/lib/types';
import { SocialPostCard } from '@/components/social-media/social-post-card';
import { parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePermissions } from '@/context/permissions-provider';


export default function SocialMediaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { permissions } = usePermissions();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // --- Data Fetching ---
  const postsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(
        collection(firestore, 'socialMediaPosts'),
        where('companyId', '==', profile.companyId)
    );
    // For managers, we fetch all and filter client-side based on their brands
    // For employees, they see everything to know what's happening
    return q;
  }, [firestore, profile]);
  
  const { data: allPosts, isLoading: postsLoading } = useCollection<SocialMediaPost>(postsQuery);

  const posts = useMemo(() => {
    if (!allPosts || !profile) return [];
    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
        return allPosts.filter(post => !post.brandId || profile.brandIds?.includes(post.brandId));
    }
    return allPosts;
  }, [allPosts, profile]);


  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);

    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    let calendarEnd = endOfWeek(lastDayOfMonth, { weekStartsOn: 0});

    const totalDaysInView = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    // Ensure we always have 6 weeks for a consistent layout
    if (totalDaysInView.length / 7 < 6) {
        calendarEnd = add(calendarEnd, { weeks: 6 - (totalDaysInView.length / 7) });
    }

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return { start: calendarStart, end: calendarEnd, days };
  }, [currentDate]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialMediaPost[]>();
    if (!posts) return map;

    posts.forEach(post => {
      if (post.scheduledAt) {
        const postDate = parseISO(post.scheduledAt);
         if (isWithinInterval(postDate, { start: calendarGrid.start, end: calendarGrid.end })) {
          const dayKey = format(postDate, 'yyyy-MM-dd');
          if (!map.has(dayKey)) {
            map.set(dayKey, []);
          }
          map.get(dayKey)?.push(post);
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

  const canCreate = useMemo(() => {
    if (!profile || !permissions) return false;
    if (profile.role === 'Super Admin' || profile.role === 'Manager' || profile.role === 'Employee') return true;
    return false;
  }, [profile, permissions]);


  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Social Media Center"
        actions={
          canCreate ? (
            <CreatePostDialog>
              <Button size="sm">
                <Plus className="mr-2" /> Create Post
              </Button>
            </CreatePostDialog>
          ) : null
        }
      />
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
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

        <div className="flex flex-col flex-1 border rounded-lg">
            <div className="grid grid-cols-7">
                {daysOfWeek.map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-r last:border-r-0">
                        {day}
                    </div>
                ))}
            </div>
            {postsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
            <div className="grid grid-cols-7 grid-rows-6 flex-1 overflow-hidden">
              {calendarGrid.days.map((day, index) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const postsForDay = postsByDay.get(dayKey) || [];
                return (
                  <div 
                      key={day.toString()} 
                      className={cn(
                          "relative flex flex-col border-r border-b",
                          !isSameMonth(day, currentDate) && "bg-muted/30 text-muted-foreground/50",
                          (index + 1) % 7 === 0 && "border-r-0", // Remove right border for last cell in a row
                          index >= 35 && "border-b-0" // Remove bottom border for last row
                      )}
                  >
                      <span className={cn( "absolute top-1.5 right-1.5 font-semibold text-sm", isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground")}>
                          {format(day, 'd')}
                      </span>
                      <ScrollArea className="flex-1 mt-8">
                        <div className="flex flex-col gap-1.5 p-1">
                          {postsForDay.map(post => (
                            <SocialPostCard key={post.id} post={post} />
                          ))}
                        </div>
                      </ScrollArea>
                  </div>
                )
              })}
            </div>
            )}
        </div>
      </main>
    </div>
  );
}
