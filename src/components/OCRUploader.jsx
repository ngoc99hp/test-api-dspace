"use client"

import React, { useState } from 'react';
import { Upload, FileText } from 'lucide-react';

export default function OCRUploader({ onUploadSuccess, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'));
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast('Please select PDF files', 'warning');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('collection', 'default');
        formData.append('language', 'vie');

        const res = await fetch('/api/ocr/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Upload ${file.name} failed:`, err);
        failCount++;
      }
    }

    setUploading(false);
    setSelectedFiles([]);

    if (successCount > 0) {
      showToast(`✅ ${successCount} files uploaded successfully`, 'success');
      onUploadSuccess();
    }
    if (failCount > 0) {
      showToast(`❌ ${failCount} files failed`, 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        Upload PDFs for OCR
      </h2>

      <div className="space-y-4">
        <label className="block">
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Click to select PDF files</p>
            <p className="text-sm text-gray-500 mt-1">
              Multiple files supported
            </p>
          </div>
        </label>

        {selectedFiles.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">
              Selected files ({selectedFiles.length}):
            </p>
            <ul className="space-y-1 text-sm text-blue-800">
              {selectedFiles.map((file, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? '🔄 Uploading & OCR Processing...' : `📤 Upload ${selectedFiles.length} Files`}
        </button>
      </div>
    </div>
  );
}