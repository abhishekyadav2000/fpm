'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { Transaction, Account, Category } from '@/lib/api';
import { Plus, X, Edit2, Trash2, Search, Filter } from 'lucide-react';

interface TransactionFormData {
  accountId: string;
  categoryId: string;
  date: string;
  description: string;
  merchant: string;
  amount: string;
  notes: string;
}

const emptyForm: TransactionFormData = {
  accountId: '',
  categoryId: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  merchant: '',
  amount: '',
  notes: ''
};

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterAccount, setFilterAccount] = useState('');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [txs, accts, cats] = await Promise.all([
        api.getTransactions({ limit: 200 }),
        api.getAccounts(),
        api.getCategories()
      ]);
      setTransactions(txs);
      setAccounts(accts);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setForm({ ...emptyForm, accountId: accounts[0]?.id || '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setForm({
      accountId: tx.accountId,
      categoryId: tx.categoryId || '',
      date: tx.date.split('T')[0],
      description: tx.description,
      merchant: tx.merchant || '',
      amount: String(tx.amount),
      notes: tx.notes || ''
    });
    setEditingId(tx.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = {
        accountId: form.accountId,
        categoryId: form.categoryId || undefined,
        date: form.date,
        description: form.description,
        merchant: form.merchant || undefined,
        amount: parseFloat(form.amount),
        notes: form.notes || undefined
      };

      if (editingId) {
        await api.updateTransaction(editingId, data);
      } else {
        await api.createTransaction(data);
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    
    try {
      await api.deleteTransaction(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Apply filters
  const filteredTransactions = transactions.filter(tx => {
    if (filterAccount && tx.accountId !== filterAccount) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.merchant?.toLowerCase().includes(q) ||
        tx.category?.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryName = (id?: string) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Ledger</h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Date</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Description</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Category</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Account</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Amount</th>
              <th className="px-6 py-3 text-sm font-medium text-slate-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Loading transactions...
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No transactions found. Add your first transaction!
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const cat = getCategoryName(tx.categoryId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{tx.description}</div>
                      {tx.merchant && <div className="text-xs text-slate-500">{tx.merchant}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {cat ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-sm">
                          {cat.icon} {cat.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {tx.account?.name || 'Unknown'}
                    </td>
                    <td className={`px-6 py-4 text-right font-medium ${tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => openEditModal(tx)}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Transaction' : 'Add Transaction'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="-50.00 or 100.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                <select
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Grocery shopping"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Merchant (optional)</label>
                <input
                  type="text"
                  value={form.merchant}
                  onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                  placeholder="Whole Foods"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
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
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
