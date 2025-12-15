'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUp, Linkedin } from 'lucide-react';

export function EngagementCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Linkedin className="h-4 w-4"/>
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">15.38%</div>
      </CardContent>
      <CardFooter>
         <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-green-500">2%</span>
          </div>
          <div>from 13.38%</div>
        </div>
      </CardFooter>
    </Card>
  )
}
