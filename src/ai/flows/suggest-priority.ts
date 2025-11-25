'use server';

/**
 * @fileOverview An AI agent that suggests task priority based on its title and description.
 *
 * - suggestPriority - A function that generates a priority suggestion.
 * - SuggestPriorityInput - The input type for the suggestPriority function.
 * - SuggestPriorityOutput - The return type for the suggestPriority function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestPriorityInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  description: z.string().optional().describe('The description of the task.'),
});
export type SuggestPriorityInput = z.infer<typeof SuggestPriorityInputSchema>;

const SuggestPriorityOutputSchema = z.object({
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']).describe('The suggested priority for the task.'),
  reason: z.string().describe('The reason for the suggested priority.'),
});
export type SuggestPriorityOutput = z.infer<typeof SuggestPriorityOutputSchema>;

export async function suggestPriority(input: SuggestPriorityInput): Promise<SuggestPriorityOutput> {
  return suggestPriorityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPriorityPrompt',
  input: {schema: SuggestPriorityInputSchema},
  output: {schema: SuggestPriorityOutputSchema},
  prompt: `You are an expert project manager. Your task is to suggest a priority level for a given task based on its title and description.
Analyze the task for keywords indicating urgency, importance, and impact.

Task Title: {{{title}}}
Task Description: {{{description}}}

Output the priority as one of 'Urgent', 'High', 'Medium', or 'Low' and provide a brief reason for your suggestion.
- 'Urgent': For critical, time-sensitive issues like production bugs or blockers.
- 'High': For important features or tasks that have a significant impact on the project timeline.
- 'Medium': For regular tasks that are part of the normal workflow.
- 'Low': For non-essential tasks, improvements, or "nice-to-have" features.

Format your output as a valid JSON object.
`,
});

const suggestPriorityFlow = ai.defineFlow(
  {
    name: 'suggestPriorityFlow',
    inputSchema: SuggestPriorityInputSchema,
    outputSchema: SuggestPriorityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
