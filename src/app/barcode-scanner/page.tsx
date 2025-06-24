'use client';

import React, { useRef, useEffect, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const BarcodeScannerPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();
  }, []);

  const startScanning = async () => {
    if (!videoRef.current || !codeReader.current) return;

    setIsScanning(true);
    setScannedResult(null);

    try {
      await codeReader.current.decodeFromVideoElement(videoRef.current, (result, err) => {
        if (result) {
          setScannedResult(result.getText());
          setIsScanning(false);
          codeReader.current?.reset();
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error('Error scanning barcode:', err);
          setScannedResult('Error scanning');
          setIsScanning(false);
          codeReader.current?.reset();
        }
      });
    } catch (error) {
      console.error('Error starting camera:', error);
      setScannedResult('Error accessing camera');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    codeReader.current?.reset();
    setIsScanning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      <h1>Barcode Scanner</h1>
      <div style={{ width: '100%', maxWidth: '500px', margin: '20px 0' }}>
        <video ref={videoRef} style={{ width: '100%', border: '1px solid #ccc' }} />
      </div>
      {scannedResult && (
        <div style={{ marginTop: '20px', fontSize: '1.2em', fontWeight: 'bold' }}>
          Scanned Result: {scannedResult}
        </div>
      )}
      <div style={{ marginTop: '20px' }}>
        {!isScanning ? (
          <button onClick={startScanning} style={{ padding: '10px 20px', fontSize: '1em' }}>
            Start Scanning
          </button>
        ) : (
          <button onClick={stopScanning} style={{ padding: '10px 20px', fontSize: '1em', backgroundColor: '#f44336', color: 'white' }}>
            Stop Scanning
          </button>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerPage;