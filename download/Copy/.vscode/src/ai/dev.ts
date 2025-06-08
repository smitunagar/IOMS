
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-ingredients-list.ts';
import '@/ai/flows/suggest-discounted-dishes.ts';
import '@/ai/flows/extract-order-from-text.ts'; // Add the new flow
