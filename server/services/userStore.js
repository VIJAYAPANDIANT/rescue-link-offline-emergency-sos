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
 * 6. Role-based access control (role: 'admin' | 'responder' | 'user').
 * 7. Account status flags (status: 'active' | 'suspended' | 'deactivated').
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
    const { passwordHash, ...rest } = user;
    return {
      id: rest.id,
      name: rest.name,
      email: rest.email,
      role: rest.role || 'user',
      status: rest.status || 'active',
      createdAt: rest.createdAt,
      updatedAt: rest.updatedAt || rest.createdAt,
    };
  }

  /**
   * Read and parse users.json safely.
   */
  async readUsers() {
    this.ensureInitialized();

    const rawData = await fs.promises.readFile(USERS_FILE, 'utf8');

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
   * Atomic write to users.json using a temp file with Windows file-lock retry.
   */
  async writeUsers(usersList) {
    if (!Array.isArray(usersList)) {
      throw new Error('writeUsers requires an array of user objects.');
    }

    return new Promise((resolve, reject) => {
      this.writeLock = this.writeLock
        .then(async () => {
          const tempFile = `${USERS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(usersList, null, 2);

          // Write payload to temporary file first
          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');

          // Atomically rename temp file over destination file with retry
          let renamed = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              await fs.promises.rename(tempFile, USERS_FILE);
              renamed = true;
              break;
            } catch (err) {
              if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < 4) {
                await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
              } else {
                try { await fs.promises.unlink(tempFile); } catch (e) {}
                throw err;
              }
            }
          }

          if (renamed) resolve();
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
   */
  async createUser({ name, email, passwordHash, role = 'user', status = 'active' }) {
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
      role: ['admin', 'responder', 'user'].includes(role) ? role : 'user',
      status: ['active', 'suspended', 'deactivated'].includes(status) ? status : 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);

    // Atomically persist updated array
    await this.writeUsers(users);

    return this.toSafeUser(newUser);
  }

  /**
   * Update an existing user's role or status.
   */
  async updateUser(id, updates = {}) {
    if (!id) return null;
    const users = await this.readUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const user = users[index];
    if (updates.role && ['admin', 'responder', 'user'].includes(updates.role)) {
      user.role = updates.role;
    }
    if (updates.status && ['active', 'suspended', 'deactivated'].includes(updates.status)) {
      user.status = updates.status;
    }
    if (updates.name && typeof updates.name === 'string' && updates.name.trim().length >= 2) {
      user.name = updates.name.trim();
    }
    if (updates.passwordHash) {
      user.passwordHash = updates.passwordHash;
    }
    user.updatedAt = new Date().toISOString();

    users[index] = user;
    await this.writeUsers(users);
    return this.toSafeUser(user);
  }

  /**
   * Retrieve paginated users with optional search and filters.
   */
  async getAllUsers({ page = 1, limit = 20, search, role, status } = {}) {
    const users = await this.readUsers();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let filtered = users.map((u) => this.toSafeUser(u)).filter((u) => {
      if (role && role !== 'all' && u.role !== role) return false;
      if (status && status !== 'all' && u.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesId = u.id.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      return true;
    });

    // Newest first
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIndex, startIndex + limitNum);

    return {
      users: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Count users by status and total.
   */
  async countUsers() {
    const users = await this.readUsers();
    const total = users.length;
    let active = 0;
    let suspended = 0;
    let admins = 0;

    for (const u of users) {
      if ((u.status || 'active') === 'active') active++;
      if (u.status === 'suspended') suspended++;
      if (u.role === 'admin') admins++;
    }

    return { total, active, suspended, admins };
  }
}

const userStore = new UserStore();
module.exports = userStore;
