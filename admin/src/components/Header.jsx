import React from 'react';
import { RefreshCwIcon } from './Icons';

export default function Header({ title, subtitle, onRefresh, isRefreshing }) {
  return (
    <header className="px-8 py-5 border-b border-slate-800 bg-navy-850/60 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-3">
        {/* Live heartbeat indicator */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-navy-900/80 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-300 font-medium">Gateway: Online</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50 transition"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
