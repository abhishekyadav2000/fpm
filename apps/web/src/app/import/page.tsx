'use client';

import { useState, useEffect } from 'react';
import api, { Account } from '@/lib/api';
import { Upload, CheckCircle, AlertCircle, FileText, X, Eye } from 'lucide-react';

interface ParsedRow {
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  raw: Record<string, string>;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'staged' | 'committing' | 'committed' | 'error'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [stagedCount, setStagedCount] = useState(0);
  const [dupeCount, setDupeCount] = useState(0);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < headers.length) continue;

      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => {
        raw[h] = values[idx]?.trim() || '';
      });

      // Try to detect columns
      const dateCol = headers.find(h => h.includes('date')) || headers[0];
      const descCol = headers.find(h => h.includes('desc') || h.includes('memo') || h.includes('payee')) || headers[1];
      const amountCol = headers.find(h => h.includes('amount')) || headers[2];
      const merchantCol = headers.find(h => h.includes('merchant') || h.includes('vendor'));

      const amount = parseFloat(raw[amountCol]?.replace(/[$,]/g, '') || '0');
      
      rows.push({
        date: raw[dateCol] || '',
        description: raw[descCol] || 'Unknown',
        merchant: merchantCol ? raw[merchantCol] : undefined,
        amount: isNaN(amount) ? 0 : amount,
        raw
      });
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setStatus('parsing');
    setError('');

    try {
      const text = await f.text();
      const rows = parseCSV(text);
      setParsedRows(rows);
      setStatus('idle');
    } catch (err) {
      setError('Failed to parse CSV file');
      setStatus('error');
    }
  };

  const handleStage = async () => {
    if (!file || parsedRows.length === 0) return;

    setStatus('parsing');
    setError('');

    try {
      const result = await api.stageImport(file.name, parsedRows.map(r => ({
        date: r.date,
        description: r.description,
        merchant: r.merchant,
        amount: r.amount
      })));

      setBatchId(result.batchId);
      setStagedCount(result.total);
      setDupeCount(result.duplicates);
      setStatus('staged');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage import');
      setStatus('error');
    }
  };

  const handleCommit = async () => {
    if (!batchId || !selectedAccountId) return;

    setStatus('committing');
    setError('');

    try {
      await api.commitImport(batchId, selectedAccountId);
      setStatus('committed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit import');
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setBatchId(null);
    setStagedCount(0);
    setDupeCount(0);
    setStatus('idle');
    setError('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Import Transactions</h1>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {status === 'committed' ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
          <div>
            <div className="font-semibold text-emerald-800">Import Successful!</div>
            <div className="text-emerald-600">{stagedCount - dupeCount} transactions imported.</div>
          </div>
          <button
            onClick={reset}
            className="ml-auto bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            Import More
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">Upload a CSV file with your transactions</p>
              <p className="text-sm text-slate-500 mb-4">
                Expected columns: date, description/memo, amount (merchant optional)
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block bg-emerald-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-emerald-700"
              >
                Select CSV File
              </label>
              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4" />
                  {file.name}
                  <button onClick={reset} className="p-1 hover:bg-slate-100 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {parsedRows.length > 0 && (status === 'idle' || status === 'parsing') && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Parsed {parsedRows.length} rows</h2>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:underline"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide' : 'Preview'}
                </button>
              </div>

              {showPreview && (
                <div className="max-h-64 overflow-auto mb-4 border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.description}</td>
                          <td className={`px-3 py-2 text-right ${row.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                            ${Math.abs(row.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 20 && (
                    <div className="text-center text-sm text-slate-500 py-2">
                      ...and {parsedRows.length - 20} more rows
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleStage}
                disabled={status === 'parsing'}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
              >
                {status === 'parsing' ? 'Processing...' : 'Stage Import'}
              </button>
            </div>
          )}

          {(status === 'staged' || status === 'committing') && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-lg mb-4">Ready to Import</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-700">{stagedCount - dupeCount}</div>
                  <div className="text-sm text-emerald-600">New transactions</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-amber-700">{dupeCount}</div>
                  <div className="text-sm text-amber-600">Duplicates (will skip)</div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Import to Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={!selectedAccountId || status === 'committing'}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400"
                >
                  {status === 'committing' ? 'Importing...' : 'Commit Import'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
