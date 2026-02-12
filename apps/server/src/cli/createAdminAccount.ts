#!/usr/bin/env node
// TODO: Restrict to development only before production launch
// Currently enabled in production for internal testing

import { storage } from '../storage';
import * as bcrypt from 'bcrypt';

async function createAdminAccount() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.error('Usage: npm run admin:create <phoneNumber> <password> <secretKey>');
      console.error('Example: npm run admin:create +8613800138000 admin123 BYPASSSECRET12345678');
      process.exit(1);
    }

    const [phoneNumber, password, secretKey] = args;

    // Verify secret key
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    if (!expectedKey) {
      console.error('❌ Error: ADMIN_CREATE_SECRET_KEY not set in .env file');
      console.error('Please add: ADMIN_CREATE_SECRET_KEY=BYPASSSECRET12345678');
      process.exit(1);
    }

    if (secretKey !== expectedKey) {
      console.error('❌ Error: Invalid secret key');
      process.exit(1);
    }

    console.log('🔧 Creating admin account...');
    console.log(`📞 Phone: ${phoneNumber}`);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const existingUsers = await storage.getUserByPhone(phoneNumber);
    let user;

    if (existingUsers.length > 0) {
      // Update existing user to be admin
      user = existingUsers[0];
      user = await storage.updateUser(user.id, {
        password: hashedPassword,
        isAdmin: true,
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
      });
      console.log(`✅ Updated existing user to admin account`);
    } else {
      // Create new admin user
      user = await storage.createUserWithPhone({
        phoneNumber,
        email: `admin_${Date.now()}@joyjoin.app`,
        firstName: 'Admin',
        lastName: 'User',
      });
      user = await storage.updateUser(user.id, {
        password: hashedPassword,
        isAdmin: true,
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        displayName: 'Admin',
        primaryArchetype: '开心柯基',
      });
      console.log(`✅ Created new admin account`);
    }

    console.log('\n🎉 Success! Admin account ready:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Phone: ${user.phoneNumber}`);
    console.log(`   Login at: /admin/login`);
    console.log(`   Use phone + password to login`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin account:', error.message);
    process.exit(1);
  }
}

createAdminAccount();
