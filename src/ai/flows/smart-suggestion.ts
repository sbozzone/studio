
'use server';

/**
 * @fileOverview AI agent that suggests items from the user's input item list.
 *
 * - suggestItems - A function that suggests items based on the provided item list.
 * - SuggestItemsInput - The input type for the suggestItems function, a list of item names.
 * - SuggestItemsOutput - The return type for the suggestItems function, a list of suggested item names.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema still expects a list of strings (item names for simplicity for now)
const SuggestItemsInputSchema = z.object({
  mealList: z // Field name kept as mealList to match existing AI prompt structure if sensitive
    .array(z.string())
    .describe('A list of items (entrees or side dishes) the user has entered into the app.'),
});
export type SuggestItemsInput = z.infer<typeof SuggestItemsInputSchema>;

// Output schema still returns a list of strings
const SuggestItemsOutputSchema = z.object({
  suggestedMeals: z // Field name kept as suggestedMeals
    .array(z.string())
    .describe('A list of suggested items (entrees or side dishes) from the input list.'),
});
export type SuggestItemsOutput = z.infer<typeof SuggestItemsOutputSchema>;

export async function suggestMeals(input: SuggestItemsInput): Promise<SuggestItemsOutput> { // Function name kept for now
  return suggestItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestItemsPrompt', // Renamed prompt
  input: {schema: SuggestItemsInputSchema},
  output: {schema: SuggestItemsOutputSchema},
  prompt: `You are a helpful assistant that suggests meals/items (entrees or side dishes) from a given list.

  Given the following list of items:
  {{#each mealList}}{{{this}}}\n{{/each}}

  Suggest items from this list. The suggestions should be diverse.
  Make sure to only suggest items that are in the list.
  Respond with a JSON object that contains an array of suggested items (use the key "suggestedMeals").`,
});

const suggestItemsFlow = ai.defineFlow(
  {
    name: 'suggestItemsFlow', // Renamed flow
    inputSchema: SuggestItemsInputSchema,
    outputSchema: SuggestItemsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
