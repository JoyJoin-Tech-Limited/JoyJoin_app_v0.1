#!/usr/bin/env node

/**
 * Migration Script: Fix Assessment Answer Unique Constraint
 * 
 * This script removes duplicate assessment answers and ensures the unique constraint exists.
 * It is IDEMPOTENT and safe to run multiple times.
 * 
 * Usage:
 *   node scripts/migrate-fix-assessment-constraint.js
 * 
 * Or with explicit DATABASE_URL:
 *   DATABASE_URL="your-connection-string" node scripts/migrate-fix-assessment-constraint.js
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
    const migrationPath = join(__dirname, '..', 'migrations', '20260119205000_fix_assessment_answer_unique_constraint.sql');
    
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

    // Check current state before migration
    console.log('\n🔍 Checking current state...');
    
    // First, check if the table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'assessment_answers'
      ) as exists
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('   ℹ️  Table "assessment_answers" does not exist yet');
      console.log('   ✅ Migration skipped - table will be created by schema push');
      console.log('   This is expected for new databases or before drizzle-kit push runs\n');
      return; // Exit successfully without doing anything
    }
    
    console.log('   ✅ Table "assessment_answers" exists');
    
    // Count duplicates
    const duplicatesCheck = await client.query(`
      SELECT session_id, question_id, COUNT(*) as duplicate_count
      FROM assessment_answers
      GROUP BY session_id, question_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 10
    `);
    
    if (duplicatesCheck.rows.length > 0) {
      console.log(`   ⚠️  Found ${duplicatesCheck.rows.length} sets of duplicate answers`);
      console.log('   Sample duplicates:');
      duplicatesCheck.rows.slice(0, 3).forEach(row => {
        console.log(`      Session: ${row.session_id.substring(0, 8)}... Question: ${row.question_id} (${row.duplicate_count} duplicates)`);
      });
    } else {
      console.log('   ✅ No duplicate answers found');
    }

    // Check if constraint exists
    const constraintCheck = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'assessment_answer_session_question_unique'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('   ✅ Unique constraint already exists');
    } else {
      console.log('   ⚠️  Unique constraint does NOT exist - will be created');
    }

    console.log('\n🚀 Executing migration...');
    console.log('   This will:');
    console.log('   1. Remove duplicate assessment answers (keeping most recent)');
    console.log('   2. Add unique constraint if missing');
    console.log('   Migration is idempotent - safe to run multiple times\n');

    try {
      await client.query(migrationSQL);
      console.log('✅ Migration SQL executed successfully!');
    } catch (sqlError) {
      console.error('❌ Failed to execute migration SQL:', sqlError.message);
      console.error('   This could be due to:');
      console.error('   - Permission issues');
      console.error('   - Database connection problems');
      console.error('   - Constraint already exists (which is OK)');
      console.error('\n   Full error:', sqlError);
      
      // Check PostgreSQL error code for constraint already exists (42P07)
      if (sqlError.code === '42P07') {
        console.log('\n✅ Constraint already exists - this is expected on re-run');
      } else {
        throw sqlError;
      }
    }

    console.log('\n📊 Verifying final state...');

    // Count remaining rows
    const totalCount = await client.query('SELECT COUNT(*) FROM assessment_answers');
    console.log(`   Total assessment answers: ${totalCount.rows[0].count}`);

    // Check for remaining duplicates
    const remainingDuplicates = await client.query(`
      SELECT session_id, question_id, COUNT(*) as duplicate_count
      FROM assessment_answers
      GROUP BY session_id, question_id
      HAVING COUNT(*) > 1
    `);

    if (remainingDuplicates.rows.length > 0) {
      console.log(`\n   ⚠️  WARNING: Still found ${remainingDuplicates.rows.length} sets of duplicates!`);
      console.log('   This should not happen. Please investigate manually.');
      process.exit(1);
    } else {
      console.log('   ✅ No duplicate answers remain');
    }

    // Verify constraint exists
    const finalConstraintCheck = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'assessment_answer_session_question_unique'
    `);

    if (finalConstraintCheck.rows.length > 0) {
      console.log('   ✅ Unique constraint is in place');
    } else {
      console.log('   ❌ ERROR: Unique constraint was not created!');
      process.exit(1);
    }

    console.log('\n🎉 SUCCESS! Assessment answer constraint migration completed.');
    console.log('   - All duplicates removed');
    console.log('   - Unique constraint in place');
    console.log('   - presignup-sync endpoint should now work correctly');

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
