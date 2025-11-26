import { config } from 'dotenv';
config();

import '@/ai/flows/smart-task-suggestions.ts';
import '@/ai/flows/suggest-priority.ts';
import '@/ai/flows/validate-priority-change.ts';
