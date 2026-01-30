'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { BudgetEnvelope, Category } from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

interface EnvelopeWithSpent extends BudgetEnvelope {
  spent: number;
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [envelopes, setEnvelopes] = useState<EnvelopeWithSpent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [assignedAmount, setAssignedAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [budgetData, spendingData, cats] = await Promise.all([
        api.getBudget(month),
        api.getBudgetSpending(month),
        api.getCategories()
      ]);
      
      setCategories(cats);
      
      // Merge envelopes with spending
      const spendingMap = new Map(spendingData.map(s => [s.categoryId, s.spent]));
      const envs: EnvelopeWithSpent[] = budgetData.envelopes.map(env => ({
        ...env,
        spent: spendingMap.get(env.categoryId) || 0
      }));
      
      setEnvelopes(envs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const prevMonth = () => {
    const d = new Date(month + '-01');
    d.setMonth(d.getMonth() - 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const d = new Date(month + '-01');
    d.setMonth(d.getMonth() + 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const openAddModal = () => {
    setSelectedCategoryId('');
    setAssignedAmount('');
    setShowModal(true);
  };

  const openEditModal = (env: EnvelopeWithSpent) => {
    setSelectedCategoryId(env.categoryId);
    setAssignedAmount(String(env.assigned));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) return;
    
    setSaving(true);
    try {
      await api.upsertEnvelope(month, selectedCategoryId, parseFloat(assignedAmount) || 0);
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const totalAssigned = envelopes.reduce((sum, e) => sum + Number(e.assigned || 0), 0);
  const totalSpent = envelopes.reduce((sum, e) => sum + Number(e.spent || 0), 0);
  const totalAvailable = totalAssigned - totalSpent;

  // Categories not yet in budget
  const usedCategoryIds = new Set(envelopes.map(e => e.categoryId));
  const availableCategories = categories.filter(c => !usedCategoryIds.has(c.id));

  const formatMonth = (m: string) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{formatMonth(month)}</h1>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          Add Envelope
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Total Assigned</div>
          <div className="text-2xl font-bold text-slate-900">${totalAssigned.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Total Spent</div>
          <div className="text-2xl font-bold text-red-600">${totalSpent.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Available</div>
          <div className={`text-2xl font-bold ${totalAvailable >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${totalAvailable.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Category</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Assigned</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Spent</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Available</th>
              <th className="px-6 py-3 text-sm font-medium text-slate-600">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading...</td>
              </tr>
            ) : envelopes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No budget envelopes yet. Add one to start tracking!
                </td>
              </tr>
            ) : (
              envelopes.map((env) => {
                const assigned = Number(env.assigned) || 0;
                const spent = Number(env.spent) || 0;
                const available = assigned - spent;
                const pct = assigned > 0 ? (spent / assigned) * 100 : 0;
                const cat = categories.find(c => c.id === env.categoryId);
                return (
                  <tr
                    key={env.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openEditModal(env)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium">{cat?.icon} {cat?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">${assigned.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-red-600">${spent.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right font-medium ${available >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${available.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Envelope Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {usedCategoryIds.has(selectedCategoryId) ? 'Edit Envelope' : 'Add Envelope'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                  disabled={usedCategoryIds.has(selectedCategoryId)}
                >
                  <option value="">Select category...</option>
                  {usedCategoryIds.has(selectedCategoryId) && (
                    <option value={selectedCategoryId}>
                      {categories.find(c => c.id === selectedCategoryId)?.name}
                    </option>
                  )}
                  {availableCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={assignedAmount}
                    onChange={(e) => setAssignedAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
