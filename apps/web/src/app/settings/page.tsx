'use client';

import { useEffect, useState } from 'react';
import { Save, AlertTriangle, Check, Loader2, Download, Trash2, User, Bot, Database, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaModel, setOllamaModel] = useState('llama3.2:1b');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
    checkOllamaStatus();
  }, [user]);

  const checkOllamaStatus = async () => {
    setOllamaStatus('checking');
    try {
      const response = await fetch('http://localhost:6000/health');
      if (response.ok) {
        setOllamaStatus('online');
        // Get available models
        try {
          const modelsRes = await fetch('http://localhost:11434/api/tags');
          if (modelsRes.ok) {
            const data = await modelsRes.json();
            setAvailableModels(data.models?.map((m: any) => m.name) || []);
          }
        } catch {
          setAvailableModels(['llama3.2:1b', 'llama2', 'mistral', 'codellama']);
        }
      } else {
        setOllamaStatus('offline');
      }
    } catch {
      setOllamaStatus('offline');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    
    try {
      // In a real app, this would call an API to update user profile
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 500));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const [accounts, transactions, categories, portfolios] = await Promise.all([
        api.getAccounts(),
        api.getTransactions(),
        api.getCategories(),
        api.getPortfolios(),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        accounts,
        transactions,
        categories,
        portfolios,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fpm-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Failed to export data');
    }
  };

  const handleDeleteAllData = async () => {
    // In a real app, this would call an API to delete all user data
    // For now, just log out
    setShowDeleteConfirm(false);
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="font-semibold text-lg">Profile</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
              disabled
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg">AI Configuration</h2>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            ollamaStatus === 'online' 
              ? 'bg-emerald-100 text-emerald-700' 
              : ollamaStatus === 'offline'
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              ollamaStatus === 'online' 
                ? 'bg-emerald-500' 
                : ollamaStatus === 'offline'
                ? 'bg-red-500'
                : 'bg-amber-500 animate-pulse'
            }`} />
            {ollamaStatus === 'online' ? 'Online' : ollamaStatus === 'offline' ? 'Offline' : 'Checking...'}
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Ollama Model</label>
            <select 
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))
              ) : (
                <>
                  <option value="llama3.2:1b">llama3.2:1b</option>
                  <option value="llama2">llama2</option>
                  <option value="mistral">mistral</option>
                  <option value="codellama">codellama</option>
                </>
              )}
            </select>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-slate-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">100% Local & Private</p>
                <p className="text-sm text-slate-600">
                  All AI processing runs locally via Ollama. Your financial data never leaves your device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="font-semibold text-lg">Data Management</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Export All Data</p>
              <p className="text-sm text-slate-600">Download all your data as JSON</p>
            </div>
            <button 
              onClick={handleExportData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Delete All Data</p>
              <p className="text-sm text-slate-600">Permanently delete all your data</p>
            </div>
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Delete All Data?</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              This will permanently delete all your accounts, transactions, budgets, portfolios, and other data. 
              You will be logged out and all data will be lost forever.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
