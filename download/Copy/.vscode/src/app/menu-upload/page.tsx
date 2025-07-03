"use client";

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { saveDishes } from '@/lib/menuService';
import { importMenuCsvToLocalStorage } from '@/lib/importMenuCsv';

export default function MenuUploadPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser?.id) return;

    setIsUploading(true);
    try {
      const fileData = await selectedFile.arrayBuffer();
      const base64File = Buffer.from(fileData).toString('base64');

      const response = await fetch('/api/uploadMenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64File, userId: currentUser.id }),
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      // If backend signals to import, do so automatically
      if (data.shouldImport && currentUser.id) {
        await importMenuCsvToLocalStorage(currentUser.id);
        if (data.partialOrRepaired) {
          toast({ title: 'Warning', description: 'Menu was only partially imported due to malformed data. Please check the menu for missing items.', variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: 'Menu uploaded, parsed, and imported.' });
        }
        setTimeout(() => window.location.reload(), 500);
        return;
      }

      if (data.partialOrRepaired) {
        toast({ title: 'Warning', description: 'Menu was only partially imported due to malformed data. Please check the menu for missing items.', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Menu uploaded and parsed.' });
      }
      setTimeout(() => window.location.reload(), 500);

    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to upload menu.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppLayout pageTitle="Upload Menu PDF">
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] space-y-6">
        <Input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
          {isUploading ? 'Uploading...' : 'Upload and Parse'}
        </Button>
      </div>
    </AppLayout>
  );
}
