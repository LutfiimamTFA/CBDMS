'use client';
import type { SocialMediaPost } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfig = {
  posts: {
    label: 'Posts',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function PostsByPlatformChart({ posts }: { posts: SocialMediaPost[] }) {
  const platformCounts = posts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    posts: count,
  }));

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        No posts to analyze.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{
          left: 10,
        }}
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="platform"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <XAxis dataKey="posts" type="number" hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Bar dataKey="posts" fill="var(--color-posts)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
