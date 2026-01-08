
'use client';
import type { Task, User } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useMemo } from 'react';

const chartConfig = {
  hours: {
    label: 'Tracked Hours',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function TeamWorkloadChart({
  tasks,
  users,
}: {
  tasks: Task[];
  users: User[];
}) {
  const workloadData = useMemo(() => {
    if (!users || !tasks) return [];
    return users
      .filter((user) => user.role === 'Employee' || user.role === 'PIC')
      .map((user) => {
        const totalHours = tasks
          .filter((task) => task.assigneeIds.includes(user.id))
          .reduce((acc, task) => acc + (task.timeTracked || 0), 0);
        return {
          name: user.name.split(' ')[0], // Use first name for brevity
          hours: parseFloat(totalHours.toFixed(1)),
        };
      })
      .filter(data => data.hours > 0) // Only show users with tracked time
      .sort((a, b) => b.hours - a.hours); // Sort by most hours
  }, [users, tasks]);

  if (!workloadData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          No time tracked by team members in the selected period.
      </div>
    );
  }

  return (
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart
          accessibilityLayer
          data={workloadData}
          layout="vertical"
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid horizontal={false} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            width={60}
          />
          <XAxis type="number" dataKey="hours" />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
        </BarChart>
      </ChartContainer>
  );
}
