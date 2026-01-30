// API Client - connects to Fastify backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL || 'http://localhost:5001';
const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL || 'http://localhost:6000';

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'loan' | 'cash';
  institution?: string;
  currency: string;
  balance?: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  notes?: string;
  account?: Account;
  category?: Category;
  splits?: TransactionSplit[];
}

export interface TransactionSplit {
  id: string;
  categoryId?: string;
  amount: number;
  category?: Category;
}

export interface BudgetMonth {
  id: string;
  month: string;
  notes?: string;
  envelopes: BudgetEnvelope[];
}

export interface BudgetEnvelope {
  id: string;
  categoryId: string;
  assigned: number;
  spent?: number;
  category?: Category;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: Holding[];
  targets?: AllocationTarget[];
  snapshots?: PerformanceSnapshot[];
}

export interface Holding {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice?: number;
  marketValue?: number;
}

export interface Trade {
  id: string;
  portfolioId: string;
  holdingId?: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  price: number;
  fees: number;
  date: string;
}

export interface AllocationTarget {
  id: string;
  assetClass: string;
  targetPct: number;
}

export interface PerformanceSnapshot {
  id: string;
  date: string;
  totalValue: number;
  totalCost: number;
  dayReturn: number;
}

export interface ImportBatch {
  id: string;
  filename: string;
  status: 'staged' | 'committed' | 'rolledback';
  rowCount: number;
  createdAt: string;
  committedAt?: string;
}

export interface ImportRow {
  id: string;
  rowNumber: number;
  rawData: any;
  isDupe: boolean;
  categoryId?: string;
}

export interface AgentRun {
  id: string;
  workflow: string;
  status: string;
  output?: any;
  startedAt: string;
  finishedAt?: string;
  steps?: AgentStep[];
}

export interface AgentStep {
  id: string;
  agent: string;
  action: string;
  input: any;
  output: any;
  evidenceIds: string[];
}

