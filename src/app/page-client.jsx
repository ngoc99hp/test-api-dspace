"use client";

import React, { useState, useEffect } from "react";
import OCRUploader from "@/components/OCRUploader";
import OCRJobsList from "@/components/OCRJobsList";
import MappingsTable from "@/components/MappingsTable";
import UploadStatus from "@/components/UploadStatus";
import { ToastContainer } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useOCRJobs } from "@/hooks/useOCRJobs";

export default function PageClient({ session, initialCollections = [] }) {
  const dspaceUrl = process.env.NEXT_PUBLIC_DSPACE_URL;
  const { toasts, removeToast, success, error, warning, info } = useToast();
  const { jobs, loading, fetchJobs, downloadJob, deleteJob } = useOCRJobs();

  const [collections, setCollections] = useState(initialCollections);
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

  const handleDelete = async (jobId) => {
    try {
      await deleteJob(jobId);
      success("Job deleted successfully");

      setSelectedJobIds((prev) => prev.filter((id) => id !== jobId));
      setMappings((prev) => prev.filter((m) => m.jobId !== jobId));
    } catch (err) {
      error(`Delete failed: ${err.message}`);
    }
  };

  const handleAnalyze = async () => {
    if (selectedJobIds.length === 0) {
      warning("Please select completed jobs first");
      return;
    }

    if (collections.length === 0) {
      error("Collections not loaded yet. Please wait...");
      return;
    }

    setIsAnalyzing(true);
    info(`Analyzing ${selectedJobIds.length} documents with community context...`);

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

        if (!job || job.status !== "completed") continue;

        if (!job.metadata || !job.metadata.metadata) {
          warning(`${job.filename} has no metadata, skipping`);
          continue;
        }

        const titleField = job.metadata.metadata.find(
          (m) => m.key === "dc.title"
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

      console.log(
        "Collections sent to AI:",
        collections.slice(0, 3).map((c) => ({
          name: c.name,
          communityName: c.communityName,
          displayName: c.displayName,
        }))
      );

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

      const newMappings = aiData.suggestions.map((sug) => {
        const doc = documents.find((d) => d.folderName === sug.folderName);

        const collection = collections.find(
          (c) => (c.id || c.uuid) === sug.collectionId
        );

        return {
          jobId: doc?.jobId || sug.documentIndex,
          folderName: sug.folderName,
          title: doc?.title || sug.folderName,
          collectionId: sug.collectionId,
          collectionName: sug.collectionName,
          collectionDisplayName: collection?.displayName || sug.collectionName,
          communityName: collection?.communityName || sug.communityName || "",
          fullContext: collection?.fullContext || sug.collectionName,
          confidence: sug.confidence,
          reasoning: sug.reasoning,
          status: "ready",
          metadata: doc?.metadata || [],
        };
      });

      setMappings(newMappings);
      setSelectedMappings(newMappings.map((m) => m.jobId || m.folderId));

      const highConfidence = newMappings.filter((m) => m.confidence >= 80).length;
      const mediumConfidence = newMappings.filter(
        (m) => m.confidence >= 60 && m.confidence < 80
      ).length;
      const lowConfidence = newMappings.filter((m) => m.confidence < 60).length;

      success(
        `Analysis complete! ${newMappings.length} suggestions ready:\n` +
          `🟢 ${highConfidence} high confidence (80-100%)\n` +
          `🟡 ${mediumConfidence} medium confidence (60-79%)\n` +
          `🔴 ${lowConfidence} low confidence (<60%)`
      );

      const communityDist = {};
      newMappings.forEach((m) => {
        communityDist[m.communityName] = (communityDist[m.communityName] || 0) + 1;
      });
      console.log("Community distribution:", communityDist);
    } catch (err) {
      console.error("Analysis error:", err);
      error(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateMapping = (id, collectionId, collectionName) => {
    setMappings((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((m) => (m.jobId || m.folderId) === id);
      if (idx !== -1) {
        const collection = collections.find(
          (c) => (c.id || c.uuid) === collectionId
        );

        updated[idx].collectionId = collectionId;
        updated[idx].collectionName = collectionName;

        if (collection) {
          updated[idx].collectionDisplayName = collection.displayName;
          updated[idx].communityName = collection.communityName;
          updated[idx].fullContext = collection.fullContext;
        }
      }
      return updated;
    });
  };

  const handleUpload = async () => {
    const toUpload = mappings.filter(
      (m) =>
        selectedMappings.includes(m.jobId || m.folderId) &&
        m.status === "ready" &&
        m.collectionId
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
          communityContext: mapping.communityName
            ? `${mapping.communityName} > ${mapping.collectionName}`
            : mapping.collectionName,
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
          (name) => name.endsWith(".pdf") && !name.includes("metadata")
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
            communityContext: mapping.communityName
              ? `${mapping.communityName} > ${mapping.collectionName}`
              : mapping.collectionName,
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
            communityContext: mapping.communityName
              ? `${mapping.communityName} > ${mapping.collectionName}`
              : mapping.collectionName,
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
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Collections Status */}
      {collections.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-semibold">
                {collections.length} collections loaded from{" "}
                {new Set(collections.map((c) => c.communityName)).size} communities
              </p>
              <p className="text-xs text-green-600 mt-1">
                AI matching with community context enabled
              </p>
            </div>
          </div>
        </div>
      )}

      <OCRUploader
        onUploadSuccess={handleUploadSuccess}
        showToast={(msg, type) => {
          if (type === "success") success(msg);
          else error(msg);
        }}
      />

      {/* ✨ CHANGED: Vertical Layout */}
      <div className="space-y-6 mb-8">
        <OCRJobsList
          jobs={jobs}
          onSelectForDSpace={setSelectedJobIds}
          onDownload={handleDownload}
          selectedJobs={selectedJobIds}
          onDelete={handleDelete}
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
            dspaceUrl={dspaceUrl}
          />
        )}
      </div>

      <UploadStatus uploadStatus={uploadStatus} />
    </>
  );
}