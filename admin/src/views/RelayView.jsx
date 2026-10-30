import React, { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { RadioIcon, ActivityIcon, ShieldIcon } from '../components/Icons';

export default function RelayView() {
  const [relays, setRelays] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchRelays = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getRelayActivity({ page, limit: pagination.limit });
      setRelays(res.relays || []);
      setStats(res.stats || {});
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load relay telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelays(1);
  }, []);

  const hopDist = stats.hopDistribution || {};

  return (
    <div className="space-y-6">
      {/* Relay Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Relayed Alerts"
          value={stats.totalRelayedAlerts}
          subtitle="Alerts forwarded via BLE mesh"
          icon={RadioIcon}
          variant="purple"
        />

        <MetricCard
          title="Max Hop Count Observed"
          value={stats.maxHopObserved}
          subtitle="Maximum epidemic propagation"
          icon={ActivityIcon}
          variant="amber"
        />

        <MetricCard
          title="Active Forwarding Nodes"
          value={stats.uniqueForwardingNodes}
          subtitle="Unique forwarder IDs recorded"
          icon={ShieldIcon}
          variant="blue"
        />

        <MetricCard
          title="Multi-Hop Distribution"
          value={
            stats.totalRelayedAlerts
              ? `${Math.round(((hopDist['2'] || 0) + (hopDist['3'] || 0) + (hopDist['4+'] || 0)) / stats.totalRelayedAlerts * 100)}%`
              : '0%'
          }
          subtitle="Alerts reaching 2+ hops"
          icon={RadioIcon}
          variant="green"
        />
      </div>

      {/* Hop Count Breakdown */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h4 className="text-sm font-bold text-white mb-3 tracking-wide">
          Mesh Hop Depth Distribution
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
            <span className="text-slate-400 font-semibold">1 Hop (Direct Relay):</span>
            <p className="text-lg font-bold text-slate-200 mt-1">{hopDist['1'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
            <span className="text-purple-400 font-semibold">2 Hops (Mesh Forward):</span>
            <p className="text-lg font-bold text-purple-300 mt-1">{hopDist['2'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
            <span className="text-amber-400 font-semibold">3 Hops (Deep Mesh):</span>
            <p className="text-lg font-bold text-amber-300 mt-1">{hopDist['3'] || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
            <span className="text-red-400 font-semibold">4+ Hops (Perimeter):</span>
            <p className="text-lg font-bold text-red-300 mt-1">{hopDist['4+'] || 0}</p>
          </div>
        </div>
      </div>

      {/* Relays Table */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Bluetooth Mesh Relay Telemetry
            </h3>
            <p className="text-xs text-slate-400">
              Epidemic forwarding records ($A \to B \to C$) captured during cloud synchronization
            </p>
          </div>
          <span className="text-xs text-slate-500 italic">
            Physical device locations are never inferred without explicit GPS consent
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading relay records...
          </div>
        ) : relays.length === 0 ? (
          <EmptyState
            title="No Mesh Relays Recorded"
            description="When offline devices forward distress alerts over Bluetooth Low Energy, their hop metrics will appear here."
            icon={RadioIcon}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Alert ID</th>
                  <th className="px-6 py-3 font-semibold">Emergency Type</th>
                  <th className="px-6 py-3 font-semibold">Originator</th>
                  <th className="px-6 py-3 font-semibold">Forwarder Node ID</th>
                  <th className="px-6 py-3 font-semibold">Hop Count</th>
                  <th className="px-6 py-3 font-semibold">Cloud Sync Ingestion</th>
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {relays.map((r, i) => (
                  <tr key={`${r.alertId}-${i}`} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">
                      {r.alertId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge type="emergencyType" value={r.emergencyType} />
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-200">
                      {r.senderName || 'Anonymous Survivor'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-purple-400 text-[11px]">
                      {r.forwarderId || 'Node-Relay'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold text-xs">
                        {r.hopCount} {r.hopCount === 1 ? 'hop' : 'hops'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {r.relayedByName ? (
                        <span>Synced by <strong className="text-slate-200">{r.relayedByName}</strong></span>
                      ) : (
                        <span>Direct Gateway</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(p) => fetchRelays(p)}
        />
      </div>
    </div>
  );
}
