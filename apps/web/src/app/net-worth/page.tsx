'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Building2, Briefcase, CreditCard, PiggyBank, Wallet } from 'lucide-react';
import Link from 'next/link';
import { api, Account, Portfolio } from '@/lib/api';

const accountTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  checking: Building2,
  savings: PiggyBank,
  credit: CreditCard,
  investment: Briefcase,
  loan: CreditCard,
  cash: Wallet,
};

export default function NetWorthPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, portfoliosRes] = await Promise.all([
        api.getAccounts(),
        api.getPortfolios(),
      ]);
      setAccounts(accountsRes);
      setPortfolios(portfoliosRes);
    } catch (e) {
      setError('Failed to load data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate totals
  const portfolioValue = portfolios.reduce((sum, p) => {
    return sum + (p.holdings?.reduce((hSum, h) => {
      return hSum + (h.shares * (h.currentPrice || h.costBasis / h.shares));
    }, 0) || 0);
  }, 0);

  const assets = accounts.filter(a => (a.balance || 0) > 0 && a.type !== 'credit' && a.type !== 'loan');
  const liabilities = accounts.filter(a => a.type === 'credit' || a.type === 'loan' || (a.balance || 0) < 0);
  
  const totalAssets = assets.reduce((sum, a) => sum + (a.balance || 0), 0) + portfolioValue;
  const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const formatCurrency = (amount: number) => {
    return `$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Net Worth</h1>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Net Worth Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Total Assets</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          {loading ? (
            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAssets)}</div>
          )}
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Total Liabilities</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          {loading ? (
            <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-red-600">-{formatCurrency(totalLiabilities)}</div>
          )}
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-sm text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-100">Net Worth</span>
            <Wallet className="w-5 h-5 text-blue-100" />
          </div>
          {loading ? (
            <div className="h-8 w-32 bg-blue-400 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold">
              {netWorth >= 0 ? '' : '-'}{formatCurrency(netWorth)}
            </div>
          )}
        </div>
      </div>

      {/* Net Worth Breakdown Bar */}
      {!loading && totalAssets > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="font-semibold text-slate-900 mb-4">Breakdown</h2>
          <div className="h-8 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${(totalAssets / (totalAssets + totalLiabilities)) * 100}%` }}
            >
              {Math.round((totalAssets / (totalAssets + totalLiabilities)) * 100)}%
            </div>
            {totalLiabilities > 0 && (
              <div 
                className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${(totalLiabilities / (totalAssets + totalLiabilities)) * 100}%` }}
              >
                {Math.round((totalLiabilities / (totalAssets + totalLiabilities)) * 100)}%
              </div>
            )}
          </div>
          <div className="flex justify-between mt-2 text-sm text-slate-600">
            <span>Assets: {formatCurrency(totalAssets)}</span>
            <span>Liabilities: {formatCurrency(totalLiabilities)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-slate-900">Assets</h2>
            <Link href="/accounts" className="text-sm text-blue-600 hover:text-blue-700">
              Manage Accounts
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No asset accounts yet</p>
              <Link href="/accounts" className="text-blue-600 hover:text-blue-700">
                Add an account
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((acc) => {
                const Icon = accountTypeIcons[acc.type] || Building2;
                return (
                  <div key={acc.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{acc.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{acc.type}</div>
                      </div>
                    </div>
                    <span className="text-emerald-600 font-medium">
                      {formatCurrency(acc.balance || 0)}
                    </span>
                  </div>
                );
              })}
              
              {/* Portfolio as Asset */}
              {portfolios.length > 0 && portfolioValue > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Investments</div>
                      <div className="text-xs text-slate-500">{portfolios.length} portfolio(s)</div>
                    </div>
                  </div>
                  <span className="text-emerald-600 font-medium">
                    {formatCurrency(portfolioValue)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Liabilities */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-slate-900">Liabilities</h2>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : liabilities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No liabilities - great job! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liabilities.map((acc) => {
                const Icon = accountTypeIcons[acc.type] || CreditCard;
                return (
                  <div key={acc.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{acc.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{acc.type}</div>
                      </div>
                    </div>
                    <span className="text-red-600 font-medium">
                      -{formatCurrency(acc.balance || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
