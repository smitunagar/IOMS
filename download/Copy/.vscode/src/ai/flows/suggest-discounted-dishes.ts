
'use server';
/**
 * @fileOverview AI flow to suggest dishes to discount based on expiring ingredients and menu.
 *
 * - suggestDiscountedDishes - A function that handles the discount suggestion process.
 * - SuggestDiscountedDishesInput - The input type for the suggestDiscountedDishes function.
 * - SuggestDiscountedDishesOutput - The return type for the suggestDiscountedDishes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpiringIngredientSchema = z.object({
  name: z.string().describe('The name of the expiring ingredient.'),
  quantity: z.number().describe('The current quantity of the ingredient in stock.'),
  unit: z.string().describe('The unit of the ingredient (e.g., g, ml, pcs).'),
  daysUntilExpiry: z.number().describe('Number of days until the ingredient expires. 0 means expires today, negative means already expired.'),
});

const DishIngredientSchema = z.object({
  name: z.string().describe('The name of an ingredient in the dish.'),
  quantityPerDish: z.number().describe('The quantity of this ingredient needed for one serving of the dish.'),
  unit: z.string().describe('The unit for this ingredient in the dish recipe.'),
});

const MenuDishSchema = z.object({
  name: z.string().describe('The name of the dish on the menu.'),
  ingredients: z.array(DishIngredientSchema).describe('The list of ingredients and their quantities required for this dish.'),
  // currentPrice: z.optional(z.number()).describe('The current selling price of the dish.'), // Optional: Could be used for more advanced discount % logic
});

const SuggestDiscountedDishesInputSchema = z.object({
  expiringIngredients: z.array(ExpiringIngredientSchema).describe('A list of ingredients that are expiring soon or have already expired.'),
  menuDishes: z.array(MenuDishSchema).describe('The current list of dishes available on the menu, including their recipes.'),
});
export type SuggestDiscountedDishesInput = z.infer<typeof SuggestDiscountedDishesInputSchema>;

const DiscountSuggestionSchema = z.object({
  dishName: z.string().describe('The name of the dish recommended for a discount.'),
  reason: z.string().describe('A brief explanation for why this dish is suggested for a discount (e.g., uses specific expiring ingredients).'),
  suggestedDiscountPercentage: z.optional(z.number()).describe('An optional suggested discount percentage (e.g., 10 for 10%, 15 for 15%).'),
  usesExpiringIngredients: z.array(z.string()).describe('List of expiring ingredients names that this dish uses significantly.'),
});

const SuggestDiscountedDishesOutputSchema = z.object({
  suggestions: z.array(DiscountSuggestionSchema).describe('A list of discount suggestions. Can be empty if no suitable suggestions are found.'),
});
export type SuggestDiscountedDishesOutput = z.infer<typeof SuggestDiscountedDishesOutputSchema>;

export async function suggestDiscountedDishes(input: SuggestDiscountedDishesInput): Promise<SuggestDiscountedDishesOutput> {
  // Basic validation or pre-processing if needed
  if (input.expiringIngredients.length === 0) {
    return { suggestions: [] }; // No expiring ingredients, no suggestions needed.
  }
  if (input.menuDishes.length === 0) {
    return { suggestions: [] }; // No menu dishes to suggest.
  }
  return suggestDiscountedDishesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestDiscountedDishesPrompt',
  input: {schema: SuggestDiscountedDishesInputSchema},
  output: {schema: SuggestDiscountedDishesOutputSchema},
  prompt: `You are an expert restaurant operations assistant focused on minimizing food waste and maximizing profit through strategic discounts.
Analyze the provided list of "expiringIngredients" (which includes items expiring very soon or already expired) and the "menuDishes" (which includes their recipes).

Your goal is to suggest specific dishes from the "menuDishes" list that should be put on discount.
Base your suggestions on the following criteria:
1.  **Ingredient Utilization**: Prioritize dishes that heavily use one or more of the "expiringIngredients". A dish is a good candidate if it can help consume a significant amount of an ingredient that is about to go bad.
2.  **Quantity Matching**: Consider the quantity of the expiring ingredient in stock versus how much is needed per dish. Suggesting a dish that uses a tiny amount of a massively overstocked expiring item might not be as effective as one that uses a larger portion.
3.  **Multiple Expiring Ingredients**: Dishes that use multiple expiring ingredients are excellent candidates.
4.  **Urgency**: Pay attention to "daysUntilExpiry". Items expiring sooner (0 days or negative) should be prioritized.

For each suggested dish, provide:
- "dishName": The exact name of the dish from the menu.
- "reason": A concise explanation of why this dish is recommended for a discount, specifically mentioning which expiring ingredient(s) it helps to use.
- "suggestedDiscountPercentage" (Optional): If you feel confident, suggest a discount percentage (e.g., 10, 15, 20, 25). This could be higher for items that are very close to expiry or if a dish uses a large amount of an expiring item.
- "usesExpiringIngredients": A list of the names of the expiring ingredients this dish prominently features.

If no dishes are suitable for discount (e.g., no menu items use the expiring ingredients, or quantities are too low to matter), return an empty "suggestions" array.

**Expiring Ingredients:**
{{#each expiringIngredients}}
- Name: {{name}}, Quantity: {{quantity}} {{unit}}, Expires in: {{daysUntilExpiry}} days
{{/each}}

**Menu Dishes and Recipes:**
{{#each menuDishes}}
- Dish: {{name}}
  Ingredients:
  {{#each ingredients}}
  - {{name}}: {{quantityPerDish}} {{unit}}
  {{/each}}
{{/each}}

Provide your response strictly in the JSON format defined by the output schema.
Example of a single suggestion object:
{
  "dishName": "Tomato Basil Soup",
  "reason": "Effectively uses a large quantity of tomatoes expiring in 1 day.",
  "suggestedDiscountPercentage": 15,
  "usesExpiringIngredients": ["Tomatoes"]
}
`,
});

const suggestDiscountedDishesFlow = ai.defineFlow(
  {
    name: 'suggestDiscountedDishesFlow',
    inputSchema: SuggestDiscountedDishesInputSchema,
    outputSchema: SuggestDiscountedDishesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      // Handle cases where AI might not return output, though schema validation should help
      console.warn("AI prompt for discount suggestions did not return an output.");
      return { suggestions: [] };
    }
    return output;
  }
);

    
