"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { PlusCircle, RefreshCw, Pencil, Trash2, AlertTriangle, Upload, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { getInventory, updateInventoryItem, removeInventoryItem, InventoryItem, batchAddOrUpdateInventoryItems, ProcessedCSVItem } from '@/lib/inventoryService'; 
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, parseISO, isValid, parse as parseDateFns } from 'date-fns';

const defaultCategories = ["Pantry", "Produce", "Dairy", "Meat", "Seafood", "Frozen", "Beverages", "Spices", "Other"];
const CSV_TEMPLATE_HEADERS = "Name,Quantity,Unit,Category,LowStockThreshold,ExpiryDate (YYYY-MM-DD),ImageURL,AIHint";
const CSV_TEMPLATE_EXAMPLE_ROW = "Example Tomato,10,kg,Produce,2,2024-12-31,https://placehold.co/60x60.png,fresh tomato";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editFormState, setEditFormState] = useState<Partial<InventoryItem>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInventoryAndNotify = useCallback((showToasts = true) => {
    if (!currentUser) {
      setIsLoading(false);
      setInventory([]);
      return;
    }
    setIsLoading(true);
      const currentInventory = getInventory(currentUser.id);
      setInventory(currentInventory);
      setIsLoading(false);

      if (showToasts) {
        currentInventory.forEach(item => {
          const stockStatus = getStockLevel(item);
          if (stockStatus === 'critical') {
            toast({
              title: `Critical Stock Alert: ${item.name}`,
              description: `Only ${item.quantity} ${item.unit} left. This is below the critical threshold.`,
              variant: "destructive",
            });
          }

          if (item.expiryDate) {
            const expiry = parseISO(item.expiryDate);
            if (isValid(expiry)) {
              const daysUntilExpiry = differenceInDays(expiry, new Date());
              if (daysUntilExpiry <= 0) {
                toast({
                  title: `Expired Item: ${item.name}`,
                  description: `This item expired on ${format(expiry, "PPP")}. Remove or check immediately.`,
                  variant: "destructive",
                });
              } else if (daysUntilExpiry <= 3) {
                toast({
                  title: `Expiry Alert: ${item.name}`,
                  description: `Expires in ${daysUntilExpiry} day(s) on ${format(expiry, "PPP")}.`,
                  variant: "destructive",
                  action: <AlertTriangle className="h-5 w-5 text-destructive-foreground" />
                });
              }
            }
          }
        });
      }
  }, [currentUser, toast]);

  useEffect(() => {
    loadInventoryAndNotify();
  }, [loadInventoryAndNotify]);

  const handleRefresh = () => {
    loadInventoryAndNotify(); 
    toast({ title: "Inventory Refreshed", description: "Stock levels and alerts updated."});
  }

  const handleOpenEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setEditFormState({ ...item }); 
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!currentUser || !editingItem || !editFormState) return;

    const quantity = parseFloat(String(editFormState.quantity));
    const lowStockThreshold = parseFloat(String(editFormState.lowStockThreshold));
    const quantityUsed = parseFloat(String(editFormState.quantityUsed || 0));

    if (isNaN(quantity) || isNaN(lowStockThreshold) || isNaN(quantityUsed)) {
        toast({ title: "Error", description: "Quantity, threshold, and used quantity must be valid numbers.", variant: "destructive" });
        return;
    }
    
    const updatedDetails: Partial<InventoryItem> = {
      ...editFormState,
      quantity,
      lowStockThreshold,
      quantityUsed,
      aiHint: editFormState.aiHint || undefined,
      expiryDate: editFormState.expiryDate ? editFormState.expiryDate : undefined,
    };
    
    const result = updateInventoryItem(currentUser.id, editingItem.id, updatedDetails);
    if (result) {
      toast({ title: "Success", description: `${result.name} updated successfully.` });
      loadInventoryAndNotify(false); 
    } else {
      toast({ title: "Error", description: "Failed to update item.", variant: "destructive" });
    }
    setIsEditDialogOpen(false);
    setEditingItem(null);
  };
  
  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (!currentUser) return;
    if (confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      const success = removeInventoryItem(currentUser.id, itemId);
      if (success) {
        toast({ title: "Item Deleted", description: `"${itemName}" has been removed from inventory.` });
        loadInventoryAndNotify(false);
      } else {
        toast({ title: "Error", description: `Failed to delete "${itemName}".`, variant: "destructive" });
      }
    }
  };

  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "number" || name === "quantity" || name === "lowStockThreshold" || name === "quantityUsed") {
      const numValue = parseFloat(value);
      setEditFormState(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setEditFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    setEditFormState(prev => ({ ...prev, expiryDate: date ? date.toISOString().split('T')[0] : undefined }));
  };

  const handleDownloadTemplate = () => {
    const csvContent = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE_ROW}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "inventory_template.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    toast({title: "Template Downloading", description: "inventory_template.csv should start downloading."})
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
        toast({ title: "Error", description: "Please log in to import inventory.", variant: "destructive" });
        return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error", description: "Could not read file content.", variant: "destructive"});
        return;
      }
      try {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== ''); 
        if (lines.length <= 1) { 
            toast({ title: "Error", description: "CSV file is empty or contains only headers.", variant: "destructive"});
            return;
        }
        
        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map(h => h.trim());
        const expectedHeaders = CSV_TEMPLATE_HEADERS.toLowerCase().split(',').map(h => h.trim().replace(" (yyyy-mm-dd)",""));
        
        if (!expectedHeaders.every((eh, i) => headers[i] === eh)) {
            console.error("Actual CSV headers:", headers, "Expected template headers:", expectedHeaders);
            toast({ title: "Invalid CSV Headers", description: `Please use the template. Expected: ${CSV_TEMPLATE_HEADERS}`, variant: "destructive", duration: 10000});
            return;
        }

        const itemsToProcess: ProcessedCSVItem[] = [];
        const parseErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            
            const name = values[0]?.trim();
            const quantityStr = values[1]?.trim();
            const unit = values[2]?.trim();
            const category = values[3]?.trim() || "Pantry";
            const lowStockThresholdStr = values[4]?.trim();
            const expiryDateStr = values[5]?.trim();
            const imageURL = values[6]?.trim();
            const aiHint = values[7]?.trim();

            if (!name || !quantityStr || !unit) {
                parseErrors.push(`Row ${i+1}: Name, Quantity, or Unit is missing. Skipping.`);
                continue;
            }

            const quantity = parseFloat(quantityStr);
            if (isNaN(quantity)) {
                 parseErrors.push(`Row ${i+1}: Invalid quantity '${quantityStr}' for item '${name}'. Skipping.`);
                 continue;
            }
            
            let lowStockThreshold: number | undefined = parseFloat(lowStockThresholdStr);
            if (isNaN(lowStockThreshold) || lowStockThreshold <=0) lowStockThreshold = Math.max(1, Math.floor(quantity * 0.2));

            let expiryDate: string | undefined = undefined;
            if (expiryDateStr) {
                const parsedDate = parseDateFns(expiryDateStr, 'yyyy-MM-dd', new Date());
                if (isValid(parsedDate)) {
                    expiryDate = parsedDate.toISOString().split('T')[0];
                } else {
                    parseErrors.push(`Row ${i+1}: Invalid expiry date format '${expiryDateStr}' for item '${name}'. Expected YYYY-MM-DD. Expiry not set.`);
                }
            }
            
            itemsToProcess.push({ 
                name, 
                quantity, 
                unit, 
                category, 
                lowStockThreshold, 
                expiryDate,
                imageURL: imageURL || undefined,
                aiHint: aiHint || undefined,
            });
        }
        
        if (parseErrors.length > 0) {
            toast({
                title: `CSV Parsing Issues (${parseErrors.length})`,
                description: parseErrors.slice(0, 3).join('; ') + (parseErrors.length > 3 ? '...' : ''),
                variant: "destructive",
                duration: 10000
            });
        }

        if (itemsToProcess.length > 0) {
            const result = batchAddOrUpdateInventoryItems(currentUser.id, itemsToProcess);
            toast({
                title: "Import Complete",
                description: `${result.added} new items added. ${result.updated} items updated. ${result.errors + parseErrors.length} errors encountered.`,
            });
            loadInventoryAndNotify(false);
        } else if (parseErrors.length === lines.length -1 && lines.length > 1) {
            toast({ title: "Import Failed", description: "No valid items found to process in the CSV.", variant: "destructive"});
        }


      } catch (error) {
        console.error("Error processing CSV:", error);
        toast({ title: "Error", description: `Failed to process CSV file. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };


  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockLevel = (item: InventoryItem): "critical" | "low" | "medium" | "high" => {
    const effectiveThreshold = item.lowStockThreshold > 0 ? item.lowStockThreshold : 1;
    if (item.quantity <= 0) return "critical"; 
    if (item.quantity <= effectiveThreshold / 2 && effectiveThreshold > 1) return "critical"; 
    if (item.quantity <= effectiveThreshold) return "low";
    if (item.quantity <= effectiveThreshold * 2) return "medium";
    return "high";
  }
  
  const calculateProgressValue = (item: InventoryItem) => {
    const effectiveThreshold = item.lowStockThreshold > 0 ? item.lowStockThreshold : 1;
    const maxStockGuess = Math.max(item.quantity + (item.quantityUsed || 0), effectiveThreshold * 5, 1);
    if (maxStockGuess === 0 && item.quantity === 0) return 0;
    if (maxStockGuess === 0 && item.quantity > 0) return 100; 
    return (item.quantity / maxStockGuess) * 100;
  }

  const getExpiryStatus = (expiryDateStr?: string): { status: "expired" | "soon" | "ok" | "none"; days?: number; formattedDate?: string } => {
    if (!expiryDateStr) return { status: "none" };
    const expiry = parseISO(expiryDateStr);
    if (!isValid(expiry)) return { status: "none" };
    
    const days = differenceInDays(expiry, new Date());
    const formatted = format(expiry, "PP");

    if (days < 0) return { status: "expired", days, formattedDate: formatted };
    if (days <= 7) return { status: "soon", days, formattedDate: formatted };
    return { status: "ok", days, formattedDate: formatted };
  };


  return (
    <AppLayout pageTitle="Inventory Management">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Current Stock Levels</CardTitle>
              <CardDescription>View, manage, and get alerts for your inventory. Data is stored locally per user.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading || !currentUser}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleDownloadTemplate} variant="outline" disabled={!currentUser}>
                <Download className="mr-2 h-4 w-4" /> Download CSV Template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" disabled={!currentUser}>
                <Upload className="mr-2 h-4 w-4" /> Import from CSV
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <Button disabled> 
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
              </Button>
            </div>
          </div>
          <Input
            type="search"
            placeholder="Search ingredients or categories..."
            className="mt-4"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!currentUser}
          />
        </CardHeader>
        <CardContent>
          {isLoading && currentUser ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading inventory...</p>
            </div>
          ) : !currentUser ? (
             <p className="text-center text-muted-foreground py-8">Please log in to view inventory.</p>
          ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableCaption>A list of your current inventory items. Last updated: {new Date().toLocaleTimeString()}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead className="min-w-[150px]">Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Last Restocked</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => {
                const stockStatus = getStockLevel(item);
                const expiryInfo = getExpiryStatus(item.expiryDate);
                
                let rowClass = "";
                if (stockStatus === 'critical' || expiryInfo.status === 'expired') rowClass = 'bg-destructive/20 hover:bg-destructive/30';
                else if (stockStatus === 'low' || expiryInfo.status === 'soon') rowClass = 'bg-yellow-400/20 hover:bg-yellow-400/30';

                return (
                  <TableRow key={item.id} className={rowClass}>
                    <TableCell>
                      <Image
                        src={item.image || "https://placehold.co/60x60.png"}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="rounded object-cover"
                        data-ai-hint={item.aiHint || item.name.toLowerCase().split(' ').slice(0,2).join(' ')}
                        onError={(e) => (e.currentTarget.src = "https://placehold.co/60x60.png")}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantityUsed || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         <Progress 
                           value={calculateProgressValue(item)} 
                           className="w-20 h-2 [&>*]:bg-current" 
                           style={{color: stockStatus === 'critical' || stockStatus === 'low' ? 'hsl(var(--destructive))' : stockStatus === 'medium' ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-1))'}}
                         />
                         <Badge 
                           variant={stockStatus === 'critical' ? 'destructive' : stockStatus === 'low' ? 'destructive' : stockStatus === 'medium' ? 'secondary' : 'default'} 
                           className="capitalize"
                          >
                           {stockStatus}
                         </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {expiryInfo.formattedDate ? (
                        <Badge 
                          variant={expiryInfo.status === 'expired' ? 'destructive' : expiryInfo.status === 'soon' ? 'secondary' : 'outline'}
                          className={expiryInfo.status === 'soon' && expiryInfo.days !== undefined && expiryInfo.days <=3 ? 'bg-yellow-500 text-black' : ''}
                        >
                           {expiryInfo.status === 'expired' ? `Expired: ` : expiryInfo.status === 'soon' ? `Expires: ` : ''}
                           {expiryInfo.formattedDate}
                           {expiryInfo.status === 'soon' && expiryInfo.days !== undefined && ` (${expiryInfo.days}d)`}
                        </Badge>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(item)} title="Edit Item">
                        <Pencil className="h-4 w-4" />
                      </Button>
                       <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id, item.name)} title="Delete Item">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          )}
          {filteredInventory.length === 0 && !isLoading && currentUser && (
            <p className="text-center text-muted-foreground py-8">No items match your search, or inventory is empty.</p>
          )}
        </CardContent>
      </Card>

      {editingItem && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit: {editingItem.name}</DialogTitle>
              <DialogDescription>Make changes to your inventory item here. Click save when you're done.</DialogDescription>
            </DialogHeader>
            {editingItem.image && (
              <div className="my-4 flex flex-col items-center">
                <Image
                  src={editFormState.image || "https://placehold.co/80x80.png"}
                  alt={editingItem.name}
                  width={80}
                  height={80}
                  className="rounded object-cover mb-1"
                  data-ai-hint={editFormState.aiHint || ''}
                  onError={(e) => (e.currentTarget.src = "https://placehold.co/80x80.png")}
                />
                <p className="text-xs text-muted-foreground">Current AI Hint: {editFormState.aiHint || 'N/A'}</p>
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={editFormState.name || ''} onChange={handleFormInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aiHint" className="text-right">AI Hint</Label>
                <Input id="aiHint" name="aiHint" value={editFormState.aiHint || ''} onChange={handleFormInputChange} className="col-span-3" placeholder="e.g. fresh tomato"/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantity" className="text-right">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" value={editFormState.quantity || 0} onChange={handleFormInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right">Unit</Label>
                <Input id="unit" name="unit" value={editFormState.unit || ''} onChange={handleFormInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Category</Label>
                <select id="category" name="category" value={editFormState.category || ''} onChange={handleFormInputChange} className="col-span-3 p-2 border rounded-md bg-input">
                    {defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="lowStockThreshold" className="text-right">Low Stock At</Label>
                <Input id="lowStockThreshold" name="lowStockThreshold" type="number" value={editFormState.lowStockThreshold || 0} onChange={handleFormInputChange} className="col-span-3" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantityUsed" className="text-right">Quantity Used</Label>
                <Input id="quantityUsed" name="quantityUsed" type="number" value={editFormState.quantityUsed || 0} onChange={handleFormInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expiryDate" className="text-right">Expiry Date</Label>
                <DatePicker 
                    date={editFormState.expiryDate ? parseISO(editFormState.expiryDate) : undefined} 
                    setDate={(d) => handleDateChange(d)} 
                    />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
