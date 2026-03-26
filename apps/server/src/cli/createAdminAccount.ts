#!/usr/bin/env node
/**
 * createAdminAccount – Bootstrap CLI for admin account creation.
 *
 * Creates a new admin account in the admin_accounts table (username/password/role).
 * Replaces the legacy phone-number-based admin creation flow.
 *
 * Usage:
 *   npm run admin:create <username> <password> <secretKey> [role] [displayName]
 *
 * role: super_admin | operator | viewer  (default: super_admin)
 *
 * Examples:
 *   npm run admin:create admin admin123 BYPASSSECRET12345678
 *   npm run admin:create ops_user MyPass99 BYPASSSECRET12345678 operator "运营小王"
 */

import { storage } from '../storage';
import * as bcrypt from 'bcrypt';

async function createAdminAccount() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 3) {
      console.error('Usage: npm run admin:create <username> <password> <secretKey> [role] [displayName]');
      console.error('Example: npm run admin:create admin admin123 BYPASSSECRET12345678');
      console.error('Roles: super_admin (default) | operator | viewer');
      process.exit(1);
    }

    const [username, password, secretKey, role = 'super_admin', displayName] = args;

    // Validate secret key
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    if (!expectedKey) {
      console.error('❌ Error: ADMIN_CREATE_SECRET_KEY not set in .env file');
      process.exit(1);
    }
    if (secretKey !== expectedKey) {
      console.error('❌ Error: Invalid secret key');
      process.exit(1);
    }

    const validRoles = ['super_admin', 'operator', 'viewer'];
    if (!validRoles.includes(role)) {
      console.error(`❌ Error: Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`);
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters');
      process.exit(1);
    }

    console.log('🔧 Creating admin account...');
    console.log(`👤 Username: ${username}`);
    console.log(`🎭 Role: ${role}`);

    // Check if username already exists
    const existing = await storage.getAdminAccountByUsername(username);
    if (existing) {
      console.error(`❌ Error: Username "${username}" already exists`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const account = await storage.createAdminAccount({
      username,
      passwordHash,
      role,
      displayName: displayName || undefined,
    });

    console.log('\n🎉 Success! Admin account created:');
    console.log(`   ID:           ${account.id}`);
    console.log(`   Username:     ${account.username}`);
    console.log(`   Role:         ${account.role}`);
    console.log(`   Display Name: ${account.displayName || '(none)'}`);
    console.log(`\n   Login at: /admin/login`);
    console.log(`   Use username + password to login`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin account:', error.message);
    process.exit(1);
  }
}

createAdminAccount();
