import React from 'react';

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  badge,
}) {
  const colorMap = {
    red: 'border-red-500/40 text-red-400 bg-red-950/20',
    amber: 'border-amber-500/40 text-amber-400 bg-amber-950/20',
    green: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
    blue: 'border-blue-500/40 text-blue-400 bg-blue-950/20',
    purple: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
    slate: 'border-slate-700 text-slate-400 bg-slate-800/40',
  };

  const currentTheme = colorMap[variant] || colorMap.blue;

  return (
    <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            {title}
          </p>
          <h3 className="text-3xl font-extrabold text-white tracking-tight">
            {value !== undefined && value !== null ? value : 0}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg border ${currentTheme}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">{badge.label}</span>
          <span className="font-semibold text-slate-200">{badge.value}</span>
        </div>
      )}
    </div>
  );
}
