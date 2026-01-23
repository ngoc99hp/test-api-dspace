"use client"

import React from 'react';

export default function MappingsTable({ mappings, collections, onUpdateMapping, onUpload, isUploading }) {
  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 80) return '🟢 High';
    if (confidence >= 60) return '🟡 Medium';
    return '🔴 Low';
  };

  const readyCount = mappings.filter(m => m.status === 'ready' && m.collectionId).length;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">📊 AI Suggestions</h2>
        <span className="text-sm text-gray-500">
          {readyCount} of {mappings.length} ready to upload
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Collection</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasoning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping, idx) => (
              <tr 
                key={mapping.folderId} 
                className={mapping.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}
              >
                <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900">{mapping.title}</div>
                  <div className="text-xs text-gray-500">{mapping.folderName}</div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {mapping.status === 'error' ? (
                    <span className="text-red-600 font-medium">{mapping.collectionName}</span>
                  ) : (
                    <select
                      value={mapping.collectionId ?? ''}
                      onChange={(e) => {
                        const col = collections.find(c => (c.id ?? c.uuid) === e.target.value);
                        onUpdateMapping(mapping.folderId, e.target.value, col?.name ?? '');
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-shadow"
                    >
                      {collections.map(col => (
                        <option key={col.id ?? col.uuid} value={col.id ?? col.uuid}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className={`font-semibold ${getConfidenceColor(mapping.confidence)}`}>
                    {getConfidenceBadge(mapping.confidence)}
                  </div>
                  <div className="text-xs text-gray-500">{mapping.confidence}%</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {mapping.reasoning}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onUpload}
        disabled={isUploading || readyCount === 0}
        className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? '⏳ Uploading...' : `🚀 Push ${readyCount} Items to DSpace`}
      </button>
    </div>
  );
}