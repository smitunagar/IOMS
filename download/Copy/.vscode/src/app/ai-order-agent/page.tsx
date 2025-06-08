
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

export default function AiOrderAgentPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [transcript, setTranscript] = useState<string>("");
  const [aiExtractedOrder, setAiExtractedOrder] = useState<ExtractedOrderOutput | null>(null);
  const [processedOrderItems, setProcessedOrderItems] = useState<MatchedOrderItem[]>([]);
  
  const [menuDishes, setMenuDishes] = useState<Dish[]>([]);
  useEffect(() => {
    if (currentUser) {
      setMenuDishes(getDishes(currentUser.id));
    }
  }, [currentUser]);

  // Form state for confirming order details
  const [confirmedOrderType, setConfirmedOrderType] = useState<OrderType | 'unknown'>('unknown');
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");


  const [isProcessingTranscript, startProcessingTranscript] = useTransition();
  const [isCreatingOrder, startCreatingOrder] = useTransition();

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
        setConfirmedOrderType(result.orderType || 'unknown');
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
      orderSpecifics = { table: displayMessageTarget, tableId: selectedTableId };
    } else if (confirmedOrderType === 'delivery') {
      if (!customerName || !customerPhone || !customerAddress || !selectedDriver) {
        toast({ title: "Error", description: "Please fill all customer and driver details for delivery.", variant: "destructive" });
        return;
      }
      displayMessageTarget = `Delivery to ${customerName}`;
      orderSpecifics = {
        customerName, customerPhone, customerAddress, driverName: selectedDriver,
        table: displayMessageTarget, tableId: `delivery-ai-${Date.now()}`,
      };
    } else if (confirmedOrderType === 'pickup') {
       if (!customerName || !customerPhone) {
        toast({ title: "Error", description: "Please fill customer name and phone for pickup.", variant: "destructive" });
        return;
      }
      displayMessageTarget = `Pickup for ${customerName}`;
      orderSpecifics = {
        customerName, customerPhone,
        table: displayMessageTarget, tableId: `pickup-ai-${Date.now()}`,
      }
    } else {
        toast({ title: "Error", description: "Please select a valid order type (Dine-In, Delivery, or Pickup).", variant: "destructive" });
        return;
    }
    
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
            orderType: confirmedOrderType as OrderType, // Cast as we validated unknown away
            items: orderItemsForService,
            subtotal,
            taxRate: DEFAULT_TAX_RATE,
            ...orderSpecifics,
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
                <CardDescription>AI Confidence: <Badge variant={aiExtractedOrder.confidenceScore > 0.7 ? "default" : "secondary"}>{(aiExtractedOrder.confidenceScore * 100).toFixed(0)}%</Badge></CardDescription>
            )}
          </CardHeader>
          
          {isProcessingTranscript && (
             <CardContent className="flex justify-center items-center min-h-[300px]">
               <Loader2 className="h-12 w-12 animate-spin text-primary" />
             </CardContent>
          )}

          {aiExtractedOrder && !isProcessingTranscript && (
            <>
              <CardContent className="space-y-4">
                <div>
                  <Label>Order Type</Label>
                  <Select value={confirmedOrderType} onValueChange={(v) => setConfirmedOrderType(v as (OrderType | 'unknown'))} disabled={isCreatingOrder}>
                    <SelectTrigger><SelectValue placeholder="Select order type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Unknown / Not Specified</SelectItem>
                      <SelectItem value="dine-in">Dine-In</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="pickup">Pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {confirmedOrderType === 'dine-in' && (
                  <div>
                    <Label htmlFor="table-select-agent">Assign to Table</Label>
                    <Select value={selectedTableId} onValueChange={setSelectedTableId} disabled={isCreatingOrder}>
                      <SelectTrigger id="table-select-agent"><SelectValue placeholder="Select a table" /></SelectTrigger>
                      <SelectContent>
                        {MOCK_TABLES_AGENT.map(table => <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(confirmedOrderType === 'delivery' || confirmedOrderType === 'pickup') && (
                  <>
                    <div>
                      <Label htmlFor="customer-name-agent">Customer Name</Label>
                      <Input id="customer-name-agent" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Extracted or Enter Name" disabled={isCreatingOrder}/>
                    </div>
                    <div>
                      <Label htmlFor="customer-phone-agent">Customer Phone</Label>
                      <Input id="customer-phone-agent" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Extracted or Enter Phone" disabled={isCreatingOrder}/>
                    </div>
                  </>
                )}
                {confirmedOrderType === 'delivery' && (
                  <>
                    <div>
                      <Label htmlFor="customer-address-agent">Delivery Address</Label>
                      <Input id="customer-address-agent" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Extracted or Enter Address" disabled={isCreatingOrder}/>
                    </div>
                     <div>
                      <Label htmlFor="driver-select-agent">Assign Driver</Label>
                      <Select value={selectedDriver} onValueChange={setSelectedDriver} disabled={isCreatingOrder}>
                        <SelectTrigger id="driver-select-agent"><SelectValue placeholder="Select a driver" /></SelectTrigger>
                        <SelectContent>
                          {MOCK_DRIVERS_AGENT.map(driver => <SelectItem key={driver} value={driver}>{driver}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <Label>Items Suggested by AI:</Label>
                {processedOrderItems.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded-md">
                    {processedOrderItems.map((item, index) => (
                      <div key={index} className={`p-2 rounded-md flex justify-between items-center ${item.isMatched ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <div>
                          <p className="font-medium">{item.aiExtractedName} (Qty: {item.quantity})</p>
                          {item.isMatched && item.menuDish ? (
                            <p className="text-xs text-green-700 flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>Matched: {item.menuDish.name} (${item.menuDish.price.toFixed(2)})</p>
                          ) : (
                            <p className="text-xs text-red-700 flex items-center"><XCircle className="h-3 w-3 mr-1"/>Not found on menu. Will not be added.</p>
                          )}
                        </div>
                         {/* TODO: Add controls to change quantity or re-match dish */}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No items extracted by AI or none match the menu.</p>
                )}
                 <div>
                  <Label htmlFor="order-notes-agent">Order Notes (from AI or manual)</Label>
                  <Textarea id="order-notes-agent" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="e.g., 'Extra sauce', 'Call upon arrival'" disabled={isCreatingOrder}/>
                </div>

              </CardContent>
              <CardFooter>
                 <Button 
                    onClick={handleConfirmAndCreateOrder} 
                    disabled={isProcessingTranscript || isCreatingOrder || !currentUser || processedOrderItems.filter(i => i.isMatched).length === 0 || confirmedOrderType === 'unknown'} 
                    className="w-full"
                  >
                  {isCreatingOrder ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-4 w-4" />
                  )}
                  Confirm & Create Order
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

