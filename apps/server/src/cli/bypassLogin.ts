#!/usr/bin/env node
// TODO: Restrict to development only before production launch
// Currently enabled in production for internal testing

import { storage } from '../storage';

async function bypassLogin() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: npm run user:bypass <phoneNumber> <secretKey>');
      console.error('Example: npm run user:bypass +8613800138000 BYPASSSECRET12345678');
      process.exit(1);
    }

    const [phoneNumber, secretKey] = args;

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

    console.log('🔧 Bypassing personality test...');
    console.log(`📞 Phone: ${phoneNumber}`);

    // Find user
    const existingUsers = await storage.getUserByPhone(phoneNumber);
    
    if (existingUsers.length === 0) {
      console.error('❌ Error: User not found with this phone number');
      process.exit(1);
    }

    const user = existingUsers[0];

    // Set default archetype if none exists
    const updates: any = {
      hasCompletedPersonalityTest: true,
    };

    if (!user.primaryArchetype) {
      updates.primaryArchetype = '开心柯基'; // Default archetype
      console.log('ℹ️ No archetype found, setting default: 开心柯基');
    }

    await storage.updateUser(user.id, updates);

    console.log('\n✅ Success! Personality test bypassed:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Phone: ${user.phoneNumber}`);
    console.log(`   Display Name: ${user.displayName || 'Not set'}`);
    console.log(`   Archetype: ${user.primaryArchetype || '开心柯基'}`);
    console.log('\n   User can now access the app without completing the personality test');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error bypassing test:', error.message);
    process.exit(1);
  }
}

bypassLogin();
