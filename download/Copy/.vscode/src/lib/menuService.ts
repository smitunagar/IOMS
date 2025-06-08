
// IMPORTANT: This service uses localStorage and will only work in the browser.

import type { GenerateIngredientsListOutput } from '@/ai/flows/generate-ingredients-list';

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
  ingredients: IngredientQuantity[];
}

const MENU_STORAGE_KEY_BASE = 'restaurantMenu';

// Initial mock dishes are no longer used to seed for every user.
// New users will start with an empty menu.

function generateDishId(): string {
  return `dish_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getUserMenuStorageKey(userId: string): string {
  return `${MENU_STORAGE_KEY_BASE}_${userId}`;
}

export function getDishes(userId: string | null): Dish[] {
  if (typeof window === 'undefined' || !userId) {
    return []; // No user, no dishes, or SSR
  }
  try {
    const menuStorageKey = getUserMenuStorageKey(userId);
    const storedMenu = localStorage.getItem(menuStorageKey);
    if (storedMenu) {
      return JSON.parse(storedMenu) as Dish[];
    } else {
      // For a new user, start with an empty menu and initialize it in localStorage
      const emptyMenu: Dish[] = [];
      localStorage.setItem(menuStorageKey, JSON.stringify(emptyMenu));
      return emptyMenu;
    }
  } catch (error) {
    console.error(`Error accessing localStorage for menu (user: ${userId}):`, error);
    return [];
  }
}

export function saveDishes(userId: string | null, dishes: Dish[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const menuStorageKey = getUserMenuStorageKey(userId);
    localStorage.setItem(menuStorageKey, JSON.stringify(dishes));
  } catch (error) {
    console.error(`Error saving menu to localStorage (user: ${userId}):`, error);
  }
}

export function addDishToMenu(
  userId: string | null,
  dishName: string,
  aiIngredients: GenerateIngredientsListOutput['ingredients']
): Dish | null {
  if (typeof window === 'undefined' || !userId) return null;

  const currentDishes = getDishes(userId);

  const transformedIngredients: IngredientQuantity[] = aiIngredients.map(ing => ({
    inventoryItemName: ing.name,
    quantityPerDish: ing.quantity,
    unit: ing.unit,
  }));

  const newDish: Dish = {
    id: generateDishId(),
    name: dishName,
    price: 10.00, // Default price
    category: "New Dishes", // Default category
    image: "https://placehold.co/100x100.png", // Default placeholder image
    aiHint: dishName.toLowerCase().split(' ').slice(0, 2).join(' '), // Simple AI hint from name
    ingredients: transformedIngredients,
  };

  const updatedDishes = [...currentDishes, newDish];
  saveDishes(userId, updatedDishes);
  return newDish;
}
