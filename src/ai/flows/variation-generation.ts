
'use server';

/**
 * @fileOverview Item variation AI agent. (DEPRECATED - This flow is no longer used)
 *
 * - generateItemVariations - A function that handles item variation generation.
 * - GenerateItemVariationsInput - The input type for the generateItemVariations function.
 * - GenerateItemVariationsOutput - The return type for the generateItemVariations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateItemVariationsInputSchema_DEPRECATED = z.object({
  selectedMeal: z.string().describe('The item (entree or side dish) for which to generate variations.'),
  favoriteMeals: z.array(z.string()).describe('A list of the user\u0027s favorite items (entrees or side dishes).'),
});
export type GenerateItemVariationsInput_DEPRECATED = z.infer<typeof GenerateItemVariationsInputSchema_DEPRECATED>;

const GenerateItemVariationsOutputSchema_DEPRECATED = z.object({
  variations: z
    .array(z.string())
    .describe('A list of suggested item variations based on ingredient substitutions or style changes.'),
});
export type GenerateItemVariationsOutput_DEPRECATED = z.infer<typeof GenerateItemVariationsOutputSchema_DEPRECATED>;

export async function generateMealVariations(
  input: GenerateItemVariationsInput_DEPRECATED
): Promise<GenerateItemVariationsOutput_DEPRECATED> {
  console.warn('generateMealVariations AI flow called but is deprecated.');
  return { variations: [] };
  // return generateItemVariationsFlow(input);
}

const prompt_DEPRECATED = ai.definePrompt({
  name: 'generateItemVariationsPrompt_DEPRECATED',
  input: {schema: GenerateItemVariationsInputSchema_DEPRECATED},
  output: {schema: GenerateItemVariationsOutputSchema_DEPRECATED},
  prompt: `This prompt is deprecated.`,
});

const generateItemVariationsFlow_DEPRECATED = ai.defineFlow(
  {
    name: 'generateItemVariationsFlow_DEPRECATED',
    inputSchema: GenerateItemVariationsInputSchema_DEPRECATED,
    outputSchema: GenerateItemVariationsOutputSchema_DEPRECATED,
  },
  async input => {
    // const {output} = await prompt_DEPRECATED(input);
    // return output!;
    return { variations: [] };
  }
);
