#!/usr/bin/env node
import { assertProductionAuthDebugSurfaceAllowed } from '../auth/policy';

import { storage } from '../storage';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';
import { ARCHETYPE_NAMES } from '../archetypeConfig';
import type { ArchetypeName } from '../archetypeConfig';

const ARCHETYPES = ARCHETYPE_NAMES;
const GENDERS = ['男性', '女性', '不透露'];
const CITIES = ['香港', '深圳', '广州', '北京', '上海'];

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function selectFromMenu(rl: readline.Interface, title: string, options: readonly string[]): Promise<string> {
  console.log(`\n${title}`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  
  while (true) {
    const answer = await prompt(rl, '\nEnter number: ');
    const num = parseInt(answer);
    if (num >= 1 && num <= options.length) {
      return options[num - 1];
    }
    console.log('❌ Invalid selection. Please try again.');
  }
}

async function createUserAccount() {
  const rl = createReadlineInterface();

  try {
    assertProductionAuthDebugSurfaceAllowed('createUserAccount CLI');
    console.log('🔧 JoyJoin User Account Creator');
    console.log('================================\n');

    // Step 1: Verify secret key
    const secretKey = await prompt(rl, '🔐 Enter secret key: ');
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    
    if (!expectedKey) {
      console.error('❌ Error: ADMIN_CREATE_SECRET_KEY not set in .env file');
      console.error('Please add ADMIN_CREATE_SECRET_KEY to your local environment before retrying.');
      rl.close();
      process.exit(1);
    }

    if (secretKey !== expectedKey) {
      console.error('❌ Error: Invalid secret key');
      rl.close();
      process.exit(1);
    }

    console.log('✅ Secret key verified\n');

    // Step 2: Phone number
    let phoneNumber: string;
    while (true) {
      phoneNumber = await prompt(rl, '📞 Enter phone number (11 digits): ');
      if (phoneNumber.length === 11 && /^\d+$/.test(phoneNumber)) {
        phoneNumber = `+86${phoneNumber}`;
        break;
      }
      if (phoneNumber.startsWith('+') && phoneNumber.length > 10) {
        break;
      }
      console.log('❌ Invalid phone number. Please enter 11 digits or format like +8613800138000');
    }

    // Step 3: Password
    const password = await prompt(rl, '🔑 Enter password: ');
    if (!password) {
      console.error('❌ Password is required');
      rl.close();
      process.exit(1);
    }

    // Step 4: Display name
    const displayName = await prompt(rl, '👤 Enter display name: ');
    if (!displayName) {
      console.error('❌ Display name is required');
      rl.close();
      process.exit(1);
    }

    // Step 5: Archetype selection
    const archetype = await selectFromMenu(rl, '🎭 Select archetype:', ARCHETYPES);

    // Step 6: Gender selection
    const gender = await selectFromMenu(rl, '⚧️ Select gender:', GENDERS);

    // Step 7: City selection
    const city = await selectFromMenu(rl, '🌆 Select city:', CITIES);

    // Step 8: Industry (optional)
    const industry = await prompt(rl, '💼 Enter industry (optional, press Enter to skip): ');

    console.log('\n⏳ Creating user account...');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user exists
    const existingUsers = await storage.getUserByPhone(phoneNumber);
    let user;

    const userData: Record<string, unknown> = {
      password: hashedPassword,
      displayName,
      primaryArchetype: archetype as ArchetypeName,
      gender,
      currentCity: city,
      hasCompletedPersonalityTest: true,
    };

    if (industry) {
      userData.currentOccupation = industry;
    }

    if (existingUsers.length > 0) {
      // Update existing user
      user = existingUsers[0];
      user = await storage.updateUser(user.id, userData);
      console.log('✅ Updated existing user account');
    } else {
      // Create new user
      user = await storage.createUserWithPhone({
        phoneNumber,
        email: `user_${Date.now()}@joyjoin.app`,
        firstName: displayName.split(' ')[0] || displayName,
        lastName: displayName.split(' ')[1] || '',
      });
      user = await storage.updateUser(user.id, userData);
      console.log('✅ Created new user account');
    }

    console.log('\n🎉 Success! User account ready:');
    console.log('================================');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Phone: ${user.phoneNumber}`);
    console.log(`   Display Name: ${user.displayName}`);
    console.log(`   Archetype: ${user.primaryArchetype}`);
    console.log(`   Gender: ${user.gender}`);
    console.log(`   City: ${user.currentCity}`);
    if (industry) console.log(`   Industry: ${industry}`);
    console.log('\n   Login at: /login');
    console.log('   Use phone + verification code (demo: 666666)');

    rl.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Error creating user account:', message);
    rl.close();
    process.exit(1);
  }
}

createUserAccount();
