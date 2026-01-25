# Quick Start - Update Player Data

## 🚀 Simple Update (3 commands)

```bash
# 1. Put your new CSV file in this directory
# (or keep the existing 2026-Dynasty.csv)

# 2. Run the update script
node update-player-data.js your-new-file.csv

# 3. Done! Your app now uses the new data
```

## 📝 What You Need

A CSV file with these columns:

**Required:**
- Player Name (or Name)
- Position
- College (or School)

**Optional:**
- Rank (if you don't have source rankings)
- Any ranking sources (PFF, Mel Kiper, etc.)
- Year, Height, Weight, Speed, etc.

## ✅ What Happens

1. **Backups created** → `./backups/[timestamp]/`
2. **Data processed** → Calculates consensus rankings
3. **Files updated:**
   - players.csv
   - player-sources.csv
   - players-final.json

## 🔄 Restore from Backup

If something goes wrong:

```bash
# List backups
ls ./backups/

# Copy files back
cp ./backups/[timestamp]/*.csv .
cp ./backups/[timestamp]/*.json .
```

## 💡 Examples

### Update with new Google Sheets export
```bash
node update-player-data.js ~/Downloads/2026-Rankings.csv
```

### Reprocess existing data
```bash
node update-player-data.js
```

### Using npm scripts
```bash
npm run update-data
```

---

**Need more help?** See [UPDATE_GUIDE.md](./UPDATE_GUIDE.md) for the full guide.
