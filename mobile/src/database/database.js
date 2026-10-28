/**
 * RescueLink Database Service
 *
 * Manages SQLite database connection, PRAGMA setup, and lifecycle.
 */

import { runMigrations } from './migrations.js';

const DB_NAME = 'rescuelink_emergency.db';

let dbInstance = null;
let initPromise = null;
let customDbDriver = null;

/**
 * Configure an injected database driver (primarily for testing or custom mocks)
 */
export const setCustomDatabase = (driver) => {
  customDbDriver = driver;
  dbInstance = driver;
};

/**
 * Reset database instance (useful during tests or reset actions)
 */
export const resetDatabaseInstance = async () => {
  if (dbInstance && typeof dbInstance.closeAsync === 'function') {
    try {
      await dbInstance.closeAsync();
    } catch (e) {
      // Ignore close errors
    }
  }
  dbInstance = null;
  initPromise = null;
  customDbDriver = null;
};

/**
 * Retrieve the active, migrated SQLite database instance.
 */
export const getDatabase = async () => {
  if (customDbDriver) {
    return customDbDriver;
  }

  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Dynamic import to avoid crashes in non-React Native environments
      const SQLite = require('expo-sqlite');

      if (!SQLite || typeof SQLite.openDatabaseAsync !== 'function') {
        throw new Error('expo-sqlite openDatabaseAsync is unavailable in this environment.');
      }

      console.log(`[Database] Opening SQLite database: ${DB_NAME}`);
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      // Configure WAL (Write-Ahead Logging) and Foreign Keys
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `);

      // Run versioned migrations
      await runMigrations(db);

      dbInstance = db;
      return dbInstance;
    } catch (error) {
      console.error('[Database] Database initialization error:', error.message);
      dbInstance = null;
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

export default {
  getDatabase,
  resetDatabaseInstance,
  setCustomDatabase,
};
