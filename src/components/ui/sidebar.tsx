"use client"

import { cn } from "@/lib/utils"
import { BookUser, Home, Package, Scan, ShoppingCart, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Quagga from 'quagga';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: "Dashboard",
    },
    {
      href: "/tables",
      icon: BookUser,
      label: "Tables",
    },
    {
      href: "/inventory",
      icon: Package,
      label: "Inventory",
    },
    {
      href: "/ingredient-tool",
      icon: Package,
      label: "Ingredient Tool",
    },
    {
      href: "/order-history",
      icon: ShoppingCart,
      label: "Order History",
    },
    {
      href: "/barcode-scanner",
      icon: Scan, // Using the Scan icon for barcode scanner
      label: "Barcode Scanner",
    },
  ]

  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const startScanning = () => {
    setIsScanning(true);
    setScannedResult(null);
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current!,
        constraints: {
          facingMode: "environment", // or "user" for front camera
        },
      },
      decoder: {
        readers: ["ean_reader"], // Specify the types of barcodes you want to read
      },
    }, function (err: any) {
      if (err) {
        console.error(err);
        setIsScanning(false);
        return
      }
      Quagga.start();
    });

    Quagga.onDetected(handleDetected);
  };

  const handleDetected = (result: any) => {
    console.log("Barcode detected:", result.codeResult.code);
    setScannedResult(result.codeResult.code);
    stopScanning(); // Stop scanning after detecting a barcode
  };

  const stopScanning = () => {
    Quagga.stop();
    setIsScanning(false);
  };

  // Clean up on unmount
  useEffect(() => { return () => { stopScanning(); }; }, []);

  return (
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Overview
          </h2>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "w-full justify-start",
                    pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}>
                  <span className="mr-2 h-4 w-4">{item.icon}</span>
                  {item.label}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}