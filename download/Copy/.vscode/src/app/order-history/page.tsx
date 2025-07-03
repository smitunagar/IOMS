"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCompletedOrders, Order } from '@/lib/orderService';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Car, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function OrderHistoryPage() {
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      const orders = getCompletedOrders(currentUser.id);
      setCompletedOrders(orders);
      setIsLoading(false);
    } else {
      setCompletedOrders([]);
      setIsLoading(false);
    }
  }, [currentUser]);

  return (
    <AppLayout pageTitle="Order History">
      <Card>
        <CardHeader>
          <CardTitle>Completed Orders</CardTitle>
          <CardDescription>Review all past completed transactions for your restaurant.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && currentUser ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading order history...</p>
            </div>
          ) : !currentUser ? (
            <p className="text-center text-muted-foreground py-8">Please log in to view order history.</p>
          ) : completedOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No completed orders found.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <Table>
                <TableCaption>A list of all completed orders. Last updated: {new Date().toLocaleTimeString()}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Order ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details (Table/Customer)</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium truncate max-w-[150px] block" title={order.id}>{order.id}</TableCell>
                      <TableCell>
                        {order.orderType === 'delivery' ? 
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit"><Car className="h-3.5 w-3.5"/>Delivery</Badge> : 
                          <Badge variant="outline" className="flex items-center gap-1 w-fit"><Store className="h-3.5 w-3.5"/>Dine-In</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {order.orderType === 'delivery' ? (
                          <div className="text-xs">
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-muted-foreground">{order.customerAddress}</p>
                          </div>
                        ) : order.table}
                      </TableCell>
                      <TableCell>
                        {order.completedAt ? new Date(order.completedAt).toLocaleString() : new Date(order.createdAt).toLocaleDateString() + ' (Pending)'}
                      </TableCell>
                      <TableCell className="text-right">{(() => {
                        // Show euro if any item in order uses euro pricing
                        let hasEuro = false;
                        let euroTotal = 0;
                        order.items.forEach(item => {
                          let priceStr = item.unitPrice && item.unitPrice.toString().trim() ? item.unitPrice : item.name && item.name.match(/(\d+[.,]?\d*)\s*(EUR|€)/i)?.[0];
                          if (priceStr && /(EUR|€)/i.test(priceStr.toString())) {
                            hasEuro = true;
                            const match = priceStr.toString().match(/(\d+[.,]?\d*)/);
                            if (match) euroTotal += parseFloat(match[1].replace(',', '.')) * item.quantity;
                          }
                        });
                        if (hasEuro) {
                          return `€${euroTotal.toFixed(2)}`;
                        } else {
                          return `$${(typeof order.totalAmount === 'number' && !isNaN(order.totalAmount) ? order.totalAmount : parseFloat(order.totalAmount) || 0).toFixed(2)}`;
                        }
                      })()}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
