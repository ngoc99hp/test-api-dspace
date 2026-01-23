"use client"

import React from 'react';

export default function UploadStatus({ uploadStatus }) {
  if (uploadStatus.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4">📈 Upload Status</h2>
      <div className="space-y-2">
        {uploadStatus.map((status, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg transition-colors ${
              status.success === null 
                ? 'bg-blue-50 border border-blue-200' 
                : status.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-900 min-w-fit">
                {status.folderName}:
              </span>
              <span 
                className={`flex-1 ${
                  status.success === null 
                    ? 'text-blue-700' 
                    : status.success 
                      ? 'text-green-700' 
                      : 'text-red-700'
                }`}
              >
                {status.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}