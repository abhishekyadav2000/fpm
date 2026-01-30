'use client';

import { useEffect, useState } from 'react';
import { 
  Gem, 
  RefreshCw, 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  PiggyBank, 
  Shield, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Wallet,
  LineChart,
  Zap,
  Filter,
  Clock,
  Target,
  ArrowRight,
  Brain
} from 'lucide-react';
import AdvisorPanel from '@/components/AdvisorPanel';

interface MinedInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'achievement' | 'tip' | 'pattern' | 'anomaly';
  category: 'spending' | 'savings' | 'investments' | 'debt' | 'income';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action?: string;
  evidence?: string;
  confidence: number;
}

interface MiningResult {
  run_id: string;
  insights: MinedInsight[];
  total_count: number;
  focus_areas: string[];
  generated_at: string;
}

const FOCUS_OPTIONS = [
  { id: 'all', label: 'All Areas', icon: Target },
  { id: 'spending', label: 'Spending', icon: Wallet },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'investments', label: 'Investments', icon: LineChart },
  { id: 'anomalies', label: 'Anomalies', icon: Zap },
];

export default function InsightsPage() {
  const [insights, setInsights] = useState<MinedInsight[]>([]);
  const [mining, setMining] = useState(false);
  const [lastMined, setLastMined] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<string[]>(['all']);
  const [filterImpact, setFilterImpact] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const mineInsights = async () => {
    setMining(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mine-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default',
          depth: 'standard',
          focus_areas: focusAreas.includes('all') ? ['spending', 'savings', 'investments', 'anomalies'] : focusAreas
        })
      });
      
      if (!response.ok) throw new Error('Mining failed');
      
      const result: MiningResult = await response.json();
      setInsights(result.insights || []);
      setLastMined(result.generated_at);
    } catch (e) {
      setError('Failed to mine insights. Make sure the AI service is running.');
      // Load placeholder insights
      setInsights([
        {
          id: '1',
          type: 'tip',
          category: 'spending',
          title: 'Start Tracking',
          description: 'Add your transactions to get personalized insights about your spending patterns.',
          impact: 'medium',
          action: 'Go to Ledger',
          confidence: 1.0
        },
        {
          id: '2',
          type: 'tip',
          category: 'savings',
          title: 'Set Savings Goals',
          description: 'Create budget envelopes to track your savings progress toward specific goals.',
          impact: 'medium',
          action: 'Go to Budgets',
          confidence: 1.0
        },
        {
          id: '3',
          type: 'opportunity',
          category: 'investments',
          title: 'Track Investments',
          description: 'Add your portfolio holdings to monitor performance and allocation.',
          impact: 'medium',
          action: 'Go to Portfolio',
          confidence: 1.0
        },
      ]);
    } finally {
      setMining(false);
    }
  };

  useEffect(() => {
    mineInsights();
  }, []);

  const toggleFocus = (focus: string) => {
    if (focus === 'all') {
      setFocusAreas(['all']);
    } else {
      const newFocus = focusAreas.filter(f => f !== 'all');
      if (newFocus.includes(focus)) {
        const filtered = newFocus.filter(f => f !== focus);
        setFocusAreas(filtered.length > 0 ? filtered : ['all']);
      } else {
        setFocusAreas([...newFocus, focus]);
      }
    }
  };

  const filteredInsights = insights.filter(insight => {
    if (filterImpact && insight.impact !== filterImpact) return false;
    if (filterCategory && insight.category !== filterCategory) return false;
    return true;
  });

  const getTypeIcon = (type: MinedInsight['type']) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'achievement':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'pattern':
        return <Brain className="w-5 h-5" />;
      case 'anomaly':
        return <Zap className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: MinedInsight['type']) => {
    switch (type) {
      case 'opportunity':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'achievement':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pattern':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'anomaly':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const getCategoryIcon = (category: MinedInsight['category']) => {
    switch (category) {
      case 'spending':
        return <Wallet className="w-4 h-4" />;
      case 'savings':
        return <PiggyBank className="w-4 h-4" />;
      case 'investments':
        return <LineChart className="w-4 h-4" />;
      case 'income':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  const getImpactBadge = (impact: MinedInsight['impact']) => {
    const colors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700'
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[impact]}`}>
        {impact}
      </span>
    );
  };

  // Count insights by type for summary
  const insightStats = {
    opportunities: insights.filter(i => i.type === 'opportunity').length,
    warnings: insights.filter(i => i.type === 'warning').length,
    achievements: insights.filter(i => i.type === 'achievement').length,
    highImpact: insights.filter(i => i.impact === 'high').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Gem className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Insight Miner</h1>
            <p className="text-slate-600">AI-powered financial pattern detection</p>
          </div>
        </div>
        <button
          onClick={mineInsights}
          disabled={mining}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
        >
          {mining ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Mining Insights...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Mine New Insights
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Focus Area Selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
          <Filter className="w-4 h-4" />
          <span>Focus Areas</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map(option => {
            const isActive = focusAreas.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleFocus(option.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent'
                }`}
              >
                <option.icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Summary */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Opportunities</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{insightStats.opportunities}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Warnings</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{insightStats.warnings}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Achievements</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{insightStats.achievements}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-sm">High Impact</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{insightStats.highImpact}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Insights Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterImpact(null)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                !filterImpact ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Impact
            </button>
            {['high', 'medium', 'low'].map(impact => (
              <button
                key={impact}
                onClick={() => setFilterImpact(filterImpact === impact ? null : impact)}
                className={`text-xs px-3 py-1.5 rounded-full capitalize transition-all ${
                  filterImpact === impact ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {impact}
              </button>
            ))}
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button
              onClick={() => setFilterCategory(null)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                !filterCategory ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {['spending', 'savings', 'investments', 'income'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={`text-xs px-3 py-1.5 rounded-full capitalize transition-all ${
                  filterCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {mining ? (
            <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <Gem className="w-8 h-8 text-purple-600 animate-bounce" />
              </div>
              <h3 className="font-semibold text-lg text-slate-900 mb-2">Mining Insights...</h3>
              <p className="text-slate-600">Analyzing your financial data for patterns and opportunities</p>
              <div className="mt-6 flex justify-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-100" />
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse delay-200" />
              </div>
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
              <Gem className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">No insights found</h3>
              <p className="text-slate-600 mb-4">
                {insights.length > 0 ? 'Try adjusting your filters.' : 'Add financial data to get started.'}
              </p>
              {insights.length === 0 && (
                <button
                  onClick={mineInsights}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Sparkles className="w-4 h-4" />
                  Mine Insights
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all group"
                >
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTypeColor(insight.type)}`}>
                      {getTypeIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{insight.title}</h3>
                        {getImpactBadge(insight.impact)}
                      </div>
                      <p className="text-slate-600 text-sm mb-3">{insight.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1 capitalize">
                            {getCategoryIcon(insight.category)}
                            {insight.category}
                          </span>
                          {insight.evidence && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {insight.evidence}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {(insight.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        {insight.action && (
                          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {insight.action}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last mined timestamp */}
          {lastMined && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
              <Clock className="w-3 h-3" />
              Last mined: {new Date(lastMined).toLocaleString()}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Advisor */}
          <AdvisorPanel />

          {/* How Insight Miner Works */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Gem className="w-5 h-5 text-purple-400" />
              How It Works
            </h2>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">1</div>
                <div>
                  <div className="font-medium">Data Collection</div>
                  <p className="text-slate-400">Aggregates your transactions, budgets, and investments</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">2</div>
                <div>
                  <div className="font-medium">Pattern Analysis</div>
                  <p className="text-slate-400">AI identifies trends, anomalies, and opportunities</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">3</div>
                <div>
                  <div className="font-medium">Evidence Grounding</div>
                  <p className="text-slate-400">All insights are backed by your actual data</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">4</div>
                <div>
                  <div className="font-medium">Actionable Output</div>
                  <p className="text-slate-400">Ranked recommendations with impact scores</p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-emerald-900 mb-1">Your Data Stays Local</h3>
                <p className="text-sm text-emerald-700">
                  All analysis runs on your local machine using Ollama. No financial data is sent to external servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
