'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, PieChart, RefreshCw, ArrowRight, CreditCard, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api, Account, Transaction, Portfolio } from '@/lib/api';

interface Metrics {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  portfolioValue: number;
  savingsRate: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics>({
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    portfolioValue: 0,
    savingsRate: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load accounts, transactions, and portfolios in parallel
      const [accountsRes, transactionsRes, portfoliosRes] = await Promise.all([
        api.getAccounts().catch(() => [] as Account[]),
        api.getTransactions({ limit: 10 }).catch(() => [] as Transaction[]),
        api.getPortfolios().catch(() => [] as Portfolio[]),
      ]);

      setAccounts(accountsRes);
      setRecentTransactions(transactionsRes);

      // Calculate net worth from accounts
      const netWorth = accountsRes.reduce((sum: number, acc: Account) => {
        const balance = acc.balance || 0;
        // Credit cards are negative (liabilities)
        if (acc.type === 'credit' || acc.type === 'loan') {
          return sum - Math.abs(balance);
        }
        return sum + balance;
      }, 0);

      // Calculate portfolio value
      const portfolioValue = portfoliosRes.reduce((sum: number, p: Portfolio) => {
        const holdingsValue = p.holdings?.reduce((hSum: number, h) => {
          return hSum + (h.shares * (h.currentPrice || h.costBasis / h.shares));
        }, 0) || 0;
        return sum + holdingsValue;
      }, 0);

      // Calculate monthly income/expenses (current month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyTransactions = transactionsRes.filter(
        (t: Transaction) => new Date(t.date) >= startOfMonth
      );
      
      const monthlyIncome = monthlyTransactions
        .filter((t: Transaction) => t.amount > 0)
        .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
      
      const monthlyExpenses = monthlyTransactions
        .filter((t: Transaction) => t.amount < 0)
        .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);

      const savingsRate = monthlyIncome > 0 
        ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 
        : 0;

      setMetrics({
        netWorth: netWorth + portfolioValue,
        monthlyIncome,
        monthlyExpenses,
        portfolioValue,
        savingsRate: Math.round(savingsRate),
      });
    } catch (e) {
      setError('Failed to load dashboard data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const cards = [
    { 
      label: 'Net Worth', 
      value: metrics.netWorth, 
      icon: Wallet, 
      color: 'bg-emerald-500',
      href: '/net-worth'
    },
    { 
      label: 'Monthly Income', 
      value: metrics.monthlyIncome, 
      icon: TrendingUp, 
      color: 'bg-blue-500',
      href: '/ledger'
    },
    { 
      label: 'Monthly Expenses', 
      value: metrics.monthlyExpenses, 
      icon: TrendingDown, 
      color: 'bg-red-500',
      href: '/ledger'
    },
    { 
      label: 'Portfolio Value', 
      value: metrics.portfolioValue, 
      icon: PieChart, 
      color: 'bg-purple-500',
      href: '/portfolio'
    },
  ];

  const formatCurrency = (amount: number) => {
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</p>
        </div>
        <button
          onClick={loadDashboardData}
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link 
              key={card.label} 
              href={card.href}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-600 text-sm">{card.label}</span>
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {loading ? (
                  <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
                ) : (
                  formatCurrency(card.value)
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Savings Rate Banner */}
      {!loading && metrics.monthlyIncome > 0 && (
        <div className={`rounded-xl p-4 ${metrics.savingsRate >= 20 ? 'bg-emerald-50 border border-emerald-200' : metrics.savingsRate >= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Monthly Savings Rate</p>
              <p className="text-2xl font-bold">{metrics.savingsRate}%</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>Saving {formatCurrency(metrics.monthlyIncome - metrics.monthlyExpenses)}</p>
              <p>of {formatCurrency(metrics.monthlyIncome)} income</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
            <Link href="/ledger" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-1" />
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 mb-3">No transactions yet</p>
              <Link 
                href="/ledger" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Add your first transaction
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTransactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    {tx.category && (
                      <div 
                        className="w-1.5 h-6 rounded-full"
                        style={{ backgroundColor: tx.category.color || '#6B7280' }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                      <p className="text-xs text-slate-500">
                        {tx.category?.name || 'Uncategorized'} • {formatDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm ${tx.amount > 0 ? 'text-emerald-600 font-medium' : 'text-slate-900'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accounts Overview */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Accounts</h2>
            <Link href="/accounts" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Manage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-1" />
                  <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 mb-3">No accounts yet</p>
              <Link 
                href="/accounts" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Add an account
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.slice(0, 5).map((account) => {
                const isLiability = account.type === 'credit' || account.type === 'loan';
                return (
                  <div key={account.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLiability ? 'bg-red-100' : 'bg-emerald-100'}`}>
                        {isLiability ? (
                          <CreditCard className={`w-4 h-4 ${isLiability ? 'text-red-600' : 'text-emerald-600'}`} />
                        ) : (
                          <Building2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${isLiability ? 'text-red-600' : 'text-slate-900'}`}>
                      {isLiability ? '-' : ''}{formatCurrency(Math.abs(account.balance || 0))}
                    </span>
                  </div>
                );
              })}
              {accounts.length > 5 && (
                <p className="text-xs text-slate-500 text-center pt-1">
                  +{accounts.length - 5} more accounts
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