class ApiClient {
  private token: string | null = null;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('fpm_token');
    }
  }
  
  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('fpm_token', token);
      } else {
        localStorage.removeItem('fpm_token');
      }
    }
  }
  
  getToken(): string | null {
    return this.token;
  }
  
  private async request<T>(
    url: string,
    options: RequestInit = {},
    baseUrl = API_URL
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers
    });
    
    if (response.status === 401) {
      this.setToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }
  
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const result = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(result.token);
    return result;
  }
  
  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }
  
  logout() {
    this.setToken(null);
  }
  
  // Accounts
  async getAccounts(): Promise<Account[]> {
    return this.request<Account[]>('/accounts');
  }
  
  async createAccount(data: Omit<Account, 'id'>): Promise<Account> {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async updateAccount(id: string, data: Partial<Account>): Promise<Account> {
    return this.request<Account>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async deleteAccount(id: string): Promise<void> {
    return this.request<void>(`/accounts/${id}`, { method: 'DELETE' });
  }
  
  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }
  
  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async deleteCategory(id: string): Promise<void> {
    return this.request<void>(`/categories/${id}`, { method: 'DELETE' });
  }
  
  // Transactions
  async getTransactions(params?: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    const searchParams = new URLSearchParams();
    if (params?.accountId) searchParams.set('accountId', params.accountId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    
    const query = searchParams.toString();
    return this.request<Transaction[]>(`/transactions${query ? `?${query}` : ''}`);
  }
  
  async createTransaction(data: {
    accountId: string;
    categoryId?: string;
    date: string;
    description: string;
    merchant?: string;
    amount: number;
    notes?: string;
    splits?: { categoryId: string; amount: number }[];
  }): Promise<Transaction> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async deleteTransaction(id: string): Promise<void> {
    return this.request<void>(`/transactions/${id}`, { method: 'DELETE' });
  }
  
  // Budgets
  async getBudget(month: string): Promise<BudgetMonth> {
    return this.request<BudgetMonth>(`/budgets/${month}`);
  }
  
  async upsertEnvelope(month: string, categoryId: string, assigned: number): Promise<BudgetEnvelope> {
    return this.request<BudgetEnvelope>(`/budgets/${month}/envelopes`, {
      method: 'POST',
      body: JSON.stringify({ categoryId, assigned })
    });
  }
  
  async getBudgetSpending(month: string): Promise<{ categoryId: string; spent: number }[]> {
    return this.request<{ categoryId: string; spent: number }[]>(`/budgets/${month}/spending`);
  }
  
  // Imports
  async getImports(): Promise<ImportBatch[]> {
    return this.request<ImportBatch[]>('/imports');
  }
  
  async stageImport(filename: string, rows: any[]): Promise<{ batchId: string; total: number; duplicates: number }> {
    return this.request('/imports/stage', {
      method: 'POST',
      body: JSON.stringify({ filename, rows })
    });
  }
  
  async getImportRows(batchId: string): Promise<ImportRow[]> {
    return this.request<ImportRow[]>(`/imports/${batchId}/rows`);
  }
  
  async commitImport(batchId: string, accountId: string): Promise<{ committed: number }> {
    return this.request(`/imports/${batchId}/commit`, {
      method: 'POST',
      body: JSON.stringify({ accountId })
    });
  }
  
  async rollbackImport(batchId: string): Promise<void> {
    return this.request(`/imports/${batchId}/rollback`, { method: 'POST' });
  }
  
  // Portfolios
  async getPortfolios(): Promise<Portfolio[]> {
    return this.request<Portfolio[]>('/portfolios');
  }
  
  async getPortfolio(id: string): Promise<Portfolio> {
    return this.request<Portfolio>(`/portfolios/${id}`);
  }
  
  async createPortfolio(data: { name: string }): Promise<Portfolio> {
    return this.request<Portfolio>('/portfolios', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async addHolding(portfolioId: string, data: { symbol: string; shares: number; costBasis: number }): Promise<Holding> {
    return this.request<Holding>(`/portfolios/${portfolioId}/holdings`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async addTrade(portfolioId: string, data: {
    symbol: string;
    type: 'buy' | 'sell' | 'dividend';
    shares: number;
    price: number;
    fees?: number;
    date: string;
  }): Promise<Trade> {
    return this.request<Trade>(`/portfolios/${portfolioId}/trades`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async getLatestPrices(symbols: string[]): Promise<{ symbol: string; price: number; date: string }[]> {
    return this.request(`/prices/latest?symbols=${symbols.join(',')}`);
  }
  
  // Insights
  async getInsights(): Promise<any[]> {
    return this.request('/insights');
  }
  
  // Decisions
  async getDecisions(): Promise<any[]> {
    return this.request('/decisions');
  }
  
  async logDecision(decision: string, reasoning: string, outcome?: string): Promise<any> {
    return this.request('/decisions', {
      method: 'POST',
      body: JSON.stringify({ decision, reasoning, outcome })
    });
  }
  
  // Agent runs
  async getAgentRuns(): Promise<AgentRun[]> {
    return this.request('/agent-runs');
  }
  
  // Analytics (separate service)
  async getNetWorth(): Promise<{ net_worth: number; assets: number; liabilities: number }> {
    return this.request('/metrics/net-worth', {}, ANALYTICS_URL);
  }
  
  async getCashflow(months = 6): Promise<{ data: { month: string; income: number; expenses: number; net: number }[] }> {
    return this.request(`/metrics/cashflow?months=${months}`, {}, ANALYTICS_URL);
  }
  
  async getBurnRate(): Promise<{ avg_burn_rate: number; min_month: number; max_month: number }> {
    return this.request('/metrics/burn-rate', {}, ANALYTICS_URL);
  }
  
  async getPortfolioSummary(): Promise<{ total_value: number; total_cost: number; return_pct: number }> {
    return this.request('/metrics/portfolio-summary', {}, ANALYTICS_URL);
  }
  
  // Agents (separate service)
  async runWorkflow(workflow: string, params?: any): Promise<{ run_id: string; status: string; output?: any }> {
    return this.request('/run', {
      method: 'POST',
      body: JSON.stringify({ workflow, params })
    }, AGENTS_URL);
  }
  
  async chat(message: string): Promise<{ response: string; evidence_ids?: string[] }> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    }, AGENTS_URL);
  }
}

export const api = new ApiClient();
export default api;
