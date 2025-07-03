"use server";

import { ai } from '@/ai/genkit';
import {
  GenerateIngredientsListInput,
  GenerateIngredientsListOutput,
  GenerateIngredientsListInputSchema,
  GenerateIngredientsListOutputSchema,
  IngredientSchema
} from './ingredient-types';

const prompt = ai.definePrompt({
  name: 'generateIngredientsListPrompt',
  input: { schema: GenerateIngredientsListInputSchema },
  output: { schema: GenerateIngredientsListOutputSchema },
  prompt: `You are a chef. Generate a list of ingredients needed for the dish "{{dishName}}" for {{numberOfServings}} servings.\nFor each ingredient, provide its name, quantity (as a number), and unit (e.g., "g", "ml", "pcs", "kg").\nReturn the output as a JSON object with a single key "ingredients".\nThe "ingredients" key should have a value of an array of objects, where each object has "name" (string), "quantity" (number), and "unit" (string) fields.\nBe as accurate as possible. For example:\n{\n  "ingredients": [\n    { "name": "Spaghetti", "quantity": 500, "unit": "g" },\n    { "name": "Guanciale", "quantity": 150, "unit": "g" },\n    { "name": "Eggs", "quantity": 4, "unit": "pcs" }\n  ]\n}\nEnsure the output strictly follows this JSON format.`,
});

const generateIngredientsListFlow = ai.defineFlow(
  {
    name: 'generateIngredientsListFlow',
    inputSchema: GenerateIngredientsListInputSchema,
    outputSchema: GenerateIngredientsListOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI did not return an output.');
    }
    return output;
  }
);

export async function generateIngredientsList(input: GenerateIngredientsListInput): Promise<GenerateIngredientsListOutput> {
  return generateIngredientsListFlow(input);
}
