
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
  getDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function SocialMediaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);

    const calendarStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(add(lastDayOfMonth, { days: 6 - getDay(lastDayOfMonth) + (getDay(firstDayOfMonth) > 4 && new Date(lastDayOfMonth).getDate() > 30 ? 0 : 0) }), { weekStartsOn: 0});

    const totalDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weeks: Date[][] = [];
    for (let i = 0; i < totalDays.length; i += 7) {
      weeks.push(totalDays.slice(i, i + 7));
    }
    
    // Ensure 6 weeks are always rendered
    while (weeks.length < 6) {
        const lastDayOfLastWeek = weeks[weeks.length - 1][6];
        const nextWeekStart = add(lastDayOfLastWeek, { days: 1 });
        const nextWeekEnd = endOfWeek(nextWeekStart);
        weeks.push(eachDayOfInterval({start: nextWeekStart, end: nextWeekEnd}));
    }

    return { weeks };
  }, [currentDate]);
  
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

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Social Media Center"
        actions={
          <Button size="sm">
            <Plus className="mr-2" /> Create Post
          </Button>
        }
      />
      <main className="flex flex-col flex-1 overflow-hidden p-4 md:p-6">
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

        <div className="grid grid-cols-7 border-t border-l rounded-t-lg">
            {daysOfWeek.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-secondary/50 border-r">
                    {day}
                </div>
            ))}
        </div>
         <div className="grid grid-cols-1 grid-rows-6 border-l border-r border-b rounded-b-lg flex-1">
          {calendarGrid.weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 h-full">
              {week.map((day) => (
                <div 
                    key={day.toString()} 
                    className={cn("p-2 border-t border-r relative", !isSameMonth(day, currentDate) && "bg-muted/30 text-muted-foreground/50")}
                >
                    <span className={cn( "absolute top-1.5 right-1.5 font-semibold text-sm", isSameDay(day, new Date()) && "flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground")}>
                        {format(day, 'd')}
                    </span>
                    {/* Posts will be rendered here */}
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
