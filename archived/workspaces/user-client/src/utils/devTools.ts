// Development-only tools. These are loaded only for explicit local opt-in.

const ARCHETYPES = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
];

const GENDERS = ['男性', '女性', '不透露'];
const CITIES = ['香港', '深圳', '广州', '北京', '上海'];

// Helper function to prompt for input
async function promptUser(message: string): Promise<string> {
  return new Promise((resolve) => {
    const input = prompt(message);
    resolve(input || '');
  });
}

// Helper function to show numbered menu and get selection
async function selectFromMenu(title: string, options: string[]): Promise<string> {
  console.log(`\n${title}`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  
  while (true) {
    const answer = await promptUser('\nEnter number:');
    const num = parseInt(answer);
    if (num >= 1 && num <= options.length) {
      return options[num - 1];
    }
    console.error('❌ Invalid selection. Please try again.');
  }
}

// API helper
async function apiCall(endpoint: string, body: any): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  
  return data;
}

// Dev tools object
export const devTools = {
  help() {
    console.log(`
🔧 JoyJoin Development Tools
============================

Available Commands:
------------------
window.dev.help()              - Show this help message
window.dev.checkSecretKey()    - Validate local dev auth tool setup
window.dev.archetypes()        - List all 12 archetypes
window.dev.createAdmin()       - Create admin account (interactive)
window.dev.createUser()        - Create user account (interactive)
window.dev.bypassTest()        - Bypass personality test for current user

Examples:
---------
// Test your secret key first
window.dev.checkSecretKey()

// List archetypes
window.dev.archetypes()

// Create admin account
window.dev.createAdmin()
> Enter secret key from your local ADMIN_CREATE_SECRET_KEY config
> Enter phone number: +8613800138000
> Enter password: admin123

// Create user account
window.dev.createUser()
> Enter secret key from your local ADMIN_CREATE_SECRET_KEY config
> Enter phone number: +8613900139000
> Enter password: user123
> ... (follow prompts)

// Bypass personality test
window.dev.bypassTest()
> Enter secret key from your local ADMIN_CREATE_SECRET_KEY config

Troubleshooting:
----------------
- If getting "Invalid secret key", try window.dev.checkSecretKey()
- Confirm ADMIN_CREATE_SECRET_KEY is set in your local environment
- Check server logs for detailed error messages

Security:
---------
⚠️ All commands require secret key authentication
⚠️ Requires explicit local opt-in and matching server-side dev flags
⚠️ Not registered in production by default
    `);
  },

  archetypes() {
    console.log('\n🎭 JoyJoin 12 Archetypes:');
    console.log('========================\n');
    ARCHETYPES.forEach((archetype, index) => {
      console.log(`${index + 1}. ${archetype}`);
    });
    console.log('\nUse these names when creating accounts or selecting archetypes.\n');
  },

  async createAdmin() {
    try {
      console.log('🔐 Admin Account Creator');
      console.log('========================\n');

      // Step 1: Secret key
      const secretKey = await promptUser('🔑 Enter secret key:');
      if (!secretKey) {
        console.error('❌ Secret key required');
        return;
      }

      console.log('🔍 Verifying secret key...');

      // Step 2: Phone number
      const phoneNumber = await promptUser('📱 Enter phone number (11 digits):');
      if (!phoneNumber) {
        console.error('❌ Phone number required');
        return;
      }

      // Step 3: Password
      const password = await promptUser('🔒 Enter password:');
      if (!password) {
        console.error('❌ Password required');
        return;
      }

      console.log('\n⏳ Creating admin account...');

      const response = await fetch('/api/dev/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, password, secretKey }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Error:', data.error || data.message || 'Unknown error');
        if (data.hint) console.log('💡 Hint:', data.hint);
        return;
      }

      console.log('\n✅ Admin account created successfully!');
      console.log('📋 Login details:');
      console.log('   Phone:', phoneNumber);
      console.log('   Password:', password);
      console.log('   Admin Portal: ' + window.location.origin + '/admin/login');
    } catch (error: any) {
      console.error('❌ Network error:', error);
      console.log('💡 Make sure the API server is running');
    }
  },

  async createUser() {
    try {
      console.log('🔐 User Account Creator');
      console.log('====================\n');

      // Step 1: Secret key
      const secretKey = await promptUser('🔑 Enter secret key:');
      if (!secretKey) {
        console.error('❌ Secret key required');
        return;
      }

      console.log('🔍 Verifying secret key...');

      // Step 2: Phone number
      const phoneNumber = await promptUser('📱 Enter phone number (e.g., +8613900139000):');
      if (!phoneNumber) {
        console.error('❌ Phone number required');
        return;
      }

      // Step 3: Password
      const password = await promptUser('🔒 Enter password:');
      if (!password) {
        console.error('❌ Password required');
        return;
      }

      // Step 4: Display name
      const displayName = await promptUser('👤 Enter display name:');
      if (!displayName) {
        console.error('❌ Display name required');
        return;
      }

      // Step 5: Archetype selection
      const archetype = await selectFromMenu('🎭 Select archetype:', ARCHETYPES);

      // Step 6: Gender selection
      const gender = await selectFromMenu('⚧️ Select gender:', GENDERS);

      // Step 7: City selection
      const city = await selectFromMenu('🌆 Select city:', CITIES);

      // Step 8: Age (optional)
      const ageStr = await promptUser('🎂 Enter age (optional, press Cancel/ESC to skip):');
      const age = ageStr ? parseInt(ageStr) : undefined;

      // Step 9: Industry (optional)
      const industry = await promptUser('💼 Enter industry (optional, press Cancel/ESC to skip):');

      // Step 10: Top interests (optional)
      const topInterests = await promptUser('❤️ Enter interests (comma-separated, optional, press Cancel/ESC to skip):');

      console.log('\n⏳ Creating user account...');

      const response = await fetch('/api/dev/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          password,
          secretKey,
          displayName,
          archetype,
          gender,
          city,
          age: age ? String(age) : undefined,
          industry: industry || undefined,
          topInterests: topInterests || undefined,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Error:', data.error || data.message || 'Unknown error');
        if (data.hint) console.log('💡 Hint:', data.hint);
        return;
      }

      console.log('\n✅ User account created successfully!');
      console.log('📋 Login details:');
      console.log('   Phone:', phoneNumber);
      console.log('   Display Name:', displayName);
      console.log('   Archetype:', archetype);
      console.log('\n   Login at: ' + window.location.origin + '/login');
      console.log('   Use phone + verification code (demo: 666666)');
    } catch (error: any) {
      console.error('❌ Network error:', error);
      console.log('💡 Make sure the API server is running');
    }
  },

  async bypassTest() {
    try {
      console.log('🔐 Bypass Personality Test');
      console.log('========================\n');

      // Step 1: Secret key
      const secretKey = await promptUser('🔑 Enter secret key:');
      if (!secretKey) {
        console.error('❌ Secret key required');
        return;
      }

      console.log('🔍 Verifying secret key...');
      console.log('⏳ Bypassing personality test...');

      const response = await fetch('/api/dev/personality-test/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Error:', data.error || data.message || 'Unknown error');
        if (data.hint) console.log('💡 Hint:', data.hint);
        return;
      }

      console.log('\n✅ Success! Personality test bypassed');
      console.log(`   Archetype: ${data.archetype}`);
      console.log('\n   Redirecting to discover page...');

      // Redirect to discover page
      setTimeout(() => {
        window.location.href = '/discover';
      }, 1000);
    } catch (error: any) {
      console.error('❌ Network error:', error);
      console.log('💡 Make sure the API server is running');
    }
  },

  async checkSecretKey() {
    try {
      console.log('🔍 Testing secret key configuration...\n');

      const secretKey = await promptUser('🔑 Enter secret key to test:');
      if (!secretKey) {
        console.error('❌ Secret key required');
        return;
      }

      console.log('⏳ Checking secret key...');

      const response = await fetch('/api/dev/check-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Secret key is valid!');
        console.log('   Key length:', data.keyLength);
      } else {
        console.error('❌ Secret key validation failed');
        console.error('   Error:', data.error);
        if (data.hint) console.log('💡 Hint:', data.hint);
        if (data.serverKeyLength !== undefined) {
          console.log('   Expected key length:', data.serverKeyLength);
          console.log('   Provided key length:', data.providedKeyLength);
        }
      }
    } catch (error: any) {
      console.error('❌ Network error:', error);
      console.log('💡 Make sure the API server is running');
    }
  },
};

// Type declaration for global window
declare global {
  interface Window {
    dev: typeof devTools;
  }
}
