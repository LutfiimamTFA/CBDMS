'use client';
import type { SocialMediaPost } from '@/lib/types';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Pie, PieChart, Cell, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Instagram } from 'lucide-react';
import { ChartLegendContent } from '../ui/chart';

const chartConfig = {
  posts: {
    label: 'Posts',
  },
  Post: {
    label: 'Photo/Post',
    color: 'hsl(var(--chart-2))',
  },
  Reels: {
    label: 'Reels',
    color: 'hsl(var(--chart-1))',
  },
  Carousel: {
    label: 'Carousel',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

export function PostTypeChart({ posts }: { posts: SocialMediaPost[] }) {
  const data = [
    { type: 'Post', count: posts.filter(p => p.postType === 'Post').length, fill: 'var(--color-Post)' },
    { type: 'Reels', count: posts.filter(p => p.postType === 'Reels').length, fill: 'var(--color-Reels)' },
    // Static value for demonstration as we don't have this data
    { type: 'Carousel', count: Math.floor(posts.length / 4), fill: 'var(--color-Carousel)' },
  ].filter(item => item.count > 0);

  const totalPosts = data.reduce((acc, curr) => acc + curr.count, 0);

  if (totalPosts === 0) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Instagram className="h-4 w-4"/>
                    <CardTitle className="text-sm font-medium">Post Reach &gt; Post Type</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="h-[120px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No posts to analyze.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="flex flex-col">
       <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
                <Instagram className="h-4 w-4"/>
                <CardTitle className="text-sm font-medium">Post Reach &gt; Post Type</CardTitle>
            </div>
       </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-full max-h-[120px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              innerRadius={30}
              strokeWidth={5}
            >
               {data.map((entry) => (
                <Cell key={`cell-${entry.type}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardContent className="flex justify-center p-4">
        <ChartLegendContent payload={data.map(item => ({ value: item.type, color: item.fill, type: 'square' }))} />
      </CardContent>
    </Card>
  );
}
