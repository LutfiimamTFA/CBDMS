'use client';
import type { SocialMediaPost } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';

const chartConfig = {
  posts: {
    label: 'Posts',
  },
  Draft: {
    label: 'Draft',
    color: 'hsl(var(--chart-2))',
  },
  'Needs Approval': {
    label: 'Needs Approval',
    color: 'hsl(var(--chart-3))',
  },
  Scheduled: {
    label: 'Scheduled',
    color: 'hsl(var(--chart-1))',
  },
  Posted: {
    label: 'Posted',
    color: 'hsl(var(--chart-5))',
  },
  Error: {
    label: 'Error',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

export function PostStatusChart({ posts }: { posts: SocialMediaPost[] }) {
  const data = Object.keys(chartConfig)
    .filter(key => key !== 'posts')
    .map((status) => ({
      status,
      count: posts.filter((post) => post.status === status).length,
      fill: (chartConfig as any)[status].color,
    }))
    .filter(item => item.count > 0);

  const totalPosts = posts.length;

  if (totalPosts === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        No posts found to analyze.
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
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
            dataKey="count"
            nameKey="status"
            innerRadius={60}
            strokeWidth={5}
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.status}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold">{totalPosts}</span>
        <span className="text-sm text-muted-foreground">Total Posts</span>
      </div>
    </div>
  );
}
