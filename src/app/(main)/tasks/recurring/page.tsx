
'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function RecurringTasksPage() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Recurring Tasks" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Recurring Task Templates</h2>
            <p className="text-muted-foreground">
              Create templates for tasks that need to be done on a regular schedule.
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="mt-4 text-lg font-medium">No Templates Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by creating a new recurring task template.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
