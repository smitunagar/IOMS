// Utility to fetch and parse menu.csv from the API (browser or edge compatible)
export interface Dish {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  aiHint: string;
  ingredients: string[];
}

export async function fetchMenuCsv(): Promise<Dish[]> {
  const res = await fetch('/api/menuCsv');
  if (!res.ok) throw new Error('Failed to fetch menu CSV');
  const data = await res.json();
  return Array.isArray(data.menu) ? data.menu : [];
}
