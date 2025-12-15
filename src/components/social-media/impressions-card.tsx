'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { TrendingUp, Facebook } from 'lucide-react';

const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
}

export function ImpressionsCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Facebook className="h-4 w-4"/>
            <CardTitle className="text-sm font-medium">Profile Impressions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">6,783</div>
        <p className="text-xs text-muted-foreground">impressions</p>
      </CardContent>
      <CardFooter>
         <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-green-500">284</span>
          </div>
          <div>from 6,499</div>
        </div>
      </CardFooter>
    </Card>
  )
}
