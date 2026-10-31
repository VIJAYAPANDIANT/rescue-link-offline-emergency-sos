import React from 'react';
import { RefreshCwIcon, MenuIcon } from './Icons';

export default function Header({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
  onToggleMobileMenu,
}) {
  return (
    <header className="px-6 sm:px-8 py-4 border-b border-slate-800 bg-navy-850/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Live heartbeat indicator */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-navy-900/80 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-300 font-medium hidden sm:inline">Gateway: Online</span>
          <span className="text-emerald-400 font-bold sm:hidden">LIVE</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50 transition"
            aria-label="Refresh data"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
