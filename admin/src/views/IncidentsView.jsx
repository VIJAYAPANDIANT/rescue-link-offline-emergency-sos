import React, { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import InteractiveMap from '../components/InteractiveMap';
import {
  SearchIcon,
  FilterIcon,
  MapPinIcon,
  ExternalLinkIcon,
  ShieldAlertIcon,
  ActivityIcon,
} from '../components/Icons';

export default function IncidentsView({ initialIncident, onClearInitialIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'map'

  // Filters
  const [search, setSearch] = useState('');
  const [emergencyType, setEmergencyType] = useState('all');
  const [status, setStatus] = useState('all');
  const [hasLocation, setHasLocation] = useState('all');

  // Selected incident for detail view / editing
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);

  const fetchIncidents = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getIncidents({
        page,
        limit: pagination.limit,
        search,
        emergencyType,
        status,
        hasLocation: hasLocation === 'all' ? undefined : hasLocation,
      });

      setIncidents(res.incidents || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents(1);
  }, [emergencyType, status, hasLocation]);

  // Handle open incident from props
  useEffect(() => {
    if (initialIncident) {
      openIncidentDetails(initialIncident);
      if (onClearInitialIncident) onClearInitialIncident();
    }
  }, [initialIncident]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchIncidents(1);
  };

  const openIncidentDetails = async (incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status || 'Pending');
    setStatusNotes('');
    setStatusMessage('');
    try {
      const res = await adminApi.getIncidentById(incident.id);
      if (res.incident) setSelectedIncident(res.incident);
      if (res.auditLogs) setAuditLogs(res.auditLogs);
    } catch (err) {
      console.error('Failed to fetch incident audit history:', err);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedIncident || !newStatus) return;

    setStatusUpdating(true);
    setStatusMessage('');
    try {
      const res = await adminApi.updateIncidentStatus(selectedIncident.id, {
        status: newStatus,
        notes: statusNotes,
      });

      setSelectedIncident(res.incident);
      setStatusMessage('Incident status updated successfully.');

      // Refresh audit logs for this incident
      const detailsRes = await adminApi.getIncidentById(selectedIncident.id);
      if (detailsRes.auditLogs) setAuditLogs(detailsRes.auditLogs);

      // Refresh main table
      fetchIncidents(pagination.page);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl p-5 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Alert ID, sender name, or distress description..."
              className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={emergencyType}
            onChange={(e) => setEmergencyType(e.target.value)}
            className="px-3 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Emergency Types</option>
            <option value="Medical Emergency">Medical Emergency</option>
            <option value="Fire">Fire</option>
            <option value="Accident">Accident</option>
            <option value="Personal Safety">Personal Safety</option>
            <option value="Test / Drill">Test / Drill</option>
            <option value="Other">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Open">Open</option>
            <option value="Investigating">Investigating</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
            <option value="False Alarm">False Alarm</option>
          </select>

          {/* Location Filter */}
          <select
            value={hasLocation}
            onChange={(e) => setHasLocation(e.target.value)}
            className="px-3 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">Location: All</option>
            <option value="true">With GPS Coordinates</option>
            <option value="false">Unmapped Only</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
          >
            Search
          </button>

          {/* View Mode Toggle */}
          <div className="ml-auto flex items-center bg-navy-900 border border-slate-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Table View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                viewMode === 'map'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPinIcon className="w-3.5 h-3.5 mr-1" />
              Spatial Canvas
            </button>
          </div>
        </form>
      </div>

      {/* Main Content: Table or Map */}
      {viewMode === 'map' ? (
        <InteractiveMap incidents={incidents} onSelectIncident={openIncidentDetails} />
      ) : (
        <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading incidents from database...
            </div>
          ) : incidents.length === 0 ? (
            <EmptyState
              title="No Incidents Found"
              description="No emergency alerts match your search and filter criteria. Adjust your filters or reset search."
              icon={ShieldAlertIcon}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Incident ID</th>
                    <th className="px-5 py-3 font-semibold">Emergency Type</th>
                    <th className="px-5 py-3 font-semibold">Originator</th>
                    <th className="px-5 py-3 font-semibold">Location (GPS)</th>
                    <th className="px-5 py-3 font-semibold">Mesh Route</th>
                    <th className="px-5 py-3 font-semibold">Delivery / ACK</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {incidents.map((inc) => {
                    const hasCoords =
                      inc.location &&
                      typeof inc.location.latitude === 'number' &&
                      typeof inc.location.longitude === 'number';

                    return (
                      <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                          {inc.id.slice(0, 8)}...
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge type="emergencyType" value={inc.emergencyType} />
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-200">
                          {inc.senderName || 'Anonymous'}
                        </td>
                        <td className="px-5 py-3.5">
                          {hasCoords ? (
                            <span className="font-mono text-emerald-400 text-[11px]">
                              {inc.location.latitude.toFixed(4)}, {inc.location.longitude.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Unmapped</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {inc.source === 'bluetooth_relay' ? (
                            <span className="text-purple-400 font-semibold">
                              📡 Relay ({inc.hopCount || 1} hops)
                            </span>
                          ) : (
                            <span className="text-slate-400">Direct ({inc.source || 'local'})</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-[10px] text-slate-400">
                              ACK: <strong className="text-slate-300">{inc.ackStatus || 'unacknowledged'}</strong>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Sync: <strong className="text-emerald-400">{inc.syncStatus || 'synced'}</strong>
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge type="status" value={inc.status} />
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {new Date(inc.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openIncidentDetails(inc)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={(p) => fetchIncidents(p)}
          />
        </div>
      )}

      {/* Incident Review & Lifecycle Management Modal */}
      {selectedIncident && (
        <Modal
          isOpen={!!selectedIncident}
          onClose={() => setSelectedIncident(null)}
          title={`Emergency Incident: ${selectedIncident.id.slice(0, 8)}...`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6 text-xs">
            {/* Alert Header Summary */}
            <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <StatusBadge type="emergencyType" value={selectedIncident.emergencyType} />
                  <StatusBadge type="status" value={selectedIncident.status} />
                </div>
                <h4 className="text-base font-bold text-white mt-2">
                  {selectedIncident.emergencyType}
                </h4>
                <p className="text-slate-400 mt-0.5">
                  Reported by <strong className="text-slate-200">{selectedIncident.senderName || 'Anonymous'}</strong> at{' '}
                  {new Date(selectedIncident.createdAt).toLocaleString()}
                </p>
              </div>

              {selectedIncident.location && (
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Location Coordinates</p>
                  <p className="font-mono text-emerald-400 text-sm font-bold">
                    {selectedIncident.location.latitude.toFixed(5)}, {selectedIncident.location.longitude.toFixed(5)}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${selectedIncident.location.latitude},${selectedIncident.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-red-400 hover:text-red-300 font-semibold mt-1"
                  >
                    Open Google Maps
                    <ExternalLinkIcon className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
              )}
            </div>

            {/* Survivor Distress Narrative */}
            <div>
              <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1.5">
                Survivor Distress Narrative (Immutable)
              </h5>
              <div className="p-3.5 rounded-xl bg-navy-900/80 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedIncident.details || 'No narrative description provided by survivor.'}
              </div>
            </div>

            {/* Mesh & Transmission Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Source</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedIncident.source || 'local'}</p>
              </div>
              <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Hop Count</span>
                <p className="font-semibold text-purple-400 mt-0.5">{selectedIncident.hopCount || 0} hops</p>
              </div>
              <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">BLE ACK Status</span>
                <p className="font-semibold text-teal-400 mt-0.5">{selectedIncident.ackStatus || 'unacknowledged'}</p>
              </div>
              <div className="p-3 rounded-lg bg-navy-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Cloud Sync</span>
                <p className="font-semibold text-emerald-400 mt-0.5">{selectedIncident.syncStatus || 'synced'}</p>
              </div>
            </div>

            {/* Administrative Status Update Form */}
            <form onSubmit={handleStatusUpdate} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Administrative Status Update
                </h5>
                <span className="text-[10px] text-slate-400">
                  Preserves original sender details and creates security audit log
                </span>
              </div>

              {statusMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold ${
                    statusMessage.startsWith('Error')
                      ? 'bg-red-950/40 text-red-300 border border-red-500/40'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {statusMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    New Lifecycle Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Acknowledged">Acknowledged</option>
                    <option value="Resolved">Resolved</option>
                    <option value="False Alarm">False Alarm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Reviewer Notes / Dispatch Reference
                  </label>
                  <input
                    type="text"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="e.g. Dispatched SAR Unit 4 to location"
                    className="w-full px-3 py-2 bg-navy-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={statusUpdating || newStatus === selectedIncident.status}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition"
                >
                  {statusUpdating ? 'Updating Status...' : 'Apply Status Transition'}
                </button>
              </div>
            </form>

            {/* Audit History for this Incident */}
            {auditLogs.length > 0 && (
              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-2">
                  Administrative Audit History
                </h5>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-navy-900/60 border border-slate-800 text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-purple-300">{log.adminEmail}</span>{' '}
                        changed status from{' '}
                        <span className="font-semibold text-slate-400">
                          {log.details?.oldStatus || 'Initial'}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold text-emerald-400">
                          {log.details?.newStatus}
                        </span>
                        {log.details?.notes && (
                          <span className="text-slate-400 ml-1.5 italic">
                            ("{log.details.notes}")
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
