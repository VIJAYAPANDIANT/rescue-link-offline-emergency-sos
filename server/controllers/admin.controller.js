/**
 * Admin Dashboard & Incident Monitoring Controller
 *
 * Implements administrative reporting, user management, incident lifecycle updates,
 * relay telemetry, notification audits, and security logging.
 */

const alertStore = require('../services/alertStore');
const userStore = require('../services/userStore');
const notificationStore = require('../services/notificationStore');
const auditStore = require('../services/auditStore');

const ALLOWED_ADMIN_STATUSES = [
  'Pending',
  'Open',
  'Investigating',
  'Dispatched',
  'Resolved',
  'False Alarm',
  'Acknowledged',
];

/**
 * GET /api/admin/dashboard
 * Aggregates high-level system telemetry and incident metrics from real stored data.
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const alerts = await alertStore.readAlerts();
    const userCounts = await userStore.countUsers();
    const notificationStats = await notificationStore.getNotificationStats();

    // Incident stats
    const totalIncidents = alerts.length;
    let activeIncidents = 0;
    let resolvedIncidents = 0;
    let acknowledgedIncidents = 0;
    let pendingSyncCount = 0;
    let syncedCount = 0;
    let totalRelays = 0;
    let maxHopObserved = 0;

    const incidentTypeDistribution = {};
    const incidentStatusDistribution = {};
    const timelineMap = {};

    for (const a of alerts) {
      // Type distribution
      const type = a.emergencyType || 'Other';
      incidentTypeDistribution[type] = (incidentTypeDistribution[type] || 0) + 1;

      // Status distribution
      const st = a.status || 'Pending';
      incidentStatusDistribution[st] = (incidentStatusDistribution[st] || 0) + 1;

      // Active vs resolved
      if (['Resolved', 'False Alarm'].includes(st)) {
        resolvedIncidents++;
      } else {
        activeIncidents++;
      }

      if (st === 'Acknowledged' || a.ackStatus === 'acknowledged') {
        acknowledgedIncidents++;
      }

      if (a.syncStatus === 'synced' || a.source === 'server' || a.source === 'local') {
        syncedCount++;
      } else {
        pendingSyncCount++;
      }

      if ((a.hopCount && a.hopCount > 0) || a.source === 'bluetooth_relay') {
        totalRelays++;
        if (a.hopCount && a.hopCount > maxHopObserved) {
          maxHopObserved = a.hopCount;
        }
      }

      // Timeline aggregation by date (YYYY-MM-DD)
      if (a.createdAt) {
        const day = a.createdAt.split('T')[0];
        timelineMap[day] = (timelineMap[day] || 0) + 1;
      }
    }

    // Format timeline as sorted array of { date, count }
    const timeline = Object.keys(timelineMap)
      .sort()
      .map((date) => ({ date, count: timelineMap[date] }));

    // Recent 5 incidents
    const sortedAlerts = [...alerts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const recentIncidents = sortedAlerts.slice(0, 5);

    // Recent 5 audit logs
    const { logs: recentAuditLogs } = await auditStore.getLogs({ page: 1, limit: 5 });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers: userCounts.total,
          activeUsers: userCounts.active,
          suspendedUsers: userCounts.suspended,
          totalIncidents,
          activeIncidents,
          resolvedIncidents,
          acknowledgedIncidents,
          syncedCount,
          pendingSyncCount,
          totalRelaysForwarded: totalRelays,
          maxHopObserved,
        },
        notificationStats,
        incidentTypeDistribution,
        incidentStatusDistribution,
        timeline,
        recentIncidents,
        recentAuditLogs,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/incidents
 * Paginated, searchable, and filterable incident management endpoint.
 */
