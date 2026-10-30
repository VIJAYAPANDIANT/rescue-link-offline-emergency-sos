#!/usr/bin/env node
/**
 * Safe Initial Administrator Setup CLI
 *
 * Usage:
 *   node scripts/create-admin.js --email admin@rescuelink.org --password "YourStrongPassword" --name "Lead Administrator"
 *
 * Or via environment variables:
 *   ADMIN_EMAIL=admin@rescuelink.org ADMIN_PASSWORD=YourPassword node scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');
const userStore = require('../services/userStore');
const auditStore = require('../services/auditStore');

// Parse simple CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        params[key] = next;
        i++;
      } else {
        params[key] = true;
      }
    }
  }
  return params;
}

async function run() {
  const cliArgs = parseArgs();

  const name = cliArgs.name || process.env.ADMIN_NAME || 'System Administrator';
  const email = cliArgs.email || process.env.ADMIN_EMAIL;
  const password = cliArgs.password || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('====================================================');
    console.error(' RescueLink Initial Administrator Setup');
    console.error('====================================================');
    console.error('ERROR: Both email and password are required.');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/create-admin.js --name "Admin Name" --email "admin@rescuelink.org" --password "StrongPass123"');
    console.error('');
    console.error('Or with environment variables:');
    console.error('  ADMIN_NAME="Admin" ADMIN_EMAIL="admin@rescuelink.org" ADMIN_PASSWORD="StrongPassword" node scripts/create-admin.js');
    console.error('====================================================');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('ERROR: Admin password must be at least 6 characters long.');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await userStore.findByEmail(normalizedEmail);

    if (existing) {
      console.log(`User <${normalizedEmail}> already exists. Promoting to administrator role...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const updated = await userStore.updateUser(existing.id, {
        role: 'admin',
        status: 'active',
        name,
        passwordHash,
      });

      await auditStore.createLog({
        action: 'ADMIN_SETUP_PROMOTION',
        adminId: existing.id,
        adminEmail: normalizedEmail,
        targetType: 'user',
        targetId: existing.id,
        details: { email: normalizedEmail, promotedTo: 'admin' },
      });

      console.log('====================================================');
      console.log(' SUCCESS: User promoted to Administrator');
      console.log(` ID:    ${updated.id}`);
      console.log(` Email: ${updated.email}`);
      console.log(` Role:  ${updated.role}`);
      console.log('====================================================');
    } else {
      console.log(`Creating new administrator account for <${normalizedEmail}>...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const newUser = await userStore.createUser({
        name,
        email: normalizedEmail,
        passwordHash,
        role: 'admin',
        status: 'active',
      });

      await auditStore.createLog({
        action: 'ADMIN_SETUP_CREATION',
        adminId: newUser.id,
        adminEmail: normalizedEmail,
        targetType: 'user',
        targetId: newUser.id,
        details: { email: normalizedEmail, role: 'admin' },
      });

      console.log('====================================================');
      console.log(' SUCCESS: Administrator account created successfully');
      console.log(` ID:    ${newUser.id}`);
      console.log(` Name:  ${newUser.name}`);
      console.log(` Email: ${newUser.email}`);
      console.log(` Role:  ${newUser.role}`);
      console.log('====================================================');
    }
    process.exit(0);
  } catch (err) {
    console.error('FAILED to initialize administrator:', err.message);
    process.exit(1);
  }
}

run();
