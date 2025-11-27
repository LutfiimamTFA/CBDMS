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
    id: 'nav_reports',
    label: 'Reports',
    path: '/reports',
    icon: 'FileText',
    order: 3,
    roles: ['Super Admin', 'Manager'],
  },
];
