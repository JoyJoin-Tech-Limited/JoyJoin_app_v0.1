#!/usr/bin/env node

/**
 * Validation Script: Verify Assessment Constraint Fix Files
 * 
 * This script validates that all necessary files for the constraint fix are in place
 * and properly formatted. Run this before deployment to catch any issues early.
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating Assessment Constraint Fix...\n');

let hasErrors = false;

// Check 1: Migration SQL file exists
const migrationPath = join(__dirname, '..', 'migrations', '20260119205000_fix_assessment_answer_unique_constraint.sql');
if (existsSync(migrationPath)) {
  console.log('✅ Migration SQL file exists');
  
  // Validate SQL content
  const sqlContent = readFileSync(migrationPath, 'utf-8');
  const requiredPatterns = [
    'DELETE FROM assessment_answers',
    'assessment_answer_session_question_unique',
    'ROW_NUMBER() OVER',
    'PARTITION BY session_id, question_id',
    'DO $$',
  ];
  
  for (const pattern of requiredPatterns) {
    if (sqlContent.includes(pattern)) {
      console.log(`   ✅ Contains: ${pattern}`);
    } else {
      console.log(`   ❌ Missing: ${pattern}`);
      hasErrors = true;
    }
  }
} else {
  console.log('❌ Migration SQL file NOT found:', migrationPath);
  hasErrors = true;
}

// Check 2: Migration script exists
const scriptPath = join(__dirname, 'migrate-fix-assessment-constraint.js');
if (existsSync(scriptPath)) {
  console.log('\n✅ Migration script exists');
  
  // Validate script content
  const scriptContent = readFileSync(scriptPath, 'utf-8');
  const requiredScriptPatterns = [
    'import pg from',
    'DATABASE_URL',
    'duplicatesCheck',
    'constraintCheck',
    'readFileSync',
  ];
  
  for (const pattern of requiredScriptPatterns) {
    if (scriptContent.includes(pattern)) {
      console.log(`   ✅ Contains: ${pattern}`);
    } else {
      console.log(`   ❌ Missing: ${pattern}`);
      hasErrors = true;
    }
  }
} else {
  console.log('\n❌ Migration script NOT found:', scriptPath);
  hasErrors = true;
}

// Check 3: Deployment script updated
const deployScriptPath = join(__dirname, '..', 'deployment', 'scripts', 'deploy.sh');
if (existsSync(deployScriptPath)) {
  console.log('\n✅ Deployment script exists');
  
  const deployContent = readFileSync(deployScriptPath, 'utf-8');
  if (deployContent.includes('migrate-fix-assessment-constraint.js')) {
    console.log('   ✅ References constraint migration script');
  } else {
    console.log('   ❌ Does NOT reference constraint migration script');
    hasErrors = true;
  }
} else {
  console.log('\n❌ Deployment script NOT found');
  hasErrors = true;
}

// Check 4: CI/CD workflow updated
const cicdPath = join(__dirname, '..', '.github', 'workflows', 'cicd.yml');
if (existsSync(cicdPath)) {
  console.log('\n✅ CI/CD workflow exists');
  
  const cicdContent = readFileSync(cicdPath, 'utf-8');
  if (cicdContent.includes('migrate-fix-assessment-constraint.js')) {
    console.log('   ✅ References constraint migration script');
  } else {
    console.log('   ❌ Does NOT reference constraint migration script');
    hasErrors = true;
  }
} else {
  console.log('\n❌ CI/CD workflow NOT found');
  hasErrors = true;
}

// Check 5: Schema still defines the constraint
const schemaPath = join(__dirname, '..', 'packages', 'shared', 'src', 'schema.ts');
if (existsSync(schemaPath)) {
  console.log('\n✅ Schema file exists');
  
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  if (schemaContent.includes('assessment_answer_session_question_unique')) {
    console.log('   ✅ Schema defines the unique constraint');
  } else {
    console.log('   ❌ Schema does NOT define the constraint');
    hasErrors = true;
  }
  
  if (schemaContent.includes('unique("assessment_answer_session_question_unique")')) {
    console.log('   ✅ Schema properly defines unique constraint');
  } else {
    console.log('   ❌ Schema does NOT properly define unique constraint');
    hasErrors = true;
  }
} else {
  console.log('\n❌ Schema file NOT found');
  hasErrors = true;
}

// Check 6: Storage uses onConflictDoUpdate correctly
const storagePath = join(__dirname, '..', 'apps', 'server', 'src', 'storage.ts');
if (existsSync(storagePath)) {
  console.log('\n✅ Storage file exists');
  
  const storageContent = readFileSync(storagePath, 'utf-8');
  // Check for key elements of onConflictDoUpdate usage
  const hasOnConflict = storageContent.includes('onConflictDoUpdate');
  const hasTarget = storageContent.includes('target:');
  const hasSessionIdRef = storageContent.includes('assessmentAnswers.sessionId');
  const hasQuestionIdRef = storageContent.includes('assessmentAnswers.questionId');
  
  if (hasOnConflict && hasTarget && hasSessionIdRef && hasQuestionIdRef) {
    console.log('   ✅ Storage uses onConflictDoUpdate with correct target');
  } else {
    console.log('   ❌ Storage onConflictDoUpdate may not match constraint');
    hasErrors = true;
  }
} else {
  console.log('\n❌ Storage file NOT found');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ VALIDATION FAILED - Please fix the errors above');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED');
  console.log('\nThe constraint fix is properly configured and ready for deployment.');
  console.log('The migration will:');
  console.log('  1. Remove duplicate assessment answers');
  console.log('  2. Add the unique constraint');
  console.log('  3. Fix the presignup-sync endpoint errors');
  process.exit(0);
}
