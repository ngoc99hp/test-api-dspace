import React from 'react';

export default function Header({ session }) {
  return (
    <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-[1800px] mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left - Title */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Smart DSpace Uploader
              </h1>
              <p className="text-sm text-gray-500">Upload → OCR → AI Analysis → DSpace</p>
            </div>
          </div>

          {/* Right - User Info */}
          {session?.authenticated && (
            <div className="flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-lg px-4 py-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-800 font-semibold">
                Logged in as {session.fullname}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}