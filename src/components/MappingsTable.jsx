"use client"

import React from 'react';

// Component Tooltip cho title
function TooltipTitle({ title, folderName }) {
  return (
    <div className="group relative">
      <h3 className="font-semibold text-gray-900 line-clamp-2">
        {title}
      </h3>
      
      {/* Tooltip - chỉ hiện khi title dài */}
      {title.length > 60 && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-md shadow-xl">
            {title}
            {/* Arrow */}
            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500 mt-1 truncate max-w-62.5">
        {folderName}
      </p>
    </div>
  );
}

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
      
      {mappings.length === 0 ? (
        <div className="text-center p-12">
          <div className="text-gray-400 mb-3">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">No AI suggestions yet</p>
          <p className="text-gray-400 text-sm mt-1">Select completed jobs and click Analyze</p>
        </div>
      ) : (
        <>
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
                    key={mapping.jobId || mapping.folderId || idx}
                    className={mapping.status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50 transition-colors'}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm max-w-75">
                      <TooltipTitle title={mapping.title} folderName={mapping.folderName} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {mapping.status === 'error' ? (
                        <span className="text-red-600 font-medium">{mapping.collectionName}</span>
                      ) : (
                        <select
                          value={mapping.collectionId ?? ''}
                          onChange={(e) => {
                            const col = collections.find(c => (c.id ?? c.uuid) === e.target.value);
                            onUpdateMapping(mapping.jobId || mapping.folderId, e.target.value, col?.name ?? '');
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
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-87.5">
                      <div className="line-clamp-2">
                        {mapping.reasoning}
                      </div>
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
        </>
      )}
    </div>
  );
}