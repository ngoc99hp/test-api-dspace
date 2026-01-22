"use client"
import React, { useState, useRef } from 'react';

export default function DSpaceBatchUploader() {
  // Lấy DSpace URL từ biến môi trường
  const dspaceUrl = process.env.NEXT_PUBLIC_DSPACE_URL || 'https://lib.hpu.edu.vn';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [session, setSession] = useState(null);
  const [folders, setFolders] = useState([]);
  const [uploadStatus, setUploadStatus] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Login to DSpace
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

      // Check session status (POST method now, with dspaceUrl)
      const statusRes = await fetch('/api/dspace/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dspaceUrl })
      });
      const statusData = await statusRes.json();

      if (statusData.authenticated) {
        setSession(statusData);
        alert('Login successful!');
      } else {
        alert('Login failed: Not authenticated');
      }
    } catch (err) {
      alert('Login error: ' + err.message);
    }
  };

  // Handle folder selection
  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Group files by directory path
    const folderMap = {};
    files.forEach(file => {
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts[0];
      
      if (!folderMap[folderName]) {
        folderMap[folderName] = [];
      }
      folderMap[folderName].push(file);
    });

    const folderList = Object.entries(folderMap).map(([name, files]) => ({
      name,
      files,
      metadataFile: files.find(f => f.name === 'metadata.json')
    }));

    setFolders(folderList);
    setUploadStatus([]);
  };

  // Read metadata.json from a file
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

  // Upload a single folder
  const uploadFolder = async (folder) => {
    try {
      // 1. Read metadata.json
      if (!folder.metadataFile) {
        throw new Error('metadata.json not found in folder');
      }

      const metadata = await readMetadataFile(folder.metadataFile);
      
      // Validate metadata format
      if (!metadata.metadata || !Array.isArray(metadata.metadata)) {
        throw new Error('Invalid metadata format. Expected { "metadata": [...] }');
      }

      // 2. Create item
      const createRes = await fetch('/api/dspace/create-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          collectionId,
          metadata: metadata.metadata,
          dspaceUrl
        })
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.error || 'Failed to create item');
      }

      const itemData = await createRes.json();
      const itemId = itemData.id;

      // 3. Upload bitstreams (all files except metadata.json)
      const bitstreamFiles = folder.files.filter(f => f.name !== 'metadata.json');
      const uploadedBitstreams = [];

      for (const file of bitstreamFiles) {
        console.log('Uploading file:', file.name, 'Size:', file.size);
        
        try {
          // Đọc file thành ArrayBuffer
          const fileData = await file.arrayBuffer();
          console.log('File data read, size:', fileData.byteLength);
          
          // Gửi RAW BINARY đến API route với params trong URL
          const uploadUrl = `/api/dspace/upload-bitstream?itemId=${itemId}&fileName=${encodeURIComponent(file.name)}&dspaceUrl=${encodeURIComponent(dspaceUrl)}`;
          console.log('Upload URL:', uploadUrl);
          
          const bitstreamRes = await fetch(uploadUrl, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/octet-stream'
            },
            body: fileData // RAW binary data
          });

          console.log('Response status:', bitstreamRes.status);
          
          if (!bitstreamRes.ok) {
            const errorText = await bitstreamRes.text();
            console.error('Upload failed:', errorText);
            
            let error;
            try {
              error = JSON.parse(errorText);
            } catch (e) {
              error = { error: errorText };
            }
            
            throw new Error(error.error || error.message || `Failed to upload ${file.name}`);
          }

          const bitstreamData = await bitstreamRes.json();
          console.log('Upload success:', bitstreamData);
          uploadedBitstreams.push(bitstreamData);
        } catch (err) {
          console.error('Error uploading', file.name, ':', err);
          throw new Error(`Failed to upload ${file.name}: ${err.message}`);
        }
      }

      return {
        success: true,
        itemId,
        bitstreamCount: uploadedBitstreams.length,
        handle: itemData.handle || 'Pending'
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  };

  // Push all folders to DSpace
  const handlePushToDSpace = async () => {
    if (!session?.authenticated) {
      alert('Please login first');
      return;
    }

    if (!collectionId) {
      alert('Please enter Collection ID');
      return;
    }

    if (folders.length === 0) {
      alert('Please select folders');
      return;
    }

    setIsProcessing(true);
    setUploadStatus([]);

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      
      setUploadStatus(prev => [
        ...prev,
        { folderName: folder.name, status: 'Processing...', success: null }
      ]);

      const result = await uploadFolder(folder);

      setUploadStatus(prev => {
        const updated = [...prev];
        updated[i] = {
          folderName: folder.name,
          status: result.success 
            ? `Success! Item ID: ${result.itemId}, Bitstreams: ${result.bitstreamCount}, Handle: ${result.handle}`
            : `Failed: ${result.error}`,
          success: result.success
        };
        return updated;
      });
    }

    setIsProcessing(false);
    alert('Processing complete!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          DSpace 6.3 Batch Document Uploader
        </h1>

        {/* Login Form */}
        {!session?.authenticated && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Login to DSpace</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">DSpace Server:</span> {dspaceUrl}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dspace.org"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Login
              </button>
            </div>
          </div>
        )}

        {/* Session Info */}
        {session?.authenticated && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <h3 className="text-green-800 font-semibold mb-2">
              ✓ Logged in as {session.fullname}
            </h3>
            <p className="text-green-700 text-sm">Email: {session.email}</p>
            <p className="text-green-700 text-sm">DSpace Version: {session.sourceVersion}</p>
          </div>
        )}

        {/* Upload Section */}
        {session?.authenticated && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Upload Configuration</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection ID (Required)
                </label>
                <input
                  type="text"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  placeholder="e.g., 123 or uuid-string"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this in DSpace admin interface or via /rest/collections
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Folders
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  webkitdirectory=""
                  multiple
                  onChange={handleFolderSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each folder must contain a metadata.json file
                </p>
              </div>

              {folders.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Selected Folders ({folders.length})
                  </h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {folders.map((folder, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="mr-2">
                          {folder.metadataFile ? '✓' : '✗'}
                        </span>
                        <span className="font-medium">{folder.name}</span>
                        <span className="ml-2 text-gray-400">
                          ({folder.files.length} files)
                        </span>
                        {!folder.metadataFile && (
                          <span className="ml-2 text-red-600 text-xs">
                            Missing metadata.json
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handlePushToDSpace}
                disabled={isProcessing || folders.length === 0 || !collectionId}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Push to DSpace'}
              </button>
            </div>

            {/* Upload Status */}
            {uploadStatus.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Upload Status</h2>
                <div className="space-y-3">
                  {uploadStatus.map((status, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-md ${
                        status.success === null
                          ? 'bg-blue-50 border border-blue-200'
                          : status.success
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="font-semibold mr-2">
                          {status.folderName}:
                        </span>
                        <span
                          className={`flex-1 ${
                            status.success === null
                              ? 'text-blue-700'
                              : status.success
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}
                        >
                          {status.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📋 Instructions
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-900 text-sm">
            <li>Login with your DSpace credentials</li>
            <li>Enter the target Collection ID</li>
            <li>
              Prepare folders with documents. Each folder must contain:
              <ul className="list-disc list-inside ml-6 mt-1 text-blue-800">
                <li><code className="bg-blue-100 px-1 rounded">metadata.json</code> - DSpace metadata</li>
                <li>Document files (PDF, images, etc.)</li>
              </ul>
            </li>
            <li>Select folders using the folder picker</li>
            <li>Click "Push to DSpace" to start upload</li>
          </ol>
          
          <div className="mt-4 p-3 bg-blue-100 rounded">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Example metadata.json format:
            </p>
            <pre className="text-xs text-blue-900 overflow-x-auto">
{`{
  "metadata": [
    { "key": "dc.title", "value": "Document Title", "language": null },
    { "key": "dc.contributor.author", "value": "Author Name", "language": null },
    { "key": "dc.date.issued", "value": "2024", "language": null },
    { "key": "dc.description.abstract", "value": "Abstract text", "language": "en" },
    { "key": "dc.language.iso", "value": "en", "language": null },
    { "key": "dc.type", "value": "Text", "language": null }
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}