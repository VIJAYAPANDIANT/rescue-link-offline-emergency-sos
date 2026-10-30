import React from 'react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import {
  UsersIcon,
  ShieldAlertIcon,
  ActivityIcon,
  CheckCircleIcon,
  RadioIcon,
  BellIcon,
  FileTextIcon,
} from '../components/Icons';

export default function OverviewView({ data, onSelectIncident, onNavigateTab }) {
  const summary = data?.summary || {};
  const notifStats = data?.notificationStats || {};
  const recentIncidents = data?.recentIncidents || [];
  const recentAuditLogs = data?.recentAuditLogs || [];
  const typeDistribution = data?.incidentTypeDistribution || {};

  return (
    <div className="space-y-8">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total SOS Incidents"
          value={summary.totalIncidents}
          subtitle="All recorded distress broadcasts"
          icon={ShieldAlertIcon}
          variant="red"
          badge={{
            label: 'Active / Unresolved',
            value: summary.activeIncidents ?? 0,
          }}
        />

        <MetricCard
          title="Active Emergencies"
          value={summary.activeIncidents}
          subtitle="Awaiting resolution"
          icon={ActivityIcon}
          variant="amber"
          badge={{
            label: 'Acknowledged',
            value: summary.acknowledgedIncidents ?? 0,
          }}
        />

        <MetricCard
          title="Registered Responders"
          value={summary.totalUsers}
          subtitle="Mesh network participants"
          icon={UsersIcon}
          variant="blue"
          badge={{
            label: 'Active Accounts',
            value: summary.activeUsers ?? 0,
          }}
        />

        <MetricCard
          title="BLE Relays Forwarded"
          value={summary.totalRelaysForwarded}
          subtitle={`Max hop observed: ${summary.maxHopObserved || 0}`}
          icon={RadioIcon}
          variant="purple"
          badge={{
            label: 'Cloud Synced',
            value: summary.syncedCount ?? 0,
          }}
        />
      </div>

      {/* Secondary Row: Notifications & Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Type Breakdown */}
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Emergency Category Distribution
            </h3>
            <span className="text-xs text-slate-400">
              {summary.totalIncidents || 0} Total
            </span>
          </div>

          {Object.keys(typeDistribution).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No emergency incidents recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(typeDistribution).map(([type, count]) => {
                const total = summary.totalIncidents || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <StatusBadge type="emergencyType" value={type} />
                      <span className="font-semibold text-slate-300">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Multi-Channel Notification Health */}
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              SOS Notification Dispatch
            </h3>
            <button
              onClick={() => onNavigateTab('notifications')}
              className="text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              View All →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-navy-900 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Tasks</span>
              <p className="text-xl font-bold text-white mt-0.5">{notifStats.total || 0}</p>
            </div>
            <div className="bg-navy-900 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-emerald-400 font-semibold uppercase">Delivered</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {(notifStats.delivered || 0) + (notifStats.sent || 0)}
              </p>
            </div>
            <div className="bg-navy-900 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-blue-400 font-semibold uppercase">In Flight / Queued</span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">
                {(notifStats.queued || 0) + (notifStats.sending || 0)}
              </p>
            </div>
            <div className="bg-navy-900 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] text-red-400 font-semibold uppercase">Failed / Retrying</span>
              <p className="text-xl font-bold text-red-400 mt-0.5">{notifStats.failed || 0}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>By Channel:</span>
            <div className="space-x-3 font-medium text-slate-300">
              <span>📧 Email: {notifStats.byChannel?.email || 0}</span>
              <span>📱 SMS: {notifStats.byChannel?.sms || 0}</span>
            </div>
          </div>
        </div>

        {/* Cloud Sync Telemetry */}
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Offline-to-Cloud Integrity
              </h3>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Distress alerts originate on offline survivor devices, travel across BLE multi-hop relays, and sync opportunistically when gateways reach internet connectivity.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-slate-400">Synced to Central Cloud:</span>
                <span className="font-bold text-emerald-400">{summary.syncedCount || 0} alerts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-slate-400">Multi-Hop Mesh Forwards:</span>
                <span className="font-bold text-purple-400">{summary.totalRelaysForwarded || 0} hops</span>
              </div>
              <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-slate-400">Total System Users:</span>
                <span className="font-bold text-slate-200">{summary.totalUsers || 0} nodes</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('incidents')}
            className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition"
          >
            Manage All Incidents →
          </button>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Recent Distress Incidents</h3>
            <p className="text-xs text-slate-400">Latest alerts synchronized across peer mesh nodes</p>
          </div>
          <button
            onClick={() => onNavigateTab('incidents')}
            className="text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            Open Incident Command →
          </button>
        </div>

        {recentIncidents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No incidents reported yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Incident ID</th>
                  <th className="px-6 py-3 font-semibold">Emergency Type</th>
                  <th className="px-6 py-3 font-semibold">Originator</th>
                  <th className="px-6 py-3 font-semibold">Source / Hops</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">
                      {inc.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge type="emergencyType" value={inc.emergencyType} />
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-200">
                      {inc.senderName || 'Anonymous'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {inc.source === 'bluetooth_relay' ? (
                        <span className="text-purple-400 font-semibold">
                          📡 Relay ({inc.hopCount || 1} hops)
                        </span>
                      ) : (
                        <span>Direct ({inc.source || 'local'})</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge type="status" value={inc.status} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => onSelectIncident(inc)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition"
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

      {/* Recent Administrative Audit Trail */}
      {recentAuditLogs.length > 0 && (
        <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileTextIcon className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Recent Administrative Audit Trail
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('audit-logs')}
              className="text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              View Full Audit Ledger →
            </button>
          </div>

          <div className="space-y-2">
            {recentAuditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-navy-900 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                    {log.action}
                  </span>
                  <span className="text-slate-300">
                    Admin <span className="font-semibold text-white">{log.adminEmail}</span>
                  </span>
                  {log.targetId && (
                    <span className="text-slate-500 font-mono text-[11px]">
                      Target: {log.targetId.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <span className="text-slate-500 text-[11px] mt-1 sm:mt-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
