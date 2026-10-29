/**
 * RescueLink Cloud Synchronization Service
 *
 * Coordinates offline-to-cloud synchronization between local SQLite outbox
 * and the Express/Node.js backend.
 *
 * Implements:
 * - Network connectivity gating & end-to-end reachability checks
 * - In-flight concurrency locks (no overlapping sync jobs)
 * - Controlled batch uploads
 * - Per-alert response handling & idempotent updates
 * - Exponential backoff retry scheduling
 * - Safe handling of expired authentication without local data loss
 */

import { apiClient } from '../api/apiClient.js';
import { networkService } from '../network/networkService.js';
import { SyncQueueRepository } from '../../database/syncQueueRepository.js';
import { AlertRepository } from '../../database/alertRepository.js';

const BATCH_SIZE = 10;
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 300000; // 5 minutes

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.lastSyncResult = null;
    this.listeners = new Set();

    // Listen to network transitions: automatically trigger sync when reconnected
    networkService.addConnectivityListener((netState) => {
      if (netState.wasReconnected && apiClient.getToken()) {
        console.log('[SyncService] Network reconnected. Triggering opportunistic synchronization...');
        this.syncPendingAlerts().catch((err) => {
          console.warn('[SyncService] Auto-sync error on reconnect:', err.message);
        });
      }
    });
  }

  /**
   * Subscribe to sync lifecycle events (progress, completed, failed)
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  addSyncListener(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(state) {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[SyncService] Listener error:', err);
      }
    }
  }

  /**
   * Calculate exponential backoff delay with jitter.
   * delay = min(base * 2^retryCount, max)
   */
  calculateBackoff(retryCount) {
    const exponent = Math.min(retryCount, 6);
    const delay = BASE_BACKOFF_MS * Math.pow(2, exponent);
    const jitter = Math.floor(Math.random() * 1000);
    return Math.min(delay + jitter, MAX_BACKOFF_MS);
  }

  /**
   * Check how many items are waiting in the offline sync queue.
   */
  async getSyncStatus() {
    const pendingCount = await SyncQueueRepository.getPendingCount();
    return {
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      isOnline: networkService.isOnline(),
    };
  }

  /**
   * Main synchronization execution routine.
   *
   * @param {object} [options]
   * @param {boolean} [options.isManual=false]
   */
  async syncPendingAlerts({ isManual = false } = {}) {
    // 1. Concurrency guard: prevent simultaneous overlapping runs
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress. Skipping trigger.');
      return { success: false, reason: 'already_running' };
    }

    // 2. Connectivity verification
    const netState = await networkService.checkConnectivity();
    if (!netState.isConnected || !netState.isInternetReachable) {
      this.notifyListeners({
        isSyncing: false,
        status: 'offline',
        message: 'Device is offline. Alerts remain stored in local SQLite outbox.',
      });
      return { success: false, reason: 'offline' };
    }

    // 3. Authentication verification
    const token = apiClient.getToken();
    if (!token) {
      this.notifyListeners({
        isSyncing: false,
        status: 'unauthenticated',
        message: 'Sign in to synchronize local records with the cloud.',
      });
      return { success: false, reason: 'unauthenticated' };
    }

    this.isSyncing = true;
    this.notifyListeners({ isSyncing: true, status: 'syncing', message: 'Synchronizing...' });

    let totalSynced = 0;
    let totalAlreadySynced = 0;
    let totalFailed = 0;

    try {
      // 4. Read eligible outbox items (respecting exponential backoff timers)
      const eligibleItems = await SyncQueueRepository.getEligibleItems(BATCH_SIZE);

      if (eligibleItems.length === 0) {
        this.isSyncing = false;
        this.notifyListeners({
          isSyncing: false,
          status: 'idle',
          message: 'All records are up to date.',
        });
        return { success: true, count: 0 };
      }

      console.log(`[SyncService] Processing batch of ${eligibleItems.length} eligible queue items...`);

      // 5. Assemble batch payloads by matching with local SQLite alert records
      const alertsToUpload = [];
      const queueItemsMap = new Map();

      for (const queueItem of eligibleItems) {
        await SyncQueueRepository.markAttempt(queueItem.id);

        const localAlert = await AlertRepository.getAlertById(queueItem.alertId);
        if (!localAlert) {
          // Local alert record was removed; remove stale queue record
          await SyncQueueRepository.remove(queueItem.id);
          continue;
        }

        queueItemsMap.set(localAlert.alertId, queueItem);

        alertsToUpload.push({
          alertId: localAlert.alertId,
          emergencyType: localAlert.emergencyType,
          details: localAlert.details,
          contactDetails: localAlert.contactDetails,
          location:
            typeof localAlert.latitude === 'number' && typeof localAlert.longitude === 'number'
              ? { latitude: localAlert.latitude, longitude: localAlert.longitude }
              : null,
          source: localAlert.source,
          originalSenderName: localAlert.senderName,
          createdAt: localAlert.createdAt,
          status: localAlert.deliveryStatus === 'Resolved' ? 'Resolved' : 'Pending',
        });
      }

      if (alertsToUpload.length === 0) {
        this.isSyncing = false;
        return { success: true, count: 0 };
      }

      // 6. Dispatch batch to backend /api/alerts/sync
      const response = await apiClient.syncAlerts(alertsToUpload);

      // Handle Authentication Expired error without wiping local items
      if (response.status === 401) {
        console.warn('[SyncService] Session token expired during sync.');
        for (const item of eligibleItems) {
          await SyncQueueRepository.markFailed(
            item.id,
            'Authentication expired. Please sign in to resume sync.',
            10000
          );
        }
        this.isSyncing = false;
        this.notifyListeners({
          isSyncing: false,
          status: 'auth_expired',
          message: 'Session expired. Please sign in to sync.',
        });
        return { success: false, reason: 'auth_expired' };
      }

      if (!response.success && !response.results) {
        // Network or server-level failure
        console.warn('[SyncService] Batch sync request failed:', response.error);
        for (const item of eligibleItems) {
          const backoff = this.calculateBackoff(item.retryCount);
          await SyncQueueRepository.markFailed(item.id, response.error, backoff);
        }
        totalFailed = eligibleItems.length;
      } else {
        // 7. Process individual alert results
        const results = response.results || [];
        for (const res of results) {
          const queueItem = queueItemsMap.get(res.alertId);

          if (res.status === 'synced' || res.status === 'already_synced') {
            // Success: update SQLite alert status to 'synced'
            await AlertRepository.updateAlertSyncStatus(res.alertId, 'synced');

            if (queueItem) {
              await SyncQueueRepository.remove(queueItem.id);
            }

            if (res.status === 'synced') totalSynced++;
            else totalAlreadySynced++;
          } else {
            // Failed: reschedule with backoff
            if (queueItem) {
              const backoff = this.calculateBackoff(queueItem.retryCount);
              await SyncQueueRepository.markFailed(
                queueItem.id,
                res.error || 'Server validation rejected alert.',
                backoff
              );
            }
            totalFailed++;
          }
        }
      }

      this.lastSyncTime = new Date().toISOString();
      this.lastSyncResult = {
        synced: totalSynced,
        alreadySynced: totalAlreadySynced,
        failed: totalFailed,
        total: alertsToUpload.length,
      };

      console.log(
        `[SyncService] Sync finished: ${totalSynced} synced, ${totalAlreadySynced} already synced, ${totalFailed} failed.`
      );

      this.notifyListeners({
        isSyncing: false,
        status: totalFailed > 0 ? 'partial_failure' : 'success',
        result: this.lastSyncResult,
        lastSyncTime: this.lastSyncTime,
      });

      return {
        success: totalFailed === 0,
        ...this.lastSyncResult,
      };
    } catch (err) {
      console.error('[SyncService] Fatal sync loop error:', err);
      this.notifyListeners({
        isSyncing: false,
        status: 'error',
        message: err.message,
      });
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
