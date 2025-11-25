'use server';

/**
 * @fileOverview An AI agent that suggests tasks based on past work patterns and estimated durations.
 *
 * - suggestTasks - A function that generates task suggestions.
 * - SmartTaskSuggestionsInput - The input type for the suggestTasks function.
 * - SmartTaskSuggestionsOutput - The return type for the suggestTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartTaskSuggestionsInputSchema = z.object({
  pastTasks: z.string().describe('A list of past tasks with descriptions and time spent on each task.'),
  userRole: z.string().describe('The role of the user.'),
});
export type SmartTaskSuggestionsInput = z.infer<typeof SmartTaskSuggestionsInputSchema>;

const SmartTaskSuggestionsOutputSchema = z.object({
  suggestedTasks: z.array(
    z.object({
      taskName: z.string().describe('The name of the suggested task.'),
      estimatedDuration: z.number().describe('The estimated duration in hours for the suggested task.'),
      reason: z.string().describe('The reason why the task is suggested')
    })
  ).describe('A list of suggested tasks with estimated durations.'),
});
export type SmartTaskSuggestionsOutput = z.infer<typeof SmartTaskSuggestionsOutputSchema>;

export async function suggestTasks(input: SmartTaskSuggestionsInput): Promise<SmartTaskSuggestionsOutput> {
  return suggestTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartTaskSuggestionsPrompt',
  input: {schema: SmartTaskSuggestionsInputSchema},
  output: {schema: SmartTaskSuggestionsOutputSchema},
  prompt: `You are an AI assistant that analyzes user's past tasks and suggests potential tasks they might need to work on next, along with estimated durations.

You will be provided with a list of past tasks, their descriptions, and the time spent on each task.

Based on this information, and the user's role, suggest tasks that the user might need to work on next.
Also, estimate the duration for each suggested task in hours.

Past Tasks: {{{pastTasks}}}
User Role: {{{userRole}}}

Format your output as a JSON array of task objects, each containing taskName, estimatedDuration, and reason fields.
Ensure the output is valid JSON.
Here is an example of JSON output:
[{
"taskName": "Prepare presentation slides",
"estimatedDuration": 4,
"reason": "Following up on the project status meeting, presentation is needed"
},
{
"taskName": "Send weekly status report",
"estimatedDuration": 1,
"reason": "Weekly reporting is required"
}]
`,
});

const suggestTasksFlow = ai.defineFlow(
  {
    name: 'suggestTasksFlow',
    inputSchema: SmartTaskSuggestionsInputSchema,
    outputSchema: SmartTaskSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
