'use client';

import React, { useRef, useEffect, useState } from 'react';
// Removed direct import for @zxing/library as it's loaded via CDN dynamically.

const productDatabase = {
  "123456789012": {
    name: "Wireless Mouse X1",
    description: "Ergonomic wireless mouse with 2.4GHz connectivity and adjustable DPI.",
    price: "$25.99"
  },
  "987654321098": {
    name: "Mechanical Keyboard RGB",
    description: "Full-size mechanical keyboard with customizable RGB backlighting and tactile switches.",
    price: "$79.50"
  },
  "555000111222": {
    name: "USB-C Hub 7-in-1",
    description: "Compact USB-C hub with HDMI, USB 3.0, SD/TF card slots, and Power Delivery.",
    price: "$35.00"
  },
  "112233445566": {
    name: "External SSD 1TB",
    description: "Portable 1TB SSD with USB 3.2 Gen 2 for fast data transfer.",
    price: "$99.00",
    manufacturingDate: "2024-01-15",
    batchNumber: "SSD202401A"
  },
  "778899001122": {
    name: "Noise-Cancelling Headphones",
    description: "Over-ear headphones with active noise cancellation and 30-hour battery life.",
    price: "$149.99"
  },
  "332211009988": {
    name: "Smart LED Light Bulb (4-pack)",
    description: "Dimmable smart LED bulbs, compatible with Alexa and Google Assistant.",
    price: "$29.95"
  },
  "678901234567": {
    name: "Organic Chicken Broth",
    description: "Low sodium, organic chicken broth, 32 fl oz (946 ml). Perfect for soups and stews.",
    price: "$4.50",
    expiryDate: "2025-12-31", // Added expiry date
    batchNumber: "CBATCH202410", // Added batch number
    manufacturingDate: "2024-05-15" // Added manufacturing date
  },
  // Add more mock products as needed with additional details
  "121212121212": {
    name: "Artisanal Sourdough Bread",
    description: "Freshly baked sourdough, 24oz. Best consumed within 3 days.",
    price: "$6.75",
    expiryDate: "2025-06-28", // Example for a perishable item
    manufacturingDate: "2025-06-25"
  }
};

const BarcodeScannerPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<any | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isZxingLoaded, setIsZxingLoaded] = useState<boolean>(false);

  // States for product details
  const [productDetails, setProductDetails] = useState<any | null>(null);
  const [productLoading, setProductLoading] = useState<boolean>(false);
  const [productError, setProductError] = useState<string | null>(null);

  // New state for manual barcode input
  const [manualBarcodeInput, setManualBarcodeInput] = useState<string>('');

  useEffect(() => {
    const zxingScript = document.createElement('script');
    zxingScript.src = "https://unpkg.com/@zxing/library@latest/umd/index.min.js";
    zxingScript.async = true;

    zxingScript.onload = () => {
      if (typeof window !== 'undefined' && window.ZXing) {
        if (window.ZXing.BrowserCodeReader) {
          window.ZXing.BrowserCodeReader.setLocateFile = (path: string, prefix: string) => {
            if (path.endsWith('zxing.min.js')) {
              return `/zxing.min.js`;
            }
            return prefix + path;
          };
        } else {
          console.warn("window.ZXing.BrowserCodeReader not found, worker location might not be configurable.");
        }
        
        codeReader.current = new window.ZXing.BrowserMultiFormatReader();
        setIsZxingLoaded(true);
        setErrorMessage(null);
      } else {
        setErrorMessage("ZXing library failed to load or is not available on window.ZXing.");
        console.error("ZXing library (window.ZXing) not found after script load.");
      }
    };

    zxingScript.onerror = () => {
      setErrorMessage("Failed to load ZXing library script. Please check your network connection.");
      console.error("ZXing script loading failed.");
      setIsZxingLoaded(false);
    };

    document.body.appendChild(zxingScript);

    return () => {
      if (codeReader.current) {
        codeReader.current.reset();
      }
      if (document.body.contains(zxingScript)) {
        document.body.removeChild(zxingScript);
      }
    };
  }, []);

  const fetchProductDetails = async (barcode: string) => {
    setProductLoading(true);
    setProductDetails(null);
    setProductError(null);
    setScannedResult(null); // Clear scanned result if fetching manually

    return new Promise((resolve) => {
      setTimeout(() => {
        const details = (productDatabase as any)[barcode];
        if (details) {
          resolve(details);
        } else {
          resolve(null);
        }
      }, 1000);
    });
  };

  const handleManualBarcodeLookup = async () => {
    if (!manualBarcodeInput.trim()) {
      setProductError("Please enter a barcode number.");
      return;
    }
    setErrorMessage(null); // Clear camera-related errors
    const details = await fetchProductDetails(manualBarcodeInput.trim());
    if (details) {
      setProductDetails(details);
      setManualBarcodeInput(''); // Clear input on success
    } else {
      setProductError(`No product found for barcode: ${manualBarcodeInput}`);
    }
    setProductLoading(false);
  };

  const startScanning = async () => {
    if (!isZxingLoaded) {
      setErrorMessage("Scanner library is still loading. Please wait a moment.");
      return;
    }
    if (!videoRef.current || !codeReader.current) {
      setErrorMessage("Video element or scanner not initialized.");
      return;
    }

    setIsScanning(true);
    setScannedResult(null);
    setErrorMessage(null);
    setProductDetails(null);
    setProductError(null);
    setProductLoading(false);
    setManualBarcodeInput(''); // Clear manual input when starting scan

    try {
      const videoInputDevices = await codeReader.current.getVideoInputDevices();

      if (videoInputDevices.length === 0) {
        setErrorMessage("No video input devices found. Please ensure a camera is connected and allowed.");
        setIsScanning(false);
        return;
      }

      const selectedDeviceId = videoInputDevices[0].deviceId;

      codeReader.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current, async (result: any, err: any) => {
        if (result) {
          const barcodeData = result.getText();
          setScannedResult(barcodeData);
          setErrorMessage(null);
          setIsScanning(false);
          codeReader.current?.reset();
          setManualBarcodeInput(barcodeData); // Populate manual input with scanned result
          console.log(`Scanned barcode: ${barcodeData}. Fetching product details...`);
          
          const details = await fetchProductDetails(barcodeData);
          if (details) {
            setProductDetails(details);
          } else {
            setProductError(`No product found for barcode: ${barcodeData}`);
          }
          setProductLoading(false);

        }
        if (err && !(err instanceof window.ZXing.NotFoundException)) {
          console.error('Error scanning barcode:', err);
          setErrorMessage(`Error scanning: ${err.message}`);
          setIsScanning(false);
          codeReader.current?.reset();
          setProductLoading(false);
        }
      });
    } catch (error: any) {
      console.error('Error starting camera or decoding:', error);
      setErrorMessage(`Error accessing camera: ${error.message || 'Unknown error'}. Please grant camera permission.`);
      setIsScanning(false);
      setProductLoading(false);
    }
  };

  const stopScanning = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
    setScannedResult(null);
    setErrorMessage(null);
    setProductDetails(null);
    setProductError(null);
    setProductLoading(false);
    // Keep manual input as is when stopping scan, user might want to continue with it
  };

  return (
    <div className="flex flex-col items-center p-5 bg-gray-100 min-h-screen font-inter">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 rounded-md p-2">Barcode Scanner</h1>

      {/* Video Scanner Section */}
      <div className="w-full max-w-lg mb-6 bg-white shadow-lg rounded-lg overflow-hidden border border-gray-300">
        <video
          ref={videoRef}
          className="w-full h-auto block rounded-t-lg"
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          autoPlay
        />
        <div className="p-4 bg-gray-50 text-center text-sm text-gray-600 rounded-b-lg">
          {isScanning ? "Scanning for barcodes..." : (isZxingLoaded ? "Press 'Start Scanning' to begin." : "Loading scanner components...")}
        </div>
      </div>

      <div className="mt-6 mb-6 space-x-4">
        {!isScanning ? (
          <button
            onClick={startScanning}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all duration-200"
            disabled={!isZxingLoaded}
          >
            {isZxingLoaded ? 'Start Camera Scan' : 'Loading Scanner...'}
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition-all duration-200"
          >
            Stop Camera Scan
          </button>
        )}
      </div>

      {/* Manual Barcode Input Section */}
      <div className="w-full max-w-lg p-5 bg-white shadow-lg rounded-lg border border-gray-300 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Manual Barcode Input</h2>
        <input
          type="text"
          value={manualBarcodeInput}
          onChange={(e) => setManualBarcodeInput(e.target.value)}
          placeholder="Enter barcode number"
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-center text-lg"
          disabled={!isZxingLoaded} // Disable input until ZXing is loaded
        />
        <button
          onClick={handleManualBarcodeLookup}
          className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition-all duration-200"
          disabled={!isZxingLoaded || !manualBarcodeInput.trim()} // Disable if not loaded or input is empty
        >
          Lookup Barcode
        </button>
      </div>

      {/* Results and Error Messages */}
      {scannedResult && !productDetails && !productLoading && !productError && ( // Show only if scanned and no product details found yet
        <div className="mt-4 p-4 bg-green-100 text-green-800 font-semibold text-lg rounded-lg shadow-md break-words">
          Scanned Result: <span className="font-mono break-all">{scannedResult}</span>
        </div>
      )}

      {productLoading && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-800 font-medium text-center rounded-lg shadow-md">
          Fetching product details...
        </div>
      )}

      {productDetails && (
        <div className="mt-4 p-4 bg-purple-100 text-purple-800 font-semibold text-lg rounded-lg shadow-md w-full max-w-lg">
          <h2 className="text-xl font-bold mb-2">Product Details</h2>
          <p><strong>Name:</strong> {productDetails.name}</p>
          <p><strong>Description:</strong> {productDetails.description}</p>
          <p><strong>Price:</strong> {productDetails.price}</p>
          {productDetails.expiryDate && (
            <p><strong>Expiry Date:</strong> {productDetails.expiryDate}</p>
          )}
          {productDetails.batchNumber && (
            <p><strong>Batch Number:</strong> {productDetails.batchNumber}</p>
          )}
          {productDetails.manufacturingDate && (
            <p><strong>Mfg. Date:</strong> {productDetails.manufacturingDate}</p>
          )}
        </div>
      )}

      {productError && (
        <div className="mt-4 p-4 bg-orange-100 text-orange-800 font-medium text-center rounded-lg shadow-md">
          {productError}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-100 text-red-800 font-medium text-center rounded-lg shadow-md">
          Error: {errorMessage}
        </div>
      )}

      <script src="https://cdn.tailwindcss.com"></script>
    </div>
  );
};

export default BarcodeScannerPage;
