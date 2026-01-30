'use client';

import { SchedulePage } from '@/components/schedule/schedule-page';

// This page now uses the modern, consistent SchedulePage component for a better user experience.
export default function CalendarPage() {
  return <SchedulePage workstream="tasks" />;
}
