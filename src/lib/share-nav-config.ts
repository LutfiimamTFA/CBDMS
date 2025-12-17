
import type { NavigationItem } from './types';

// This is the single source of truth for what can be shared.
// It is static and not dependent on user roles or any other dynamic data.
export const shareableNavItems: Omit<NavigationItem, 'roles' | 'parentId'>[] = [
  {
    id: 'nav_task_board',
    label: 'Board',
    path: '/dashboard',
    icon: 'KanbanSquare',
    order: 1,
  },
  {
    id: 'nav_list',
    label: 'List',
    path: '/tasks',
    icon: 'ClipboardList',
    order: 2,
  },
  {
    id: 'nav_calendar',
    label: 'Calendar',
    path: '/calendar',
    icon: 'Calendar',
    order: 3,
  },
  {
    id: 'nav_performance_analysis',
    label: 'Reports',
    path: '/reports',
    icon: 'FileText',
    order: 4,
  },
];

// A mapping to get the URL scope from the path.
const pathScopeMap: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/tasks': 'tasks',
  '/calendar': 'calendar',
  '/reports': 'reports',
};

export function getScopeFromPath(path: string): string | undefined {
  return pathScopeMap[path];
}
