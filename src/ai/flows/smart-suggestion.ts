
'use server';

/**
 * @fileOverview AI agent that suggests items from the user's input item list.
 * This flow is no longer used and can be deleted.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestItemsInputSchema = z.object({
  mealList: z
    .array(z.string())
    .describe('A list of items (entrees or side dishes) the user has entered into the app.'),
});
export type SuggestItemsInput = z.infer<typeof SuggestItemsInputSchema>;

const SuggestItemsOutputSchema = z.object({
  suggestedMeals: z
    .array(z.string())
    .describe('A list of suggested items (entrees or side dishes) from the input list.'),
});
export type SuggestItemsOutput = z.infer<typeof SuggestItemsOutputSchema>;

export async function suggestMeals(input: SuggestItemsInput): Promise<SuggestItemsOutput> {
  // Return empty or throw error as this flow is deprecated
  console.warn('suggestMeals AI flow called but is deprecated.');
  return { suggestedMeals: [] };
}

const prompt = ai.definePrompt({
  name: 'suggestItemsPrompt_DEPRECATED', 
  input: {schema: SuggestItemsInputSchema},
  output: {schema: SuggestItemsOutputSchema},
  prompt: `This prompt is deprecated.`,
});

const suggestItemsFlow = ai.defineFlow(
  {
    name: 'suggestItemsFlow_DEPRECATED', 
    inputSchema: SuggestItemsInputSchema,
    outputSchema: SuggestItemsOutputSchema,
  },
  async input => {
    // const {output} = await prompt(input);
    // return output!;
    return { suggestedMeals: [] };
  }
);
