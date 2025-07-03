"use client";

import React, { useState, useTransition, useEffect } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, MessageSquareQuote, CheckCircle, AlertCircle, Utensils, ShoppingCart, XCircle } from "lucide-react";
import { extractOrderFromText, ExtractOrderInput, ExtractedOrderOutput } from '@/ai/flows/extract-order-from-text';
import { useAuth } from '@/contexts/AuthContext';
import { getDishes, Dish } from '@/lib/menuService';
import { addOrder, OrderItem as ServiceOrderItem, DEFAULT_TAX_RATE, OrderType, NewOrderData } from '@/lib/orderService';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from "@/components/ui/badge"; // Added import

const MOCK_TABLES_AGENT = Array.from({ length: 10 }, (_, i) => ({ id: `t${i + 1}`, name: `Table ${i + 1}` }));
const MOCK_DRIVERS_AGENT = ["Driver A", "Driver B", "Driver C"];

interface MatchedOrderItem {
  menuDish: Dish | null; // Matched dish from menu, or null if no match
  aiExtractedName: string;
  quantity: number;
  isMatched: boolean;
}

// Fix: Use a custom type for local state that includes 'pickup' and 'unknown',
// but only allow 'dine-in' | 'delivery' for OrderType (orderService)
type AgentOrderType = 'dine-in' | 'delivery' | 'pickup' | 'unknown';

