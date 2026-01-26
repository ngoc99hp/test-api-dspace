"use client";

import React, { useState } from "react";
import {
  Download,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";

// Component Tooltip cho filename
function TooltipFilename({ filename, jobId }) {
  return (
    <div className="group relative">
      <p className="text-sm font-semibold text-gray-900 truncate max-w-70">
        {filename}
      </p>

      {/* Tooltip - chỉ hiện khi hover */}
      {filename.length > 40 && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-md shadow-xl">
            {filename}
            {/* Arrow */}
            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-0.5">ID: {jobId.slice(0, 8)}...</p>
    </div>
  );
}

// Ellipsis Pagination Helper
function getPageNumbers(currentPage, totalPages) {
  const pages = [];

  // Case 1: Tổng <= 7 pages → Hiển thị hết
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Case 2: Current ở đầu (1-3)
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }

  // Case 3: Current ở cuối
  if (currentPage >= totalPages - 2) {
    return [
      1,
      "...",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  // Case 4: Current ở giữa
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export default function OCRJobsList({
  jobs,
  onSelectForDSpace,
  onDownload,
  onDelete,
  selectedJobs = [],
  onAnalyze,
  isAnalyzing,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 5;

  const [deletingJobId, setDeletingJobId] = useState(null);

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" /> Completed
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-1 text-blue-600">
            <Clock className="w-4 h-4" /> Processing
          </span>
        );
      case "queued":
        return (
          <span className="flex items-center gap-1 text-yellow-600">
            <Clock className="w-4 h-4" /> Queued
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="w-4 h-4" /> Failed
          </span>
        );
      default:
        return status;
    }
  };

  const handleDelete = async (jobId, filename) => {
    if (
      !confirm(
        `Are you sure you want to delete "${filename}"?\n\nThis will permanently delete all files and cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingJobId(jobId);

    try {
      await onDelete(jobId);
    } catch (err) {
      console.error("Delete error:", err);
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingJobId(null);
    }
  };

  const completedJobs = jobs.filter((j) => j.status === "completed");

  // Pagination logic
  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const currentJobs = jobs.slice(startIndex, endIndex);

  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectForDSpace(completedJobs.map((j) => j.job_id));
    } else {
      onSelectForDSpace([]);
    }
  };

  const handleToggleJob = (jobId) => {
    if (selectedJobs.includes(jobId)) {
      onSelectForDSpace(selectedJobs.filter((id) => id !== jobId));
    } else {
      onSelectForDSpace([...selectedJobs, jobId]);
    }
  };

  const isAllSelected =
    completedJobs.length > 0 && selectedJobs.length === completedJobs.length;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header with Actions */}
      <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              📋 OCR Jobs
              <span className="text-sm font-normal text-blue-100">
                ({jobs.length} total, {selectedJobs.length} selected)
              </span>
            </h2>
          </div>

          {/* ✅ FIX: Button luôn chiếm chỗ, dùng opacity để ẩn/hiện */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || selectedJobs.length === 0}
            className={`
              bg-white text-blue-600 px-6 py-2.5 rounded-lg font-medium 
              shadow-lg transition-all duration-200
              ${
                selectedJobs.length > 0
                  ? "opacity-100 visible hover:bg-blue-50 hover:shadow-xl transform hover:-translate-y-0.5"
                  : "opacity-0 invisible pointer-events-none"
              }
              disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed
            `}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                🤖 Analyze {selectedJobs.length} Document
                {selectedJobs.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {jobs.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-gray-400 mb-3">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">No jobs yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Upload PDFs to get started
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      checked={isAllSelected}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentJobs.map((job) => {
                  const isSelected = selectedJobs.includes(job.job_id);
                  const isCompleted = job.status === "completed";

                  return (
                    <tr
                      key={job.job_id}
                      onClick={() => isCompleted && handleToggleJob(job.job_id)}
                      className={`
                        transition-all duration-150
                        border-l-4
                        ${
                          isSelected
                            ? "bg-blue-50 border-l-blue-500"
                            : "border-l-transparent hover:bg-gray-50"
                        }
                        ${isCompleted ? "cursor-pointer" : "cursor-default"}
                      `}
                    >
                      <td
                        className="px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isCompleted && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleJob(job.job_id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <TooltipFilename
                          filename={job.filename}
                          jobId={job.job_id}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-20">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                job.status === "completed"
                                  ? "bg-green-500"
                                  : job.status === "processing"
                                    ? "bg-blue-500"
                                    : job.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-yellow-500"
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 min-w-11.25">
                            {job.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(job.created_at).toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td
                        className="px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {job.status === "completed" && (
                          <button
                            onClick={() => onDownload(job.job_id)}
                            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        )}
                        {job.status === "failed" && job.error && (
                          <div className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg max-w-50">
                            {job.error}
                          </div>
                        )}
                        {/* Delete button - for all jobs */}
                        <button
                          onClick={() => handleDelete(job.job_id, job.filename)}
                          disabled={deletingJobId === job.job_id}
                          className="flex items-center gap-1 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingJobId === job.job_id && (
                            <span className="text-xs">Deleting...</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination with Ellipsis */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIndex + 1}</span>{" "}
                to{" "}
                <span className="font-semibold">
                  {Math.min(endIndex, jobs.length)}
                </span>{" "}
                of <span className="font-semibold">{jobs.length}</span> jobs
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium text-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex gap-1">
                  {getPageNumbers(currentPage, totalPages).map((page, idx) => {
                    if (page === "...") {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="w-10 h-10 flex items-center justify-center text-gray-400 font-bold"
                        >
                          •••
                        </span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg font-medium transition-all ${
                          currentPage === page
                            ? "bg-blue-600 text-white shadow-lg"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium text-gray-700"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
