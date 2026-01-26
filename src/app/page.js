"use client";

import React, { useState, useEffect } from "react";
import LoginForm from "../components/LoginForm";
import OCRUploader from "../components/OCRUploader";
import OCRJobsList from "../components/OCRJobsList";
import MappingsTable from "../components/MappingsTable";
import UploadStatus from "../components/UploadStatus";
import Header from "../components/Header";
import { ToastContainer } from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { useOCRJobs } from "../hooks/useOCRJobs";

export default function SmartDSpaceUploader() {
  const dspaceUrl = process.env.NEXT_PUBLIC_DSPACE_URL;
  const { toasts, removeToast, success, error, warning, info } = useToast();
  const { jobs, loading, fetchJobs, downloadJob } = useOCRJobs();

  const [session, setSession] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedMappings, setSelectedMappings] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState([]);

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Load collections after login
  const loadCollections = async () => {
    try {
      const res = await fetch("/api/dspace/get-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dspaceUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
        console.log(`Loaded ${data.collections.length} collections`);
      }
    } catch (err) {
      error(`Failed to load collections: ${err.message}`);
    }
  };

  const handleLoginSuccess = async (sessionData) => {
    setSession(sessionData);
    await loadCollections();
  };

  const handleUploadSuccess = () => {
    fetchJobs();
    info("Files uploaded to OCR queue");
  };

  const handleDownload = async (jobId) => {
    try {
      await downloadJob(jobId);
      success("Download started");
    } catch (err) {
      error(`Download failed: ${err.message}`);
    }
  };

  // Analyze selected jobs with AI
  const handleAnalyze = async () => {
    if (selectedJobIds.length === 0) {
      warning("Please select completed jobs first");
      return;
    }

    setIsAnalyzing(true);
    info(`Analyzing ${selectedJobIds.length} documents...`);

    try {
      const jobsRes = await fetch("/api/ocr/jobs?include_metadata=true");

      if (!jobsRes.ok) {
        throw new Error("Failed to fetch jobs with metadata");
      }

      const jobsData = await jobsRes.json();
      const jobsWithMetadata = jobsData.jobs;

      const documents = [];

      for (const jobId of selectedJobIds) {
        const job = jobsWithMetadata.find((j) => j.job_id === jobId);

        if (!job || job.status !== 'completed') continue;

        if (!job.metadata || !job.metadata.metadata) {
          warning(`${job.filename} has no metadata, skipping`);
          continue;
        }

        const titleField = job.metadata.metadata.find(
          (m) => m.key === "dc.title",
        );

        documents.push({
          jobId: job.job_id,
          folderName: job.filename.replace(".pdf", ""),
          title: titleField?.value || job.filename,
          metadata: job.metadata.metadata,
        });
      }

      if (documents.length === 0) {
        error("No valid documents with metadata found");
        setIsAnalyzing(false);
        return;
      }

      const aiRes = await fetch("/api/ai/suggest-collection-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents, collections }),
      });

      if (!aiRes.ok) {
        const errorData = await aiRes.json();
        throw new Error(errorData.error || "AI analysis failed");
      }

      const aiData = await aiRes.json();

      const newMappings = aiData.suggestions.map((sug) => {
        const doc = documents.find((d) => d.folderName === sug.folderName);
        return {
          jobId: doc?.jobId || sug.documentIndex,
          folderName: sug.folderName,
          title: doc?.title || sug.folderName,
          collectionId: sug.collectionId,
          collectionName: sug.collectionName,
          confidence: sug.confidence,
          reasoning: sug.reasoning,
          status: "ready",
          metadata: doc?.metadata || [],
        };
      });

      setMappings(newMappings);
      setSelectedMappings(newMappings.map(m => m.jobId || m.folderId));
      success(`Analysis complete! ${newMappings.length} suggestions ready`);
    } catch (err) {
      console.error("Analysis error:", err);
      error(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update mapping
  const handleUpdateMapping = (id, collectionId, collectionName) => {
    setMappings((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((m) => (m.jobId || m.folderId) === id);
      if (idx !== -1) {
        updated[idx].collectionId = collectionId;
        updated[idx].collectionName = collectionName;
      }
      return updated;
    });
  };

  // Upload to DSpace
  const handleUpload = async () => {
    const toUpload = mappings.filter(
      (m) => selectedMappings.includes(m.jobId || m.folderId) && m.status === 'ready' && m.collectionId
    );

    if (toUpload.length === 0) {
      warning("No items selected to upload");
      return;
    }

    setIsUploading(true);
    setUploadStatus([]);
    info(`Starting upload of ${toUpload.length} items...`);

    for (let i = 0; i < toUpload.length; i++) {
      const mapping = toUpload[i];

      setUploadStatus((prev) => [
        ...prev,
        {
          folderName: mapping.folderName,
          status: "Uploading...",
          success: null,
        },
      ]);

      try {
        const createRes = await fetch("/api/dspace/create-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            collectionId: mapping.collectionId,
            metadata: mapping.metadata,
            dspaceUrl,
          }),
        });

        if (!createRes.ok) {
          throw new Error("Failed to create item");
        }

        const itemData = await createRes.json();
        let itemId = itemData.itemId;

        if (!itemId && itemData.handle) {
          const handleRes = await fetch("/api/dspace/get-item-by-handle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ handle: itemData.handle, dspaceUrl }),
          });

          if (handleRes.ok) {
            const handleData = await handleRes.json();
            itemId = handleData.id;
          }
        }

        if (!itemId) {
          throw new Error("Could not get item ID");
        }

        const downloadRes = await fetch(`/api/ocr/download/${mapping.jobId}`);
        if (!downloadRes.ok) {
          throw new Error("Failed to download job files");
        }

        const blob = await downloadRes.blob();
        const JSZip = require("jszip");
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(blob);

        const pdfFile = Object.keys(zipContent.files).find(
          (name) => name.endsWith(".pdf") && !name.includes("metadata"),
        );

        if (!pdfFile) {
          throw new Error("PDF file not found in job output");
        }

        const pdfBlob = await zipContent.files[pdfFile].async("blob");

        const uploadUrl = `/api/dspace/upload-bitstream?itemId=${encodeURIComponent(itemId)}&fileName=${encodeURIComponent(pdfFile)}&dspaceUrl=${encodeURIComponent(dspaceUrl)}`;

        const bitstreamRes = await fetch(uploadUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/octet-stream" },
          body: pdfBlob,
        });

        if (!bitstreamRes.ok) {
          throw new Error("Failed to upload PDF");
        }

        setUploadStatus((prev) => {
          const updated = [...prev];
          updated[i] = {
            folderName: mapping.folderName,
            status: `✅ Success! ID: ${itemId}, Handle: ${itemData.handle ?? "Pending"}`,
            success: true,
          };
          return updated;
        });
      } catch (err) {
        console.error(`Upload error for ${mapping.folderName}:`, err);
        setUploadStatus((prev) => {
          const updated = [...prev];
          updated[i] = {
            folderName: mapping.folderName,
            status: `❌ Failed: ${err.message}`,
            success: false,
          };
          return updated;
        });
      }
    }

    setIsUploading(false);
    success("Upload complete!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <Header session={session} />

      <div className="max-w-[1800px] mx-auto p-8">
        {!session?.authenticated ? (
          <div className="max-w-xl mx-auto">
            <LoginForm
              dspaceUrl={dspaceUrl}
              onLoginSuccess={handleLoginSuccess}
              showToast={(msg, type) => {
                if (type === "success") success(msg);
                else if (type === "error") error(msg);
                else warning(msg);
              }}
            />
          </div>
        ) : (
          <>
            <OCRUploader
              onUploadSuccess={handleUploadSuccess}
              showToast={(msg, type) => {
                if (type === "success") success(msg);
                else error(msg);
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <OCRJobsList
                jobs={jobs}
                onSelectForDSpace={setSelectedJobIds}
                onDownload={handleDownload}
                selectedJobs={selectedJobIds}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />

              {mappings.length > 0 && (
                <MappingsTable
                  mappings={mappings}
                  collections={collections}
                  onUpdateMapping={handleUpdateMapping}
                  onUpload={handleUpload}
                  isUploading={isUploading}
                  selectedMappings={selectedMappings}
                  onSelectMappings={setSelectedMappings}
                />
              )}
            </div>

            <UploadStatus uploadStatus={uploadStatus} />
          </>
        )}
      </div>
    </div>
  );
}