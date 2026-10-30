import React, { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { BellIcon, CheckCircleIcon, AlertCircleIcon, ActivityIcon } from '../components/Icons';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getNotifications({
        page,
        limit: pagination.limit,
        channel,
        status,
      });

      setNotifications(res.notifications || []);
      setStats(res.stats || {});
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [channel, status]);

  return (
    <div className="space-y-6">
      {/* Delivery Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Notification Tasks"
          value={stats.total}
          subtitle="All dispatched emergency tasks"
          icon={BellIcon}
          variant="blue"
        />

        <MetricCard
          title="Provider Confirmed"
          value={(stats.delivered || 0) + (stats.sent || 0)}
          subtitle="Confirmed delivered or sent"
          icon={CheckCircleIcon}
          variant="green"
        />

        <MetricCard
          title="In-Flight / Queued"
          value={(stats.queued || 0) + (stats.sending || 0)}
          subtitle="Awaiting provider confirmation"
          icon={ActivityIcon}
          variant="amber"
        />

        <MetricCard
          title="Failed / Retrying"
          value={stats.failed}
          subtitle="Provider rejected or errored"
          icon={AlertCircleIcon}
          variant="red"
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="px-3.5 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Delivery Channels</option>
            <option value="email">Email (SMTP)</option>
            <option value="sms">SMS (Twilio)</option>
            <option value="push">Push Notification</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3.5 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Delivery States</option>
            <option value="queued">Queued</option>
            <option value="sending">Sending</option>
            <option value="sent">Provider Accepted (Sent)</option>
            <option value="delivered">Delivered Confirmed</option>
            <option value="failed">Failed / Errored</option>
          </select>
        </div>

        <p className="text-xs text-slate-400">
          Recipient contact details are strictly masked to protect survivor privacy.
        </p>
      </div>

      {/* Notifications Table */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading notification logs...
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No Notification Records"
            description="When emergency contacts are notified for an SOS broadcast, detailed delivery audits appear here."
            icon={BellIcon}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Task ID</th>
                  <th className="px-5 py-3 font-semibold">Related SOS Alert</th>
                  <th className="px-5 py-3 font-semibold">Channel</th>
                  <th className="px-5 py-3 font-semibold">Masked Recipient</th>
                  <th className="px-5 py-3 font-semibold">Delivery State</th>
                  <th className="px-5 py-3 font-semibold">Provider / Message ID</th>
                  <th className="px-5 py-3 font-semibold">Retries</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                      {n.id.slice(0, 8)}...
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300 text-[11px]">
                      {n.alertId ? `${n.alertId.slice(0, 8)}...` : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 uppercase font-bold text-[10px] tracking-wider text-slate-300">
                      {n.channel === 'email' ? '📧 Email' : n.channel === 'sms' ? '📱 SMS' : '🔔 Push'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300 font-semibold text-[11px]">
                      {n.recipient}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge type="notificationStatus" value={n.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      <span className="font-semibold text-slate-300 capitalize">{n.provider}</span>
                      {n.providerMessageId && (
                        <p className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                          {n.providerMessageId}
                        </p>
                      )}
                      {n.errorMessage && (
                        <p className="text-[10px] text-red-400 line-clamp-1 mt-0.5">
                          {n.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {n.retryCount || 0}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
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
          onPageChange={(p) => fetchNotifications(p)}
        />
      </div>
    </div>
  );
}
