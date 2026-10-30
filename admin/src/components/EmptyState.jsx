import React from 'react';
import { AlertCircleIcon } from './Icons';

export default function EmptyState({
  title = 'No records found',
  description = 'There are currently no items matching your criteria in the system.',
  icon: Icon = AlertCircleIcon,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-base font-semibold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
