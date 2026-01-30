'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { Portfolio, Holding } from '@/lib/api';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react';

interface HoldingWithValue extends Holding {
  currentPrice: number;
  marketValue: number;
  gain: number;
  gainPct: number;
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [holdings, setHoldings] = useState<HoldingWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    type: 'buy' as 'buy' | 'sell',
    shares: '',
    price: '',
    fees: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

  const loadPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPortfolios();
      setPortfolios(data);
      if (data.length > 0 && !selectedPortfolio) {
        setSelectedPortfolio(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedPortfolio]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  useEffect(() => {
    if (!selectedPortfolio) {
      setHoldings([]);
      return;
    }

    // Calculate holdings with current values
    // For now, use a simple mock price or stored cost basis
    const holdingsWithValues = selectedPortfolio.holdings?.map(h => {
      const shares = Number(h.shares) || 0;
      const costBasis = Number(h.costBasis) || 0;
      // Use cost basis per share as approximate price (in production, fetch real prices)
      const avgCost = shares > 0 ? costBasis / shares : 0;
      const currentPrice = avgCost * (1 + (Math.random() * 0.2 - 0.1)); // Mock ±10%
      const marketValue = shares * currentPrice;
      const gain = marketValue - costBasis;
      const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
      
      return {
        ...h,
        shares,
        costBasis,
        currentPrice,
        marketValue,
        gain,
        gainPct
      };
    }) || [];
    
    setHoldings(holdingsWithValues);
  }, [selectedPortfolio]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    
    setSaving(true);
    try {
      const portfolio = await api.createPortfolio({ name: newPortfolioName });
      setPortfolios([...portfolios, portfolio]);
      setSelectedPortfolio(portfolio);
      setShowAddPortfolio(false);
      setNewPortfolioName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio) return;
    
    setSaving(true);
    try {
      await api.addTrade(selectedPortfolio.id, {
        symbol: tradeForm.symbol.toUpperCase(),
        type: tradeForm.type,
        shares: parseFloat(tradeForm.shares),
        price: parseFloat(tradeForm.price),
        fees: parseFloat(tradeForm.fees) || 0,
        date: tradeForm.date
      });
      
      // Reload portfolio
      const updated = await api.getPortfolio(selectedPortfolio.id);
      if (updated) {
        setSelectedPortfolio(updated);
        setPortfolios(portfolios.map(p => p.id === updated.id ? updated : p));
      }
      
      setShowAddTrade(false);
      setTradeForm({
        symbol: '',
        type: 'buy',
        shares: '',
        price: '',
        fees: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add trade');
    } finally {
      setSaving(false);
    }
  };

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
          {portfolios.length > 0 && (
            <select
              value={selectedPortfolio?.id || ''}
              onChange={(e) => setSelectedPortfolio(portfolios.find(p => p.id === e.target.value) || null)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddPortfolio(true)}
            className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            New Portfolio
          </button>
          {selectedPortfolio && (
            <button
              onClick={() => setShowAddTrade(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              Add Trade
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!selectedPortfolio ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500 mb-4">No portfolios yet. Create one to start tracking!</p>
          <button
            onClick={() => setShowAddPortfolio(true)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
          >
            Create Portfolio
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Total Value</div>
              <div className="text-2xl font-bold text-slate-900">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Total Cost</div>
              <div className="text-2xl font-bold text-slate-700">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Total Gain/Loss</div>
              <div className={`text-2xl font-bold flex items-center gap-2 ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalGain >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Total Return</div>
              <div className={`text-2xl font-bold ${totalReturnPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Symbol</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Shares</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Price</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Market Value</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Cost Basis</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Gain/Loss</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-slate-600">Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No holdings yet. Add a trade to get started!
                    </td>
                  </tr>
                ) : (
                  holdings.map((h) => {
                    const pct = totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-900">{h.symbol}</td>
                        <td className="px-6 py-4 text-right">{h.shares.toFixed(4)}</td>
                        <td className="px-6 py-4 text-right">${h.currentPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-medium">${h.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-right text-slate-600">${h.costBasis.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className={`px-6 py-4 text-right font-medium ${h.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {h.gain >= 0 ? '+' : ''}${h.gain.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="text-xs ml-1">({h.gainPct >= 0 ? '+' : ''}{h.gainPct.toFixed(1)}%)</span>
                        </td>
                        <td className="px-6 py-4 text-right">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Portfolio Modal */}
      {showAddPortfolio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Create Portfolio</h2>
              <button onClick={() => setShowAddPortfolio(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreatePortfolio} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="My Investments"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddPortfolio(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400">
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Trade Modal */}
      {showAddTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Trade</h2>
              <button onClick={() => setShowAddTrade(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddTrade} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={tradeForm.symbol}
                    onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value })}
                    placeholder="AAPL"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={tradeForm.type}
                    onChange={(e) => setTradeForm({ ...tradeForm, type: e.target.value as 'buy' | 'sell' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Shares</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={tradeForm.shares}
                    onChange={(e) => setTradeForm({ ...tradeForm, shares: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price per Share</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tradeForm.price}
                    onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={tradeForm.date}
                    onChange={(e) => setTradeForm({ ...tradeForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fees (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tradeForm.fees}
                    onChange={(e) => setTradeForm({ ...tradeForm, fees: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddTrade(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400">
                  {saving ? 'Adding...' : 'Add Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
