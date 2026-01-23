"use client"

import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import FolderSelector from '../components/FolderSelector';
import MappingsTable from '../components/MappingsTable';
import UploadStatus from '../components/UploadStatus';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function SmartDSpaceUploader() {
  const dspaceUrl = process.env.NEXT_PUBLIC_DSPACE_URL;
  const { toasts, removeToast, success, error, warning, info } = useToast();
  
  const [session, setSession] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState([]);

  // Load collections after login
  const loadCollections = async () => {
    try {
      const res = await fetch('/api/dspace/get-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dspaceUrl })
      });

      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
        console.log(`Loaded ${data.collections.length} collections`);
      } else {
        warning('Failed to load collections');
      }
    } catch (err) {
      error(`Failed to load collections: ${err.message}`);
    }
  };

  // Handle login success
  const handleLoginSuccess = async (sessionData) => {
    setSession(sessionData);
    await loadCollections();
  };

  // Read metadata from file
  const readMetadataFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const metadata = JSON.parse(e.target.result);
          resolve(metadata);
        } catch (err) {
          reject(new Error('Invalid JSON in metadata.json'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read metadata.json'));
      reader.readAsText(file);
    });
  };

  // Add folders
  const handleAddFolders = async (e) => {
    const files = Array.from(e.target.files);
    
    const folderMap = {};
    files.forEach(file => {
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts[0];
      
      if (!folderMap[folderName]) {
        folderMap[folderName] = [];
      }
      folderMap[folderName].push(file);
    });

    const newFolders = await Promise.all(
      Object.entries(folderMap).map(async ([name, files]) => {
        const metadataFile = files.find(f => f.name === 'metadata.json');
        let title = 'N/A';
        let hasValidMetadata = false;

        if (metadataFile) {
          try {
            const metadata = await readMetadataFile(metadataFile);
            if (metadata.metadata && Array.isArray(metadata.metadata)) {
              const titleField = metadata.metadata.find(m => m.key === 'dc.title');
              title = titleField?.value ?? 'Untitled';
              hasValidMetadata = true;
            }
          } catch (err) {
            console.error(`Error reading metadata from ${name}:`, err);
          }
        }

        return {
          id: Date.now() + Math.random(),
          name,
          title,
          files,
          metadataFile,
          hasValidMetadata,
          fileCount: files.length
        };
      })
    );

    setSelectedFolders(prev => {
      const existingNames = prev.map(f => f.name);
      const uniqueNew = newFolders.filter(f => !existingNames.includes(f.name));
      if (uniqueNew.length > 0) {
        info(`Added ${uniqueNew.length} folders`);
      } else {
        warning('All selected folders already added');
      }
      return [...prev, ...uniqueNew];
    });
  };

  // Remove folder
  const handleRemoveFolder = (folderId) => {
    setSelectedFolders(prev => prev.filter(f => f.id !== folderId));
    setMappings(prev => prev.filter(m => m.folderId !== folderId));
    info('Folder removed');
  };

  // Clear all folders
  const handleClearAll = () => {
    setSelectedFolders([]);
    setMappings([]);
    info('All folders cleared');
  };

  // AI Analysis
  const handleAnalyze = async () => {
    if (selectedFolders.length === 0) {
      warning('Please select folders first');
      return;
    }

    if (collections.length === 0) {
      warning('No collections loaded. Please login first.');
      return;
    }

    const validFolders = selectedFolders.filter(f => f.hasValidMetadata);
    if (validFolders.length === 0) {
      warning('No folders with valid metadata.json found');
      return;
    }

    setIsAnalyzing(true);
    info(`Analyzing ${validFolders.length} folders...`);
    const newMappings = [];

    try {
      // Prepare documents for batch analysis
      const documents = [];
      
      for (const folder of validFolders) {
        const metadata = await readMetadataFile(folder.metadataFile);
        documents.push({
          folderId: folder.id,
          folderName: folder.name,
          title: folder.title,
          metadata: metadata.metadata
        });
      }

      console.log(`🚀 Sending ${documents.length} documents in single API call...`);

      // Single batch API call for ALL documents
      const res = await fetch('/api/ai/suggest-collection-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents,
          collections
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Batch API error:', errorData);
        throw new Error(errorData.error ?? `Batch AI failed with status ${res.status}`);
      }

      const data = await res.json();
      console.log(`✅ Received ${data.suggestions.length} suggestions`);

      // Map suggestions to folders
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const suggestion = data.suggestions.find(s => s.folderName === doc.folderName) 
                        ?? data.suggestions[i];

        if (suggestion) {
          newMappings.push({
            folderId: doc.folderId,
            folderName: doc.folderName,
            title: doc.title,
            collectionId: suggestion.collectionId,
            collectionName: suggestion.collectionName,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            status: 'ready',
            metadata: doc.metadata
          });
        } else {
          newMappings.push({
            folderId: doc.folderId,
            folderName: doc.folderName,
            title: doc.title,
            collectionId: null,
            collectionName: 'No suggestion returned',
            confidence: 0,
            reasoning: 'AI did not provide suggestion for this document',
            status: 'error'
          });
        }
      }

      // Add error entries for folders without valid metadata
      for (const folder of selectedFolders) {
        if (!folder.hasValidMetadata) {
          newMappings.push({
            folderId: folder.id,
            folderName: folder.name,
            title: folder.title,
            collectionId: null,
            collectionName: 'Missing/Invalid metadata.json',
            confidence: 0,
            reasoning: 'No valid metadata file found',
            status: 'error'
          });
        }
      }

      success(`Analysis complete! ${data.suggestions.length} suggestions ready`);

    } catch (err) {
      console.error('Batch analysis error:', err);
      error(`Analysis failed: ${err.message}`);
      
      // Fallback: Mark all as errors
      for (const folder of selectedFolders) {
        newMappings.push({
          folderId: folder.id,
          folderName: folder.name,
          title: folder.title,
          collectionId: null,
          collectionName: 'Analysis failed',
          confidence: 0,
          reasoning: err.message,
          status: 'error'
        });
      }
    }

    setMappings(newMappings);
    setIsAnalyzing(false);
  };

  // Update mapping
  const handleUpdateMapping = (folderId, collectionId, collectionName) => {
    setMappings(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(m => m.folderId === folderId);
      if (idx !== -1) {
        updated[idx].collectionId = collectionId;
        updated[idx].collectionName = collectionName;
      }
      return updated;
    });
  };

  // Upload to DSpace
  const handleUpload = async () => {
    const readyMappings = mappings.filter(m => m.status === 'ready' && m.collectionId);
    
    if (readyMappings.length === 0) {
      warning('No items ready to upload');
      return;
    }

    setIsUploading(true);
    setUploadStatus([]);
    info(`Starting upload of ${readyMappings.length} items...`);

    for (let i = 0; i < readyMappings.length; i++) {
      const mapping = readyMappings[i];
      const folder = selectedFolders.find(f => f.id === mapping.folderId);

      setUploadStatus(prev => [
        ...prev,
        { folderName: mapping.folderName, status: 'Uploading...', success: null }
      ]);

      try {
        // Create item
        const createRes = await fetch('/api/dspace/create-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            collectionId: mapping.collectionId,
            metadata: mapping.metadata,
            dspaceUrl
          })
        });

        if (!createRes.ok) {
          throw new Error('Failed to create item');
        }

        const itemData = await createRes.json();
        let itemId = itemData.itemId;

        if (!itemId && itemData.handle) {
          const handleRes = await fetch('/api/dspace/get-item-by-handle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ handle: itemData.handle, dspaceUrl })
          });

          if (handleRes.ok) {
            const handleData = await handleRes.json();
            itemId = handleData.id;
          }
        }

        if (!itemId) {
          throw new Error('Could not get item ID');
        }

        // Upload bitstreams
        const bitstreamFiles = folder.files.filter(f => f.name !== 'metadata.json');
        let uploadedCount = 0;

        for (const file of bitstreamFiles) {
          const fileData = await file.arrayBuffer();
          const uploadUrl = `/api/dspace/upload-bitstream?itemId=${encodeURIComponent(itemId)}&fileName=${encodeURIComponent(file.name)}&dspaceUrl=${encodeURIComponent(dspaceUrl)}`;
          
          const bitstreamRes = await fetch(uploadUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: fileData
          });

          if (bitstreamRes.ok) {
            uploadedCount++;
          }
        }

        setUploadStatus(prev => {
          const updated = [...prev];
          updated[i] = {
            folderName: mapping.folderName,
            status: `✅ Success! ID: ${itemId}, Files: ${uploadedCount}, Handle: ${itemData.handle ?? 'Pending'}`,
            success: true
          };
          return updated;
        });

      } catch (err) {
        setUploadStatus(prev => {
          const updated = [...prev];
          updated[i] = {
            folderName: mapping.folderName,
            status: `❌ Failed: ${err.message}`,
            success: false
          };
          return updated;
        });
      }
    }

    setIsUploading(false);
    success('Upload complete!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🤖 Smart DSpace Uploader
          </h1>
          <p className="text-gray-600">AI-Powered Collection Auto-Mapping</p>
        </div>

        {/* Login Form */}
        {!session?.authenticated && (
          <LoginForm 
            dspaceUrl={dspaceUrl}
            onLoginSuccess={handleLoginSuccess}
            showToast={(msg, type) => {
              if (type === 'success') success(msg);
              else if (type === 'error') error(msg);
              else if (type === 'warning') warning(msg);
              else info(msg);
            }}
          />
        )}

        {/* Session Info */}
        {session?.authenticated && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-800 font-semibold">
                  ✓ Logged in as {session.fullname}
                </h3>
                <p className="text-green-700 text-sm">
                  {collections.length} collections available
                </p>
              </div>
              <div className="text-right">
                <p className="text-green-700 text-sm">{session.email}</p>
                <p className="text-green-600 text-xs">DSpace {session.sourceVersion}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {session?.authenticated && (
          <>
            <FolderSelector
              selectedFolders={selectedFolders}
              onAddFolders={handleAddFolders}
              onRemoveFolder={handleRemoveFolder}
              onClearAll={handleClearAll}
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
              />
            )}

            <UploadStatus uploadStatus={uploadStatus} />
          </>
        )}
      </div>
    </div>
  );
}