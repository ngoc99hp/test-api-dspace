"use client"
import React, { useState, useRef } from 'react';
import { Plus, X, Trash2, FolderOpen } from 'lucide-react';

export default function SmartDSpaceUploader() {
  const dspaceUrl = process.env.NEXT_PUBLIC_DSPACE_URL;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [collections, setCollections] = useState([]);
  
  // ✅ Quản lý danh sách folders đã chọn
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState([]);
  const fileInputRef = useRef(null);

  // Login
  const handleLogin = async () => {
    try {
      const res = await fetch('/api/dspace/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, dspaceUrl })
      });

      if (!res.ok) {
        const error = await res.json();
        alert('Login failed: ' + (error.error || 'Unknown error'));
        return;
      }

      const statusRes = await fetch('/api/dspace/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dspaceUrl })
      });
      const statusData = await statusRes.json();

      if (statusData.authenticated) {
        setSession(statusData);
        await loadCollections();
        alert('✅ Login successful!');
      } else {
        alert('Login failed: Not authenticated');
      }
    } catch (err) {
      alert('Login error: ' + err.message);
    }
  };

  // Load all collections
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
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
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

  // ✅ Thêm folders vào danh sách (không gọi AI ngay)
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
              title = titleField?.value || 'Untitled';
              hasValidMetadata = true;
            }
          } catch (err) {
            console.error(`Error reading metadata from ${name}:`, err);
          }
        }

        return {
          id: Date.now() + Math.random(), // Unique ID
          name,
          title,
          files,
          metadataFile,
          hasValidMetadata,
          fileCount: files.length
        };
      })
    );

    // ✅ Thêm vào danh sách, không trùng lặp
    setSelectedFolders(prev => {
      const existingNames = prev.map(f => f.name);
      const uniqueNew = newFolders.filter(f => !existingNames.includes(f.name));
      return [...prev, ...uniqueNew];
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ✅ Xóa folder khỏi danh sách
  const handleRemoveFolder = (folderId) => {
    setSelectedFolders(prev => prev.filter(f => f.id !== folderId));
    setMappings(prev => prev.filter(m => m.folderId !== folderId));
  };

  // ✅ Xóa tất cả folders
  const handleClearAll = () => {
    if (confirm('Remove all selected folders?')) {
      setSelectedFolders([]);
      setMappings([]);
    }
  };

  // ✅ AI Analysis - CHỈ khi user bấm nút xác nhận
  const handleAnalyze = async () => {
    if (selectedFolders.length === 0) {
      alert('Please select folders first');
      return;
    }

    if (collections.length === 0) {
      alert('No collections loaded. Please login first.');
      return;
    }

    const validFolders = selectedFolders.filter(f => f.hasValidMetadata);
    if (validFolders.length === 0) {
      alert('No folders with valid metadata.json found');
      return;
    }

    if (!confirm(`Analyze ${validFolders.length} folders with AI? (This will use Claude API credits)`)) {
      return;
    }

    setIsAnalyzing(true);
    const newMappings = [];

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
        continue;
      }

      try {
        const metadata = await readMetadataFile(folder.metadataFile);

        // ✅ Call AI (API key từ .env)
        const res = await fetch('/api/ai/suggest-collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: metadata.metadata,
            collections
          })
        });

        if (!res.ok) {
          throw new Error('AI suggestion failed');
        }

        const data = await res.json();
        const suggestion = data.suggestion;

        newMappings.push({
          folderId: folder.id,
          folderName: folder.name,
          title: folder.title,
          collectionId: suggestion.collectionId,
          collectionName: suggestion.collectionName,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning,
          alternativeIds: suggestion.alternativeIds || [],
          status: 'ready',
          metadata: metadata.metadata
        });

      } catch (err) {
        console.error(`Error analyzing ${folder.name}:`, err);
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

  // Upload to DSpace
  const handleUpload = async () => {
    const readyMappings = mappings.filter(m => m.status === 'ready' && m.collectionId);
    
    if (readyMappings.length === 0) {
      alert('No items ready to upload');
      return;
    }

    if (!confirm(`Upload ${readyMappings.length} items to DSpace?`)) {
      return;
    }

    setIsUploading(true);
    setUploadStatus([]);

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
            status: `✅ Success! ID: ${itemId}, Files: ${uploadedCount}, Handle: ${itemData.handle || 'Pending'}`,
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
    alert('Upload complete!');
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🤖 Smart DSpace Uploader
          </h1>
          <p className="text-gray-600">AI-Powered Collection Auto-Mapping</p>
        </div>

        {/* Login */}
        {!session?.authenticated && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">🔐 Login to DSpace</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Server:</span> {dspaceUrl}
                </p>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Login
              </button>
            </div>
          </div>
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

        {/* Folder Selection */}
        {session?.authenticated && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Folder Selection
              </h2>

              <div className="space-y-4">
                {/* Add Folders Button */}
                <div className="flex gap-3">
                  <label className="flex-1 cursor-pointer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      webkitdirectory=""
                      multiple
                      onChange={handleAddFolders}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg border-2 border-blue-200 hover:bg-blue-100 font-medium">
                      <Plus className="w-5 h-5" />
                      Add Folders
                    </div>
                  </label>
                  
                  {selectedFolders.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="px-4 py-3 bg-red-50 text-red-700 rounded-lg border-2 border-red-200 hover:bg-red-100 font-medium flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                  )}
                </div>

                {/* Selected Folders List */}
                {selectedFolders.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        Selected Folders ({selectedFolders.length})
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {selectedFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between px-4 py-3 border-b hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {folder.hasValidMetadata ? '✅' : '❌'}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900">{folder.title}</p>
                                <p className="text-xs text-gray-500">
                                  {folder.name} • {folder.fileCount} files
                                </p>
                              </div>
                            </div>
                            {!folder.hasValidMetadata && (
                              <p className="text-xs text-red-600 mt-1 ml-7">
                                Missing or invalid metadata.json
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveFolder(folder.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analyze Button */}
                {selectedFolders.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-800 mb-3">
                      ⚠️ AI analysis will use Claude API credits. Make sure you've selected all desired folders before analyzing.
                    </p>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? '🤖 AI Analyzing...' : `🤖 Analyze ${selectedFolders.filter(f => f.hasValidMetadata).length} Folders with AI`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mappings Table */}
            {mappings.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">📊 AI Suggestions</h2>
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
                        <tr key={mapping.folderId} className={mapping.status === 'error' ? 'bg-red-50' : ''}>
                          <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {mapping.title}
                            <div className="text-xs text-gray-500">{mapping.folderName}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {mapping.status === 'error' ? (
                              <span className="text-red-600">{mapping.collectionName}</span>
                            ) : (
                              <select
                                value={mapping.collectionId}
                                onChange={(e) => {
                                  const newMappings = [...mappings];
                                  const col = collections.find(c => c.id === e.target.value || c.uuid === e.target.value);
                                  const idx = newMappings.findIndex(m => m.folderId === mapping.folderId);
                                  newMappings[idx].collectionId = e.target.value;
                                  newMappings[idx].collectionName = col?.name || '';
                                  setMappings(newMappings);
                                }}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                {collections.map(col => (
                                  <option key={col.id || col.uuid} value={col.id || col.uuid}>
                                    {col.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-semibold ${getConfidenceColor(mapping.confidence)}`}>
                              {getConfidenceBadge(mapping.confidence)}
                            </span>
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
                  onClick={handleUpload}
                  disabled={isUploading || mappings.filter(m => m.status === 'ready').length === 0}
                  className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                >
                  {isUploading ? '⏳ Uploading...' : '🚀 Push to DSpace'}
                </button>
              </div>
            )}

            {/* Upload Status */}
            {uploadStatus.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">📈 Upload Status</h2>
                <div className="space-y-2">
                  {uploadStatus.map((status, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${
                        status.success === null ? 'bg-blue-50' :
                        status.success ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <span className="font-semibold">{status.folderName}:</span> {status.status}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}