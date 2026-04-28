#!/usr/bin/env node
import { assertProductionAuthDebugSurfaceAllowed } from '../auth/policy';
import { logger } from '../lib/logger';

import { storage } from '../storage';

async function bypassLogin() {
  try {
    assertProductionAuthDebugSurfaceAllowed('bypassLogin CLI');
    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 2) {
      logger.error('Usage: npm run user:bypass <phoneNumber> <secretKey>');
      logger.error('Example: npm run user:bypass +8613800138000 BYPASSSECRET12345678');
      process.exit(1);
    }

    const [phoneNumber, secretKey] = args;

    // Verify secret key
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    if (!expectedKey) {
      logger.error('ADMIN_CREATE_SECRET_KEY not set in .env file');
      logger.error('Please add ADMIN_CREATE_SECRET_KEY to your local environment before retrying.');
      process.exit(1);
    }

    if (secretKey !== expectedKey) {
      logger.error('Invalid secret key');
      process.exit(1);
    }

    logger.info('Bypassing personality test...', { phoneNumber });

    // Find user
    const existingUsers = await storage.getUserByPhone(phoneNumber);

    if (existingUsers.length === 0) {
      logger.error('User not found with this phone number', { phoneNumber });
      process.exit(1);
    }

    const user = existingUsers[0];

    // Set default archetype if none exists
    const updates: Record<string, unknown> = {
      hasCompletedPersonalityTest: true,
    };

    if (!user.primaryArchetype) {
      updates.primaryArchetype = 'corgi'; // Default archetype
      logger.info('No archetype found, setting default: corgi', { userId: user.id });
    }

    await storage.updateUser(user.id, updates);

    logger.info('Personality test bypassed', {
      userId: user.id,
      phone: user.phoneNumber,
      displayName: user.displayName || 'Not set',
      archetype: user.primaryArchetype || 'corgi',
    });

    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error bypassing test', { error: message });
    process.exit(1);
  }
}

bypassLogin();
