'use client';
import type { Task, Status } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';
import { statusInfo } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';

export function TaskStatusChart({ tasks }: { tasks: Task[] }) {
  const { t } = useI18n();

  const chartConfig = {
    tasks: {
      label: 'Tasks',
    },
    'To Do': {
      label: t('status.todo'),
      color: 'hsl(var(--chart-3))',
    },
    Doing: {
      label: t('status.doing'),
      color: 'hsl(var(--chart-2))',
    },
    Done: {
      label: t('status.done'),
      color: 'hsl(var(--chart-1))',
    },
  } satisfies ChartConfig;

  const data = (['To Do', 'Doing', 'Done'] as Status[]).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status).length,
    fill: chartConfig[status].color,
  }));

  const totalTasks = tasks.length;

  return (
    <div className="h-[250px] w-full relative">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-full"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey="tasks"
            nameKey="status"
            innerRadius={60}
            strokeWidth={5}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{totalTasks}</span>
        <span className="text-sm text-muted-foreground">Total Tasks</span>
      </div>
    </div>
  );
}
