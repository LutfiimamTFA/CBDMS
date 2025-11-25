import type { User, Task, Tag } from './types';
import { PlaceHolderImages } from './placeholder-images';
import { addDays, formatISO } from 'date-fns';

const findImage = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl || '';

export const users: User[] = [
  { id: 'user-1', name: 'Sarah Lee', email: 'sarah@example.com', avatarUrl: findImage('user1') },
  { id: 'user-2', name: 'Mike Johnson', email: 'mike@example.com', avatarUrl: findImage('user2') },
  { id: 'user-3', name: 'Emily Chen', email: 'emily@example.com', avatarUrl: findImage('user3') },
  { id: 'user-4', name: 'David Rodriguez', email: 'david@example.com', avatarUrl: findImage('user4') },
];

export const currentUser: User = { id: 'user-5', name: 'Alex Doe', email: 'alex@example.com', avatarUrl: findImage('user5') };

const today = new Date();

const tags: Record<string, Tag> = {
  design: { label: 'Design', color: 'bg-pink-500' },
  dev: { label: 'Development', color: 'bg-blue-500' },
  docs: { label: 'Documentation', color: 'bg-green-500' },
  research: { label: 'Research', color: 'bg-purple-500' },
  bug: { label: 'Bug Fix', color: 'bg-red-500' },
  feature: { label: 'Feature', color: 'bg-yellow-500 text-black' },
}

export const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Design Q3 Marketing Campaign Landing Page',
    status: 'Doing',
    priority: 'Urgent',
    assignees: [users[0], users[2]],
    dueDate: formatISO(addDays(today, 2)),
    timeEstimate: 16,
    timeTracked: 6,
    description: 'Create a visually appealing and high-converting landing page for the upcoming Q3 marketing campaign. Focus on mobile-first design and clear calls-to-action.',
    subtasks: [{ id: 'sub-1', title: 'Create wireframes' }, { id: 'sub-2', title: 'Design mockups' }],
    tags: [tags.design, tags.feature],
  },
  {
    id: 'task-2',
    title: 'Develop User Authentication Flow',
    status: 'Doing',
    priority: 'High',
    assignees: [users[1]],
    dueDate: formatISO(addDays(today, 5)),
    timeEstimate: 24,
    timeTracked: 10,
    description: 'Implement the full user authentication (login, registration, password reset) using JWT and OAuth2.',
    dependencies: ['task-3'],
    tags: [tags.dev, tags.feature],
  },
  {
    id: 'task-3',
    title: 'Setup PostgreSQL Database Schema',
    status: 'Done',
    priority: 'High',
    assignees: [users[1], users[3]],
    dueDate: formatISO(addDays(today, -2)),
    timeEstimate: 8,
    timeTracked: 8,
    description: 'Define and migrate the initial database schema for users, tasks, and projects tables.',
    tags: [tags.dev],
  },
  {
    id: 'task-4',
    title: 'Write API Documentation for v1',
    status: 'To Do',
    priority: 'Medium',
    assignees: [users[3]],
    dueDate: formatISO(addDays(today, 10)),
    timeEstimate: 12,
    timeTracked: 0,
    description: 'Use Swagger/OpenAPI to document all v1 endpoints, including request/response examples.',
    tags: [tags.docs],
  },
  {
    id: 'task-5',
    title: 'Create Onboarding Tutorial for New Users',
    status: 'To Do',
    priority: 'Medium',
    assignees: [users[0], users[2]],
    dueDate: formatISO(addDays(today, 14)),
    timeEstimate: 20,
    timeTracked: 0,
    description: 'Design and implement an interactive tutorial to guide new users through the main features of the application.',
    tags: [tags.design, tags.dev, tags.feature],
  },
  {
    id: 'task-6',
    title: 'Fix Bug #582 - Incorrect Timezone Display',
    status: 'To Do',
    priority: 'High',
    assignees: [users[1]],
    dueDate: formatISO(addDays(today, 1)),
    timeEstimate: 4,
    timeTracked: 0,
    description: 'User reports show that timestamps are not being correctly converted to their local timezone in the reports section.',
    tags: [tags.bug],
  },
  {
    id: 'task-7',
    title: 'Research Competitor "TaskMaster Pro"',
    status: 'Done',
    priority: 'Low',
    assignees: [users[2]],
    dueDate: formatISO(addDays(today, -7)),
    timeEstimate: 8,
    timeTracked: 9,
    description: 'Analyze the features, pricing, and user experience of "TaskMaster Pro" to identify our competitive advantages and areas for improvement.',
    tags: [tags.research],
  },
  {
    id: 'task-8',
    title: 'Plan Team Offsite Event',
    status: 'To Do',
    priority: 'Low',
    assignees: [currentUser],
    dueDate: formatISO(addDays(today, 30)),
    timeEstimate: 10,
    timeTracked: 0,
    description: 'Organize the annual team offsite, including location scouting, activity planning, and budget management.',
  },
];
