import type { User, Task, Tag } from './types';

export const tags: Record<string, Tag> = {
  design: { label: 'Design', color: 'bg-pink-500 text-white' },
  dev: { label: 'Development', color: 'bg-blue-500 text-white' },
  docs: { label: 'Documentation', color: 'bg-green-500 text-white' },
  research: { label: 'Research', color: 'bg-purple-500 text-white' },
  bug: { label: 'Bug Fix', color: 'bg-red-500 text-white' },
  feature: { label: 'Feature', color: 'bg-yellow-500 text-black' },
}
