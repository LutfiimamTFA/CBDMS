'use server';

/**
 * @fileOverview An AI agent that validates a requested task priority change.
 *
 * - validatePriorityChange - A function that validates the priority change.
 * - ValidatePriorityChangeInput - The input type for the function.
 * - ValidatePriorityChangeOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ValidatePriorityChangeInputSchema = z.object({
  title: z.string().describe('The title of the task.'),
  description: z.string().optional().describe('The description of the task.'),
  currentPriority: z.enum(['Urgent', 'High', 'Medium', 'Low']).describe('The current priority of the task.'),
  requestedPriority: z.enum(['Urgent', 'High', 'Medium', 'Low']).describe('The new priority being requested for the task.'),
});
export type ValidatePriorityChangeInput = z.infer<typeof ValidatePriorityChangeInputSchema>;

const ValidatePriorityChangeOutputSchema = z.object({
  isApproved: z
    .boolean()
    .describe(
      'Whether the priority change is approved by the AI assistant. This should generally be true unless a user is trying to escalate to Urgent without a clear reason.'
    ),
  reason: z
    .string()
    .describe(
      'A brief, constructive reason for the approval or disapproval. Explains why the change makes sense or why caution is advised.'
    ),
  suggestedPriority: z
    .enum(['Urgent', 'High', 'Medium', 'Low'])
    .describe('The priority that the AI assistant believes is most appropriate.'),
});
export type ValidatePriorityChangeOutput = z.infer<typeof ValidatePriorityChangeOutputSchema>;

export async function validatePriorityChange(
  input: ValidatePriorityChangeInput
): Promise<ValidatePriorityChangeOutput> {
  return validatePriorityChangeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'validatePriorityChangePrompt',
  input: { schema: ValidatePriorityChangeInputSchema },
  output: { schema: ValidatePriorityChangeOutputSchema },
  prompt: `You are an expert project manager acting as an "AI Priority Guard". Your job is to provide a second opinion on task priority changes.

A user wants to change a task's priority from '{{{currentPriority}}}' to '{{{requestedPriority}}}'.

Analyze the task details:
- Task Title: {{{title}}}
- Task Description: {{{description}}}

Your main goal is to prevent "priority inflation," where everything becomes urgent. Be critical but helpful.

- If the change is a downgrade (e.g., High to Medium), always approve it. Reason: "Downgrading priority is fine."
- If the change is an upgrade to 'Low', 'Medium', or 'High', generally approve it unless it seems very wrong.
- If the change is an upgrade to 'Urgent', be very strict. Look for keywords like 'blocker', 'critical', 'production issue', 'deadline', 'must-do'. If these are missing, disapprove the change to 'Urgent' and suggest 'High' instead. Provide a clear reason why 'Urgent' might not be appropriate yet.

Your response must be in valid JSON format.

Example for disapproving Urgent:
{
  "isApproved": false,
  "reason": "This task doesn't seem to be a critical blocker. 'High' priority is more suitable for important features that are not production emergencies.",
  "suggestedPriority": "High"
}

Example for approving Urgent:
{
  "isApproved": true,
  "reason": "Approved. The task is marked as a 'critical blocker', which justifies the 'Urgent' priority.",
  "suggestedPriority": "Urgent"
}
`,
});

const validatePriorityChangeFlow = ai.defineFlow(
  {
    name: 'validatePriorityChangeFlow',
    inputSchema: ValidatePriorityChangeInputSchema,
    outputSchema: ValidatePriorityChangeOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
