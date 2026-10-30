import React, { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { FileTextIcon, SearchIcon, FilterIcon } from '../components/Icons';

export default function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs({
        page,
        limit: pagination.limit,
        search,
        action,
      });

      setLogs(res.logs || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [action]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, administrator email, or target ID..."
              className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-3.5 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Administrative Actions</option>
            <option value="INCIDENT_STATUS_UPDATE">Incident Status Updates</option>
            <option value="USER_STATUS_UPDATE">User Account Changes</option>
            <option value="ADMIN_SETUP_CREATION">Admin Account Creation</option>
            <option value="ADMIN_SETUP_PROMOTION">Admin Role Promotion</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
          >
            Filter Logs
          </button>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Security & Operations Audit Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Tamper-evident log of all administrator actions, state transitions, and user modifications
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {pagination.total} Log Entries
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading security logs...
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Audit Records"
            description="Administrative actions (incident status updates, user role changes, admin logins) will be recorded here."
            icon={FileTextIcon}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Target Entity</th>
                  <th className="px-5 py-3 font-semibold">Modification Details</th>
                  <th className="px-5 py-3 font-semibold">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      {log.adminEmail}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      <span className="capitalize font-semibold text-slate-300">
                        {log.targetType || 'System'}:
                      </span>{' '}
                      <span className="font-mono text-[10px] text-slate-500">
                        {log.targetId ? `${log.targetId.slice(0, 8)}...` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 max-w-xs">
                      {log.details ? (
                        <div className="font-mono text-[11px] truncate">
                          {log.details.oldStatus && log.details.newStatus ? (
                            <span>
                              Status: <span className="text-slate-400">{log.details.oldStatus}</span> →{' '}
                              <span className="text-emerald-400 font-bold">{log.details.newStatus}</span>
                              {log.details.notes && ` ("${log.details.notes}")`}
                            </span>
                          ) : log.details.newRole ? (
                            <span>Role updated to: <span className="text-purple-400 font-bold">{log.details.newRole}</span></span>
                          ) : log.details.newStatus ? (
                            <span>Status updated to: <span className="text-amber-400 font-bold">{log.details.newStatus}</span></span>
                          ) : (
                            JSON.stringify(log.details)
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
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
          onPageChange={(p) => fetchLogs(p)}
        />
      </div>
    </div>
  );
}
