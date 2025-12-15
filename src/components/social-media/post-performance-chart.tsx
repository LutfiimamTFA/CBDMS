
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
  publishedPosts: {
    label: "Published Posts",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function PostPerformanceChart({ posts }: { posts: SocialMediaPost[] }) {
  
  const chartData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 13);
    const interval = eachDayOfInterval({ start, end });

    // Create a map to store the count of posts per day
    const postsByDay = posts.reduce((acc, post) => {
      // Ensure scheduledAt is valid before parsing
      if (post.scheduledAt) {
        try {
          const day = format(parseISO(post.scheduledAt), 'yyyy-MM-dd');
          acc[day] = (acc[day] || 0) + 1;
        } catch (e) {
          // Ignore posts with invalid date formats
        }
      }
      return acc;
    }, {} as Record<string, number>);

    // Map over the 14-day interval and create the chart data
    return interval.map(date => {
        const dayKey = format(date, 'yyyy-MM-dd');
        const postCount = postsByDay[dayKey] || 0;
        return {
            date: format(date, 'd MMM'),
            publishedPosts: postCount,
        }
    });

  }, [posts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Output</CardTitle>
        <CardDescription>Number of posts published over the last 14 days.</CardDescription>
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
              allowDecimals={false} // Ensure Y-axis shows whole numbers for post counts
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
             <Legend content={<ChartLegendContent />} />
            <Line
              dataKey="publishedPosts"
              type="monotone"
              stroke="var(--color-publishedPosts)"
              strokeWidth={2}
              dot={true}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
