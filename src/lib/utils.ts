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

export const statusInfo: Record<Status, StatusInfo> = {
  'To Do': { label: 'To Do', value: 'To Do', icon: Circle },
  'Doing': { label: 'Doing', value: 'Doing', icon: CircleDashed },
  'Done': { label: 'Done', value: 'Done', icon: CheckCircle2 },
};
