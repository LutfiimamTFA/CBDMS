'use client';
import { tasks } from '@/lib/data';
import type { Priority } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

const chartConfig = {
  hours: {
    label: 'Hours',
  },
  Urgent: {
    label: 'Urgent',
    color: 'hsl(var(--chart-5))',
  },
  High: {
    label: 'High',
    color: 'hsl(var(--chart-4))',
  },
  Normal: {
    label: 'Normal',
    color: 'hsl(var(--chart-1))',
  },
  Low: {
    label: 'Low',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function HoursByPriorityChart() {
  const data = (['Urgent', 'High', 'Normal', 'Low'] as Priority[]).map((priority) => ({
    priority,
    hours: tasks
      .filter((task) => task.priority === priority)
      .reduce((acc, task) => acc + (task.timeTracked || 0), 0),
  }));

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
              <Bar
                key={entry.priority}
                dataKey="hours"
                fill={chartConfig[entry.priority as keyof typeof chartConfig]?.color}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
