import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const csvPath = path.join(process.cwd(), 'download', 'Copy', 'menu.csv');
  if (!fs.existsSync(csvPath)) {
    return new Response(JSON.stringify({ error: 'Menu CSV not found' }), { status: 404 });
  }
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  const [header, ...rows] = lines;
  const menu = rows.map(row => {
    const [id, name, price, category, image, aiHint, ingredients] = row.split(',');
    return {
      id,
      name,
      price: Number(price),
      category,
      image,
      aiHint,
      ingredients: ingredients ? ingredients.split(';') : [],
    };
  });
  return new Response(JSON.stringify({ menu }), { status: 200 });
}
