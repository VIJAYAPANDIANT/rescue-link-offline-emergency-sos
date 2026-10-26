/**
 * User File Store Service
 *
 * Implements persistent JSON-file storage for RescueLink users in `server/data/users.json`.
 *
 * Safety & Reliability Constraints:
 * 1. Safe JSON-file operations: writes to a temporary file and atomically renames.
 * 2. Overlapping writes prevented via an asynchronous operation mutex lock.
 * 3. Never silently overwrites corrupted files; explicit SyntaxError thrown.
 * 4. Case-insensitive email normalization.
 * 5. Password hashes are never leaked in returned safe user objects.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

class UserStore {
  constructor() {
    this.writeLock = Promise.resolve();
    this.ensureInitialized();
  }

  /**
   * Ensure data directory and users.json file exist.
   * Initializes with empty array `[]` only if the file does not exist.
   */
  ensureInitialized() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  /**
   * Helper to normalize email addresses for consistent lookups.
   */
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * Strips sensitive fields (passwordHash) before returning to API layers.
   */
  toSafeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Read and parse users.json safely.
   * If the file is corrupted (SyntaxError), throws an explicit error rather than wiping it.
   */
  async readUsers() {
    this.ensureInitialized();

    const rawData = await fs.promises.readFile(USERS_FILE, 'utf8');

    // Handle empty file edge-case
    if (!rawData.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        throw new Error('users.json root structure must be an Array.');
      }
      return parsed;
    } catch (parseError) {
      console.error('[CRITICAL] Corrupted users.json detected:', parseError.message);
      const corruptErr = new Error(
        `Corrupted user data file detected at ${USERS_FILE}: ${parseError.message}. Data will not be overwritten.`
      );
      corruptErr.code = 'CORRUPTED_USER_DATA';
      throw corruptErr;
    }
  }

  /**
   * Atomic write to users.json using a temp file.
   * Serialized through a promise-based write lock to prevent race conditions.
   */
  async writeUsers(usersList) {
    if (!Array.isArray(usersList)) {
      throw new Error('writeUsers requires an array of user objects.');
    }

    // Execute within serialized write queue
    return new Promise((resolve, reject) => {
      this.writeLock = this.writeLock
        .then(async () => {
          const tempFile = `${USERS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(usersList, null, 2);

          // Write payload to temporary file first
          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');

          // Atomically rename temp file over destination file
          await fs.promises.rename(tempFile, USERS_FILE);

          resolve();
        })
        .catch((err) => {
          console.error('[UserStore] Error writing users.json:', err);
          reject(err);
        });
    });
  }

  /**
   * Find a user by normalized email address.
   */
  async findByEmail(email) {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return null;

    const users = await this.readUsers();
    return users.find((u) => this.normalizeEmail(u.email) === normalized) || null;
  }

  /**
   * Find a user by ID.
   */
  async findById(id) {
    if (!id) return null;
    const users = await this.readUsers();
    return users.find((u) => u.id === id) || null;
  }

  /**
   * Create and persist a new user record.
   *
   * @param {object} params
   * @param {string} params.name
   * @param {string} params.email
   * @param {string} params.passwordHash
   * @returns {Promise<object>} Safe user record
   */
  async createUser({ name, email, passwordHash }) {
    const normalizedEmail = this.normalizeEmail(email);

    // Read current users
    const users = await this.readUsers();

    // Check for duplicate normalized email
    const existing = users.find((u) => this.normalizeEmail(u.email) === normalizedEmail);
    if (existing) {
      const conflictErr = new Error('A user with this email address already exists.');
      conflictErr.code = 'EMAIL_DUPLICATE';
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    const newUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    // Atomically persist updated array
    await this.writeUsers(users);

    return this.toSafeUser(newUser);
  }
}

const userStore = new UserStore();
module.exports = userStore;
