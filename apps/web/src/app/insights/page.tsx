'use client';

import { useEffect, useState } from 'react';
import { Bot, RefreshCw, Lightbulb, AlertTriangle, TrendingUp, PiggyBank, Shield, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import AdvisorPanel from '@/components/AdvisorPanel';
import { api, AgentRun } from '@/lib/api';

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'tip' | 'achievement';
  title: string;
  description: string;
  action?: string;
  evidence?: string;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const runs = await api.getAgentRuns();
      setRecentRuns(runs.slice(0, 5));
      
      // Extract insights from completed runs
      const completedInsights: Insight[] = [];
      runs.forEach((run: AgentRun) => {
        if (run.status === 'completed' && run.output?.insights) {
          run.output.insights.forEach((insight: any, index: number) => {
            completedInsights.push({
              id: `${run.id}-${index}`,
              type: insight.type || 'tip',
              title: insight.title,
              description: insight.description,
              action: insight.action,
              evidence: insight.evidence,
            });
          });
        }
      });
      setInsights(completedInsights);
    } catch (e) {
      // Use placeholder insights if no agent runs yet
      setInsights([
        {
          id: '1',
          type: 'tip',
          title: 'Start by adding your accounts',
          description: 'Add your bank accounts, credit cards, and investment accounts to get started with tracking.',
          action: 'Go to Accounts',
        },
        {
          id: '2',
          type: 'tip',
          title: 'Import your transactions',
          description: 'Use the CSV import feature to quickly add historical transactions from your bank.',
          action: 'Go to Import',
        },
        {
          id: '3',
          type: 'opportunity',
          title: 'Set up a budget',
          description: 'Create envelope budgets to track spending by category and reach your savings goals.',
          action: 'Go to Budgets',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateNewInsights = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.runWorkflow('financial-advisor', { action: 'analyze' });
      // Poll for completion
      setTimeout(loadInsights, 3000);
    } catch (e) {
      setError('Failed to generate insights. Make sure the AI service is running.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'achievement':
        return <CheckCircle2 className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'achievement':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Insights</h1>
          <p className="text-slate-600">Personalized financial insights powered by local AI</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadInsights}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={generateNewInsights}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate New Insights
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Insights Area */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
              <Bot className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">No insights yet</h3>
              <p className="text-slate-600 mb-4">
                Add some financial data and generate insights using the AI advisor.
              </p>
              <button
                onClick={generateNewInsights}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Sparkles className="w-4 h-4" />
                Generate Insights
              </button>
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                className={`bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow`}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getInsightColor(insight.type)}`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{insight.title}</h3>
                    <p className="text-slate-600 text-sm mb-2">{insight.description}</p>
                    {insight.evidence && (
                      <p className="text-xs text-slate-400 mb-2">
                        Based on: {insight.evidence}
                      </p>
                    )}
                    {insight.action && (
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        {insight.action} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Chat */}
          <AdvisorPanel />

          {/* How It Works */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              How It Works
            </h2>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0 text-xs">1</div>
                <div>
                  <div className="font-medium text-slate-900">Local Analysis</div>
                  <p>All data stays on your machine</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0 text-xs">2</div>
                <div>
                  <div className="font-medium text-slate-900">Evidence Based</div>
                  <p>Insights backed by real data</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0 text-xs">3</div>
                <div>
                  <div className="font-medium text-slate-900">Safety Validated</div>
                  <p>Risk checks on all outputs</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0 text-xs">4</div>
                <div>
                  <div className="font-medium text-slate-900">Actionable</div>
                  <p>Personalized recommendations</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Agent Runs */}
          {recentRuns.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-lg mb-4">Recent AI Runs</h2>
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{run.workflow}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(run.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      run.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : run.status === 'running'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
