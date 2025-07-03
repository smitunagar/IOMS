// menuService.ts

export interface IngredientQuantity {
  inventoryItemName: string;
  quantityPerDish: number;
  unit: string;
}

export interface Dish {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  aiHint: string;
  ingredients: IngredientQuantity[] | string[]; // For legacy or parsed dishes
}

const MENU_STORAGE_KEY_BASE = 'restaurantMenu';

function generateDishId(): string {
  return `dish_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getUserMenuStorageKey(userId: string): string {
  return `${MENU_STORAGE_KEY_BASE}_${userId}`;
}

export function getDishes(userId: string | null): Dish[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const menuStorageKey = getUserMenuStorageKey(userId);
    const storedMenu = localStorage.getItem(menuStorageKey);
    if (storedMenu) return JSON.parse(storedMenu) as Dish[];
    localStorage.setItem(menuStorageKey, JSON.stringify([]));
    return [];
  } catch (e) {
    console.error('Error reading menu:', e);
    return [];
  }
}

export function saveDishes(userId: string | null, dishes: Dish[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const menuStorageKey = getUserMenuStorageKey(userId);
    localStorage.setItem(menuStorageKey, JSON.stringify(dishes));
  } catch (e) {
    console.error('Error saving menu:', e);
  }
}

export function addDishToMenu(userId: string | null, dishName: string, aiIngredients: any): Dish | null {
  if (typeof window === 'undefined' || !userId) return null;
  const currentDishes = getDishes(userId);

  // Defensive: Ingredients as IngredientQuantity[] or string[]
  let transformedIngredients: IngredientQuantity[] | string[];
  if (Array.isArray(aiIngredients) && typeof aiIngredients[0] === 'object') {
    transformedIngredients = aiIngredients as IngredientQuantity[];
  } else if (Array.isArray(aiIngredients)) {
    transformedIngredients = aiIngredients.map(name => ({
      inventoryItemName: name,
      quantityPerDish: 1,
      unit: '',
    }));
  } else {
    transformedIngredients = [];
  }

  const newDish: Dish = {
    id: generateDishId(),
    name: dishName,
    price: 10.00,
    category: "New Dishes",
    image: "https://placehold.co/100x100.png",
    aiHint: dishName.toLowerCase().split(' ').slice(0, 2).join(' '),
    ingredients: transformedIngredients,
  };

  const updatedDishes = [...currentDishes, newDish];
  saveDishes(userId, updatedDishes);
  return newDish;
}
