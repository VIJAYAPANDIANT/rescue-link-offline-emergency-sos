/**
 * RescueLink Mobile Notification Queue Service
 *
 * Coordinates offline generation of notification tasks upon SOS alert creation
 * and synchronizes notification history from backend when connected.
 */

import { ContactRepository } from '../../database/contactRepository.js';
import { NotificationRepository } from '../../database/notificationRepository.js';
import { apiClient } from '../api/apiClient.js';

class NotificationQueueService {
  /**
   * Queue local notification tasks for all enabled emergency contacts when an SOS is triggered.
   *
   * @param {object} alert - Local alert object
   * @param {object} [user] - Current authenticated user
   * @returns {Promise<Array<object>>} Recorded notification tasks
   */
  async queueLocalNotificationTasks(alert, user = null) {
    if (!alert || (!alert.alertId && !alert.id)) {
      return [];
    }

    const alertId = alert.alertId || alert.id;
    const userId = user?.id || alert.senderId;

    try {
      // Fetch enabled emergency contacts from SQLite
      const contacts = await ContactRepository.getEnabledContacts(userId);
      if (!contacts || contacts.length === 0) {
        return [];
      }

      const tasks = [];

      for (const contact of contacts) {
        // 1. Email channel task
        if (contact.email) {
          const task = await NotificationRepository.recordTask({
            alertId,
            contactId: contact.contactId || contact.id,
            contactName: contact.name,
            channel: 'email',
            recipient: contact.email,
            status: 'queued',
          });
          tasks.push(task);
        }

        // 2. SMS channel task
        if (contact.phone) {
          const task = await NotificationRepository.recordTask({
            alertId,
            contactId: contact.contactId || contact.id,
            contactName: contact.name,
            channel: 'sms',
            recipient: contact.phone,
            status: 'queued',
          });
          tasks.push(task);
        }
      }

      return tasks;
    } catch (err) {
      console.warn('[NotificationQueueService] Error enqueuing local notification tasks:', err.message);
      return [];
    }
  }

  /**
   * Retrieve all notification tasks for a specific alert.
   */
  async getTasksForAlert(alertId) {
    if (!alertId) return [];
    try {
      return await NotificationRepository.getTasksByAlertId(alertId);
    } catch (err) {
      console.warn('[NotificationQueueService] Error retrieving tasks:', err.message);
      return [];
    }
  }

  /**
   * Pull server-confirmed notification logs and update local SQLite task statuses.
   */
  async syncServerNotifications(alertId = null) {
    try {
      const response = await apiClient.getNotifications({ alertId, limit: 100 });
      if (!response.success || !Array.isArray(response.data)) {
        return { updated: 0, serverCount: 0 };
      }

      let updatedCount = 0;
      for (const serverTask of response.data) {
        // Record or update task in local SQLite
        await NotificationRepository.recordTask({
          taskId: serverTask.id,
          alertId: serverTask.alertId,
          contactId: serverTask.contactId,
          contactName: serverTask.contactName,
          channel: serverTask.channel,
          recipient: serverTask.recipient,
          status: serverTask.status,
          errorMessage: serverTask.errorMessage,
        });
        updatedCount++;
      }

      return { updated: updatedCount, serverCount: response.data.length };
    } catch (err) {
      console.warn('[NotificationQueueService] Error syncing server notifications:', err.message);
      return { updated: 0, serverCount: 0, error: err.message };
    }
  }
}

export const notificationQueueService = new NotificationQueueService();
export default notificationQueueService;
