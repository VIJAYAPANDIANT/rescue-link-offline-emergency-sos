import React, { useState, useEffect } from 'react';
import adminApi from '../api/adminApi';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { SearchIcon, UsersIcon, ShieldIcon } from '../components/Icons';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function UsersView() {
  const { user: currentAdmin } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');

  // Selected user for editing
  const [selectedUser, setSelectedUser] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        page,
        limit: pagination.limit,
        search,
        role,
        status,
      });

      setUsers(res.users || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [role, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setTargetStatus(user.status || 'active');
    setTargetRole(user.role || 'user');
    setUpdateNotes('');
    setStatusMessage('');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setUpdating(true);
    setStatusMessage('');
    try {
      const res = await adminApi.updateUserStatus(selectedUser.id, {
        status: targetStatus,
        role: targetRole,
        notes: updateNotes,
      });

      setSelectedUser(res.user);
      setStatusMessage('User account updated successfully.');
      fetchUsers(pagination.page);
    } catch (err) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const isSelf = selectedUser && currentAdmin && selectedUser.id === currentAdmin.id;

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
              placeholder="Search users by name, email, or user ID..."
              className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-3 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="responder">Field Responder</option>
            <option value="user">Standard User</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-navy-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500"
          >
            <option value="all">All Account Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-navy-850 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading user records...
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No Users Found"
            description="No registered user accounts match the selected criteria."
            icon={UsersIcon}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-navy-900/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">User ID</th>
                  <th className="px-6 py-3 font-semibold">Display Name</th>
                  <th className="px-6 py-3 font-semibold">Email Address</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Registered</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-[11px]">
                      {u.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-white">
                      {u.name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-300">
                      {u.email}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge type="role" value={u.role || 'user'} />
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge type="userStatus" value={u.status || 'active'} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => openUserDetails(u)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      >
                        Manage
                      </button>
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
          onPageChange={(p) => fetchUsers(p)}
        />
      </div>

      {/* User Management Modal */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`User Management: ${selectedUser.name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-xs">
            {/* User Profile Card */}
            <div className="p-4 rounded-xl bg-navy-900 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedUser.name}</h4>
                <p className="text-slate-400">{selectedUser.email}</p>
                <p className="font-mono text-slate-500 text-[10px] mt-1">ID: {selectedUser.id}</p>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <StatusBadge type="role" value={selectedUser.role} />
                <StatusBadge type="userStatus" value={selectedUser.status} />
              </div>
            </div>

            {isSelf && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs">
                ⚠️ You are currently signed in as this administrator. Self-suspension and self-demotion are prohibited to prevent administrative lockout.
              </div>
            )}

            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold ${
                  statusMessage.startsWith('Error')
                    ? 'bg-red-950/40 text-red-300 border border-red-500/40'
                    : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {statusMessage}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Account Status
                  </label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    disabled={isSelf}
                    className="w-full px-3 py-2 bg-navy-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended (Blocked from Login)</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    System Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    disabled={isSelf}
                    className="w-full px-3 py-2 bg-navy-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
                  >
                    <option value="user">Standard User</option>
                    <option value="responder">Field Responder</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Administrative Reason / Audit Note
                </label>
                <input
                  type="text"
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="e.g. Promoted to incident responder after field certification"
                  className="w-full px-3 py-2 bg-navy-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition"
                >
                  {updating ? 'Saving Changes...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
