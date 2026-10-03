'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  Copy, 
  Check, 
  Sliders, 
  Plus, 
  Trash2, 
  Play, 
  Terminal, 
  Database, 
  Clock,
  AlertTriangle
} from 'lucide-react';

interface MetricsSummary {
  total_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  avg_compression_ratio: number;
  pass_rate: number;
}

interface ContextItemInput {
  id: string;
  type: string;
  content: string;
  importance: number;
}

interface ChatResponseData {
  request_id: string;
  answer: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  metrics: {
    latency_ms: number;
    context_compression_ratio: number;
  };
  policy: {
    task_type: string;
    model: string;
    temperature: number;
    max_output_tokens?: number | null;
  };
}

const PRESETS = [
  {
    name: 'Code Generation (Python)',
    taskType: 'code',
    prompt: 'Write a clean Python function with type hints and error handling to process the provided data.',
    contexts: [
      { id: '1', type: 'code_snippet', content: 'def process_items(data: list) -> dict: # Target implementation', importance: 0.9 }
    ],
    maxTokens: 4000
  },
  {
    name: 'RAG Extraction (Structured)',
    taskType: 'structured_extraction',
    prompt: 'Extract all API endpoints, auth types, and rate limits defined in the provided architecture context.',
    contexts: [
      { id: '1', type: 'document', content: 'Architecture Spec: Gateway exposes /v1/chat (OAuth2, 100 req/min) and /v1/evaluate (Bearer token, 20 req/min).', importance: 1.0 }
    ],
    maxTokens: 4000
  },
  {
    name: 'Algorithm Tradeoffs (Analytical)',
    taskType: 'analytical',
    prompt: 'Compare B-Tree and LSM-Tree storage engines for write-heavy high-throughput analytical workloads.',
    contexts: [
      { id: '1', type: 'document', content: 'Database Engine requirements: 50,000 writes/sec, SSD storage, append-only WAL preference.', importance: 0.8 }
    ],
    maxTokens: 8000
  },
  {
    name: 'System Architecture (Creative)',
    taskType: 'creative',
    prompt: 'Design a resilient distributed token-bucket rate limiter with Redis and sliding window failover.',
    contexts: [
      { id: '1', type: 'document', content: 'Context: SLA 99.99%, max Redis latency 5ms, graceful degradation to local in-memory token bucket.', importance: 0.85 }
    ],
    maxTokens: 4000
  },
];

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'response' | 'policy' | 'json'>('response');

  // Interactive Playground State (Starts with empty input and clear placeholders)
  const [taskType, setTaskType] = useState<string>('code');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [contextItems, setContextItems] = useState<ContextItemInput[]>([]);
  const [maxTokens, setMaxTokens] = useState<number>(4000);
  const [executing, setExecuting] = useState<boolean>(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [chatResult, setChatResult] = useState<ChatResponseData | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // Approximate Token Estimator
  const estimatedInputTokens = useMemo(() => {
    const promptLen = userPrompt.length;
    const contextLen = contextItems.reduce((acc, curr) => acc + curr.content.length, 0);
    return Math.max(20, Math.round((promptLen + contextLen) / 3.8) + 40);
  }, [userPrompt, contextItems]);

  const fetchMetrics = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    try {
      const res = await fetch(`${apiHost}/v1/metrics`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setIsLiveApi(true);
      } else {
        setIsLiveApi(false);
      }
    } catch {
      setIsLiveApi(false);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchMetrics();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchMetrics]);

  const applyPreset = (presetIndex: number) => {
    const p = PRESETS[presetIndex];
    setTaskType(p.taskType);
    setUserPrompt(p.prompt);
    setContextItems(p.contexts.map(c => ({ ...c, id: Math.random().toString() })));
    setMaxTokens(p.maxTokens);
  };

  const addContextItem = () => {
    setContextItems([
      ...contextItems,
      {
        id: Math.random().toString(),
        type: 'document',
        content: '',
        importance: 0.8,
      },
    ]);
  };

  const removeContextItem = (id: string) => {
    setContextItems(contextItems.filter((item) => item.id !== id));
  };

  const updateContextItem = (id: string, field: keyof ContextItemInput, val: any) => {
    setContextItems(
      contextItems.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleCopy = () => {
    if (!chatResult?.answer) return;
    navigator.clipboard.writeText(chatResult.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecutePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setExecuting(true);
    setChatError(null);
    setChatResult(null);
    setPipelineStep(1);

    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    const formattedContext = contextItems
      .filter((c) => c.content.trim().length > 0)
      .map((c) => ({
        type: c.type,
        content: c.content,
        importance: Number(c.importance),
      }));

    try {
      setTimeout(() => setPipelineStep(2), 200);
      setTimeout(() => setPipelineStep(3), 400);

      const res = await fetch(`${apiHost}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          message: userPrompt,
          context: formattedContext,
          max_context_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Execution request failed' }));
        throw new Error(errData.detail || `Server returned status ${res.status}`);
      }

      const data: ChatResponseData = await res.json();
      setPipelineStep(4);
      setChatResult(data);
      fetchMetrics();
    } catch (err: any) {
      setPipelineStep(0);
      setChatError(err.message || 'Error communicating with ContextOS API');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 p-6 rounded-3xl border border-slate-200/80 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Operational Telemetry & Studio
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
              isLiveApi 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
              {isLiveApi ? '● Backend Live' : '● Backend Disconnected'}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Real-time pipeline monitoring, context budget compression, policy routing, and execution diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
              }`}
            />
            {autoRefresh ? 'Auto-Polling 5s' : 'Auto-Poll'}
          </button>

          <button
            onClick={() => fetchMetrics(true)}
            disabled={isRefreshing}
            className="px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Hero Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Invocations */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invocations
            </span>
            <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {metrics ? metrics.total_requests.toLocaleString() : '0'}
            </span>
            {metrics && metrics.total_requests > 0 && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {metrics?.total_requests ? `${metrics.total_requests} requests processed` : 'No runs recorded yet'}
          </div>
        </div>

        {/* Card 2: Latency Breakdown */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Avg & P95 Latency
            </span>
            <span className="p-2.5 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {metrics ? metrics.avg_latency_ms : 0} <span className="text-lg font-bold text-slate-500">ms</span>
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              (P95: {metrics ? metrics.p95_latency_ms : 0} ms)
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-violet-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, ((metrics?.avg_latency_ms || 0) / 1500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Token Economics */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Avg Token Budget
            </span>
            <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <Database className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {metrics ? metrics.avg_input_tokens : 0}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              in / {metrics ? metrics.avg_output_tokens : 0} out
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Total Avg / Req</span>
            <span className="font-semibold text-emerald-700">
              {metrics ? metrics.avg_input_tokens + metrics.avg_output_tokens : 0} tokens
            </span>
          </div>
        </div>

        {/* Card 4: Compression & Pass Rate */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Compression & Quality
            </span>
            <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {metrics ? `${((metrics.avg_compression_ratio ?? 1) * 100).toFixed(0)}%` : '—'}
            </span>
            {metrics && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Pass: {((metrics.pass_rate ?? 0) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {metrics ? 'Context budget compression active' : 'Awaiting executions'}
          </div>
        </div>
      </div>

      {/* Interactive Studio & Pipeline Execution Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Playground Studio */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div className="space-y-5">
            {/* Header & Presets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  Interactive Prompt & Context Studio
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inject context documents, set importance weights, and test live Gatekeeper routing.
                </p>
              </div>
              <div className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60 self-start sm:self-auto">
                Est: ~{estimatedInputTokens} tokens
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Quick Template Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p, idx) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(idx)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/70 transition-all cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleExecutePrompt} className="space-y-4">
              {/* Task Type & Context Budget Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Task Type (Policy Classification)
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="code">Code (High Quality, Low Temp 0.2)</option>
                    <option value="structured_extraction">Structured Extraction (JSON / Regex)</option>
                    <option value="analytical">Analytical (Deep Logic, Temp 0.1)</option>
                    <option value="creative">Creative (Ideation, High Temp 0.7)</option>
                    <option value="factual">Factual (Cost-Optimized Mini Model)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Max Context Token Budget
                  </label>
                  <select
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value={2000}>2,000 Tokens (High Compression)</option>
                    <option value={4000}>4,000 Tokens (Balanced Standard)</option>
                    <option value={8000}>8,000 Tokens (Large Document Window)</option>
                    <option value={16000}>16,000 Tokens (Extended Memory)</option>
                  </select>
                </div>
              </div>

              {/* User Prompt */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  User Message / Prompt Query
                </label>
                <textarea
                  rows={3}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Type your prompt query or instruction here, or select a template preset above..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed"
                />
              </div>

              {/* Dynamic Context Builder */}
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    Injected Context Documents ({contextItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={addContextItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Context Item
                  </button>
                </div>

                {contextItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No context documents attached. Click <strong>&quot;Add Context Item&quot;</strong> above to attach reference context.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {contextItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500">#{idx + 1}</span>
                            <select
                              value={item.type}
                              onChange={(e) => updateContextItem(item.id, 'type', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700"
                            >
                              <option value="document">Document</option>
                              <option value="code_snippet">Code Snippet</option>
                              <option value="memory">Memory</option>
                              <option value="system_rule">System Rule</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Weight: {item.importance}
                            </span>
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.1"
                              value={item.importance}
                              onChange={(e) => updateContextItem(item.id, 'importance', parseFloat(e.target.value))}
                              className="w-16 accent-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={() => removeContextItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={item.content}
                          onChange={(e) => updateContextItem(item.id, 'content', e.target.value)}
                          placeholder="Paste reference text, code snippet, or document context here..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Execution Button */}
              <button
                type="submit"
                disabled={executing || !userPrompt.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {executing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing ContextOS Pipeline Stage {pipelineStep}/4...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Dispatch Through Pipeline
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Diagnostics & Trace Inspector */}
        <div className="lg:col-span-5 space-y-5">
          {/* Visual Pipeline Stage Stepper */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-3">
              ContextOS Runtime Pipeline Stages
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
              <div className={`p-2.5 rounded-xl border transition-all ${
                pipelineStep >= 1
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs font-extrabold'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <div className="text-[9px] text-slate-400 uppercase">Stage 1</div>
                Gatekeeper
              </div>
              <div className={`p-2.5 rounded-xl border transition-all ${
                pipelineStep >= 2
                  ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-2xs font-extrabold'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <div className="text-[9px] text-slate-400 uppercase">Stage 2</div>
                Assembly Line
              </div>
              <div className={`p-2.5 rounded-xl border transition-all ${
                pipelineStep >= 3
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs font-extrabold'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <div className="text-[9px] text-slate-400 uppercase">Stage 3</div>
                Dispatcher
              </div>
            </div>
          </div>

          {/* Diagnostic Output Window */}
          <div className="bg-slate-900 rounded-3xl p-6 text-slate-100 shadow-xl border border-slate-800 flex flex-col justify-between min-h-[440px]">
            <div>
              {/* Output Header with Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${chatResult ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Execution Trace Output
                  </span>
                </div>

                {chatResult && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopy}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      {chatResult.metrics.latency_ms} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Error Box */}
              {chatError && (
                <div className="mt-4 p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Execution Failed
                  </div>
                  <p className="font-mono text-[11px] text-rose-300 break-words">{chatError}</p>
                </div>
              )}

              {/* Tabs */}
              {chatResult && (
                <div className="flex items-center gap-1 pt-3 border-b border-slate-800/80 pb-2 text-[11px] font-bold">
                  <button
                    onClick={() => setActiveTab('response')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'response' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Response
                  </button>
                  <button
                    onClick={() => setActiveTab('policy')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'policy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Policy & Tokens
                  </button>
                  <button
                    onClick={() => setActiveTab('json')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              )}

              {chatResult ? (
                <div className="mt-4">
                  {activeTab === 'response' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          Model: {chatResult.policy.model}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                          Tokens: {chatResult.usage.total_tokens}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                          Compression: {(chatResult.metrics.context_compression_ratio * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {chatResult.answer}
                      </div>
                    </div>
                  )}

                  {activeTab === 'policy' && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Inference Policy</span>
                          <span className="font-bold text-indigo-300">{chatResult.policy.task_type}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Dispatched Model</span>
                          <span className="font-bold text-emerald-300">{chatResult.policy.model}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Temperature</span>
                          <span className="font-bold text-purple-300">{chatResult.policy.temperature}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Context Tokens In</span>
                          <span className="font-bold text-amber-300">{chatResult.usage.input_tokens}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'json' && (
                    <pre className="p-3.5 rounded-2xl bg-slate-950 text-slate-300 font-mono text-[11px] max-h-64 overflow-y-auto leading-relaxed border border-slate-800">
                      {JSON.stringify(chatResult, null, 2)}
                    </pre>
                  )}
                </div>
              ) : !chatError ? (
                <div className="mt-16 text-center text-slate-500 text-xs space-y-3">
                  <Terminal className="w-12 h-12 mx-auto text-slate-700" />
                  <p className="max-w-xs mx-auto">
                    Configure your prompt & context on the left and click <strong>&quot;Dispatch Through Pipeline&quot;</strong> to inspect live latency and token traces.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer Quick Links */}
            <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-semibold">
                Trace Record: <code className="font-mono text-indigo-400">{chatResult?.request_id ? chatResult.request_id.slice(0, 12) + '...' : 'Idle'}</code>
              </span>
              <Link
                href="/runs"
                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
              >
                View in Runs Log <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
