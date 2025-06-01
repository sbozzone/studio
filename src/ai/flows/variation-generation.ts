'use server';

/**
 * @fileOverview Meal variation AI agent.
 *
 * - generateMealVariations - A function that handles meal variation generation.
 * - GenerateMealVariationsInput - The input type for the generateMealVariations function.
 * - GenerateMealVariationsOutput - The return type for the generateMealVariations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMealVariationsInputSchema = z.object({
  selectedMeal: z.string().describe('The meal for which to generate variations.'),
  favoriteMeals: z.array(z.string()).describe('A list of the user\u0027s favorite meals.'),
});
export type GenerateMealVariationsInput = z.infer<typeof GenerateMealVariationsInputSchema>;

const GenerateMealVariationsOutputSchema = z.object({
  variations: z
    .array(z.string())
    .describe('A list of suggested meal variations based on ingredient substitutions.'),
});
export type GenerateMealVariationsOutput = z.infer<typeof GenerateMealVariationsOutputSchema>;

export async function generateMealVariations(
  input: GenerateMealVariationsInput
): Promise<GenerateMealVariationsOutput> {
  return generateMealVariationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMealVariationsPrompt',
  input: {schema: GenerateMealVariationsInputSchema},
  output: {schema: GenerateMealVariationsOutputSchema},
  prompt: `You are a culinary expert who can create interesting variations on meals.

  You will take a selected meal and a list of favorite meals and suggest variations to the selected meal by incorporating ingredients or techniques from the favorite meals.
  Suggest no more than 2 substitutions, and the substitutions may range from small variations (eg add pepper flakes) to total change of key ingredients.

  Selected Meal: {{{selectedMeal}}}
  Favorite Meals: {{#each favoriteMeals}}{{{this}}}\n{{/each}}`,
});

const generateMealVariationsFlow = ai.defineFlow(
  {
    name: 'generateMealVariationsFlow',
    inputSchema: GenerateMealVariationsInputSchema,
    outputSchema: GenerateMealVariationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
