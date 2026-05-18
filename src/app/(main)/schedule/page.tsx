'use client';
import { SchedulePage } from '@/components/schedule/schedule-page';

// This page is now an alias for /tasks/schedule
export default function LegacySchedulePage() {
  return <SchedulePage workstream="tasks" />;
}