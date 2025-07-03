
// IMPORTANT: This service uses localStorage and will only work in the browser.
// Ensure it's called within useEffect or client-side event handlers.
import { parse as parseDateFns, isValid, format as formatDateFns } from 'date-fns';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  lowStockThreshold: number;
  lastRestocked?: string; // ISO date string
  expiryDate?: string; // ISO date string YYYY-MM-DD
  quantityUsed: number;
  image?: string; // URL to the image
  aiHint?: string; // Hint for AI image generation
}

const INVENTORY_STORAGE_KEY_BASE = 'restaurantInventory';

function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function getUserInventoryStorageKey(userId: string): string {
  return `${INVENTORY_STORAGE_KEY_BASE}_${userId}`;
}

export function getInventory(userId: string | null): InventoryItem[] {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }
  try {
    const inventoryStorageKey = getUserInventoryStorageKey(userId);
    const storedInventory = localStorage.getItem(inventoryStorageKey);
    if (storedInventory) {
      const parsed = JSON.parse(storedInventory) as InventoryItem[];
      return parsed.map(item => ({
        ...item,
        quantityUsed: item.quantityUsed || 0,
        expiryDate: item.expiryDate || undefined,
        image: item.image || "https://placehold.co/60x60.png",
        aiHint: item.aiHint || item.name.toLowerCase().split(' ').slice(0, 2).join(' '),
      }));
    } else {
      const emptyInventory: InventoryItem[] = [];
      localStorage.setItem(inventoryStorageKey, JSON.stringify(emptyInventory));
      return emptyInventory;
    }
  } catch (error) {
    console.error(`Error accessing localStorage for inventory (user: ${userId}):`, error);
    return [];
  }
}

export function saveInventory(userId: string | null, inventory: InventoryItem[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const inventoryStorageKey = getUserInventoryStorageKey(userId);
    localStorage.setItem(inventoryStorageKey, JSON.stringify(inventory));
  } catch (error) {
    console.error(`Error saving inventory to localStorage (user: ${userId}):`, error);
  }
}

export interface RawIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export function addIngredientToInventoryIfNotExists(userId: string | null, ingredient: RawIngredient): InventoryItem | null {
  if (typeof window === 'undefined' || !userId) return null;
  
  const currentInventory = getInventory(userId);
  const existingItem = currentInventory.find(
    item => item.name.toLowerCase() === ingredient.name.toLowerCase()
  );

  if (existingItem) {
    return null; 
  }

  const newItem: InventoryItem = {
    id: generateId(),
    name: ingredient.name,
    quantity: ingredient.quantity, 
    unit: ingredient.unit,
    category: "Pantry", 
    lowStockThreshold: Math.max(1, Math.floor(ingredient.quantity * 0.2)), 
    lastRestocked: new Date().toISOString(), 
    expiryDate: undefined, 
    quantityUsed: 0,
    image: "https://placehold.co/60x60.png",
    aiHint: ingredient.name.toLowerCase().split(' ').slice(0, 2).join(' '),
  };

  const updatedInventory = [...currentInventory, newItem];
  saveInventory(userId, updatedInventory);
  return newItem;
}

export function recordIngredientUsage(userId: string | null, ingredientName: string, consumedQuantity: number, consumedUnit: string): void {
  if (typeof window === 'undefined' || !userId) return;
  const currentInventory = getInventory(userId);
  const itemIndex = currentInventory.findIndex(
    item => item.name.toLowerCase() === ingredientName.toLowerCase()
  );

  if (itemIndex > -1) {
    const item = currentInventory[itemIndex];

    if (item.unit.toLowerCase() !== consumedUnit.toLowerCase()) {
      console.warn(`Unit mismatch for ${ingredientName}: inventory unit ${item.unit}, consumed unit ${consumedUnit}. Ingredient usage not recorded.`);
      return;
    }

    const newQuantity = Math.max(0, item.quantity - consumedQuantity);
    const newQuantityUsed = (item.quantityUsed || 0) + consumedQuantity;

    currentInventory[itemIndex] = {
      ...item,
      quantity: newQuantity,
      quantityUsed: newQuantityUsed,
    };
    saveInventory(userId, currentInventory);
  } else {
    console.warn(`Ingredient "${ingredientName}" not found in inventory (user: ${userId}). Usage not recorded.`);
  }
}

