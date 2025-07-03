import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const csvPath = path.join(process.cwd(), 'download', 'Copy', 'menu.csv');
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: 'Menu CSV not found' });
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
  res.status(200).json({ menu });
}
