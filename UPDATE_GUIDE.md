# Player Data Update Guide

This guide explains how to safely update your player data without breaking anything.

## Quick Start

### Option 1: Update with a new CSV file

```bash
node update-player-data.js your-new-data.csv
```

### Option 2: Reprocess existing data

```bash
node update-player-data.js
```

That's it! The script automatically:
- ✅ Creates backups of all existing files
- ✅ Processes your new CSV data
- ✅ Generates all required files (players.csv, player-sources.csv, players-final.json)
- ✅ Verifies everything worked correctly

## What Files Get Updated

When you run the update script, these files are replaced:

1. **2026-Dynasty.csv** - Your source data (if you provide a new CSV)
2. **players.csv** - Main player data used by the app
3. **player-sources.csv** - Individual source rankings
4. **players-final.json** - Complete JSON data

## CSV Format Requirements

Your CSV file should have these columns:

### Required Columns:
- **Player Name** or **Name** - Player's full name
- **Position** - QB, RB, WR, TE, K, EDGE, DL, LB, S, CB
- **College** or **School** - Player's college

### Optional Columns:
- **Year** - Junior, Senior, etc.
- **Height** or **Size** - Player height (e.g., 6'2)
- **Weight** - Player weight in pounds
- **40 Time** or **Speed** - 40-yard dash time
- **Remarks** or **Notes** - Additional notes

### Ranking Source Columns:
Any other columns will be treated as ranking sources. Common examples:
- PFF
- Mel Kiper
- Daniel Jeremiah
- Matt Miller
- Field Yates
- NFL Draft Buzz
- TANKATHON
- PFN

**Note:** If you don't have source rankings, just include a "Rank" column, and the script will generate realistic source rankings automatically.

## Backup & Restore

### Backups

Every time you run the update script, it creates a timestamped backup in `./backups/`.

Example: `./backups/2026-01-25T14-30-00/`

### Restore from Backup

If something goes wrong, restore from a backup:

```bash
# List available backups
ls ./backups/

# Restore from a specific backup
cp ./backups/2026-01-25T14-30-00/*.csv .
cp ./backups/2026-01-25T14-30-00/*.json .
```

## Troubleshooting

### Error: "File not found or not a CSV"

Make sure your CSV file path is correct:
```bash
# Check the file exists
ls -la your-file.csv

# Use full path if needed
node update-player-data.js /full/path/to/your-file.csv
```

### Error: "No valid players found"

Your CSV might be missing required columns. Check that you have:
- Player Name (or Name)
- Position
- Either source ranking columns OR a Rank column

### Error during processing

If the script fails partway through:
1. Your original files are safe in `./backups/`
2. Check the error message for details
3. Fix the issue and run again
4. Or restore from backup if needed

## Manual Process (Advanced)

If you prefer to run each step manually:

```bash
# 1. Replace the source CSV
cp your-new-data.csv 2026-Dynasty.csv

# 2. Process to JSON
node process-excel-rankings.js

# 3. Convert to CSVs
node convert-to-csv.js
```

## Data Pipeline

Here's how the data flows through the system:

```
your-new-data.csv
       ↓
2026-Dynasty.csv (source data)
       ↓
[process-excel-rankings.js]
       ↓
players-final.json
       ↓
[convert-to-csv.js]
       ↓
players.csv + player-sources.csv
       ↓
[csv-loader.js loads in browser]
       ↓
Your Application 🎉
```

## Tips

### Testing New Data

1. Always use the backup/restore feature
2. Check the console output for any warnings
3. Open your app and verify the data looks correct
4. Check the top 10 players list in the console output

### Multiple CSV Files

You can keep multiple CSV files and switch between them:

```bash
# Use dynasty rankings
node update-player-data.js 2026-Dynasty.csv

# Use redraft rankings
node update-player-data.js 2026-Redraft.csv
```

### Scheduling Updates

To automatically update from Google Sheets daily:

```bash
# Download from Google Sheets
# (you'll need to export as CSV from Google Sheets)

# Then update
node update-player-data.js downloaded-sheet.csv
```

## Need Help?

If you run into issues:
1. Check the console output for specific error messages
2. Verify your CSV format matches the requirements
3. Try the manual process to see where it fails
4. Restore from backup if needed