export default function AiOrderAgentPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [transcript, setTranscript] = useState<string>("");
  const [aiExtractedOrder, setAiExtractedOrder] = useState<ExtractedOrderOutput | null>(null);
  const [processedOrderItems, setProcessedOrderItems] = useState<MatchedOrderItem[]>([]);
  
  const defaultDishes: Dish[] = [
    { id: '1', name: 'Biryani', price: 350, category: 'Main', image: '', aiHint: '', ingredients: [] },
    { id: '2', name: 'Qourma', price: 400, category: 'Main', image: '', aiHint: '', ingredients: [] },
    { id: '3', name: 'Nihari', price: 380, category: 'Main', image: '', aiHint: '', ingredients: [] },
    { id: '4', name: 'Karahi', price: 500, category: 'Main', image: '', aiHint: '', ingredients: [] },
    { id: '5', name: 'Haleem', price: 320, category: 'Main', image: '', aiHint: '', ingredients: [] },
  ];
  const [menuDishes, setMenuDishes] = useState<Dish[]>([]);
  useEffect(() => {
    setIsClient(true);
    if (!currentUser || !currentUser.id) return;
    // Try to load from localStorage
    const userKey = `restaurantMenu_${currentUser.id}`;
    let dishes: Dish[] = [];
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(userKey) : null;
      if (stored) {
        dishes = JSON.parse(stored);
      }
    } catch (e) { dishes = []; }
    // If still empty, fetch from CSV API and save to localStorage
    if (!dishes || dishes.length === 0) {
      fetch('/api/menuCsv')
        .then(res => res.json())
        .then(data => {
          if (data.menu && Array.isArray(data.menu) && data.menu.length > 0) {
            setMenuDishes(data.menu);
            if (typeof window !== 'undefined') {
              localStorage.setItem(userKey, JSON.stringify(data.menu));
            }
          }
        });
    } else {
      setMenuDishes(dishes);
    }
  }, [currentUser]);

  // DEBUG: Log menuDishes to verify dropdown population
  useEffect(() => {
    console.log('menuDishes for manual select:', menuDishes);
  }, [menuDishes]);

  // Form state for confirming order details
  const [confirmedOrderType, setConfirmedOrderType] = useState<AgentOrderType>('unknown');
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");

  const [selectedDishId, setSelectedDishId] = useState<string>("");
  const [manualQuantity, setManualQuantity] = useState<number>(1);

  const [isProcessingTranscript, startProcessingTranscript] = useTransition();
  const [isCreatingOrder, startCreatingOrder] = useTransition();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const handleProcessTranscript = () => {
    if (!currentUser) {
      toast({ title: "Error", description: "Please log in.", variant: "destructive" });
      return;
    }
    if (!transcript.trim()) {
      toast({ title: "Error", description: "Please enter a call transcript.", variant: "destructive" });
      return;
    }
    setAiExtractedOrder(null);
    setProcessedOrderItems([]);

    startProcessingTranscript(async () => {
      try {
        const input: ExtractOrderInput = { transcript };
        const result = await extractOrderFromText(input);
        setAiExtractedOrder(result);

        // Populate form fields with AI suggestions
        setConfirmedOrderType((result.orderType || 'unknown') as AgentOrderType);
        setCustomerName(result.customerName || "");
        setCustomerPhone(result.customerPhone || "");
        setCustomerAddress(result.customerAddress || "");
        setOrderNotes(result.notes || "");
        // Driver and table needs manual selection for now

        if (result.items && result.items.length > 0) {
          const matchedItems: MatchedOrderItem[] = result.items.map(aiItem => {
            const foundDish = menuDishes.find(menuDish => menuDish.name.toLowerCase() === aiItem.name.toLowerCase());
            return {
              menuDish: foundDish || null,
              aiExtractedName: aiItem.name,
              quantity: aiItem.quantity,
              isMatched: !!foundDish,
            };
          });
          setProcessedOrderItems(matchedItems);
        }
        
        toast({ title: "Transcript Processed", description: "AI has extracted order details. Please review." });
      } catch (error) {
        console.error("Error processing transcript:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Processing Failed", description: errorMessage, variant: "destructive" });
      }
    });
  };

  const handleConfirmAndCreateOrder = () => {
    if (!currentUser || !aiExtractedOrder) {
      toast({ title: "Error", description: "No AI extracted order to process or user not logged in.", variant: "destructive" });
      return;
    }

    const validItemsForOrder = processedOrderItems.filter(item => item.isMatched && item.menuDish);
    if (validItemsForOrder.length === 0) {
      toast({ title: "Error", description: "No valid (matched) menu items found in AI suggestions to create an order.", variant: "destructive" });
      return;
    }

    let orderSpecifics: Partial<NewOrderData> = {};
    let displayMessageTarget = "";

    if (confirmedOrderType === 'dine-in') {
      if (!selectedTableId) {
        toast({ title: "Error", description: "Please assign the order to a table for dine-in.", variant: "destructive" });
        return;
      }
      displayMessageTarget = MOCK_TABLES_AGENT.find(t => t.id === selectedTableId)?.name || "Unknown Table";
      orderSpecifics = { table: String(displayMessageTarget), tableId: String(selectedTableId) };
    } else if (confirmedOrderType === 'delivery') {
      if (!customerName || !customerPhone || !customerAddress || !selectedDriver) {
        toast({ title: "Error", description: "Please fill all customer and driver details for delivery.", variant: "destructive" });
        return;
      }
      displayMessageTarget = `Delivery to ${customerName}`;
      orderSpecifics = {
        customerName, customerPhone, customerAddress, driverName: selectedDriver,
        table: String(displayMessageTarget), tableId: `delivery-ai-${Date.now()}`,
      };
    } else if (confirmedOrderType === 'pickup') {
       if (!customerName || !customerPhone) {
        toast({ title: "Error", description: "Please fill customer name and phone for pickup.", variant: "destructive" });
        return;
      }
      displayMessageTarget = `Pickup for ${customerName}`;
      orderSpecifics = {
        customerName, customerPhone,
        table: String(displayMessageTarget), tableId: `pickup-ai-${Date.now()}`,
      }
    } else {
        toast({ title: "Error", description: "Please select a valid order type (Dine-In, Delivery, or Pickup).", variant: "destructive" });
        return;
    }
    
    // Ensure table and tableId are always strings
    const safeOrderSpecifics = {
      table: orderSpecifics.table || "Unknown",
      tableId: orderSpecifics.tableId || "unknown-id",
      ...orderSpecifics,
    };

    startCreatingOrder(() => {
        const orderItemsForService: ServiceOrderItem[] = validItemsForOrder.map(item => ({
            dishId: item.menuDish!.id, // item.menuDish is guaranteed by filter
            name: item.menuDish!.name,
            quantity: item.quantity,
            unitPrice: item.menuDish!.price,
            totalPrice: item.menuDish!.price * item.quantity,
        }));

        const subtotal = orderItemsForService.reduce((sum, item) => sum + item.totalPrice, 0);
        
        const newOrderData: NewOrderData = {
            orderType: confirmedOrderType as OrderType, // Only 'dine-in' or 'delivery' allowed in orderService
            items: orderItemsForService,
            subtotal,
            taxRate: DEFAULT_TAX_RATE,
            ...safeOrderSpecifics,
            // Notes from AI can be added here if your Order interface supports it.
            // For now, orderService doesn't explicitly handle general order notes.
        };

        const newOrder = addOrder(currentUser.id, newOrderData);

        if (newOrder) {
            toast({ title: "Order Created!", description: `Order #${newOrder.id.substring(0,12)}... for ${displayMessageTarget} created successfully.`, duration: 5000 });
            // Reset state
            setTranscript("");
            setAiExtractedOrder(null);
            setProcessedOrderItems([]);
            setConfirmedOrderType('unknown');
            setSelectedTableId("");
            setCustomerName("");
            setCustomerPhone("");
            setCustomerAddress("");
            setSelectedDriver("");
            setOrderNotes("");
          } else {
            toast({ title: "Order Creation Failed", description: "Could not save the order. Please try again.", variant: "destructive" });
          }
    });
  };

  // Always show default dishes in dropdown, merged with user/CSV menu (no duplicates)
  const dropdownDishes = [
    ...defaultDishes.filter(
      def => !menuDishes.some(u => u.name.toLowerCase() === def.name.toLowerCase())
    ),
    ...menuDishes
  ];
  console.log('DEBUG: dropdownDishes for manual select:', dropdownDishes);
  // Fallback: if dropdownDishes is empty, use defaultDishes
  const safeDropdownDishes = dropdownDishes.length > 0 ? dropdownDishes : defaultDishes;

  return (
    <AppLayout pageTitle="AI Order Agent (Beta)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transcript Input Column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><MessageSquareQuote className="mr-2 h-6 w-6 text-primary" /> Call Transcript Input</CardTitle>
            <CardDescription>
              Paste the full text transcript of the customer's call here. The AI will try to extract order details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="transcript-input">Call Transcript</Label>
            <Textarea
              id="transcript-input"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g., 'Hello, I'd like to order one large pepperoni pizza and two cokes for delivery to 123 Main Street... My name is John Doe...'"
              rows={10}
              className="min-h-[200px]"
              disabled={isProcessingTranscript || isCreatingOrder}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleProcessTranscript} disabled={isProcessingTranscript || isCreatingOrder || !currentUser || !transcript.trim()} className="w-full">
              {isProcessingTranscript ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Process with AI
            </Button>
          </CardFooter>
        </Card>

        {/* AI Extracted Details & Confirmation Column */}
        <Card className={!aiExtractedOrder && !isProcessingTranscript ? "hidden lg:block" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center"><Utensils className="mr-2 h-6 w-6 text-primary" /> AI Extracted Order & Confirmation</CardTitle>
            {isProcessingTranscript && <CardDescription>AI is processing the transcript...</CardDescription>}
            {!isProcessingTranscript && !aiExtractedOrder && <CardDescription>AI suggestions will appear here after processing.</CardDescription>}
            {aiExtractedOrder && aiExtractedOrder.confidenceScore && (
              <CardDescription>AI Confidence: <Badge variant={aiExtractedOrder.confidenceScore > 0.7 ? "default" : "secondary"}>{(typeof aiExtractedOrder.confidenceScore === 'number' && !isNaN(aiExtractedOrder.confidenceScore) ? aiExtractedOrder.confidenceScore * 100 : 0).toFixed(0)}%</Badge></CardDescription>
            )}
          </CardHeader>
          {isProcessingTranscript && (
            <CardContent className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </CardContent>
          )}
          {aiExtractedOrder && !isProcessingTranscript && (
            <React.Fragment>
              <CardContent className="space-y-4">
                {/* Manual Add Dish Section */}
                <div className="mb-4 border p-2 rounded-md bg-blue-50">
                  <Label>Add Dish Manually</Label>
                  <div className="flex gap-2 items-end">
                    {/* Only render dropdown on client when dishes are available */}
                    {isClient && menuDishes.length > 0 && (
                      <Select value={selectedDishId || undefined} onValueChange={setSelectedDishId} disabled={isCreatingOrder}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Select a dish" /></SelectTrigger>
                        <SelectContent>
                          {menuDishes.map(dish => (
                            <SelectItem key={dish.id} value={dish.id}>{dish.name} (${(typeof dish.price === 'number' && !isNaN(dish.price) ? dish.price : parseFloat(dish.price) || 0).toFixed(2)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isClient && menuDishes.length === 0 && (
                      <div className="px-4 py-2 text-muted-foreground text-sm">No dishes available. Add dishes via the Ingredient Tool and refresh.</div>
                    )}
                    <Input
                      type="number"
                      min={1}
                      value={manualQuantity}
                      onChange={e => setManualQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="Quantity"
                      className="w-24"
                      disabled={isCreatingOrder}
                    />
                    {/* Action buttons are siblings, not nested! */}
                    <Button
                      onClick={() => {
                        if (!selectedDishId) {
                          toast({ title: "No Dish Selected", description: "Please select a dish to add.", variant: "destructive" });
                          return;
                        }
                        const dish = menuDishes.find(d => d.id === selectedDishId);
                        if (dish) {
                          setProcessedOrderItems(prevItems => {
                            // Prevent duplicate dish entries
                            const exists = prevItems.some(item => item.menuDish && item.menuDish.id === dish.id);
                            if (exists) {
                              toast({ title: "Already Added", description: `${dish.name} is already in the order.`, variant: "destructive" });
                              return prevItems;
                            }
                            return [
                              ...prevItems,
                              {
                                menuDish: dish,
                                aiExtractedName: dish.name,
                                quantity: manualQuantity,
                                isMatched: true,
                              }
                            ];
                          });
                          setSelectedDishId("");
                          setManualQuantity(1);
                        }
                      }}
                      disabled={!selectedDishId || isCreatingOrder}
                      type="button"
                    >
                      Add to Order
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setMenuDishes(getDishes(currentUser?.id ?? null))}
                      disabled={isCreatingOrder || !currentUser}
                      type="button"
                    >
                      Refresh Menu
                    </Button>
                  </div>
                </div>
                {/* Processed Order Items List */}
                <div>
                  <Label>AI Processed Order Items</Label>
                  <div className="space-y-2">
                    {processedOrderItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">No items found. Please process a transcript or add items manually.</p>
                    )}
                    {processedOrderItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 border rounded-md">
                        <div className="flex-1">
                          <p className="font-semibold">{item.aiExtractedName}</p>
                          {item.menuDish && (
                            <p className="text-sm text-muted-foreground">
                              Matched Menu Dish: {item.menuDish.name} (${(typeof item.menuDish.price === 'number' && !isNaN(item.menuDish.price) ? item.menuDish.price : parseFloat(item.menuDish.price) || 0).toFixed(2)})
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => {
                              const newQty = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setProcessedOrderItems(items => {
                                const newItems = [...items];
                                newItems[idx] = { ...newItems[idx], quantity: newQty };
                                return newItems;
                              });
                            }}
                            className="w-16"
                            disabled={isCreatingOrder}
                          />
                          <Button
                            onClick={() => {
                              setProcessedOrderItems(items => {
                                const newItems = items.filter((_, i) => i !== idx);
                                return newItems;
                              });
                            }}
                            variant="destructive"
                            size="icon"
                            disabled={isCreatingOrder}
                          >
                            <XCircle className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
                  {/* Order Type, Table, and Driver Selection */}
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label>Order Type</Label>
                      <Select value={confirmedOrderType} onValueChange={v => setConfirmedOrderType(v as AgentOrderType)} disabled={isCreatingOrder}>
                        <SelectTrigger><SelectValue placeholder="Select order type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dine-in">Dine-In</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="pickup">Pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {confirmedOrderType === 'dine-in' && (
                      <div>
                        <Label>Table</Label>
                        <Select value={selectedTableId} onValueChange={setSelectedTableId} disabled={isCreatingOrder}>
                          <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
                          <SelectContent>
                            {MOCK_TABLES_AGENT.map(table => (
                              <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(['delivery', 'pickup'] as AgentOrderType[]).includes(confirmedOrderType) && (
                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                          disabled={isCreatingOrder}
                        />
                      </div>
                    )}
                    {(['delivery', 'pickup'] as AgentOrderType[]).includes(confirmedOrderType) && (
                      <div>
                        <Label>Customer Phone</Label>
                        <Input
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          placeholder="Enter customer phone"
                          disabled={isCreatingOrder}
                        />
                      </div>
                    )}
                    {confirmedOrderType === 'delivery' && (
                      <div>
                        <Label>Customer Address</Label>
                        <Input
                          value={customerAddress}
                          onChange={e => setCustomerAddress(e.target.value)}
                          placeholder="Enter delivery address"
                          disabled={isCreatingOrder}
                        />
                      </div>
                    )}
                    {confirmedOrderType === 'delivery' && (
                      <div>
                        <Label>Driver</Label>
                        <Select value={selectedDriver} onValueChange={setSelectedDriver} disabled={isCreatingOrder}>
                          <SelectTrigger><SelectValue placeholder="Select a driver" /></SelectTrigger>
                          <SelectContent>
                            {MOCK_DRIVERS_AGENT.map(driver => (
                              <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {/* Confirm and Create Order Button */}
                  <Button
                    onClick={handleConfirmAndCreateOrder}
                    disabled={isCreatingOrder || !aiExtractedOrder}
                    className="w-full sm:w-auto"
                  >
                    {isCreatingOrder ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Confirm & Create Order
                  </Button>
                </div>
              </CardFooter>
            </React.Fragment>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
