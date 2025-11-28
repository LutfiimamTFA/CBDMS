import type { NavigationItem } from './types';

export const defaultNavItems: NavigationItem[] = [
  {
    id: 'nav_taskboard',
    label: 'Task Board',
    path: '/dashboard',
    icon: 'KanbanSquare',
    order: 1,
    roles: ['Super Admin', 'Manager', 'Employee'],
  },
  {
    id: 'nav_list',
    label: 'List',
    path: '/tasks',
    icon: 'ClipboardList',
    order: 2,
    roles: ['Super Admin', 'Manager', 'Employee'],
  },
  {
    id: 'nav_calendar',
    label: 'Calendar',
    path: '/calendar',
    icon: 'CalendarDays',
    order: 3,
    roles: ['Super Admin', 'Manager'],
  },
  {
    id: 'nav_reports',
    label: 'Reports',
    path: '/reports',
    icon: 'FileText',
    order: 4,
    roles: ['Super Admin', 'Manager'],
  },
];
