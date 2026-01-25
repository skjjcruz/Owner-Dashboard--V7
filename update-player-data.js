#!/usr/bin/env node
/**
 * Safe Player Data Update Script
 *
 * This script safely updates all player data files from a new CSV source.
 * It creates backups before making changes so you can roll back if needed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

console.log('\n🚀 Player Data Update Script');
console.log('================================\n');

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
    console.log(`✓ Created backup directory: ${BACKUP_DIR}\n`);
  }
}

/**
 * Backup existing files
 */
function backupFiles() {
  console.log('📦 Creating backups...');

  const filesToBackup = [
    '2026-Dynasty.csv',
    'players.csv',
    'player-sources.csv',
    'players-final.json'
  ];

  const backupSubDir = path.join(BACKUP_DIR, TIMESTAMP);
  fs.mkdirSync(backupSubDir, { recursive: true });

  filesToBackup.forEach(file => {
    if (fs.existsSync(file)) {
      const backupPath = path.join(backupSubDir, file);
      fs.copyFileSync(file, backupPath);
      console.log(`  ✓ Backed up: ${file}`);
    }
  });

  console.log(`\n✅ Backups saved to: ${backupSubDir}\n`);
  return backupSubDir;
}

/**
 * Check if a new CSV file is provided
 */
function findNewCSV() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const csvPath = args[0];
    if (fs.existsSync(csvPath) && csvPath.endsWith('.csv')) {
      return csvPath;
    } else {
      console.error(`❌ Error: File not found or not a CSV: ${csvPath}`);
      process.exit(1);
    }
  }

  // Check if 2026-Dynasty.csv exists
  if (fs.existsSync('2026-Dynasty.csv')) {
    console.log('ℹ️  No new CSV provided. Using existing 2026-Dynasty.csv');
    return '2026-Dynasty.csv';
  }

  console.error('❌ Error: No CSV file provided and 2026-Dynasty.csv not found');
  console.log('\nUsage: node update-player-data.js [path-to-new-csv]');
  console.log('Example: node update-player-data.js my-new-data.csv');
  process.exit(1);
}

/**
 * Replace the main CSV file
 */
function updateMainCSV(newCsvPath) {
  if (newCsvPath !== '2026-Dynasty.csv') {
    console.log(`📝 Replacing 2026-Dynasty.csv with ${newCsvPath}...`);
    fs.copyFileSync(newCsvPath, '2026-Dynasty.csv');
    console.log('✅ Main CSV updated\n');
  } else {
    console.log('✓ Using existing 2026-Dynasty.csv\n');
  }
}

/**
 * Run the processing scripts
 */
function processData() {
  console.log('⚙️  Processing player data...\n');

  try {
    // Step 1: Process Excel rankings
    console.log('Step 1: Converting CSV to JSON...');
    execSync('node process-excel-rankings.js', { stdio: 'inherit' });

    // Step 2: Convert to CSV
    console.log('\nStep 2: Generating CSV files...');
    execSync('node convert-to-csv.js', { stdio: 'inherit' });

    console.log('\n✅ Data processing complete!\n');
  } catch (error) {
    console.error('\n❌ Error during processing:', error.message);
    console.log('\n💡 Your original files are backed up and can be restored.');
    process.exit(1);
  }
}

/**
 * Verify the output files
 */
function verifyOutput() {
  console.log('🔍 Verifying output files...\n');

  const requiredFiles = [
    'players.csv',
    'player-sources.csv',
    'players-final.json'
  ];

  let allValid = true;

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  ✓ ${file} (${sizeKB} KB)`);
    } else {
      console.log(`  ✗ ${file} - MISSING!`);
      allValid = false;
    }
  });

  if (!allValid) {
    console.error('\n❌ Some output files are missing!');
    process.exit(1);
  }

  console.log('\n✅ All files generated successfully!\n');
}

/**
 * Display completion summary
 */
function displaySummary(backupDir) {
  console.log('🎉 Update Complete!');
  console.log('==================\n');
  console.log('Updated files:');
  console.log('  • 2026-Dynasty.csv (source data)');
  console.log('  • players.csv (main player data)');
  console.log('  • player-sources.csv (source rankings)');
  console.log('  • players-final.json (JSON format)\n');
  console.log(`📦 Backups saved in: ${backupDir}\n`);
  console.log('✨ Your application is ready to use the new data!\n');
}

/**
 * Main execution
 */
function main() {
  try {
    // 1. Ensure backup directory exists
    ensureBackupDir();

    // 2. Find the CSV file to use
    const newCsvPath = findNewCSV();

    // 3. Create backups
    const backupDir = backupFiles();

    // 4. Update main CSV if needed
    updateMainCSV(newCsvPath);

    // 5. Process the data
    processData();

    // 6. Verify output
    verifyOutput();

    // 7. Display summary
    displaySummary(backupDir);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.log('\n💡 Check your backup files in ./backups/ to restore if needed.');
    process.exit(1);
  }
}

// Run the script
main();
