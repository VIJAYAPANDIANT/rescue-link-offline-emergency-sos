import React from 'react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { BarChartIcon, ShieldAlertIcon, ActivityIcon, CheckCircleIcon } from '../components/Icons';

export default function AnalyticsView({ data }) {
  const summary = data?.summary || {};
  const typeDist = data?.incidentTypeDistribution || {};
  const statusDist = data?.incidentStatusDistribution || {};
  const timeline = data?.timeline || [];
  const notifStats = data?.notificationStats || {};

  const totalIncidents = summary.totalIncidents || 0;
  const maxDayCount = timeline.length > 0 ? Math.max(...timeline.map((t) => t.count)) : 1;

  if (totalIncidents === 0) {
    return (
      <EmptyState
        title="No Incident Data to Analyze"
        description="Analytics and trend visualizations are computed exclusively from real stored incident and relay records. As distress alerts arrive, charts will dynamically render here."
        icon={BarChartIcon}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top High-Level Analytics Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Overall Resolution Rate"
          value={
            totalIncidents > 0
              ? `${Math.round(((summary.resolvedIncidents || 0) / totalIncidents) * 100)}%`
              : '0%'
          }
          subtitle={`${summary.resolvedIncidents || 0} of ${totalIncidents} resolved`}
          icon={CheckCircleIcon}
          variant="green"
        />

        <MetricCard
          title="Active Triage Ratio"
          value={
            totalIncidents > 0
              ? `${Math.round(((summary.activeIncidents || 0) / totalIncidents) * 100)}%`
              : '0%'
          }
          subtitle={`${summary.activeIncidents || 0} incidents in progress`}
          icon={ActivityIcon}
          variant="red"
        />

        <MetricCard
          title="Relay Mesh Adoption"
          value={
            totalIncidents > 0
              ? `${Math.round(((summary.totalRelaysForwarded || 0) / totalIncidents) * 100)}%`
              : '0%'
          }
          subtitle={`${summary.totalRelaysForwarded || 0} alerts traversed BLE hops`}
          icon={BarChartIcon}
          variant="purple"
        />

        <MetricCard
          title="Notification Reliability"
          value={
            notifStats.total > 0
              ? `${Math.round((((notifStats.delivered || 0) + (notifStats.sent || 0)) / notifStats.total) * 100)}%`
              : '100%'
          }
          subtitle={`${(notifStats.delivered || 0) + (notifStats.sent || 0)} of ${notifStats.total || 0} delivered`}
          icon={CheckCircleIcon}
          variant="blue"
        />
      </div>

      {/* Incidents Over Time Bar Visualizer */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              SOS Broadcasts Over Time (Daily Cadence)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real timeline derived strictly from incident creation timestamps
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {timeline.length} {timeline.length === 1 ? 'day active' : 'days active'}
          </span>
        </div>

        {timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No timestamp activity recorded.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-slate-800">
              {timeline.map((item) => {
                const heightPct = Math.max(10, Math.round((item.count / maxDayCount) * 100));
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center group relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-900 border border-slate-700 text-white text-[10px] font-bold py-1 px-2 rounded pointer-events-none shadow-lg z-10 whitespace-nowrap">
                      {item.date}: {item.count} alerts
                    </div>

                    {/* Bar */}
                    <div
                      className="w-full max-w-[40px] bg-gradient-to-t from-red-600 to-red-400 rounded-t-md transition-all duration-500 group-hover:from-red-500 group-hover:to-red-300 shadow-md shadow-red-500/20"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Date axis labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
              <span>{timeline[0]?.date}</span>
              {timeline.length > 2 && (
                <span>{timeline[Math.floor(timeline.length / 2)]?.date}</span>
              )}
              <span>{timeline[timeline.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Type Distribution & Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 tracking-wide">
            Emergency Category Composition
          </h3>

          <div className="space-y-3.5">
            {Object.entries(typeDist).map(([type, count]) => {
              const pct = Math.round((count / totalIncidents) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <StatusBadge type="emergencyType" value={type} />
                    <span className="font-semibold text-slate-300">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lifecycle Status Distribution */}
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 tracking-wide">
            Incident Lifecycle Status Breakdown
          </h3>

          <div className="space-y-3.5">
            {Object.entries(statusDist).map(([st, count]) => {
              const pct = Math.round((count / totalIncidents) * 100);
              return (
                <div key={st}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <StatusBadge type="status" value={st} />
                    <span className="font-semibold text-slate-300">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
