
'use server';

/**
 * @fileOverview AI flow to generate a list of ingredients and quantities needed for a dish based on its name.
 *
 * - generateIngredientsList - A function that handles the generation of ingredient list.
 * - GenerateIngredientsListInput - The input type for the generateIngredientsList function.
 * - GenerateIngredientsListOutput - The return type for the generateIngredientsList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateIngredientsListInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to generate ingredients for.'),
  numberOfServings: z.number().describe('The number of servings the ingredients should be for.'),
});
export type GenerateIngredientsListInput = z.infer<typeof GenerateIngredientsListInputSchema>;

const IngredientSchema = z.object({
  name: z.string().describe('The name of the ingredient.'),
  quantity: z.number().describe('The quantity of the ingredient (numeric value).'),
  unit: z.string().describe('The unit for the quantity (e.g., "g", "ml", "pcs", "kg").'),
});

const GenerateIngredientsListOutputSchema = z.object({
  ingredients: z.array(IngredientSchema).describe('A list of ingredients with their names, quantities, and units.'),
});
export type GenerateIngredientsListOutput = z.infer<typeof GenerateIngredientsListOutputSchema>;

export async function generateIngredientsList(input: GenerateIngredientsListInput): Promise<GenerateIngredientsListOutput> {
  return generateIngredientsListFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateIngredientsListPrompt',
  input: {schema: GenerateIngredientsListInputSchema},
  output: {schema: GenerateIngredientsListOutputSchema},
  prompt: `You are a chef. Generate a list of ingredients needed for the dish "{{dishName}}" for {{numberOfServings}} servings.
For each ingredient, provide its name, quantity (as a number), and unit (e.g., "g", "ml", "pcs", "kg").
Return the output as a JSON object with a single key "ingredients".
The "ingredients" key should have a value of an array of objects, where each object has "name" (string), "quantity" (number), and "unit" (string) fields.
Be as accurate as possible. For example:
{
  "ingredients": [
    { "name": "Spaghetti", "quantity": 500, "unit": "g" },
    { "name": "Guanciale", "quantity": 150, "unit": "g" },
    { "name": "Eggs", "quantity": 4, "unit": "pcs" }
  ]
}
Ensure the output strictly follows this JSON format.`,
});

const generateIngredientsListFlow = ai.defineFlow(
  {
    name: 'generateIngredientsListFlow',
    inputSchema: GenerateIngredientsListInputSchema,
    outputSchema: GenerateIngredientsListOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI did not return an output.');
    }
    return output;
  }
);
