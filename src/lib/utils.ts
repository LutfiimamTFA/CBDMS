import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpCircle,
  Minus,
  Circle,
  CircleDashed,
  CheckCircle2
} from 'lucide-react';
import type { Priority, PriorityInfo, Status, StatusInfo } from '@/lib/types';
import type { Duration } from 'date-fns';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const priorityInfo: Record<Priority, PriorityInfo> = {
  Urgent: {
    label: 'Urgent',
    value: 'Urgent',
    icon: ArrowUpCircle,
    color: 'text-destructive',
  },
  High: {
    label: 'High',
    value: 'High',
    icon: ArrowUp,
    color: 'text-orange-500 dark:text-orange-400',
  },
  Medium: {
    label: 'Medium',
    value: 'Medium',
    icon: Minus,
    color: 'text-primary',
  },
  Low: {
    label: 'Low',
    value: 'Low',
    icon: ArrowDown,
    color: 'text-muted-foreground',
  },
};

// This is now just a fallback/icon mapping, not the source of truth for statuses
export const statusInfo: Record<string, Omit<StatusInfo, 'value' | 'label'>> = {
  'To Do': { icon: Circle },
  'Doing': { icon: CircleDashed },
  'Done': { icon: CheckCircle2 },
};

export const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
};

export function formatDuration(duration: Duration) {
  const parts: string[] = [];
  if (duration.days && duration.days > 0) {
    parts.push(`${duration.days}d`);
  }
  if (duration.hours && duration.hours > 0) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes && duration.minutes > 0) {
    parts.push(`${duration.minutes}m`);
  }
  
  if (parts.length === 0) return '0m';

  return parts.slice(0, 2).join(' '); // Show at most 2 units (e.g., "1d 4h" instead of "1d 4h 30m")
}

const brandColors = [
  '#06b6d4', // cyan-500
  '#8b5cf6', // purple-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#f43f5e'  // rose-500
];

export const getBrandColor = (brandId: string) => {
  if (!brandId) return '#6b7280'; // gray-500
  let hash = 0;
  for (let i = 0; i < brandId.length; i++) {
    hash = brandId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % brandColors.length);
  return brandColors[index];
};
