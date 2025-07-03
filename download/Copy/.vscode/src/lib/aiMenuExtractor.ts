import { ai } from '@/ai/genkit';
import { jsonrepair } from 'jsonrepair';

/**
 * Last-ditch recovery for broken, truncated Gemini arrays.
 * Cuts off after last valid object and closes with a bracket.
 */
function recoverLongestValidArray(jsonString: string): string {
  jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');
  let arrStart = jsonString.indexOf('[');
  let lastObjClose = jsonString.lastIndexOf('}');
  if (arrStart === -1 || lastObjClose === -1 || lastObjClose < arrStart) return '[]';
  let cut = jsonString.slice(arrStart, lastObjClose + 1);
  if (!cut.trim().endsWith(']')) cut += "\n]\n";
  return cut;
}

/**
 * Extracts menu data from a PDF using Gemini and robust post-processing.
 */
export async function extractMenuFromPdf({ pdfDataUri }: { pdfDataUri: string }) {
  const prompt = `
You are an expert at reading restaurant menu PDFs. Extract every dish, drink, or menu item as a JSON object.

For each menu item, extract:
- "name": Dish or beverage name, exactly as printed.
- "price": The full price string for the item, including all sizes if shown, e.g. "(0,3l) 3,50 € (0,5l) 4,50 €". If no price, use an empty string.
- "category": Section/category name (e.g. "Pizza", "Biere", "Salate"). If not shown, use "Other".
- "ingredients": Array of ingredient names if shown in menu. If not listed, use [].

**Return only a single valid JSON array of objects.** No explanations, no markdown, no text before or after the array.

Example output:
[
  {"name":"Zwiefalter Helles Vollbier","price":"(0,3l) 3,50 € (0,5l) 4,50 €","category":"Biere","ingredients":[]},
  {"name":"Chicken Tikka Grill","price":"18,00 €","category":"Indische Grillspezialitäten","ingredients":["Hühnerbruststücke"]},
  ...
]
`;

  // Call Gemini via Genkit
  const result = await ai.generate([
    { text: prompt },
    { media: { url: pdfDataUri } }
  ]);
  console.log('GENKIT RAW RESULT:', result);

  // Extract text, from code block or raw
  let text = typeof result.text === 'string' ? result.text : '';
  let cleanText = '';
  const jsonMatch = text.match(/```json([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/);
  if (jsonMatch) {
    cleanText = jsonMatch[1].trim();
  } else {
    cleanText = text.trim();
  }

  // Remove trailing code fences and comments, just in case
  cleanText = cleanText
    .replace(/```/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();

  // DEBUG: See what we are trying to parse
  console.log('CLEAN JSON TO PARSE:', cleanText);

  let items: any[] = [];
  try {
    // 1. Try straight parse
    items = JSON.parse(cleanText);
  } catch (e) {
    // 2. Try jsonrepair
    try {
      items = JSON.parse(jsonrepair(cleanText));
    } catch (e2) {
      // 3. Try best-effort recovery for truncation
      try {
        const partial = recoverLongestValidArray(cleanText);
        items = JSON.parse(partial);
      } catch (e3) {
        // 4. Give up, show nothing
        items = [];
      }
    }
  }

  // Only filter for valid name field
  const filtered = Array.isArray(items) ? items.filter(
    (item) => item && typeof item.name === 'string' && item.name.length > 0
  ) : [];

  return filtered;

}
