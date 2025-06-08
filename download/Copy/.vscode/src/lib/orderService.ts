
// IMPORTANT: This service uses localStorage and will only work in the browser.
// Ensure it's called within useEffect or client-side event handlers.

export interface OrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus = 'Pending Payment' | 'Completed' | 'Cancelled';
export type OrderType = 'dine-in' | 'delivery';

export interface Order {
  id: string;
  orderType: OrderType;
  table: string;
  tableId: string; // For dine-in, actual tableId; for delivery, could be 'delivery' or a unique delivery ID
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string; // ISO date string
  completedAt?: string; // ISO date string
  
  // Delivery specific fields
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  driverName?: string;
}

const ORDERS_STORAGE_KEY_BASE = 'restaurantOrders';
export const DEFAULT_TAX_RATE = 0.10;

function generateId(prefix: string = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getUserOrdersStorageKey(userId: string): string {
  return `${ORDERS_STORAGE_KEY_BASE}_${userId}`;
}

export function getOrders(userId: string | null): Order[] {
  if (typeof window === 'undefined' || !userId) {
    return [];
  }
  try {
    const ordersStorageKey = getUserOrdersStorageKey(userId);
    const storedOrders = localStorage.getItem(ordersStorageKey);
    if (storedOrders) {
      return JSON.parse(storedOrders) as Order[];
    }
    const emptyOrders: Order[] = [];
    localStorage.setItem(ordersStorageKey, JSON.stringify(emptyOrders));
    return emptyOrders;
  } catch (error) {
    console.error(`Error accessing localStorage for orders (user: ${userId}):`, error);
    return [];
  }
}

export function saveOrders(userId: string | null, orders: Order[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const ordersStorageKey = getUserOrdersStorageKey(userId);
    localStorage.setItem(ordersStorageKey, JSON.stringify(orders));
  } catch (error) {
    console.error(`Error saving orders to localStorage (user: ${userId}):`, error);
  }
}

// Broaden OrderData to accept all new fields
export type NewOrderData = Omit<Order, 'id' | 'createdAt' | 'status' | 'taxAmount' | 'totalAmount'> & { subtotal: number };

export function addOrder(userId: string | null, orderData: NewOrderData): Order | null {
  if (typeof window === 'undefined' || !userId) return null;

  const taxAmount = orderData.subtotal * (orderData.taxRate || DEFAULT_TAX_RATE);
  const totalAmount = orderData.subtotal + taxAmount;

  const newOrder: Order = {
    ...orderData,
    id: generateId("order"),
    createdAt: new Date().toISOString(),
    status: 'Pending Payment',
    taxAmount,
    totalAmount,
    taxRate: orderData.taxRate || DEFAULT_TAX_RATE,
  };

  const currentOrders = getOrders(userId);
  const updatedOrders = [...currentOrders, newOrder];
  saveOrders(userId, updatedOrders);
  return newOrder;
}

export function getPendingOrders(userId: string | null): Order[] {
  const orders = getOrders(userId);
  return orders.filter(order => order.status === 'Pending Payment').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getCompletedOrders(userId: string | null): Order[] {
  const orders = getOrders(userId);
  return orders.filter(order => order.status === 'Completed').sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
}

export function getOrderById(userId: string | null, orderId: string): Order | undefined {
  const orders = getOrders(userId);
  return orders.find(order => order.id === orderId);
}

export function updateOrderStatus(userId: string | null, orderId: string, newStatus: OrderStatus): Order | null {
  if (typeof window === 'undefined' || !userId) return null;
  const currentOrders = getOrders(userId);
  const orderIndex = currentOrders.findIndex(order => order.id === orderId);

  if (orderIndex > -1) {
    currentOrders[orderIndex].status = newStatus;
    if (newStatus === 'Completed') {
      currentOrders[orderIndex].completedAt = new Date().toISOString();
    }
    saveOrders(userId, currentOrders);
    return currentOrders[orderIndex];
  }
  return null;
}

// Helper functions for managing occupied tables in localStorage
const OCCUPIED_TABLES_KEY_BASE = 'occupiedTables';

export interface OccupiedTableInfo {
  orderId: string;
  occupiedAt: string;
}

function getUserOccupiedTablesKey(userId: string): string {
  return `${OCCUPIED_TABLES_KEY_BASE}_${userId}`;
}

export function getOccupiedTables(userId: string): Record<string, OccupiedTableInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const key = getUserOccupiedTablesKey(userId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Error getting occupied tables from localStorage:", error);
    return {};
  }
}

export function setOccupiedTable(userId: string, tableId: string, orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Ensure tableId is not a delivery identifier before marking it as occupied
    if (tableId.startsWith('delivery-')) {
        console.warn("Attempted to mark a delivery pseudo-table as physically occupied. Skipping.");
        return;
    }
    const key = getUserOccupiedTablesKey(userId);
    const occupiedTables = getOccupiedTables(userId);
    occupiedTables[tableId] = { orderId, occupiedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(occupiedTables));
  } catch (error)
    {
    console.error("Error setting occupied table in localStorage:", error);
  }
}

export function clearOccupiedTable(userId: string, tableId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (tableId.startsWith('delivery-')) {
      return; // Don't try to clear pseudo-tables
    }
    const key = getUserOccupiedTablesKey(userId);
    const occupiedTables = getOccupiedTables(userId);
    delete occupiedTables[tableId];
    localStorage.setItem(key, JSON.stringify(occupiedTables));
  } catch (error) {
    console.error("Error clearing occupied table from localStorage:", error);
  }
}
