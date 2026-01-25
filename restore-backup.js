#!/usr/bin/env node
/**
 * Restore from Backup Script
 *
 * Quickly restore your player data from a backup.
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = './backups';

console.log('\n🔄 Restore from Backup');
console.log('=====================\n');

/**
 * List available backups
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ No backups directory found.');
    console.log('   Backups are created automatically when you run update-player-data.js\n');
    process.exit(1);
  }

  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.log('❌ No backups found.');
    console.log('   Backups are created automatically when you run update-player-data.js\n');
    process.exit(1);
  }

  return backups;
}

/**
 * Display backup list
 */
function displayBackups(backups) {
  console.log('Available backups:\n');
  backups.forEach((backup, index) => {
    const backupPath = path.join(BACKUP_DIR, backup);
    const files = fs.readdirSync(backupPath);
    const csvCount = files.filter(f => f.endsWith('.csv')).length;

    console.log(`  ${index + 1}. ${backup} (${csvCount} CSV files)`);
  });
  console.log();
}

/**
 * Get backup choice from user
 */
function getBackupChoice(backups) {
  const args = process.argv.slice(2);

  // If backup timestamp provided as argument
  if (args.length > 0) {
    const choice = args[0];

    // Check if it's a number
    if (/^\d+$/.test(choice)) {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < backups.length) {
        return backups[index];
      }
    }

    // Check if it's a timestamp
    if (backups.includes(choice)) {
      return choice;
    }

    console.error(`❌ Invalid backup choice: ${choice}`);
    console.log('\nUsage: node restore-backup.js [number or timestamp]');
    console.log('Example: node restore-backup.js 1');
    console.log('     or: node restore-backup.js 2026-01-25T14-30-00\n');
    process.exit(1);
  }

  // Default to most recent backup
  console.log('ℹ️  No backup specified. Using most recent backup.\n');
  return backups[0];
}

/**
 * Restore files from backup
 */
function restoreBackup(backupName) {
  const backupPath = path.join(BACKUP_DIR, backupName);

  console.log(`📦 Restoring from: ${backupName}\n`);

  const files = fs.readdirSync(backupPath);

  if (files.length === 0) {
    console.error('❌ Backup directory is empty!');
    process.exit(1);
  }

  console.log('Restoring files:');

  files.forEach(file => {
    const sourcePath = path.join(backupPath, file);
    const destPath = path.join('.', file);

    fs.copyFileSync(sourcePath, destPath);
    console.log(`  ✓ ${file}`);
  });

  console.log('\n✅ Restore complete!\n');
  console.log('📝 Restored files:');
  files.forEach(file => console.log(`   • ${file}`));
  console.log('\n✨ Your application is now using the backup data.\n');
}

/**
 * Main execution
 */
function main() {
  try {
    // List available backups
    const backups = listBackups();

    // Display backups
    displayBackups(backups);

    // Get user choice
    const backupChoice = getBackupChoice(backups);

    // Restore
    restoreBackup(backupChoice);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