const getIncidents = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      emergencyType,
      status,
      dateFrom,
      dateTo,
      hasLocation,
    } = req.query;

    const result = await alertStore.getPaginatedAlerts({
      page,
      limit,
      search,
      emergencyType,
      status,
      dateFrom,
      dateTo,
      hasLocation,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/incidents/:id
 * Retrieve full details of a specific incident, including administrative review trail.
 */
const getIncidentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await alertStore.findById(id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: 'The requested emergency incident was not found.',
        },
      });
    }

    const auditLogs = await auditStore.getLogsForTarget('incident', id);

    return res.status(200).json({
      success: true,
      incident,
      auditLogs,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/incidents/:id/status
 * Update administrative status of an incident with full audit trail logging.
 * Preserves original survivor message details, location, and BLE transmission states.
 */
const updateIncidentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status is required and must be a valid string.',
        },
      });
    }

    if (!ALLOWED_ADMIN_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_STATUS',
          message: `Status must be one of: ${ALLOWED_ADMIN_STATUSES.join(', ')}`,
        },
      });
    }

    const existing = await alertStore.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: 'The requested emergency incident was not found.',
        },
      });
    }

    const oldStatus = existing.status;
    const updated = await alertStore.updateAdminStatus(
      id,
      status,
      req.adminUser || req.user,
      notes
    );

    // Record administrative action in audit log
    await auditStore.createLog({
      action: 'INCIDENT_STATUS_UPDATE',
      adminId: req.user.id,
      adminEmail: req.user.email,
      targetType: 'incident',
      targetId: id,
      details: {
        oldStatus,
        newStatus: status,
        notes: notes || '',
        emergencyType: existing.emergencyType,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Incident status updated to "${status}".`,
      incident: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users
 * Paginated list of registered users with sanitized profiles (zero password hashes).
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;

    const result = await userStore.getAllUsers({
      page,
      limit,
      search,
      role,
      status,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Update user account status (active / suspended) or role (admin / responder / user).
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, role, notes } = req.body;

    const targetUser = await userStore.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The requested user account was not found.',
        },
      });
    }

    // Protection: Prevent admin from locking themselves out
    if (req.user.id === id) {
      if (status && status !== 'active') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SELF_SUSPENSION_PROHIBITED',
            message: 'You cannot suspend or deactivate your own administrator account.',
          },
        });
      }
      if (role && role !== 'admin') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SELF_DEMOTION_PROHIBITED',
            message: 'You cannot remove your own administrator privileges.',
          },
        });
      }
    }

    const previousRole = targetUser.role || 'user';
    const previousStatus = targetUser.status || 'active';

    const updated = await userStore.updateUser(id, { status, role });

    // Record audit log
    await auditStore.createLog({
      action: 'USER_STATUS_UPDATE',
      adminId: req.user.id,
      adminEmail: req.user.email,
      targetType: 'user',
      targetId: id,
      details: {
        previousRole,
        newRole: updated.role,
        previousStatus,
        newStatus: updated.status,
        notes: notes || '',
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User account updated successfully.',
      user: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/relay
 * Multi-device relay monitoring and mesh forwarding statistics.
 */
const getRelayActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const alerts = await alertStore.readAlerts();

    // Filter alerts with relay attributes
    const relayedAlerts = alerts
      .filter((a) => (a.hopCount && a.hopCount > 0) || a.source === 'bluetooth_relay' || a.forwarderId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let maxHopObserved = 0;
    const uniqueForwarders = new Set();
    const hopDistribution = { '1': 0, '2': 0, '3': 0, '4+': 0 };

    for (const a of relayedAlerts) {
      const hops = a.hopCount || 1;
      if (hops > maxHopObserved) maxHopObserved = hops;
      if (a.forwarderId) uniqueForwarders.add(a.forwarderId);

      if (hops === 1) hopDistribution['1']++;
      else if (hops === 2) hopDistribution['2']++;
      else if (hops === 3) hopDistribution['3']++;
      else hopDistribution['4+']++;
    }

    const total = relayedAlerts.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = relayedAlerts.slice(startIndex, startIndex + limitNum).map((a) => ({
      alertId: a.id,
      emergencyType: a.emergencyType,
      senderName: a.senderName,
      source: a.source,
      hopCount: a.hopCount || 0,
      forwarderId: a.forwarderId || 'Unknown Forwarder',
      relayedBy: a.relayedBy || null,
      relayedByName: a.relayedByName || null,
      createdAt: a.createdAt,
      status: a.status,
    }));

    return res.status(200).json({
      success: true,
      stats: {
        totalRelayedAlerts: total,
        maxHopObserved,
        uniqueForwardingNodes: uniqueForwarders.size,
        hopDistribution,
      },
      relays: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/notifications
 * Multi-channel notification delivery logs with masked recipient addresses.
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, channel, status, alertId } = req.query;

    const stats = await notificationStore.getNotificationStats();
    const result = await notificationStore.getPaginatedNotifications({
      page,
      limit,
      channel,
      status,
      alertId,
    });

    return res.status(200).json({
      success: true,
      stats,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs
 * Chronological ledger of all administrative system actions.
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, targetType, search } = req.query;

    const result = await auditStore.getLogs({
      page,
      limit,
      action,
      targetType,
      search,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardOverview,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getUsers,
  updateUserStatus,
  getRelayActivity,
  getNotifications,
  getAuditLogs,
};
