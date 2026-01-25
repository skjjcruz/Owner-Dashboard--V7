# Player Data Management System

Complete guide to managing and updating your NFL Draft player rankings data.

## 📚 Table of Contents

- [Quick Start](#quick-start)
- [System Overview](#system-overview)
- [Updating Data](#updating-data)
- [Backup & Restore](#backup--restore)
- [File Structure](#file-structure)
- [Advanced Usage](#advanced-usage)

---

## Quick Start

### Update Player Data

```bash
# Option 1: Update with a new CSV file
node update-player-data.js your-new-rankings.csv

# Option 2: Or use npm scripts
npm run update-data your-new-rankings.csv

# Option 3: Reprocess existing data
npm run update-data
```

### Restore from Backup

```bash
# Restore most recent backup
node restore-backup.js

# Restore specific backup
node restore-backup.js 1

# Or use npm scripts
npm run restore-backup
```

That's it! See [QUICK_START.md](./QUICK_START.md) for more examples.

---

## System Overview

### Data Flow Pipeline

```
┌─────────────────────┐
│  Your CSV File      │  ← New rankings data
│  (2026-Dynasty.csv) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ process-excel-      │  ← Calculate consensus rankings
│ rankings.js         │     from multiple sources
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ players-final.json  │  ← Complete data with all sources
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ convert-to-csv.js   │  ← Split into optimized CSVs
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│  players.csv                    │  ← Main player data
│  player-sources.csv             │  ← Individual rankings
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────┐
│ csv-loader.js       │  ← Load in browser
│ (Frontend)          │
└─────────────────────┘
```

### What Each File Does

| File | Purpose |
|------|---------|
| **2026-Dynasty.csv** | Source data with all rankings |
| **players.csv** | Optimized player data for the app |
| **player-sources.csv** | Individual source rankings |
| **players-final.json** | Complete JSON format (fallback) |
| **update-player-data.js** | 🔧 Main update script (use this!) |
| **restore-backup.js** | 🔄 Restore from backup |
| **process-excel-rankings.js** | Process CSV → JSON |
| **convert-to-csv.js** | Convert JSON → CSVs |

---

## Updating Data

### From Google Sheets

1. Export your Google Sheets as CSV
2. Run the update script:

```bash
node update-player-data.js ~/Downloads/rankings.csv
```

### CSV Format Requirements

#### Required Columns

- `Player Name` or `Name` - Player's full name
- `Position` - QB, RB, WR, TE, K, EDGE, DL, LB, S, CB
- `College` or `School` - Player's college

#### Optional Columns

- `Year` - Junior, Senior, etc.
- `Height` or `Size` - e.g., "6'2"
- `Weight` - In pounds
- `40 Time` or `Speed` - e.g., "4.45"
- `Remarks` or `Notes` - Additional info

#### Ranking Source Columns

Any additional columns are treated as ranking sources. Examples:
- PFF (weighted 1.2x)
- Mel Kiper (weighted 1.1x)
- Daniel Jeremiah (weighted 1.1x)
- Matt Miller
- Field Yates
- NFL Draft Buzz (weighted 0.9x)
- TANKATHON (weighted 0.9x)

> **Tip:** If you don't have multiple sources, just include a `Rank` column and the system will generate realistic source rankings automatically!

### What Happens During Update

1. ✅ **Backup Created** - All existing files saved to `./backups/[timestamp]/`
2. ✅ **CSV Processed** - Consensus rankings calculated from all sources
3. ✅ **Files Generated:**
   - `players.csv` - Main player data
   - `player-sources.csv` - Individual rankings
   - `players-final.json` - Complete JSON
4. ✅ **Verification** - All files checked for validity

### Viewing Results

After update, check the console output:

```
📈 Statistics:
   Total players: 523

   By position:
   - QB: 44
   - RB: 48
   - WR: 81
   - TE: 49
   - ...

   Top 10 players:
   1. Caleb Downs (S) - Consensus: 2.7
   2. Fernando Mendoza (QB) - Consensus: 3.3
   ...
```

---

## Backup & Restore

### Automatic Backups

Every update automatically creates a backup in `./backups/` with timestamp:

```
backups/
  ├── 2026-01-25T14-30-00/
  │   ├── 2026-Dynasty.csv
  │   ├── players.csv
  │   ├── player-sources.csv
  │   └── players-final.json
  └── 2026-01-24T10-15-30/
      └── ...
```

### Restore Options

```bash
# List and restore most recent
node restore-backup.js

# Restore specific backup by number
node restore-backup.js 1

# Restore by timestamp
node restore-backup.js 2026-01-25T14-30-00
```

### Manual Restore

```bash
# List backups
ls ./backups/

# Copy files manually
cp ./backups/2026-01-25T14-30-00/*.csv .
cp ./backups/2026-01-25T14-30-00/*.json .
```

---

## File Structure

```
Owner-Dashboard---V5/
├── 📄 2026-Dynasty.csv          ← Source data
├── 📄 players.csv               ← Main player data
├── 📄 player-sources.csv        ← Source rankings
├── 📄 players-final.json        ← Complete JSON
│
├── 🔧 update-player-data.js     ← Main update script
├── 🔄 restore-backup.js         ← Restore script
├── ⚙️  process-excel-rankings.js ← CSV → JSON processor
├── ⚙️  convert-to-csv.js         ← JSON → CSV converter
├── 🌐 csv-loader.js             ← Frontend loader
│
├── 📁 backups/                  ← Automatic backups
│   └── [timestamps]/
│
├── 📖 DATA_README.md            ← This file
├── 📖 QUICK_START.md            ← Quick reference
├── 📖 UPDATE_GUIDE.md           ← Detailed guide
│
└── 📦 package.json              ← NPM scripts
```

---

## Advanced Usage

### Manual Processing (Step-by-Step)

If you prefer to run each step manually:

```bash
# 1. Replace source CSV
cp your-data.csv 2026-Dynasty.csv

# 2. Process to JSON (calculates consensus)
npm run process

# 3. Convert to optimized CSVs
npm run convert
```

### Testing New Data

Before committing to new data:

1. Create backup: Already done automatically ✓
2. Test update: `node update-player-data.js test-data.csv`
3. Verify output: Check console statistics
4. Test in browser: Open your app and verify
5. If issues: `node restore-backup.js`

### Multiple Datasets

Keep multiple rankings (dynasty, redraft, etc.):

```bash
# Dynasty rankings
node update-player-data.js 2026-Dynasty.csv

# Redraft rankings
node update-player-data.js 2026-Redraft.csv

# Restore dynasty
# (copy from backup if needed)
```

### Source Weights

Rankings are weighted by source reliability:

| Weight | Sources |
|--------|---------|
| 1.2x | PFF, Pro Football Focus, Dane Brugler |
| 1.1x | Mel Kiper, Daniel Jeremiah |
| 1.0x | Matt Miller, Field Yates, Charlie Campbell, CBS |
| 0.9x | NFL Draft Buzz, PFN, TANKATHON |
| 0.8x | Bleacher Report, SCOUTD |

Edit `process-excel-rankings.js` to customize weights.

### Tier System

Players are automatically assigned tiers:

- **Tier 1:** Ranks 1-12 (Elite)
- **Tier 2:** Ranks 13-24 (Premium)
- **Tier 3:** Ranks 25-48 (High)
- **Tier 4:** Ranks 49-100 (Mid)
- **Tier 5:** Ranks 101+ (Deep)

---

## Troubleshooting

### Common Issues

**"No valid players found"**
- Check CSV has required columns (Name, Position, College)
- Verify positions are valid (QB, RB, WR, etc.)

**"Failed to load CSV files"**
- Make sure `players.csv` and `player-sources.csv` exist
- Run `npm run update-data` to regenerate

**Data looks wrong in app**
- Check console output for warnings
- Verify top 10 rankings make sense
- Restore previous backup if needed

### Getting Help

1. Check [UPDATE_GUIDE.md](./UPDATE_GUIDE.md) for detailed instructions
2. Check console output for specific errors
3. Try manual process to see where it fails
4. Restore from backup to recover

---

## Quick Reference Card

```bash
# 🔧 UPDATE DATA
node update-player-data.js [your-file.csv]
npm run update-data [your-file.csv]

# 🔄 RESTORE BACKUP
node restore-backup.js [backup-number]
npm run restore-backup [backup-number]

# 📊 MANUAL STEPS
npm run process    # CSV → JSON
npm run convert    # JSON → CSVs

# 📁 LIST BACKUPS
ls ./backups/

# ✅ FILES TO UPDATE
2026-Dynasty.csv         (your source)
players.csv              (auto-generated)
player-sources.csv       (auto-generated)
players-final.json       (auto-generated)
```

---

## Documentation Index

- **[QUICK_START.md](./QUICK_START.md)** - Fastest way to get started
- **[UPDATE_GUIDE.md](./UPDATE_GUIDE.md)** - Complete update guide
- **[DATA_README.md](./DATA_README.md)** - This file (system overview)

---

**Ready to update?** See [QUICK_START.md](./QUICK_START.md)
