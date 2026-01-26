"use client"

import React from 'react';
import { Download, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function OCRJobsList({ jobs, onSelectForDSpace, onDownload, selectedJobs = [] }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4" /> Completed</span>;
      case 'processing':
        return <span className="flex items-center gap-1 text-blue-600"><Clock className="w-4 h-4" /> Processing</span>;
      case 'queued':
        return <span className="flex items-center gap-1 text-yellow-600"><Clock className="w-4 h-4" /> Queued</span>;
      case 'failed':
        return <span className="flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> Failed</span>;
      default:
        return status;
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'completed');
  console.log(jobs)
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">📋 OCR Jobs ({jobs.length})</h2>
      
      {jobs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No jobs yet. Upload PDFs to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectForDSpace(completedJobs.map(j => j.job_id));
                      } else {
                        onSelectForDSpace([]);
                      }
                    }}
                    checked={completedJobs.length > 0 && selectedJobs.length === completedJobs.length}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.job_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {job.status === 'completed' && (
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.job_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectForDSpace([...selectedJobs, job.job_id]);
                          } else {
                            onSelectForDSpace(selectedJobs.filter(id => id !== job.job_id));
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{job.filename}</td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(job.status)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${job.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'}`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{job.progress}%</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {job.status === 'completed' && (
                      <button
                        onClick={() => onDownload(job.job_id)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                    {job.status === 'failed' && job.error && (
                      <span className="text-xs text-red-600">{job.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}