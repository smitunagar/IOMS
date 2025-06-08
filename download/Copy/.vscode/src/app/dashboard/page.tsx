
"use client";

import React, { useEffect, useState } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ShoppingBag, Users, TrendingUp, Clock, Repeat, Smile, TrendingDown, Info as InfoIcon, Utensils, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

// Data Interfaces
interface DailyOrdersData {
  name: string; // Changed from date for XAxis key
  orders: number;
}

interface MonthlyRevenueData {
  month: string;
  revenue: number;
  profit: number;
}

interface MenuCategoryPerformanceData {
  name: string;
  value: number; // Percentage or absolute sales
  fill: string;
}

interface TopSellingDishData {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  totalRevenue: number;
  profitMargin: number; // Percentage
}

// Mock Data
const mockDailyOrders: DailyOrdersData[] = [
  { name: "Mon", orders: Math.floor(Math.random() * 50) + 20 },
  { name: "Tue", orders: Math.floor(Math.random() * 50) + 20 },
  { name: "Wed", orders: Math.floor(Math.random() * 50) + 20 },
  { name: "Thu", orders: Math.floor(Math.random() * 50) + 20 },
  { name: "Fri", orders: Math.floor(Math.random() * 70) + 30 },
  { name: "Sat", orders: Math.floor(Math.random() * 100) + 50 },
  { name: "Sun", orders: Math.floor(Math.random() * 80) + 40 },
];

const mockMonthlyRevenue: MonthlyRevenueData[] = Array.from({ length: 6 }, (_, i) => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  d.setMonth(d.getMonth() - 5 + i);
  return {
    month: monthNames[d.getMonth()],
    revenue: Math.floor(Math.random() * 5000) + (10000 + i * 1000),
    profit: Math.floor(Math.random() * 2000) + (3000 + i * 500),
  };
});

const mockMenuCategoryPerformance: MenuCategoryPerformanceData[] = [
  { name: 'Appetizers', value: 25, fill: 'hsl(var(--chart-1))' },
  { name: 'Main Courses', value: 45, fill: 'hsl(var(--chart-2))' },
  { name: 'Desserts', value: 20, fill: 'hsl(var(--chart-3))' },
  { name: 'Beverages', value: 10, fill: 'hsl(var(--chart-4))' },
];

const mockTopSellingDishes: TopSellingDishData[] = [
  { id: '1', name: 'Margherita Pizza', category: 'Main Courses', unitsSold: 120, totalRevenue: 1800, profitMargin: 60 },
  { id: '2', name: 'Spaghetti Carbonara', category: 'Main Courses', unitsSold: 95, totalRevenue: 1425, profitMargin: 55 },
  { id: '3', name: 'Caesar Salad', category: 'Appetizers', unitsSold: 80, totalRevenue: 800, profitMargin: 65 },
  { id: '4', name: 'Chocolate Lava Cake', category: 'Desserts', unitsSold: 70, totalRevenue: 560, profitMargin: 50 },
  { id: '5', name: 'Iced Tea', category: 'Beverages', unitsSold: 150, totalRevenue: 450, profitMargin: 70 },
];

// Helper function for KPI card styling
const getKpiCardClass = (trend: 'up' | 'down' | 'neutral' | 'alert') => {
  if (trend === 'up') return 'border-green-500 bg-green-500/10';
  if (trend === 'down') return 'border-red-500 bg-red-500/10'; // For negative trends like increased wait time
  if (trend === 'alert') return 'border-red-500 bg-red-500/10'; // For critical alerts
  return 'border-yellow-500 bg-yellow-500/10'; // Neutral or needs attention
};


