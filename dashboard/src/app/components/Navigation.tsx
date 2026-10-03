'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Layers, PlayCircle, ShieldCheck, Terminal, Server, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiHost}/health`, { cache: 'no-store' });
      const duration = Math.round(performance.now() - start);
      setPingLatency(duration);
      setApiOnline(res.ok);
    } catch {
      setApiOnline(false);
      setPingLatency(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const navItems = [
    { name: 'Overview', href: '/', icon: Activity, desc: 'Telemetry & Live Playground' },
    { name: 'Recent Runs', href: '/runs', icon: Layers, desc: 'Execution Trace Logs' },
    { name: 'Evaluations', href: '/evaluations', icon: ShieldCheck, desc: 'Quality Benchmarks' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-indigo-100/80 bg-white/85 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          {/* Logo & Platform Info */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform duration-200">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                  ContextOS
                </h1>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
                  v0.1.0 Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Production LLM Runtime Observability</p>
            </div>
          </Link>

          {/* Navigation Items & Status Indicator */}
          <div className="flex items-center gap-3 sm:gap-5">
            <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 shadow-inner">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200 font-extrabold scale-100'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Backend Connectivity Status Button */}
            <button
              onClick={() => setShowStatusModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                apiOnline === true
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80'
                  : apiOnline === false
                  ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/80'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="Click to check backend runtime diagnostics"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  apiOnline === true
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                    : apiOnline === false
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                    : 'bg-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {apiOnline === true
                  ? `API Live (${pingLatency || '<10'}ms)`
                  : apiOnline === false
                  ? 'Demo / Offline Mode'
                  : 'Checking API...'}
              </span>
              <span className="sm:hidden">
                {apiOnline === true ? 'Live' : 'Demo'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Backend Status Diagnostic Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">ContextOS Gateway Telemetry</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">FastAPI Host URL</span>
                <code className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}
                </code>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Gateway Status</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                  apiOnline === true
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {apiOnline === true ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Interactive Demo Mode Active
                    </>
                  )}
                </span>
              </div>

              {apiOnline === true && pingLatency && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Round-trip Health Latency</span>
                  <span className="font-mono font-bold text-emerald-600">{pingLatency} ms</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-indigo-900 text-xs leading-relaxed">
                <p className="font-semibold mb-1">💡 Interactive Simulation Engine:</p>
                <p className="text-indigo-800 text-[11px]">
                  When the FastAPI backend is running, requests execute against real policy and routing pipelines. When in demo mode, the dashboard dynamically simulates context compression, latency, token budgets, and benchmark evaluations in real time.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={checkHealth}
                disabled={checking}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                Ping API Gateway
              </button>
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
