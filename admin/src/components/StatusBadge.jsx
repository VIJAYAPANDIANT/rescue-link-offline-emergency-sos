import React from 'react';

export default function StatusBadge({ type = 'status', value }) {
  if (!value) return null;

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  if (type === 'emergencyType') {
    switch (value) {
      case 'Medical Emergency':
        colorClasses = 'bg-red-950/60 text-red-400 border-red-500/40';
        break;
      case 'Fire':
        colorClasses = 'bg-orange-950/60 text-orange-400 border-orange-500/40';
        break;
      case 'Accident':
        colorClasses = 'bg-yellow-950/60 text-yellow-400 border-yellow-500/40';
        break;
      case 'Personal Safety':
        colorClasses = 'bg-purple-950/60 text-purple-400 border-purple-500/40';
        break;
      case 'Test / Drill':
        colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40';
        break;
      default:
        colorClasses = 'bg-blue-950/60 text-blue-400 border-blue-500/40';
        break;
    }
  } else if (type === 'role') {
    switch (value) {
      case 'admin':
        colorClasses = 'bg-purple-950/60 text-purple-300 border-purple-500/50 font-semibold';
        break;
      case 'responder':
        colorClasses = 'bg-blue-950/60 text-blue-300 border-blue-500/50';
        break;
      default:
        colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
        break;
    }
  } else if (type === 'userStatus') {
    switch (value) {
      case 'active':
        colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40';
        break;
      case 'suspended':
        colorClasses = 'bg-red-950/60 text-red-400 border-red-500/40';
        break;
      case 'deactivated':
        colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
        break;
      default:
        break;
    }
  } else if (type === 'notificationStatus') {
    switch (value) {
      case 'delivered':
      case 'sent':
        colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40';
        break;
      case 'sending':
      case 'queued':
        colorClasses = 'bg-blue-950/60 text-blue-400 border-blue-500/40';
        break;
      case 'failed':
        colorClasses = 'bg-red-950/60 text-red-400 border-red-500/40';
        break;
      default:
        break;
    }
  } else {
    // Incident status
    switch (value) {
      case 'Open':
      case 'Pending':
        colorClasses = 'bg-red-950/60 text-red-400 border-red-500/40 animate-pulse';
        break;
      case 'Investigating':
        colorClasses = 'bg-indigo-950/60 text-indigo-400 border-indigo-500/40';
        break;
      case 'Dispatched':
        colorClasses = 'bg-amber-950/60 text-amber-400 border-amber-500/40';
        break;
      case 'Acknowledged':
        colorClasses = 'bg-teal-950/60 text-teal-400 border-teal-500/40';
        break;
      case 'Resolved':
        colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40';
        break;
      case 'False Alarm':
        colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
        break;
      default:
        colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-medium tracking-wide ${colorClasses}`}
    >
      {value}
    </span>
  );
}
