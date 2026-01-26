"use client";

import React, { useState, useEffect } from "react";
import LoginForm from "../components/LoginForm";
import OCRUploader from "../components/OCRUploader";
import OCRJobsList from "../components/OCRJobsList";
import MappingsTable from "../components/MappingsTable";
import UploadStatus from "../components/UploadStatus";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState([]);

  // Load jobs on mount (without metadata initially)
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
      // Fetch jobs WITH metadata
      const jobsRes = await fetch("/api/ocr/jobs?include_metadata=true");

      if (!jobsRes.ok) {
        throw new Error("Failed to fetch jobs with metadata");
      }

      const jobsData = await jobsRes.json();
      const jobsWithMetadata = jobsData.jobs;

      console.log("Jobs with metadata:", jobsWithMetadata);

      // Build documents array from selected jobs
      const documents = [];

      for (const jobId of selectedJobIds) {
        const job = jobsWithMetadata.find((j) => j.job_id === jobId);

        if (!job) {
          console.warn(`Job ${jobId} not found`);
          continue;
        }

        if (job.status !== "completed") {
          console.warn(`Job ${jobId} not completed, skipping`);
          continue;
        }

        if (!job.metadata || !job.metadata.metadata) {
          console.warn(`Job ${jobId} has no metadata, skipping`);
          warning(`${job.filename} has no metadata, skipping`);
          continue;
        }

        // Extract title from metadata
        const titleField = job.metadata.metadata.find(
          (m) => m.key === "dc.title",
        );

        documents.push({
          jobId: job.job_id,
          folderName: job.filename.replace(".pdf", ""),
          title: titleField?.value || job.filename,
          metadata: job.metadata.metadata,
        });

        console.log(`✅ Prepared ${job.filename} for AI analysis`);
      }

      if (documents.length === 0) {
        error("No valid documents with metadata found");
        setIsAnalyzing(false);
        return;
      }

      console.log(`📊 Sending ${documents.length} documents to AI...`);

      // Batch AI analysis
      const aiRes = await fetch("/api/ai/suggest-collection-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents,
          collections,
        }),
      });

      if (!aiRes.ok) {
        const errorData = await aiRes.json();
        throw new Error(errorData.error || "AI analysis failed");
      }

      const aiData = await aiRes.json();

      console.log("AI suggestions:", aiData);

      // Map AI suggestions to jobs
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
    const readyMappings = mappings.filter(
      (m) => m.status === "ready" && m.collectionId,
    );

    if (readyMappings.length === 0) {
      warning("No items ready to upload");
      return;
    }

    setIsUploading(true);
    setUploadStatus([]);
    info(`Starting upload of ${readyMappings.length} items...`);

    for (let i = 0; i < readyMappings.length; i++) {
      const mapping = readyMappings[i];

      setUploadStatus((prev) => [
        ...prev,
        {
          folderName: mapping.folderName,
          status: "Uploading...",
          success: null,
        },
      ]);

      try {
        // 1. Create item in DSpace
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

        // 2. Get item ID if needed
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

        // 3. Download job files
        const downloadRes = await fetch(`/api/ocr/download/${mapping.jobId}`);
        if (!downloadRes.ok) {
          throw new Error("Failed to download job files");
        }

        const blob = await downloadRes.blob();

        // 4. Extract PDF from ZIP and upload
        const JSZip = require("jszip");
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(blob);

        // Find PDF file (exclude metadata.json)
        const pdfFile = Object.keys(zipContent.files).find(
          (name) => name.endsWith(".pdf") && !name.includes("metadata"),
        );

        if (!pdfFile) {
          throw new Error("PDF file not found in job output");
        }

        const pdfBlob = await zipContent.files[pdfFile].async("blob");

        // Upload bitstream
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
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 p-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="max-w-450 mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🤖 Smart DSpace Uploader with OCR
          </h1>
          <p className="text-gray-600">Upload → OCR → AI Analysis → DSpace</p>
        </div>

        {!session?.authenticated && (
          <LoginForm
            dspaceUrl={dspaceUrl}
            onLoginSuccess={handleLoginSuccess}
            showToast={(msg, type) => {
              if (type === "success") success(msg);
              else if (type === "error") error(msg);
              else warning(msg);
            }}
          />
        )}

        {session?.authenticated && (
          <>
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-8">
              <h3 className="text-green-800 font-semibold">
                ✓ Logged in as {session.fullname}
              </h3>
            </div>

            <OCRUploader
              onUploadSuccess={handleUploadSuccess}
              showToast={(msg, type) => {
                if (type === "success") success(msg);
                else error(msg);
              }}
            />

            {/* TWO COLUMN LAYOUT - OCR Jobs & AI Suggestions Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Left Column: OCR Jobs */}
              <OCRJobsList
                jobs={jobs}
                onSelectForDSpace={setSelectedJobIds}
                onDownload={handleDownload}
                selectedJobs={selectedJobIds}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />

              {/* Right Column: AI Suggestions */}
              {mappings.length > 0 && (
                <MappingsTable
                  mappings={mappings}
                  collections={collections}
                  onUpdateMapping={handleUpdateMapping}
                  onUpload={handleUpload}
                  isUploading={isUploading}
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