"use client"

import { useState, useEffect, useCallback } from 'react';

export function useOCRJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async (status = null, includeMetadata = false) => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/ocr/jobs';
      const params = new URLSearchParams();
      
      if (status) params.append('status', status);
      if (includeMetadata) params.append('include_metadata', 'true');
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch jobs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadFile = async (file, collection = 'default', language = 'vie') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collection', collection);
    formData.append('language', language);

    const res = await fetch('/api/ocr/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await res.json();
    await fetchJobs();
    return data;
  };

  const downloadJob = async (jobId) => {
    const res = await fetch(`/api/ocr/download/${jobId}`);
    
    if (!res.ok) {
      throw new Error('Download failed');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_${jobId}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // ✅ NEW: Delete job function
  const deleteJob = async (jobId) => {
    const res = await fetch(`/api/ocr/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Delete failed');
    }

    const data = await res.json();
    
    // Remove from local state
    setJobs(prev => prev.filter(j => j.job_id !== jobId));
    
    return data;
  };

  // Auto-refresh every 5 seconds when there are running jobs
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'queued' || j.status === 'processing');
    
    if (hasRunning) {
      const interval = setInterval(() => {
        fetchJobs();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [jobs, fetchJobs]);

  return {
    jobs,
    loading,
    error,
    fetchJobs,
    uploadFile,
    downloadJob,
    deleteJob, // ✅ Export delete function
  };
}