
"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Trash2, Utensils, Loader2, Car, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { recordIngredientUsage } from '@/lib/inventoryService';
import { getDishes, Dish } from '@/lib/menuService'; 
import { addOrder, OrderItem as ServiceOrderItem, DEFAULT_TAX_RATE, setOccupiedTable, OrderType, NewOrderData } from '@/lib/orderService'; 
import { useAuth } from '@/contexts/AuthContext';

interface CurrentOrderItem extends Dish { 
  orderQuantity: number; 
}

const MOCK_TABLES = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i + 1}`,
  name: `Table ${i + 1}`,
}));

const MOCK_DRIVERS = ["Alice Rider", "Bob Swift", "Charlie Dash", "Diana Zoom"];

export default function OrderEntryPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [menuDishes, setMenuDishes] = useState<Dish[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrderItem[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);
  
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");


  useEffect(() => {
    if (currentUser) {
      setIsLoadingMenu(true);
      const dishesFromService = getDishes(currentUser.id);
      setMenuDishes(dishesFromService);
      setIsLoadingMenu(false);
    } else {
      setMenuDishes([]);
      setIsLoadingMenu(false);
    }
  }, [currentUser]);


  const handleAddDishToOrder = () => {
    if (!selectedDishId || quantityToAdd <= 0) {
      toast({ title: "Error", description: "Please select a dish and specify a valid quantity.", variant: "destructive" });
      return;
    }
    const dish = menuDishes.find(d => d.id === selectedDishId);
    if (!dish) return;

    const existingItemIndex = currentOrder.findIndex(item => item.id === selectedDishId);
    if (existingItemIndex > -1) {
      const updatedOrder = [...currentOrder];
      updatedOrder[existingItemIndex].orderQuantity += quantityToAdd;
      setCurrentOrder(updatedOrder);
    } else {
      setCurrentOrder([...currentOrder, { ...dish, orderQuantity: quantityToAdd }]);
    }
    setSelectedDishId("");
    setQuantityToAdd(1);
    toast({ title: "Success", description: `${dish.name} added to order.` });
  };

  const handleRemoveItem = (itemId: string) => {
    setCurrentOrder(currentOrder.filter(item => item.id !== itemId));
    toast({ title: "Item Removed", description: "Item removed from order." });
  };

  const calculateSubtotal = () => {
    return currentOrder.reduce((sum, item) => sum + item.price * item.orderQuantity, 0);
  };

  const handlePlaceOrder = () => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not logged in.", variant: "destructive" });
      return;
    }
    if (currentOrder.length === 0) {
      toast({ title: "Error", description: "Cannot place an empty order.", variant: "destructive" });
      return;
    }

    let orderSpecifics: Partial<NewOrderData> = {};
    let displayMessageTableName = "";

    if (orderType === 'dine-in') {
      if (!selectedTableId) {
        toast({ title: "Error", description: "Please assign the order to a table.", variant: "destructive" });
        return;
      }
      displayMessageTableName = MOCK_TABLES.find(t => t.id === selectedTableId)?.name || "Unknown Table";
      orderSpecifics = {
        table: displayMessageTableName,
        tableId: selectedTableId,
      };
    } else { // Delivery
      if (!customerName || !customerPhone || !customerAddress || !selectedDriver) {
        toast({ title: "Error", description: "Please fill in all customer and driver details for delivery.", variant: "destructive" });
        return;
      }
      displayMessageTableName = `Delivery to ${customerName}`;
      orderSpecifics = {
        table: displayMessageTableName,
        tableId: `delivery-${Date.now()}`, // Unique ID for delivery "table"
        customerName,
        customerPhone,
        customerAddress,
        driverName: selectedDriver,
      };
    }
    
    currentOrder.forEach(orderItem => {
      if (orderItem.ingredients && orderItem.ingredients.length > 0) {
        orderItem.ingredients.forEach(ingredientSpec => {
          const totalConsumed = ingredientSpec.quantityPerDish * orderItem.orderQuantity;
          recordIngredientUsage(currentUser.id, ingredientSpec.inventoryItemName, totalConsumed, ingredientSpec.unit);
        });
      }
    });

    const orderItemsForService: ServiceOrderItem[] = currentOrder.map(item => ({
      dishId: item.id,
      name: item.name,
      quantity: item.orderQuantity,
      unitPrice: item.price,
      totalPrice: item.price * item.orderQuantity,
    }));

    const subtotal = calculateSubtotal();
    
    const newOrderData: NewOrderData = {
      orderType,
      items: orderItemsForService,
      subtotal: subtotal,
      taxRate: DEFAULT_TAX_RATE,
      ...orderSpecifics
    } as NewOrderData;


    const newOrder = addOrder(currentUser.id, newOrderData);

    if (newOrder) {
      if (orderType === 'dine-in' && newOrder.tableId) {
         setOccupiedTable(currentUser.id, newOrder.tableId, newOrder.id); 
      }
      toast({ title: "Order Placed!", description: `Order #${newOrder.id.substring(0,12)}... sent. Total: $${newOrder.totalAmount.toFixed(2)} for ${displayMessageTableName}.` });
      toast({ title: "Inventory Updated", description: "Ingredient usage recorded." });
      setCurrentOrder([]);
      setSelectedTableId("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setSelectedDriver("");
      // setOrderType('dine-in'); // Optionally reset to default
    } else {
      toast({ title: "Error", description: "Failed to place order. Please try again.", variant: "destructive" });
    }
  };
  
  const categories = Array.from(new Set(menuDishes.map(dish => dish.category)));

  if (!currentUser || isLoadingMenu) {
    return (
      <AppLayout pageTitle="Order Entry">
        <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl">{!currentUser ? "Authenticating..." : "Loading menu..."}</p>
        </div>
      </AppLayout>
    );
  }

  const isPlaceOrderDisabled = 
    currentOrder.length === 0 || 
    !currentUser ||
    (orderType === 'dine-in' && !selectedTableId) ||
    (orderType === 'delivery' && (!customerName || !customerPhone || !customerAddress || !selectedDriver));


  return (
    <AppLayout pageTitle="Order Entry">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center"><Utensils className="mr-2 h-6 w-6" /> Select Dishes</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-20rem)] lg:h-[calc(100vh-22rem)] pr-4">
              {categories.length === 0 && <p className="text-muted-foreground">No dishes available in the menu. Try adding some via the AI Ingredient Tool!</p>}
              {categories.map(category => (
                <div key={category} className="mb-6">
                  <h3 className="text-xl font-semibold mb-3 font-headline text-primary">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {menuDishes.filter(dish => dish.category === category).map(dish => (
                      <Card key={dish.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <Image 
                          src={dish.image} 
                          alt={dish.name} 
                          width={100} 
                          height={100} 
                          className="w-full h-32 object-cover" 
                          data-ai-hint={dish.aiHint}
                          onError={(e) => (e.currentTarget.src = "https://placehold.co/100x100.png")}
                        />
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-md mb-1">{dish.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2">${dish.price.toFixed(2)}</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              const tempDish = menuDishes.find(d => d.id === dish.id);
                              if (!tempDish) return;
                              const existingItemIndex = currentOrder.findIndex(item => item.id === dish.id);
                              if (existingItemIndex > -1) {
                                const updatedOrder = [...currentOrder];
                                updatedOrder[existingItemIndex].orderQuantity += 1;
                                setCurrentOrder(updatedOrder);
                              } else {
                                setCurrentOrder([...currentOrder, { ...tempDish, orderQuantity: 1 }]);
                              }
                              toast({ title: "Success", description: `${tempDish.name} added to order.` });
                            }}
                          >
                            <PlusCircle className="mr-2 h-4 w-4"/> Add to Order
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
            <Separator className="my-6"/>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="dish-select">Or Select Dish Manually</Label>
                <Select value={selectedDishId} onValueChange={setSelectedDishId}>
                  <SelectTrigger id="dish-select">
                    <SelectValue placeholder="Select a dish" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuDishes.map((dish) => (
                      <SelectItem key={dish.id} value={dish.id}>
                        {dish.name} (${dish.price.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantityToAdd">Quantity</Label>
                <Input
                  id="quantityToAdd"
                  type="number"
                  value={quantityToAdd}
                  onChange={(e) => setQuantityToAdd(Math.max(1, parseInt(e.target.value, 10)))}
                  min="1"
                />
              </div>
              <Button onClick={handleAddDishToOrder} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Current Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
                <Label className="mb-2 block">Order Type</Label>
                <RadioGroup value={orderType} onValueChange={(value) => setOrderType(value as OrderType)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dine-in" id="dine-in" />
                        <Label htmlFor="dine-in" className="flex items-center"><Store className="mr-2 h-4 w-4"/>Dine-In</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <Label htmlFor="delivery" className="flex items-center"><Car className="mr-2 h-4 w-4"/>Delivery</Label>
                    </div>
                </RadioGroup>
            </div>
            <Separator className="my-4" />

            {currentOrder.length === 0 ? (
              <p className="text-muted-foreground">No items in order yet.</p>
            ) : (
              <ScrollArea className="h-[150px] mb-4 pr-3">
                {currentOrder.map((item) => (
                  <div key={item.id} className="flex justify-between items-center mb-2 p-2 rounded-md border">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.orderQuantity} x ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            )}
            <Separator className="my-4" />
            
            {orderType === 'dine-in' && (
              <div className="space-y-2">
                <Label htmlFor="table-select">Assign to Table</Label>
                <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                  <SelectTrigger id="table-select">
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_TABLES.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {orderType === 'delivery' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input id="customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Jane Doe"/>
                </div>
                <div>
                  <Label htmlFor="customer-phone">Customer Phone</Label>
                  <Input id="customer-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g., 555-1234"/>
                </div>
                <div>
                  <Label htmlFor="customer-address">Delivery Address</Label>
                  <Input id="customer-address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="e.g., 123 Main St, Anytown"/>
                </div>
                <div>
                  <Label htmlFor="driver-select">Assign Driver</Label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger id="driver-select">
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_DRIVERS.map((driver) => (
                        <SelectItem key={driver} value={driver}>
                          {driver}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-4">
            <div className="flex justify-between w-full text-lg font-semibold">
              <span>Subtotal:</span>
              <span>${calculateSubtotal().toFixed(2)}</span>
            </div>
            <Button onClick={handlePlaceOrder} className="w-full" size="lg" disabled={isPlaceOrderDisabled}>
              Place Order & Send
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}
