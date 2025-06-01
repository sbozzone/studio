'use server';

/**
 * @fileOverview AI agent that suggests meals from the user's input meal list.
 *
 * - suggestMeals - A function that suggests meals based on the provided meal list.
 * - SuggestMealsInput - The input type for the suggestMeals function, a list of meal names.
 * - SuggestMealsOutput - The return type for the suggestMeals function, a list of suggested meal names.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMealsInputSchema = z.object({
  mealList: z
    .array(z.string())
    .describe('A list of meals the user has entered into the app.'),
});
export type SuggestMealsInput = z.infer<typeof SuggestMealsInputSchema>;

const SuggestMealsOutputSchema = z.object({
  suggestedMeals: z
    .array(z.string())
    .describe('A list of suggested meals from the input meal list.'),
});
export type SuggestMealsOutput = z.infer<typeof SuggestMealsOutputSchema>;

export async function suggestMeals(input: SuggestMealsInput): Promise<SuggestMealsOutput> {
  return suggestMealsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMealsPrompt',
  input: {schema: SuggestMealsInputSchema},
  output: {schema: SuggestMealsOutputSchema},
  prompt: `You are a helpful assistant that suggests meals from a given list of meals.

  Given the following list of meals:
  {{#each mealList}}{{{this}}}\n{{/each}}

  Suggest meals from this list. The suggestions should be diverse.
  Make sure to only suggest meals that are in the list.
  Respond with a JSON object that contains an array of suggested meals.`, //Fixed: remove additional context about making them diverse.
});

const suggestMealsFlow = ai.defineFlow(
  {
    name: 'suggestMealsFlow',
    inputSchema: SuggestMealsInputSchema,
    outputSchema: SuggestMealsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
