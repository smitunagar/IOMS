"use client";

import React, { useState, useTransition } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, ChefHat, PackagePlus, ClipboardPlus, Edit3 } from "lucide-react";
import { z } from 'genkit';
import { generateIngredientsList } from '@/ai/flows/generate-ingredients-list';
import { GenerateIngredientsListInput, GenerateIngredientsListOutput, IngredientSchema } from '@/ai/flows/ingredient-types';
import { addIngredientToInventoryIfNotExists, RawIngredient } from '@/lib/inventoryService';
import { addDishToMenu } from '@/lib/menuService';
import { useAuth } from '@/contexts/AuthContext';

type AiIngredient = z.infer<typeof IngredientSchema>;

interface EditableIngredient extends AiIngredient {
  // Optionally add extra fields if needed
}

export default function IngredientToolPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [dishName, setDishName] = useState<string>("");
  const [servings, setServings] = useState<number>(1);
  const [editableIngredients, setEditableIngredients] = useState<EditableIngredient[] | null>(null);
  const [isGenerating, startGeneratingTransition] = useTransition();
  const [isAddingToMenu, startAddingToMenuTransition] = useTransition();
  const [isAddingToInventory, startAddingToInventoryTransition] = useTransition();

  const handleGetIngredients = async () => {
    if (!currentUser) {
      toast({ title: "Error", description: "Please log in to use this feature.", variant: "destructive" });
      return;
    }
    if (!dishName || servings <= 0) {
      toast({ title: "Error", description: "Please enter a dish name and a valid number of servings.", variant: "destructive" });
      return;
    }

    setEditableIngredients(null);
    
    startGeneratingTransition(async () => {
      try {
        const input: GenerateIngredientsListInput = { dishName, numberOfServings: servings };
        const result: GenerateIngredientsListOutput = await generateIngredientsList(input);
        
        if (result && result.ingredients && Array.isArray(result.ingredients)) {
          setEditableIngredients(result.ingredients as EditableIngredient[]);
          toast({ title: "Ingredients Generated!", description: `Successfully generated ingredients for ${dishName}. You can edit quantities below.` });
        } else {
          throw new Error("AI did not return a valid list of ingredients.");
        }
      } catch (error) {
        console.error("Error generating ingredients:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Generation Failed", description: `Could not generate ingredients: ${errorMessage}`, variant: "destructive" });
        setEditableIngredients(null);
      }
    });
  };

  const handleIngredientQuantityChange = (index: number, newQuantity: number) => {
    if (editableIngredients) {
      const updatedIngredients = [...editableIngredients];
      updatedIngredients[index] = { ...updatedIngredients[index], quantity: Math.max(0, newQuantity) };
      setEditableIngredients(updatedIngredients);
    }
  };

  const handleAddGeneratedIngredientsToInventory = () => {
    if (!currentUser) {
      toast({ title: "Error", description: "Please log in.", variant: "destructive" });
      return;
    }
    if (!editableIngredients || editableIngredients.length === 0) {
      toast({ title: "Error", description: "No ingredients to add.", variant: "destructive" });
      return;
    }

    startAddingToInventoryTransition(async () => {
      let newItemsAddedCount = 0;
      let existingItemsSkippedCount = 0;

      for (const ingredient of editableIngredients) {
        const rawIngredient: RawIngredient = {
          name: ingredient.name,
          quantity: ingredient.quantity, 
          unit: ingredient.unit,
        };
        const addedItem = await addIngredientToInventoryIfNotExists(currentUser.id, rawIngredient);
        if (addedItem) {
          newItemsAddedCount++;
        } else {
          existingItemsSkippedCount++;
        }
      }

      if (newItemsAddedCount > 0) {
        toast({
          title: "Inventory Updated",
          description: `${newItemsAddedCount} new ingredient(s) added to inventory with generated quantities. ${existingItemsSkippedCount} existing item(s) were not modified.`,
          action: <PackagePlus className="h-5 w-5" />
        });
      } else if (existingItemsSkippedCount > 0) {
          toast({
          title: "Inventory Check",
          description: `All ${existingItemsSkippedCount} generated ingredient(s) already exist in inventory and were not modified by this action.`,
        });
      } else {
        toast({ title: "No Changes", description: "No new ingredients to add or inventory already up-to-date."});
      }
    });
  };


  const handleAddToMenu = () => {
     if (!currentUser) {
      toast({ title: "Error", description: "Please log in to use this feature.", variant: "destructive" });
      return;
    }
    if (!dishName || !editableIngredients || editableIngredients.length === 0) {
      toast({ title: "Error", description: "No dish or ingredients to add to menu.", variant: "destructive" });
      return;
    }
    
    startAddingToMenuTransition(async () => {
      try {
        // Ensure editableIngredients conforms to the expected type for addDishToMenu
        const ingredientsForMenu: AiIngredient[] = editableIngredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        }));

        const newDish = await addDishToMenu(currentUser.id, dishName, ingredientsForMenu);
        if (newDish) {
          toast({
            title: "Dish Added to Menu!",
            description: `"${dishName}" has been added to your menu with default price $${(typeof newDish.price === 'number' && !isNaN(newDish.price) ? newDish.price : parseFloat(newDish.price) || 0).toFixed(2)} and category "${newDish.category}". Ingredients quantities are as specified.`,
          });
        } else {
           toast({
            title: "Menu Update Failed",
            description: `"${dishName}" might already exist or could not be added.`,
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error adding dish to menu:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Failed to Add to Menu", description: errorMessage, variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout pageTitle="AI Ingredient Tool">
      <div className="max-w-3xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ChefHat className="mr-2 h-6 w-6 text-primary" /> Ingredient Generator</CardTitle>
            <CardDescription>
              Use AI to generate ingredients for any dish. You can edit quantities before adding to your menu or inventory (for new items).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dish-name">Dish Name</Label>
              <Input
                id="dish-name"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="e.g., Spaghetti Carbonara, Chocolate Cake"
              />
            </div>
            <div>
              <Label htmlFor="servings">Number of Servings</Label>
              <Input
                id="servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(Math.max(1, parseInt(e.target.value, 10)))}
                min="1"
              />
            </div>
            <Button onClick={handleGetIngredients} disabled={isGenerating || isAddingToMenu || isAddingToInventory || !currentUser} className="w-full">
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Ingredients
            </Button>
          </CardContent>
        </Card>

        { (isGenerating || editableIngredients) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Edit3 className="mr-2 h-5 w-5 text-primary" /> Generated Ingredients</CardTitle>
              <CardDescription>
                {isGenerating ? `Generating ingredients for ${dishName} (${servings} servings)...` : 
                editableIngredients ? `Ingredients for ${dishName} (${servings} servings). Adjust quantities as needed.` :
                "Ingredients will appear here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isGenerating ? (
                 <div className="flex justify-center items-center h-40">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
              ) : editableIngredients && editableIngredients.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {editableIngredients.map((ing, index) => (
                    <div key={index} className="grid grid-cols-[1fr_100px_80px] items-center gap-3 p-2 border rounded-md">
                      <span className="font-medium truncate" title={ing.name}>{ing.name}</span>
                      <Input
                        type="number"
                        value={ing.quantity}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          handleIngredientQuantityChange(index, isNaN(value) ? 0 : value);
                        }}
                        min="0"
                        className="text-right"
                      />
                      <span className="text-sm text-muted-foreground">{ing.unit}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No ingredients generated or an error occurred.</p>
              )}
            </CardContent>
            {editableIngredients && editableIngredients.length > 0 && !isGenerating && (
              <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button onClick={handleAddGeneratedIngredientsToInventory} disabled={isAddingToInventory || isGenerating || isAddingToMenu || !currentUser} className="w-full sm:w-auto">
                  {isAddingToInventory ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PackagePlus className="mr-2 h-4 w-4" />
                  )}
                  Add New to Inventory
                </Button>
                <Button onClick={handleAddToMenu} disabled={isAddingToMenu || isGenerating || isAddingToInventory || !currentUser} className="w-full sm:w-auto flex-grow">
                  {isAddingToMenu ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardPlus className="mr-2 h-4 w-4" />
                  )}
                  Add "{dishName}" to Menu
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}