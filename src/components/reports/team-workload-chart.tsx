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
  tasks: {
    label: 'Active Tasks',
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
      .filter((user) => user.role === 'Employee' || user.role === 'Manager')
      .map((user) => {
        const activeTasks = tasks.filter(
          (task) =>
            task.assigneeIds.includes(user.id) && task.status !== 'Done'
        );
        return {
          name: user.name.split(' ')[0], // Use first name for brevity
          tasks: activeTasks.length,
        };
      })
      .sort((a, b) => b.tasks - a.tasks); // Sort by most tasks
  }, [users, tasks]);

  if (!workloadData.length) {
    return (
      <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
          No active tasks assigned to team members.
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart
          accessibilityLayer
          data={workloadData}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <YAxis />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
