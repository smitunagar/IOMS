import { z } from 'genkit';

export const GenerateIngredientsListInputSchema = z.object({
  dishName: z.string().describe('The name of the dish to generate ingredients for.'),
  numberOfServings: z.number().describe('The number of servings the ingredients should be for.'),
});
export type GenerateIngredientsListInput = z.infer<typeof GenerateIngredientsListInputSchema>;

export const IngredientSchema = z.object({
  name: z.string().describe('The name of the ingredient.'),
  quantity: z.number().describe('The quantity of the ingredient (numeric value).'),
  unit: z.string().describe('The unit for the quantity (e.g., "g", "ml", "pcs", "kg").'),
});

export const GenerateIngredientsListOutputSchema = z.object({
  ingredients: z.array(IngredientSchema).describe('A list of ingredients with their names, quantities, and units.'),
});
export type GenerateIngredientsListOutput = z.infer<typeof GenerateIngredientsListOutputSchema>;
