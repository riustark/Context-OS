'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Search, 
  Download, 
  RefreshCw, 
  X, 
  Copy, 
  Check, 
  ArrowUpDown, 
  Play
} from 'lucide-react';

interface RunRecord {
  id: number;
  request_id: string;
  timestamp: string;
  task_type: string;
  model: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  compression_ratio: number;
  evaluation_score?: number | null;
  status: string;
  error_type?: string | null;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'latency' | 'tokens' | 'compression'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeRunModal, setActiveRunModal] = useState<RunRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    try {
      const res = await fetch(`${apiHost}/v1/runs`, { cache: 'no-store' });
      if (res.ok) {
        const data: RunRecord[] = await res.json();
        setRuns(data || []);
      } else {
        setRuns([]);
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchRuns();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchRuns]);

  // Filter & Sort
  const filteredAndSortedRuns = useMemo(() => {
    const filtered = runs.filter((run) => {
      const matchesTask = selectedTask === 'all' || (run.task_type || '').toLowerCase() === selectedTask.toLowerCase();
      const matchesStatus = selectedStatus === 'all' || (run.status || '').toLowerCase() === selectedStatus.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        (run.request_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (run.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (run.task_type || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTask && matchesStatus && matchesSearch;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'timestamp') {
        comparison = new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      } else if (sortBy === 'latency') {
        comparison = (b.latency_ms || 0) - (a.latency_ms || 0);
      } else if (sortBy === 'tokens') {
        comparison = ((b.input_tokens || 0) + (b.output_tokens || 0)) - ((a.input_tokens || 0) + (a.output_tokens || 0));
      } else if (sortBy === 'compression') {
        comparison = (b.compression_ratio || 0) - (a.compression_ratio || 0);
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });
  }, [runs, selectedTask, selectedStatus, searchQuery, sortBy, sortOrder]);

  const toggleSort = (field: 'timestamp' | 'latency' | 'tokens' | 'compression') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const copyRequestId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export to JSON
  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(runs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `contextos-runs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['id', 'request_id', 'timestamp', 'task_type', 'model', 'prompt_version', 'input_tokens', 'output_tokens', 'latency_ms', 'compression_ratio', 'status'];
    const rows = runs.map((r) => [
      r.id,
      r.request_id,
      r.timestamp,
      r.task_type,
      r.model,
      r.prompt_version,
      r.input_tokens,
      r.output_tokens,
      r.latency_ms,
      r.compression_ratio,
      r.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `contextos-runs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getTaskBadgeStyle = (task: string) => {
    switch ((task || '').toLowerCase()) {
      case 'code':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'structured_extraction':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'analytical':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'creative':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'factual':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 p-6 rounded-3xl border border-slate-200/80 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Execution Run Trace Logs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              {filteredAndSortedRuns.length} Total Runs
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            End-to-end tracing across Gatekeeper context budgets, policy routing, latency, and token consumption.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportJSON}
            disabled={runs.length === 0}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>

          <button
            onClick={exportCSV}
            disabled={runs.length === 0}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          <button
            onClick={fetchRuns}
            className="px-3.5 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Request ID, Model, or Task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        {/* Task and Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span>Task:</span>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
            >
              <option value="all">All Tasks</option>
              <option value="code">Code</option>
              <option value="structured_extraction">Structured Extraction</option>
              <option value="analytical">Analytical</option>
              <option value="creative">Creative</option>
              <option value="factual">Factual</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span>Sort:</span>
            <button
              onClick={() => toggleSort('latency')}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                sortBy === 'latency' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              Latency <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs font-bold text-slate-500 animate-pulse">
            Loading run telemetry traces...
          </div>
        ) : filteredAndSortedRuns.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <Layers className="w-12 h-12 mx-auto text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No execution runs recorded yet.</p>
            <p className="max-w-md mx-auto">
              Execute queries from the <Link href="/" className="text-indigo-600 font-bold underline">Prompt Studio</Link> or send requests to <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">POST /v1/chat</code> to populate real telemetry records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">Request ID</th>
                  <th className="py-4 px-4">Task & Policy</th>
                  <th className="py-4 px-4">Model</th>
                  <th className="py-4 px-4">Tokens (In / Out)</th>
                  <th className="py-4 px-4 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('latency')}>
                    <div className="flex items-center gap-1">
                      Latency {sortBy === 'latency' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="py-4 px-4 cursor-pointer hover:text-indigo-600" onClick={() => toggleSort('compression')}>
                    <div className="flex items-center gap-1">
                      Compression {sortBy === 'compression' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="py-4 px-4">Score</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredAndSortedRuns.map((run) => (
                  <tr
                    key={run.id || run.request_id}
                    onClick={() => setActiveRunModal(run)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-5 font-mono text-slate-900 font-bold flex items-center gap-2">
                      <span>{run.request_id.slice(0, 8)}...{run.request_id.slice(-4)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyRequestId(run.request_id);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                        title="Copy Request ID"
                      >
                        {copiedId === run.request_id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-lg border font-extrabold text-[10px] uppercase ${getTaskBadgeStyle(run.task_type)}`}>
                        {run.task_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {run.model}
                    </td>
                    <td className="py-4 px-4 text-slate-700 font-semibold font-mono">
                      {run.input_tokens} <span className="text-slate-300">/</span> {run.output_tokens}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-[11px] ${
                        run.latency_ms < 400
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : run.latency_ms < 900
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {run.latency_ms} ms
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {((run.compression_ratio || 1) * 100).toFixed(0)}%
                    </td>
                    <td className="py-4 px-4">
                      {run.evaluation_score != null ? (
                        <span className="font-bold text-indigo-600 font-mono">
                          {(run.evaluation_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        run.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRunModal(run);
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-[11px] text-slate-700 transition-all cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Inspector */}
      {activeRunModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 animate-pulse" />
                <h3 className="text-lg font-black text-slate-900">Run Telemetry Diagnostics</h3>
              </div>
              <button
                onClick={() => setActiveRunModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Request ID Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 font-bold text-[10px] uppercase block">Request UUID</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{activeRunModal.request_id}</span>
                </div>
                <button
                  onClick={() => copyRequestId(activeRunModal.request_id)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-[11px] text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedId === activeRunModal.request_id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === activeRunModal.request_id ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Model Dispatched</span>
                  <span className="font-bold text-slate-900">{activeRunModal.model}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Task Type</span>
                  <span className="font-bold text-indigo-600">{activeRunModal.task_type}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Latency</span>
                  <span className="font-mono font-bold text-slate-900">{activeRunModal.latency_ms} ms</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Budget Retained</span>
                  <span className="font-bold text-emerald-600">{((activeRunModal.compression_ratio || 1) * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Raw JSON inspection */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Complete Execution Trace JSON
                </span>
                <pre className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-56">
                  {JSON.stringify(activeRunModal, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <Link
                href="/"
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Re-execute in Studio
              </Link>
              <button
                onClick={() => setActiveRunModal(null)}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
