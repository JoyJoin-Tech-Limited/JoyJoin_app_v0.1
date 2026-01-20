#!/usr/bin/env node

/**
 * Migration Script: Rename primary_role/secondary_role to primary_archetype/secondary_archetype
 * 
 * This script applies the column rename migration to the database.
 * It is IDEMPOTENT and safe to run multiple times.
 * 
 * Usage:
 *   node scripts/migrate-rename-role-to-archetype.js
 * 
 * Or with explicit DATABASE_URL:
 *   DATABASE_URL="your-connection-string" node scripts/migrate-rename-role-to-archetype.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('   Please set DATABASE_URL in your .env file or environment');
  process.exit(1);
}

async function runMigration() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n📝 Reading migration file...');
    const migrationPath = join(__dirname, '..', 'migrations', '20260119000000_rename_role_to_archetype.sql');
    
    // Check if migration file exists
    let migrationSQL;
    try {
      migrationSQL = readFileSync(migrationPath, 'utf-8');
      console.log('✅ Migration file loaded');
    } catch (err) {
      console.error('❌ Failed to read migration file:', migrationPath);
      console.error('   Error:', err.message);
      throw err;
    }

    // Check if required tables exist
    console.log('\n🔍 Checking if required tables exist...');
    const usersTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `);
    
    const roleResultsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'role_results'
      ) as exists
    `);
    
    if (!usersTableExists.rows[0].exists || !roleResultsTableExists.rows[0].exists) {
      console.log('   ℹ️  Required tables do not exist yet');
      console.log('   ✅ Migration skipped - tables will be created by schema push');
      console.log('   This is expected for new databases or before drizzle-kit push runs\n');
      return; // Exit successfully without doing anything
    }
    
    console.log('   ✅ Required tables exist');

    console.log('\n🚀 Executing migration...');
    console.log('   This will rename columns from *_role to *_archetype');
    console.log('   Migration is idempotent - safe to run multiple times\n');

    try {
      await client.query(migrationSQL);
      console.log('✅ Migration SQL executed successfully!');
    } catch (sqlError) {
      console.error('❌ Failed to execute migration SQL:', sqlError.message);
      console.error('   This could be due to:');
      console.error('   - Column already renamed (check database)');
      console.error('   - Permission issues');
      console.error('   - Database connection problems');
      console.error('\n   Full error:', sqlError);
      throw sqlError;
    }

    console.log('\n📊 Verifying column names...');

    // Verify users table
    const usersCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('primary_archetype', 'secondary_archetype', 'primary_role', 'secondary_role')
      ORDER BY column_name
    `);

    console.log('\n   users table columns:');
    usersCheck.rows.forEach(row => {
      const icon = row.column_name.includes('archetype') ? '✅' : '⚠️ ';
      console.log(`   ${icon} ${row.column_name}`);
    });

    // Verify role_results table
    const roleResultsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'role_results' 
      AND column_name IN (
        'primary_archetype', 'primary_archetype_score',
        'secondary_archetype', 'secondary_archetype_score',
        'primary_role', 'primary_role_score',
        'secondary_role', 'secondary_role_score'
      )
      ORDER BY column_name
    `);

    console.log('\n   role_results table columns:');
    roleResultsCheck.rows.forEach(row => {
      const icon = row.column_name.includes('archetype') ? '✅' : '⚠️ ';
      console.log(`   ${icon} ${row.column_name}`);
    });

    const hasOldColumns = [...usersCheck.rows, ...roleResultsCheck.rows]
      .some(row => row.column_name.includes('_role'));

    if (hasOldColumns) {
      console.log('\n⚠️  WARNING: Some old column names still exist!');
      console.log('   This might indicate the migration did not complete fully.');
      console.log('   Please check the database manually.');
      process.exit(1);
    } else {
      console.log('\n🎉 SUCCESS! All columns have been renamed correctly.');
      console.log('   Database schema is now in sync with application code.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('   Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigration();
