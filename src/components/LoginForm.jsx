"use client"

import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

export default function LoginForm({ dspaceUrl, onLoginSuccess, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showToast('Please enter email and password', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/dspace/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, dspaceUrl })
      });

      if (!res.ok) {
        const error = await res.json();
        showToast(error.error ?? 'Login failed', 'error');
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
        showToast(`Welcome, ${statusData.fullname}!`, 'success');
        onLoginSuccess(statusData);
      } else {
        showToast('Authentication failed', 'error');
      }
    } catch (err) {
      showToast(`Login error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <LogIn className="w-5 h-5" />
        Login to DSpace
      </h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Server:</span> {dspaceUrl}
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
            disabled={isLoading}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            required
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
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}