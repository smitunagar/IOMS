
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Bell, AlertTriangle, ShoppingBasket, Utensils, Sparkles, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { getInventory, InventoryItem } from '@/lib/inventoryService';
import { getDishes, Dish } from '@/lib/menuService';
import { suggestDiscountedDishes, SuggestDiscountedDishesInput, SuggestDiscountedDishesOutput } from '@/ai/flows/suggest-discounted-dishes';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

interface AlertItem {
  id: string;
  type: 'expiry' | 'low_stock';
  message: string;
  severity: 'warning' | 'critical';
  itemName: string;
}

interface AIDiscountSuggestion {
  dishName: string;
  reason: string;
  suggestedDiscountPercentage?: number;
}

export function NotificationBell() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIDiscountSuggestion[] | null>(null);
  const [isGeneratingSuggestions, startGeneratingSuggestionsTransition] = useTransition();

  const expiringSoonThresholdDays = 7;
  const expiringCriticalThresholdDays = 3;

  useEffect(() => {
    if (!currentUser || !popoverOpen) {
      // Only refresh alerts if popover is open, or on initial load if needed.
      // For now, let's keep it simple and refresh when popover opens or currentUser changes.
      // A more advanced system might update this in the background.
      setAlerts([]); // Clear old alerts
      return;
    }

    const inventory = getInventory(currentUser.id);
    const newAlerts: AlertItem[] = [];

    inventory.forEach(item => {
      // Low Stock Alerts
      const effectiveThreshold = item.lowStockThreshold > 0 ? item.lowStockThreshold : 1;
      if (item.quantity <= effectiveThreshold / 2 && effectiveThreshold > 1) {
        newAlerts.push({
          id: `${item.id}-lowstock-critical`,
          type: 'low_stock',
          message: `Critically low stock: ${item.quantity} ${item.unit} left. Threshold is ${item.lowStockThreshold}.`,
          severity: 'critical',
          itemName: item.name,
        });
      } else if (item.quantity <= effectiveThreshold) {
         newAlerts.push({
          id: `${item.id}-lowstock-warning`,
          type: 'low_stock',
          message: `Low stock: ${item.quantity} ${item.unit} left. Threshold is ${item.lowStockThreshold}.`,
          severity: 'warning',
          itemName: item.name,
        });
      }

      // Expiry Alerts
      if (item.expiryDate) {
        const expiry = parseISO(item.expiryDate);
        if (isValid(expiry)) {
          const daysUntil = differenceInDays(expiry, new Date());
          if (daysUntil < 0) {
            newAlerts.push({
              id: `${item.id}-expiry-critical`,
              type: 'expiry',
              message: `Expired on ${format(expiry, "PP")}.`,
              severity: 'critical',
              itemName: item.name,
            });
          } else if (daysUntil <= expiringCriticalThresholdDays) {
            newAlerts.push({
              id: `${item.id}-expiry-critical`,
              type: 'expiry',
              message: `Expires in ${daysUntil} day(s) on ${format(expiry, "PP")}.`,
              severity: 'critical',
              itemName: item.name,
            });
          } else if (daysUntil <= expiringSoonThresholdDays) {
            newAlerts.push({
              id: `${item.id}-expiry-warning`,
              type: 'expiry',
              message: `Expires in ${daysUntil} day(s) on ${format(expiry, "PP")}.`,
              severity: 'warning',
              itemName: item.name,
            });
          }
        }
      }
    });
    setAlerts(newAlerts);
  }, [currentUser, popoverOpen]);


  const handleGetAISuggestions = () => {
    if (!currentUser) return;
    setAiSuggestions(null);

    startGeneratingSuggestionsTransition(async () => {
      try {
        const inventory = getInventory(currentUser.id);
        const menu = getDishes(currentUser.id);

        const expiringIngredientsForAI = inventory
          .map(item => {
            if (!item.expiryDate) return null;
            const expiry = parseISO(item.expiryDate);
            if (!isValid(expiry)) return null;
            const daysUntil = differenceInDays(expiry, new Date());
            if (daysUntil <= expiringSoonThresholdDays && daysUntil >= 0) { // Include items expiring today up to N days
              return {
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                daysUntilExpiry: daysUntil,
              };
            }
            return null;
          })
          .filter(item => item !== null) as SuggestDiscountedDishesInput['expiringIngredients'];

        if (expiringIngredientsForAI.length === 0) {
          toast({ title: "No Soon-to-Expire Items", description: "No ingredients are expiring soon enough to generate discount suggestions." });
          setAiSuggestions([]); // Empty array to indicate check was made
          return;
        }
        
        const menuDishesForAI = menu.map(dish => ({
          name: dish.name,
          ingredients: dish.ingredients.map(ing => ({
            name: ing.inventoryItemName, // Map to simple name
            quantityPerDish: ing.quantityPerDish,
            unit: ing.unit,
          })),
          // We could add currentPrice here if AI should consider it for discount %
        }));

        const input: SuggestDiscountedDishesInput = {
          expiringIngredients: expiringIngredientsForAI,
          menuDishes: menuDishesForAI,
        };
        
        const result: SuggestDiscountedDishesOutput = await suggestDiscountedDishes(input);
        
        if (result && result.suggestions) {
          setAiSuggestions(result.suggestions);
          toast({ title: "AI Suggestions Generated!", description: "Discount ideas are ready." });
        } else {
          throw new Error("AI did not return valid suggestions.");
        }
      } catch (error) {
        console.error("Error generating AI discount suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Suggestion Failed", description: errorMessage, variant: "destructive" });
        setAiSuggestions(null);
      }
    });
  };

  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;
  const warningAlertCount = alerts.filter(a => a.severity === 'warning').length;
  const totalAlertCount = alerts.length;


  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalAlertCount > 0 && (
            <Badge
              variant={criticalAlertCount > 0 ? "destructive" : "default"}
              className="absolute -top-1 -right-1 h-4 w-4 min-w-4 p-0 flex items-center justify-center text-xs rounded-full"
            >
              {totalAlertCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="p-4">
          <h3 className="font-medium text-lg">Notifications</h3>
        </div>
        <ScrollArea className="h-[300px] sm:h-[400px]">
          <div className="p-4 space-y-3">
            {alerts.length === 0 && !isGeneratingSuggestions && (!aiSuggestions || aiSuggestions.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No active alerts or suggestions.</p>
            )}
            
            {alerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-md border ${alert.severity === 'critical' ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-yellow-400/10 border-yellow-500 text-yellow-700 dark:text-yellow-400'}`}>
                <div className="flex items-start gap-2">
                  {alert.type === 'expiry' ? <AlertTriangle className="h-5 w-5 mt-0.5" /> : <ShoppingBasket className="h-5 w-5 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-sm">{alert.itemName}</p>
                    <p className="text-xs">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}

            <Separator className="my-4" />

            <div>
              <h4 className="font-medium text-md mb-2 flex items-center"><Tag className="mr-2 h-5 w-5 text-primary"/>Discount Suggestions</h4>
              {!currentUser ? (
                <p className="text-sm text-muted-foreground">Log in to get suggestions.</p>
              ) : (
                <Button onClick={handleGetAISuggestions} disabled={isGeneratingSuggestions} className="w-full text-sm">
                  {isGeneratingSuggestions ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate AI Discount Ideas
                </Button>
              )}

              {isGeneratingSuggestions && (
                <div className="flex justify-center items-center h-20">
                   <Loader2 className="h-6 w-6 animate-spin text-primary" />
                   <p className="ml-2 text-sm text-muted-foreground">AI is thinking...</p>
                 </div>
              )}

              {aiSuggestions && aiSuggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {aiSuggestions.map((suggestion, index) => (
                    <div key={index} className="p-3 rounded-md border bg-card">
                       <div className="flex items-start gap-2">
                        <Utensils className="h-5 w-5 mt-0.5 text-primary"/>
                        <div>
                          <p className="font-semibold text-sm">{suggestion.dishName}</p>
                          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                          {suggestion.suggestedDiscountPercentage && (
                            <Badge variant="secondary" className="mt-1 text-xs">Suggest {suggestion.suggestedDiscountPercentage}% off</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {aiSuggestions && aiSuggestions.length === 0 && !isGeneratingSuggestions && (
                 <p className="text-sm text-muted-foreground text-center pt-3">No specific discount suggestions from AI at this time.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

    