export default function DashboardPage() {
  // KPI States
  const [totalOrdersToday, setTotalOrdersToday] = useState(0);
  const [currentMonthlyRevenue, setCurrentMonthlyRevenue] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [totalProfitYTD, setTotalProfitYTD] = useState(0);
  const [avgWaitTime, setAvgWaitTime] = useState(0);
  const [tableTurnover, setTableTurnover] = useState(0);
  const [csatScore, setCsatScore] = useState(0);
  const [occupancyRate, setOccupancyRate] = useState(0);

  // Filter States
  const [salesTrendPeriod, setSalesTrendPeriod] = useState('weekly');

  useEffect(() => {
    // Simulate fetching data
    setTotalOrdersToday(Math.floor(Math.random() * 100) + 50);
    const currentMonthData = mockMonthlyRevenue[mockMonthlyRevenue.length - 1];
    setCurrentMonthlyRevenue(currentMonthData?.revenue || 0);
    const mockTotalDailyOrdersForAOV = (Math.floor(Math.random() * 30) + 20);
    setAverageOrderValue(currentMonthData?.revenue && mockTotalDailyOrdersForAOV > 0 ? (currentMonthData.revenue / (mockTotalDailyOrdersForAOV * 30)) : 0);
    setTotalProfitYTD(mockMonthlyRevenue.reduce((sum, item) => sum + item.profit, 0));
    
    setAvgWaitTime(parseFloat((Math.random() * 10 + 5).toFixed(1))); // e.g., 7.5 min
    setTableTurnover(parseFloat((Math.random() * 2 + 2).toFixed(1))); // e.g., 3.2x
    setCsatScore(Math.floor(Math.random() * 15) + 80); // e.g., 89%
    setOccupancyRate(Math.floor(Math.random() * 70) + 30); // e.g., 65%
  }, []);

  const KpiCard = ({ title, value, icon: Icon, trendIcon: TrendIcon, trendText, trendColorClass, unit, isLoading, infoText }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trendIcon?: React.ElementType;
    trendText: string;
    trendColorClass: string;
    unit?: string;
    isLoading?: boolean;
    infoText?: string;
  }) => (
    <Card className={cn("shadow-md hover:shadow-lg transition-shadow", trendColorClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center space-x-1">
          {infoText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                    <InfoIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  <p>{infoText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{isLoading ? '...' : value}{unit}</div>
        <div className="text-xs text-muted-foreground flex items-center">
          {TrendIcon && <TrendIcon className={cn("h-4 w-4 mr-1", trendColorClass.includes('green') ? 'text-green-600' : trendColorClass.includes('red') ? 'text-red-600' : 'text-yellow-600')} />}
          {trendText}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout pageTitle="Analytics Dashboard">
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview KPIs</TabsTrigger>
          <TabsTrigger value="sales_trends">Sales Trends</TabsTrigger>
          <TabsTrigger value="menu_performance">Menu Performance</TabsTrigger>
          <TabsTrigger value="operations">Operational Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            <KpiCard
              title="Revenue Today"
              value={`€${(totalOrdersToday * (averageOrderValue || 30)).toFixed(0)}`}
              icon={DollarSign}
              trendIcon={TrendingUp}
              trendText="+12% from yesterday"
              trendColorClass={getKpiCardClass('up')}
              infoText="Total monetary value of all sales made today."
            />
            <KpiCard
              title="Covers Today"
              value={Math.floor(totalOrdersToday * 2.5)}
              icon={Users}
              trendIcon={TrendingUp}
              trendText="+8% from yesterday"
              trendColorClass={getKpiCardClass('up')}
              infoText="Total number of customers (covers) served today. Assumes an average of 2.5 covers per order."
            />
            <KpiCard
              title="Avg. Wait Time"
              value={`${avgWaitTime} min`}
              icon={Clock}
              trendIcon={avgWaitTime > 10 ? TrendingDown : TrendingUp}
              trendText={avgWaitTime > 10 ? "+1.2 min vs avg" : "-0.5 min vs avg"}
              trendColorClass={getKpiCardClass(avgWaitTime > 10 ? 'down' : 'up')}
              infoText="Average time customers wait before being seated or served. Lower is better."
            />
            <KpiCard
              title="Table Turnover"
              value={`${tableTurnover}x`}
              icon={Repeat}
              trendIcon={tableTurnover > 3 ? TrendingUp : TrendingDown}
              trendText={tableTurnover > 3 ? "Above target" : "Below target"}
              trendColorClass={getKpiCardClass(tableTurnover > 3 ? 'up' : 'neutral')}
              infoText="Number of times a table is occupied by a new party during a specific period. Higher is generally better."
            />
          </div>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            <KpiCard
              title="CSAT Score"
              value={`${csatScore}%`}
              icon={Smile}
              trendIcon={csatScore > 85 ? TrendingUp : TrendingDown}
              trendText={csatScore > 85 ? "Excellent" : "Room for improvement"}
              trendColorClass={getKpiCardClass(csatScore > 85 ? 'up' : 'neutral')}
              infoText="Customer Satisfaction Score as a percentage. Indicates overall customer happiness."
            />
             <KpiCard
              title="Monthly Revenue (Current)"
              value={`€${currentMonthlyRevenue.toLocaleString()}`}
              icon={DollarSign}
              trendIcon={TrendingUp}
              trendText="+5.2% from last month"
              trendColorClass={getKpiCardClass('up')}
              infoText="Total revenue generated in the current calendar month so far."
            />
            <KpiCard
              title="Total Orders Today"
              value={totalOrdersToday}
              icon={ShoppingBag}
              trendIcon={TrendingUp}
              trendText="+10% from yesterday"
              trendColorClass={getKpiCardClass('up')}
              infoText="Total number of individual orders processed today."
            />
            <KpiCard
              title="Total Profit (YTD)"
              value={`€${totalProfitYTD.toLocaleString()}`}
              icon={TrendingUp}
              trendIcon={TrendingUp}
              trendText="Year to date performance"
              trendColorClass={getKpiCardClass('up')}
              infoText="Cumulative profit from the beginning of the year to date."
            />
          </div>
        </TabsContent>

        <TabsContent value="sales_trends" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Revenue & Profit Trend</CardTitle>
                <CardDescription>Monthly revenue and profit over the last 6 months.</CardDescription>
              </div>
              <Select value={salesTrendPeriod} onValueChange={setSalesTrendPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="h-[350px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockMonthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `€${value/1000}k`}/>
                  <RechartsTooltip
                     contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                     labelStyle={{ color: 'hsl(var(--foreground))' }}
                     formatter={(value: number) => `€${value.toLocaleString()}`}
                  />
                  <Legend wrapperStyle={{fontSize: '12px'}}/>
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} name="Revenue" />
                  <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} activeDot={{ r: 6 }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Orders Trend</CardTitle>
              <CardDescription>Number of orders placed ({salesTrendPeriod}).</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockDailyOrders}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{fontSize: '12px'}}/>
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu_performance" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Menu Category Performance</CardTitle>
                <CardDescription>% of sales by category.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] flex items-center justify-center p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockMenuCategoryPerformance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {mockMenuCategoryPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                      formatter={(value: number, name: string) => [`${value}%`, name]}
                    />
                    <Legend wrapperStyle={{fontSize: '12px'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Dishes</CardTitle>
                <CardDescription>Most popular items by revenue.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dish</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTopSellingDishes.sort((a,b) => b.totalRevenue - a.totalRevenue).map((dish) => (
                      <TableRow key={dish.id} className={cn(dish.profitMargin < 55 && "bg-red-500/10", dish.unitsSold > 100 && "bg-green-500/10")}>
                        <TableCell className="font-medium">{dish.name}</TableCell>
                        <TableCell>{dish.category}</TableCell>
                        <TableCell className="text-right">{dish.unitsSold}</TableCell>
                        <TableCell className="text-right">€{dish.totalRevenue.toFixed(2)}</TableCell>
                        <TableCell className={cn("text-right", dish.profitMargin >= 60 ? "text-green-600" : dish.profitMargin < 55 ? "text-red-600" : "")}>
                          {dish.profitMargin}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <Card>
            <CardHeader>
                <CardTitle>Restaurant Occupancy</CardTitle>
                <CardDescription>Current live occupancy rate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="text-4xl font-bold text-center py-4">{occupancyRate}%</div>
                <Progress value={occupancyRate} className="w-full h-4" />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
                 <div className="text-center mt-2">
                    {occupancyRate > 80 ? <Badge variant="destructive">Very Busy</Badge> : occupancyRate > 50 ? <Badge variant="secondary" className="bg-yellow-400/80 text-yellow-900">Moderately Busy</Badge> : <Badge className="bg-green-500/80 text-white">Calm</Badge>}
                 </div>
            </CardContent>
          </Card>
          {/* Placeholder for other operational metrics */}
           <Card>
            <CardHeader><CardTitle>Other Operational Metrics</CardTitle></CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Gauges for labor cost % or inventory thresholds could be added here.</p>
                <div className="mt-4 p-4 border border-dashed rounded-md text-center">
                    <InfoIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2"/>
                    Future operational insights will appear here.
                </div>
            </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </AppLayout>
  );
}
