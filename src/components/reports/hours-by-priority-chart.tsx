
'use client';
import { tasks } from '@/lib/data';
import type { Priority } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, Cell } from 'recharts';
import { priorityInfo } from '@/lib/utils';

const chartConfig = {
  hours: {
    label: 'Hours',
  },
  ...Object.fromEntries(
    Object.values(priorityInfo).map((p) => [p.value, { label: p.label, color: `hsl(var(--${p.value.toLowerCase()}))` }])
  )
} satisfies ChartConfig;


export function HoursByPriorityChart() {
  const data = (['Urgent', 'High', 'Medium', 'Low'] as Priority[]).map((priority) => ({
    priority,
    hours: tasks
      .filter((task) => task.priority === priority)
      .reduce((acc, task) => acc + (task.timeTracked || 0), 0),
  }));

  const priorityColors: Record<Priority, string> = {
    Urgent: 'hsl(var(--chart-5))',
    High: 'hsl(var(--chart-4))',
    Medium: 'hsl(var(--chart-1))',
    Low: 'hsl(var(--chart-2))',
  }

  return (
    <div className="h-[250px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="priority"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Bar
            dataKey="hours"
            radius={4}
            barSize={40}
          >
             {data.map((entry) => (
              <Cell key={`cell-${entry.priority}`} fill={priorityColors[entry.priority]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
