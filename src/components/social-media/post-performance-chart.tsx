'use client';
import type { SocialMediaPost } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useMemo } from 'react';
import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns';
import { ChartLegendContent } from '../ui/chart';

const chartConfig = {
  metric1: {
    label: "Impressions",
    color: "hsl(var(--chart-1))",
  },
  metric2: {
    label: "Engagements",
    color: "hsl(var(--chart-2))",
  },
  metric3: {
    label: "New Followers",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

export function PostPerformanceChart({ posts }: { posts: SocialMediaPost[] }) {
  
  const chartData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 13);
    const interval = eachDayOfInterval({ start, end });

    const postsByDay = posts.reduce((acc, post) => {
        const day = format(parseISO(post.scheduledAt), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return interval.map(date => {
        const dayKey = format(date, 'yyyy-MM-dd');
        const postCount = postsByDay[dayKey] || 0;
        return {
            date: format(date, 'd MMM'),
            metric1: Math.floor(Math.random() * 20) + 40 + postCount * 5, // Simulate Impressions
            metric2: Math.floor(Math.random() * 15) + 20 + postCount * 3, // Simulate Engagements
            metric3: Math.floor(Math.random() * 10) + 5 + postCount * 2,  // Simulate New Followers
        }
    });

  }, [posts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Performance</CardTitle>
        <CardDescription>Simulated performance metrics over the last 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 6)}
            />
             <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
             <Legend content={<ChartLegendContent />} />
            <Line
              dataKey="metric1"
              type="monotone"
              stroke="var(--color-metric1)"
              strokeWidth={2}
              dot={true}
            />
            <Line
              dataKey="metric2"
              type="monotone"
              stroke="var(--color-metric2)"
              strokeWidth={2}
              dot={true}
            />
            <Line
              dataKey="metric3"
              type="monotone"
              stroke="var(--color-metric3)"
              strokeWidth={2}
              dot={true}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
