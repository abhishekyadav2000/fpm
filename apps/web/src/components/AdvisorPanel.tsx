'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, AlertTriangle, Loader2, X, Maximize2, Minimize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  timestamp: Date;
}

interface AdvisorPanelProps {
  userId?: string;
  compact?: boolean;
}

// Use Next.js API routes as proxy (avoids CORS/localhost issues)
const API_BASE = '';

export default function AdvisorPanel({ userId = 'default', compact = false }: AdvisorPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [quickInsight, setQuickInsight] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load quick insight on mount
  useEffect(() => {
    loadQuickInsight();
  }, []);

  const loadQuickInsight = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/quick-insight?user_id=${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setQuickInsight(data.insight);
      }
    } catch (e) {
      // Silent fail - insight is optional
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        suggestions: data.suggestions,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      setError('AI service unavailable. Make sure Ollama is running.');
      // Add fallback message
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please make sure the AI service is running and try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const quickPrompts = [
    "How's my spending this month?",
    "Help me create a budget",
    "Investment tips",
    "How can I save more?",
  ];

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all z-50 animate-pulse hover:animate-none"
      >
        <Bot className="w-6 h-6 text-white" />
        <span className="text-white font-medium pr-1">Ask AI</span>
      </button>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col ${
      compact ? 'fixed bottom-6 right-6 w-96 h-[500px] z-50' : 'h-full min-h-[400px]'
    }`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-white" />
          <span className="font-semibold text-white">AI Advisor</span>
        </div>
        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            {quickInsight && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-left">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <p className="text-sm text-emerald-800">{quickInsight}</p>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500 mb-3">Ask me anything about your finances</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 text-slate-600"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {msg.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-xs px-2 py-1 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your finances..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
