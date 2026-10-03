'use client';

import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle 
} from 'lucide-react';

interface TestCaseResult {
  id: string | number;
  task_type: string;
  passed: boolean;
  quality_score: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  compression_ratio: number;
  answer_snippet?: string;
  message?: string;
  expected_keyword?: string;
}

interface BenchmarkResult {
  total_cases: number;
  passed_cases: number;
  pass_rate: number;
  avg_quality_score: number;
  avg_latency_ms: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  avg_compression_ratio: number;
  case_results: TestCaseResult[];
}

export default function EvaluationsPage() {
  const [evalResult, setEvalResult] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [filterTask, setFilterTask] = useState<string>('all');
  const [expandedCase, setExpandedCase] = useState<string | number | null>(null);

  const testSteps = [
    'Initializing ContextOS Benchmark Harness...',
    'Evaluating Gatekeeper Context Budget & Compression Suites...',
    'Testing Prompt Assembly Line & Template Consistency...',
    'Evaluating Dispatcher Policy Model Routing & Quality...',
    'Aggregating Operational Telemetry Scores...',
  ];

  const triggerEvaluation = () => {
    setRunning(true);
    setEvalError(null);
    setCurrentStep(0);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < testSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 450);

    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${apiHost}/v1/evaluate`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: 'Benchmark execution failed' }));
          throw new Error(errData.detail || `Server returned status ${res.status}`);
        }
        return res.json();
      })
      .then((data: BenchmarkResult) => {
        setEvalResult(data);
      })
      .catch((err: any) => {
        setEvalError(err.message || 'Failed to communicate with benchmark evaluation endpoint.');
      })
      .finally(() => {
        clearInterval(stepInterval);
        setRunning(false);
      });
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    if (!evalResult?.case_results) return [];
    return evalResult.case_results.filter((c) => {
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'passed' && c.passed) ||
        (filterStatus === 'failed' && !c.passed);
      const matchesTask =
        filterTask === 'all' || (c.task_type || '').toLowerCase() === filterTask.toLowerCase();
      return matchesStatus && matchesTask;
    });
  }, [evalResult, filterStatus, filterTask]);

  // Export Benchmark
  const exportBenchmark = () => {
    if (!evalResult) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(evalResult, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `contextos-benchmark-report-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 p-6 rounded-3xl border border-slate-200/80 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Benchmark Quality Evaluations
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              QA Test Harness
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Reproducible benchmark test harness scoring accuracy, keyword retention, latency, and context compression across dataset cases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {evalResult && (
            <button
              onClick={exportBenchmark}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Report
            </button>
          )}

          <button
            onClick={triggerEvaluation}
            disabled={running}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold rounded-2xl text-xs transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running Test Suite...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Benchmark Suite
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {evalError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold">Evaluation Run Error:</span> {evalError}
          </div>
        </div>
      )}

      {/* Progress Animation Bar */}
      {running && (
        <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4 shadow-xl border border-slate-800 animate-in fade-in duration-200">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-indigo-400 font-mono">
              Step {currentStep + 1} of {testSteps.length}
            </span>
            <span className="text-slate-400">
              {Math.round(((currentStep + 1) / testSteps.length) * 100)}% Complete
            </span>
          </div>
          <p className="text-sm font-bold text-slate-100">{testSteps[currentStep]}</p>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / testSteps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Scorecards */}
      {evalResult ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Total Test Cases
              </span>
              <span className="text-3xl font-black text-slate-900 mt-2 block">
                {evalResult.total_cases}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-1">
                Passed: {evalResult.passed_cases} / {evalResult.total_cases}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Pass Rate
              </span>
              <span className="text-3xl font-black text-emerald-600 mt-2 block">
                {(evalResult.pass_rate * 100).toFixed(0)}%
              </span>
              <span className="text-[11px] font-bold text-slate-500 mt-1 block">
                {evalResult.pass_rate >= 0.9 ? 'Target Threshold Met (≥ 90%)' : 'Below Target Threshold (< 90%)'}
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Quality Score
              </span>
              <span className="text-3xl font-black text-indigo-600 mt-2 block">
                {(evalResult.avg_quality_score * 100).toFixed(0)}/100
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 inline-block mt-1">
                Evaluation Metric
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Avg Latency & Budget
              </span>
              <span className="text-3xl font-black text-violet-600 mt-2 block">
                {evalResult.avg_latency_ms} <span className="text-lg font-bold text-slate-500">ms</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 mt-1 block">
                {(evalResult.avg_compression_ratio * 100).toFixed(0)}% context retained
              </span>
            </div>
          </div>

          {/* Test Case Explorer */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Benchmark Test Cases</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect individual prompts, expected criteria, and evaluated score breakdown.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filterStatus === 'all' ? 'bg-white text-indigo-600 shadow-2xs font-extrabold' : 'text-slate-600'
                    }`}
                  >
                    All ({evalResult.case_results.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('passed')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filterStatus === 'passed' ? 'bg-white text-emerald-600 shadow-2xs font-extrabold' : 'text-slate-600'
                    }`}
                  >
                    Passed
                  </button>
                  <button
                    onClick={() => setFilterStatus('failed')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filterStatus === 'failed' ? 'bg-white text-rose-600 shadow-2xs font-extrabold' : 'text-slate-600'
                    }`}
                  >
                    Failed
                  </button>
                </div>

                <select
                  value={filterTask}
                  onChange={(e) => setFilterTask(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">All Tasks</option>
                  <option value="code">Code</option>
                  <option value="structured_extraction">Structured Extraction</option>
                  <option value="analytical">Analytical</option>
                  <option value="creative">Creative</option>
                  <option value="factual">Factual</option>
                </select>
              </div>
            </div>

            {/* Case List */}
            <div className="space-y-3">
              {filteredCases.map((c) => {
                const isExpanded = expandedCase === c.id;
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 hover:border-indigo-200 transition-all space-y-3"
                  >
                    <div
                      onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                      className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        {c.passed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">{c.id}</span>
                            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {c.task_type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 font-medium line-clamp-1">
                            {c.message || `Benchmark Case #${c.id}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-bold text-indigo-600">
                          Score: {(c.quality_score * 100).toFixed(0)}%
                        </span>
                        <span className="font-mono text-slate-500">{c.latency_ms} ms</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200/80 space-y-3 text-xs animate-in fade-in duration-150">
                        {c.expected_keyword && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                            <span className="text-slate-500 font-semibold">Expected Keyword / Condition:</span>
                            <code className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {c.expected_keyword}
                            </code>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Output Answer Snippet
                          </span>
                          <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
                            {c.answer_snippet || 'No output snippet captured.'}
                          </pre>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px] text-center font-bold">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700">
                            Tokens In: {c.input_tokens}
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700">
                            Tokens Out: {c.output_tokens}
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-700">
                            Compression: {((c.compression_ratio || 1) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-2xl font-bold">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Ready to Benchmark ContextOS</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click <strong>&quot;Run Benchmark Suite&quot;</strong> above to execute the evaluation test dataset across accuracy, latency, and context budget efficiency.
          </p>
        </div>
      )}
    </div>
  );
}