export function updateInventoryItem(userId: string | null, itemId: string, updates: Partial<Omit<InventoryItem, 'id'>>): InventoryItem | null {
  if (typeof window === 'undefined' || !userId) return null;
  
  const currentInventory = getInventory(userId);
  const itemIndex = currentInventory.findIndex(item => item.id === itemId);

  if (itemIndex > -1) {
    const originalItem = currentInventory[itemIndex];
    currentInventory[itemIndex] = { 
      ...originalItem, 
      ...updates,
      quantityUsed: updates.quantityUsed !== undefined ? updates.quantityUsed : originalItem.quantityUsed || 0,
    };
    // If quantity changes, it implies a restock or manual adjustment.
    if(updates.quantity !== undefined && originalItem.quantity !== updates.quantity) {
      currentInventory[itemIndex].lastRestocked = new Date().toISOString();
    }
    saveInventory(userId, currentInventory);
    return currentInventory[itemIndex];
  } else {
    console.warn(`Item with id ${itemId} not found for update (user: ${userId}).`);
    return null;
  }
}

export function removeInventoryItem(userId: string | null, itemId: string): boolean {
    if (typeof window === 'undefined' || !userId) return false;
    let currentInventory = getInventory(userId);
    const initialLength = currentInventory.length;
    currentInventory = currentInventory.filter(item => item.id !== itemId);
    if (currentInventory.length < initialLength) {
      saveInventory(userId, currentInventory);
      return true;
    }
    return false;
}

export interface ProcessedCSVItem {
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    lowStockThreshold?: number;
    expiryDate?: string; // YYYY-MM-DD
    imageURL?: string;
    aiHint?: string;
}

export function batchAddOrUpdateInventoryItems(userId: string | null, itemsToProcess: ProcessedCSVItem[]): { added: number; updated: number; errors: number } {
    if (typeof window === 'undefined' || !userId) return { added: 0, updated: 0, errors: itemsToProcess.length };

    const currentInventory = getInventory(userId);
    let addedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    itemsToProcess.forEach(csvItem => {
        try {
            const existingItemIndex = currentInventory.findIndex(
                invItem => invItem.name.toLowerCase() === csvItem.name.toLowerCase()
            );

            if (existingItemIndex > -1) {
                // Update existing item
                const originalItem = currentInventory[existingItemIndex];
                const updates: Partial<InventoryItem> = {
                    quantity: csvItem.quantity,
                    unit: csvItem.unit,
                    category: csvItem.category || originalItem.category,
                    lowStockThreshold: csvItem.lowStockThreshold || originalItem.lowStockThreshold,
                    expiryDate: csvItem.expiryDate || originalItem.expiryDate,
                    image: csvItem.imageURL || originalItem.image,
                    aiHint: csvItem.aiHint || originalItem.aiHint || csvItem.name.toLowerCase().split(' ').slice(0, 2).join(' '),
                    lastRestocked: originalItem.quantity !== csvItem.quantity ? new Date().toISOString() : originalItem.lastRestocked,
                };
                currentInventory[existingItemIndex] = { ...originalItem, ...updates };
                updatedCount++;
            } else {
                // Add new item
                const newItem: InventoryItem = {
                    id: generateId(),
                    name: csvItem.name,
                    quantity: csvItem.quantity,
                    unit: csvItem.unit,
                    category: csvItem.category || "Pantry",
                    lowStockThreshold: csvItem.lowStockThreshold || Math.max(1, Math.floor(csvItem.quantity * 0.2)),
                    lastRestocked: new Date().toISOString(),
                    expiryDate: csvItem.expiryDate,
                    quantityUsed: 0,
                    image: csvItem.imageURL || "https://placehold.co/60x60.png",
                    aiHint: csvItem.aiHint || csvItem.name.toLowerCase().split(' ').slice(0, 2).join(' '),
                };
                currentInventory.push(newItem);
                addedCount++;
            }
        } catch (e) {
            console.error("Error processing CSV item:", csvItem.name, e);
            errorCount++;
        }
    });

    saveInventory(userId, currentInventory);
    return { added: addedCount, updated: updatedCount, errors: errorCount };
}
