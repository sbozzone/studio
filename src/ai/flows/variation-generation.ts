
'use server';

/**
 * @fileOverview Item variation AI agent.
 *
 * - generateItemVariations - A function that handles item variation generation.
 * - GenerateItemVariationsInput - The input type for the generateItemVariations function.
 * - GenerateItemVariationsOutput - The return type for the generateItemVariations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema still expects strings for selected item and favorite items
const GenerateItemVariationsInputSchema = z.object({
  selectedMeal: z.string().describe('The item (entree or side dish) for which to generate variations.'), // field name selectedMeal kept
  favoriteMeals: z.array(z.string()).describe('A list of the user\u0027s favorite items (entrees or side dishes).'), // field name favoriteMeals kept
});
export type GenerateItemVariationsInput = z.infer<typeof GenerateItemVariationsInputSchema>;

const GenerateItemVariationsOutputSchema = z.object({
  variations: z
    .array(z.string())
    .describe('A list of suggested item variations based on ingredient substitutions or style changes.'),
});
export type GenerateItemVariationsOutput = z.infer<typeof GenerateItemVariationsOutputSchema>;

export async function generateMealVariations( // Function name kept for now
  input: GenerateItemVariationsInput
): Promise<GenerateItemVariationsOutput> {
  return generateItemVariationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateItemVariationsPrompt', // Renamed prompt
  input: {schema: GenerateItemVariationsInputSchema},
  output: {schema: GenerateItemVariationsOutputSchema},
  prompt: `You are a culinary expert who can create interesting variations on items (entrees or side dishes).

  You will take a selected item and a list of favorite items and suggest variations to the selected item by incorporating ingredients or techniques from the favorite items.
  Suggest no more than 3 variations. The substitutions may range from small variations (e.g., add different spices) to significant changes in key ingredients or preparation style.
  Focus on creating appealing and practical variations.

  Selected Item: {{{selectedMeal}}}
  Favorite Items: {{#each favoriteMeals}}{{{this}}}\n{{/each}}`,
});

const generateItemVariationsFlow = ai.defineFlow(
  {
    name: 'generateItemVariationsFlow', // Renamed flow
    inputSchema: GenerateItemVariationsInputSchema,
    outputSchema: GenerateItemVariationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
