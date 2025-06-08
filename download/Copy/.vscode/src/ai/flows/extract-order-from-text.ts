
'use server';
/**
 * @fileOverview AI flow to extract order details from a textual call transcript.
 *
 * - extractOrderFromText - A function to process the transcript.
 * - ExtractOrderInput - The input type (transcript string).
 * - ExtractedOrderOutput - The structured output from the AI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractOrderInputSchema = z.object({
  transcript: z.string().describe('The full text transcript of the customer call.'),
});
export type ExtractOrderInput = z.infer<typeof ExtractOrderInputSchema>;

const ExtractedOrderItemSchema = z.object({
  name: z.string().describe('The name of the dish or item mentioned by the customer. Try to match common dish names.'),
  quantity: z.number().min(1).describe('The quantity of this dish or item.'),
  // NLU for exact menu mapping is hard, so we keep it simple.
  // specialInstructions: z.string().optional().describe('Any special instructions for this item, e.g., "no onions".'),
});

const ExtractedOrderOutputSchema = z.object({
  orderType: z.enum(['dine-in', 'delivery', 'pickup', 'unknown'])
    .describe('The type of order inferred from the transcript (e.g., dine-in, delivery, pickup). Default to "unknown" if not clear.'),
  items: z.array(ExtractedOrderItemSchema).describe('List of items the customer wants to order.'),
  customerName: z.string().optional().describe('The customer\'s name, if mentioned for delivery or pickup.'),
  customerPhone: z.string().optional().describe('The customer\'s phone number, if mentioned.'),
  customerAddress: z.string().optional().describe('The customer\'s delivery address, if mentioned.'),
  notes: z.string().optional().describe('Any general notes or special requests for the entire order not specific to one item.'),
  confidenceScore: z.number().min(0).max(1).optional().describe('A score from 0 to 1 indicating the AI\'s confidence in the extracted details. This is a suggestion for the AI model to provide if possible.'),
});
export type ExtractedOrderOutput = z.infer<typeof ExtractedOrderOutputSchema>;


export async function extractOrderFromText(input: ExtractOrderInput): Promise<ExtractedOrderOutput> {
  return extractOrderFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractOrderFromTextPrompt',
  input: { schema: ExtractOrderInputSchema },
  output: { schema: ExtractedOrderOutputSchema },
  prompt: `You are an AI assistant helping a restaurant take orders from a phone call transcript.
Analyze the following transcript and extract the order details.

**Transcript:**
"{{{transcript}}}"

**Instructions:**
1.  **Identify Items and Quantities:** List all food and drink items the customer mentions and their quantities.
2.  **Determine Order Type:** Infer if it's for 'dine-in', 'delivery', or 'pickup'. If unclear, set to 'unknown'.
3.  **Customer Information (for Delivery/Pickup):**
    *   If it's a delivery or pickup order, extract the customer's name, phone number, and delivery address if provided.
4.  **Special Requests/Notes:** Capture any general notes or special requests for the order.
5.  **Dish Names:** Use common names for dishes. Do not invent new dish names. If a dish is unclear, you can omit it or note it in the general notes.
6.  **Confidence (Optional):** If possible, provide a confidence score (0.0 to 1.0) on how accurately you believe you've extracted the complete order.

**Output Format:**
Return a JSON object strictly matching the defined output schema.
Example:
{
  "orderType": "delivery",
  "items": [
    { "name": "Pepperoni Pizza", "quantity": 1 },
    { "name": "Coke", "quantity": 2 }
  ],
  "customerName": "Jane Doe",
  "customerPhone": "555-123-4567",
  "customerAddress": "123 Main St, Anytown",
  "notes": "Please make the pizza extra crispy.",
  "confidenceScore": 0.85
}

If no clear order can be extracted, return an empty items list and orderType "unknown".
`,
});

const extractOrderFromTextFlow = ai.defineFlow(
  {
    name: 'extractOrderFromTextFlow',
    inputSchema: ExtractOrderInputSchema,
    outputSchema: ExtractedOrderOutputSchema,
  },
  async (input: ExtractOrderInput) => {
    // Basic validation: Ensure transcript is not empty
    if (!input.transcript || input.transcript.trim() === "") {
      return {
        orderType: 'unknown',
        items: [],
        notes: "Transcript was empty.",
        confidenceScore: 0
      };
    }

    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI did not return an output for order extraction.');
    }
    return output;
  }
);

