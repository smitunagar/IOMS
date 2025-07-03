
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getOccupiedTables, OccupiedTableInfo } from '@/lib/orderService'; // Assuming OccupiedTableInfo is exported
import { Utensils } from 'lucide-react';

type TableStatus = "Available" | "Occupied" | "Needs Cleaning";

interface Table {
  id: string;
  name: string;
  status: TableStatus;
  capacity: number;
  orderId?: string; // To store the ID of the occupying order
}

const baseTables: Omit<Table, 'status' | 'orderId'>[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i + 1}`,
  name: `Table ${i + 1}`,
  capacity: Math.floor(Math.random() * 3 + 1) * 2, // 2, 4, 6, 8
}));

export default function TableManagementPage() {
  const { currentUser } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const updateTableStatuses = useCallback(() => {
    if (!currentUser) {
      setTables(baseTables.map(t => ({ ...t, status: "Available" }))); // Reset if no user
      return;
    }

    const occupiedByOrder = getOccupiedTables(currentUser.id);

    setTables(prevTables => {
      const currentTableMap = new Map(prevTables.map(t => [t.id, t]));
      
      return baseTables.map(baseTable => {
        const existingTable = currentTableMap.get(baseTable.id);
        let newStatus: TableStatus = existingTable?.status || "Available";
        let orderIdForTable: string | undefined = existingTable?.orderId;

        if (occupiedByOrder[baseTable.id]) {
          newStatus = "Occupied";
          orderIdForTable = occupiedByOrder[baseTable.id].orderId;
        } else {
          // If it was occupied by an order but no longer is, make it available
          // (or potentially "Needs Cleaning" if we had more complex logic)
          if (existingTable?.status === "Occupied" && existingTable?.orderId && !occupiedByOrder[baseTable.id]) {
            newStatus = "Available"; 
            orderIdForTable = undefined;
          }
          // Allow random status changes only if not determined by an active order
          else if (newStatus !== "Occupied" && Math.random() < 0.05) { // 5% chance to change status for non-order-occupied tables
            const statuses: TableStatus[] = ["Available", "Needs Cleaning"];
            newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            orderIdForTable = undefined; // Ensure orderId is cleared if status changes randomly
          }
        }
        return { ...baseTable, status: newStatus, orderId: orderIdForTable };
      });
    });
    setLastUpdated(new Date());
  }, [currentUser]);

  useEffect(() => {
    // Initial load
    updateTableStatuses();

    // Set up interval for periodic updates (e.g., random changes, re-checking localStorage)
    const interval = setInterval(updateTableStatuses, 5000); // Check every 5 seconds

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [currentUser, updateTableStatuses]);


  const handleManualStatusChange = (tableId: string, newStatus: TableStatus) => {
     if (!currentUser) return;
    // Manual status changes should not override an "Occupied" status if it's due to an active order.
    // However, allowing a user to mark an "Occupied" table as "Needs Cleaning" or "Available"
    // implies the order might have been cleared manually or an error occurred.
    // For this prototype, if a table is occupied by an order, changing its status manually via UI
    // will NOT clear the order from localStorage. That's handled by payment.
    // This manual change is more for "Available" <-> "Needs Cleaning".
    
    const occupiedByOrder = getOccupiedTables(currentUser.id);
    if (occupiedByOrder[tableId] && newStatus === "Available") {
        // If trying to set an order-occupied table to "Available" manually,
        // ideally, we'd warn the user or prevent it unless payment is processed.
        // For now, we'll allow it, but it won't clear the underlying order occupation.
    }

    setTables(currentTables =>
      currentTables.map(table =>
        table.id === tableId ? { ...table, status: newStatus, orderId: newStatus === "Occupied" ? table.orderId : undefined } : table
      )
    );
    setLastUpdated(new Date());
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case "Available": return "bg-green-500 hover:bg-green-600";
      case "Occupied": return "bg-red-500 hover:bg-red-600";
      case "Needs Cleaning": return "bg-yellow-500 hover:bg-yellow-600 text-black";
      default: return "bg-gray-500";
    }
  };

  if (!currentUser) {
    return (
      <AppLayout pageTitle="Table Management">
        <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
          <p className="text-xl text-muted-foreground">Please log in to manage tables.</p>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout pageTitle="Table Management">
      <div className="mb-4 text-sm text-muted-foreground">
        {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading table status...'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tables.map((table) => (
          <Card key={table.id} className={cn("flex flex-col justify-between hover:shadow-xl transition-shadow duration-300", table.status === "Occupied" ? "border-red-500 ring-2 ring-red-500/50" : table.status === "Needs Cleaning" ? "border-yellow-500" : "border-green-500")}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {table.name}
                <Badge className={cn("text-xs", getStatusColor(table.status))}>
                  {table.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Capacity: {table.capacity} guests</p>
              {table.status === "Occupied" && table.orderId && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center">
                  <Utensils className="h-3 w-3 mr-1"/> Order: #{table.orderId.substring(0, 8)}...
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Select 
                value={table.status} 
                onValueChange={(value: TableStatus) => handleManualStatusChange(table.id, value)}
                disabled={table.status === "Occupied" && !!table.orderId} // Disable if occupied by an order
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Occupied" disabled={!!table.orderId}>Occupied (Manual)</SelectItem>
                  <SelectItem value="Needs Cleaning">Needs Cleaning</SelectItem>
                </SelectContent>
              </Select>
            </CardFooter>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
