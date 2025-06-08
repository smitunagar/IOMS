
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CreditCardIcon, SmartphoneNfcIcon, ReceiptTextIcon, PrinterIcon, Loader2, Home, Phone } from "lucide-react";
import { getPendingOrders, updateOrderStatus, Order, clearOccupiedTable } from '@/lib/orderService';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const billDetailsRef = useRef<HTMLDivElement>(null);

  const loadPendingOrders = () => {
    if (!currentUser) {
      setIsLoading(false);
      setPendingOrders([]);
      return;
    }
    setIsLoading(true);
    const orders = getPendingOrders(currentUser.id);
    setPendingOrders(orders);
    setIsLoading(false);
  };

  useEffect(() => {
    loadPendingOrders();
  }, [currentUser]);

  const selectedOrder = pendingOrders.find(order => order.id === selectedOrderId);
  const subtotal = selectedOrder?.subtotal || 0;
  const tax = selectedOrder?.taxAmount || 0;
  const totalDue = selectedOrder ? selectedOrder.totalAmount + tipAmount : 0;

  const handleOrderSelection = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = pendingOrders.find(o => o.id === orderId);
    if (order) {
      // Reset tipAmount when a new order is selected to avoid carrying over tips
      const newTipAmount = 0; 
      setTipAmount(newTipAmount);
      setAmountPaid(order.totalAmount + newTipAmount); 
    } else {
      setAmountPaid(0);
      setTipAmount(0);
    }
  };
  
  useEffect(() => {
    if (selectedOrder) {
      setAmountPaid(selectedOrder.totalAmount + tipAmount);
    }
  }, [tipAmount, selectedOrder]);


  const handlePrintBill = () => {
    if (!selectedOrder) {
      toast({ title: "Error", description: "Please select an order to print.", variant: "destructive" });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow && billDetailsRef.current) {
      printWindow.document.write('<html><head><title>Print Bill</title>');
      printWindow.document.write(`
        <style>
          body { font-family: sans-serif; margin: 20px; }
          .bill-header { text-align: center; margin-bottom: 20px; }
          .bill-header h1 { margin: 0; font-size: 1.5em; }
          .bill-header p { margin: 2px 0; font-size: 0.9em; }
          .bill-section { margin-bottom: 15px; }
          .bill-section h2 { font-size: 1.1em; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;}
          table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
          th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
          th { background-color: #f9f9f9; }
          .text-right { text-align: right; }
          .totals-table td { border: none; padding: 3px 0;}
          .totals-table .strong { font-weight: bold; }
          .delivery-info { margin-top: 10px; font-size: 0.9em; }
          .delivery-info p { margin: 2px 0; }
        </style>
      `);
      printWindow.document.write('</head><body>');
      const printContent = billDetailsRef.current.cloneNode(true) as HTMLDivElement;
      const headerElement = printContent.querySelector('.bill-header-placeholder');
      if (headerElement) {
        let tableInfo = selectedOrder.orderType === 'delivery' ? `Delivery to: ${selectedOrder.customerName}` : `Table: ${selectedOrder.table}`;
        headerElement.innerHTML = `
          <h1>${currentUser?.restaurantName || 'Webmeister360AI'} Receipt</h1>
          <p>Order ID: ${selectedOrder.id}</p>
          <p>${tableInfo}</p>
          <p>Date: ${new Date(selectedOrder.createdAt).toLocaleString()}</p>
        `;
      }
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    } else {
       toast({ title: "Print Error", description: "Could not open print window. Check pop-up blocker.", variant: "destructive" });
    }
  };


  const handleProcessPayment = () => {
    if (!currentUser) {
       toast({ title: "Error", description: "Please log in.", variant: "destructive" });
       return;
    }
    if (!selectedOrder) {
      toast({ title: "Error", description: "Please select an order to process payment.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "cash" && amountPaid < totalDue) {
       toast({ title: "Error", description: `Cash paid (${amountPaid.toFixed(2)}) is less than total due (${totalDue.toFixed(2)}).`, variant: "destructive" });
       return;
    }

    const processedOrder = updateOrderStatus(currentUser.id, selectedOrder.id, 'Completed');
    if (processedOrder) {
      if (processedOrder.orderType === 'dine-in' && processedOrder.tableId) {
        clearOccupiedTable(currentUser.id, processedOrder.tableId);
      }
      let successMessageTableInfo = processedOrder.orderType === 'delivery' ? `Delivery for ${processedOrder.customerName}` : `Table ${processedOrder.table} is now free`;
      toast({ title: "Payment Successful!", description: `Processed $${totalDue.toFixed(2)} for order ${selectedOrder.id.substring(0,12)}... via ${paymentMethod}. ${successMessageTableInfo}.` });
      loadPendingOrders(); 
      setSelectedOrderId("");
      setPaymentMethod("card");
      setAmountPaid(0);
      setTipAmount(0);
    } else {
      toast({ title: "Error", description: "Failed to update order status.", variant: "destructive" });
    }
  };

  return (
    <AppLayout pageTitle="Payment Processing">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><ReceiptTextIcon className="mr-2 h-6 w-6" /> Process Payment</CardTitle>
              <CardDescription>Select a pending order, choose payment method, and complete the transaction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="order-select">Select Pending Order</Label>
                <select
                  id="order-select"
                  value={selectedOrderId}
                  onChange={(e) => handleOrderSelection(e.target.value)}
                  className="w-full p-2 border rounded-md bg-input"
                  disabled={isLoading || pendingOrders.length === 0 || !currentUser}
                >
                  <option value="">
                    {isLoading && currentUser ? "Loading orders..." : 
                     !currentUser ? "-- Please log in --" :
                     pendingOrders.length === 0 ? "-- No pending orders --" : 
                     "-- Select an Order --"}
                  </option>
                  {pendingOrders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.orderType === 'delivery' ? 'DELIVERY: ' : 'Dine-In: '}
                      {order.table} (ID: {order.id.substring(0,8)}...) - Total: $${order.totalAmount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  className="flex flex-wrap gap-4 pt-2"
                >
                  {(["card", "cash", "mobile"] as const).map((method) => (
                    <div key={method}
                      className={`flex items-center space-x-2 p-3 border rounded-md hover:bg-accent/50 cursor-pointer 
                                  ${paymentMethod === method ? 'bg-accent border-primary ring-2 ring-primary' : ''}`}
                      onClick={() => setPaymentMethod(method)}
                    >
                      <RadioGroupItem value={method} id={method} checked={paymentMethod === method} />
                      <Label htmlFor={method} className="flex items-center cursor-pointer capitalize">
                        {method === 'card' && <CreditCardIcon className="mr-2 h-5 w-5"/>}
                        {method === 'cash' && <DollarSign className="mr-2 h-5 w-5"/>}
                        {method === 'mobile' && <SmartphoneNfcIcon className="mr-2 h-5 w-5"/>}
                        {method}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              {selectedOrder && (
                 <div>
                    <Label htmlFor="tip-amount">Tip Amount</Label>
                    <Input 
                      id="tip-amount" 
                      type="number" 
                      value={tipAmount} 
                      onChange={(e) => setTipAmount(Math.max(0, parseFloat(e.target.value)) || 0)} 
                      placeholder="Enter tip amount (optional)" 
                      min="0"
                      step="0.01"
                    />
                  </div>
              )}

              {selectedOrder && paymentMethod === "cash" && (
                 <div>
                    <Label htmlFor="amount-paid">Amount Paid by Customer (Cash)</Label>
                    <Input 
                      id="amount-paid" 
                      type="number" 
                      value={amountPaid} 
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)} 
                      placeholder="Enter amount paid" 
                      min="0"
                      step="0.01"
                    />
                     {amountPaid >= totalDue && totalDue > 0 && (
                       <p className="text-sm mt-1 text-green-600 dark:text-green-400">Change due: $${(amountPaid - totalDue).toFixed(2)}</p>
                    )}
                  </div>
              )}

            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleProcessPayment} className="w-full sm:w-auto flex-grow" size="lg" disabled={!selectedOrder || isLoading || !currentUser}>
                Process Payment ($${totalDue.toFixed(2)})
              </Button>
              <Button onClick={handlePrintBill} variant="outline" className="w-full sm:w-auto" disabled={!selectedOrder || isLoading || !currentUser}>
                <PrinterIcon className="mr-2 h-5 w-5"/> Print Bill
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="md:col-span-1">
          {selectedOrder ? (
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>ID: {selectedOrder.id.substring(0,12)}...</CardDescription>
              </CardHeader>
              <CardContent ref={billDetailsRef} className="space-y-3">
                <div className="bill-header-placeholder hidden print:block bill-header"></div>
                {selectedOrder.orderType === 'delivery' && (
                  <div className="bill-section delivery-info">
                    <h2 className="font-semibold print:text-lg">Delivery Details</h2>
                    <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
                    <p className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/> {selectedOrder.customerPhone}</p>
                    <p className="flex items-start"><Home className="mr-2 mt-1 h-4 w-4 text-muted-foreground"/> {selectedOrder.customerAddress}</p>
                    <p><strong>Driver:</strong> {selectedOrder.driverName}</p>
                  </div>
                )}
                 {selectedOrder.orderType === 'dine-in' && (
                  <p className="text-sm text-muted-foreground print:hidden">Table: {selectedOrder.table}</p>
                )}
                <Separator className={selectedOrder.orderType === 'delivery' ? 'my-3' : 'hidden'}/>
                <div className="bill-section">
                  <h2 className="font-semibold print:text-lg">Items</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left font-normal">Item</th>
                        <th className="text-center font-normal">Qty</th>
                        <th className="text-right font-normal">Price</th>
                        <th className="text-right font-normal">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right">$${item.unitPrice.toFixed(2)}</td>
                          <td className="text-right">$${item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Separator/>
                <div className="bill-section">
                  <h2 className="font-semibold print:text-lg">Summary</h2>
                  <table className="w-full text-sm totals-table">
                      <tbody>
                        <tr><td>Subtotal:</td><td className="text-right strong">$${subtotal.toFixed(2)}</td></tr>
                        <tr><td>Tax ($${(selectedOrder.taxRate * 100).toFixed(0)}%):</td><td className="text-right strong">$${tax.toFixed(2)}</td></tr>
                        {tipAmount > 0 && <tr><td>Tip:</td><td className="text-right strong">$${tipAmount.toFixed(2)}</td></tr>}
                        <tr className="text-lg border-t mt-1 pt-1"><td className="font-bold">Total Due:</td><td className="text-right font-bold strong">$${totalDue.toFixed(2)}</td></tr>
                      </tbody>
                  </table>
                </div>
                 <p className="text-xs text-muted-foreground print:hidden">Order Type: <span className="capitalize">{selectedOrder.orderType}</span></p>
                 <p className="text-xs text-muted-foreground print:hidden">Created: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-full">
              <CardContent>
                { !currentUser ? <p className="text-muted-foreground">Please log in to process payments.</p> :
                  isLoading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> :
                 <p className="text-muted-foreground">Select an order to view details.</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
