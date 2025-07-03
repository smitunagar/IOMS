export const runtime = "nodejs";
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractMenuFromPdf } from '@/lib/aiMenuExtractor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { file } = body;
    if (!file) return new Response(JSON.stringify({ message: 'Missing PDF file data' }), { status: 400 });

    const pdfDataUri = `data:application/pdf;base64,${file}`;
    const menuResult: any = await extractMenuFromPdf({ pdfDataUri });
    // Helper to escape CSV fields
    function escapeCsvField(field: string) {
      if (typeof field !== 'string') field = String(field ?? '');
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    }
    // Ensure all menu items have required fields for CSV
    const menuItems: any[] = (Array.isArray(menuResult) ? menuResult : (menuResult && menuResult.items ? menuResult.items : []))
      .filter((item: any) => item && typeof item.name === 'string' && item.name.length > 0)
      .map((item: any, idx: number) => ({
        id: item.id || (idx + 1).toString(),
        name: item.name || '',
        price: item.price || '',
        category: item.category || '',
        image: item.image || '',
        aiHint: item.aiHint || '',
        ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      }));
    console.log('FINAL MENU ITEMS TO WRITE:', menuItems);
    // Save to menu.csv with proper escaping
    const csvHeader = 'id,name,price,category,image,aiHint,ingredients';
    const csvRows = menuItems.map((item: any) => [
      escapeCsvField(item.id),
      escapeCsvField(item.name),
      escapeCsvField(item.price),
      escapeCsvField(item.category),
      escapeCsvField(item.image),
      escapeCsvField(item.aiHint),
      escapeCsvField(item.ingredients.join(';'))
    ].join(','));
    const csvContent = [csvHeader, ...csvRows].join('\n');
    // Always resolve from project root
    const csvDir = path.resolve(process.cwd(), 'download', 'Copy');
    const csvPath = path.join(csvDir, 'menu.csv');
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    // Detect partial or repaired extraction
    const partialOrRepaired = menuResult && menuResult.partialOrRepaired;
    // After writing menu.csv, trigger import to localStorage for the current user if userId is provided
    // (Assume userId is sent in the request body for automation)
    if (body.userId) {
      return new Response(JSON.stringify({ success: true, count: menuItems.length, shouldImport: true, partialOrRepaired }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, count: menuItems.length, partialOrRepaired }), { status: 200 });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
}
