/**
 * Excel Draft Rankings Processor - UPDATED
 *
 * Fixes:
 * 1. Uses calculated consensus rank (not CSV rank column)
 * 2. Includes all source data in output JSON
 * 3. Properly handles Kickers and all positions
 */

const fs = require('fs');

// Auto-detect CSV files
function findCSVFile() {
  const files = fs.readdirSync('.');
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  // Prefer Dynasty file, fallback to any CSV
  const dynastyFile = csvFiles.find(f => f.toLowerCase().includes('dynasty'));
  const redraftFile = csvFiles.find(f => f.toLowerCase().includes('redraft'));

  return dynastyFile || redraftFile || csvFiles[0] || '2026-Dynasty.csv';
}

const INPUT_FILE = findCSVFile();
const OUTPUT_FILE = 'players-final.json';

console.log(`📁 Using input file: ${INPUT_FILE}`);

// League type detection
function detectLeagueType(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('redraft')) return 'redraft';
  if (lower.includes('dynasty')) return 'dynasty';
  return 'dynasty';
}

const LEAGUE_TYPE = detectLeagueType(INPUT_FILE);

// Position configurations
const LEAGUE_POSITIONS = {
  dynasty: ['QB', 'RB', 'WR', 'TE', 'K', 'EDGE', 'DL', 'LB', 'S', 'CB'],
  redraft: ['QB', 'RB', 'WR', 'TE', 'K']
};

const ALLOWED_POSITIONS = LEAGUE_POSITIONS[LEAGUE_TYPE];

// Position sorting order
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'EDGE', 'DL', 'LB', 'S', 'CB'];

// Source weights
const SOURCE_WEIGHTS = {
  'PFF': 1.2,
  'Pro Football Focus': 1.2,
  'Dane Brugler': 1.2,
  'Mel Kiper': 1.1,
  'Daniel Jeremiah': 1.1,
  'Matt Miller': 1.0,
  'Field Yates': 1.0,
  'Charlie Campbell': 1.0,
  'CBS': 1.0,
  'Athletic': 1.0,
  'USA Today': 1.0,
  'SI': 0.9,
  'Sports Illustrated': 0.9,
  'PFN': 0.9,
  'Pro Football Network': 0.9,
  'NFL Draft Buzz': 0.9,
  'TANKATHON': 0.9,
  'Bleacher Report': 0.8,
  'SCOUTD': 0.8
};

// Tier boundaries
const TIER_BOUNDARIES = [
  { max: 12, tier: 1 },
  { max: 24, tier: 2 },
  { max: 48, tier: 3 },
  { max: 100, tier: 4 },
  { max: Infinity, tier: 5 }
];

/**
 * Simple CSV parser
 */
function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quotes
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Normalize position names
 */
function normalizePosition(pos) {
  if (!pos) return 'UNKNOWN';

  const p = pos.toUpperCase().trim();

  // Defensive line positions
  if (p === 'DT' || p === 'DE' || p === 'DL') return 'DL';

  // Linebacker positions
  if (p === 'OLB' || p === 'ILB' || p === 'MLB' || p === 'LB') return 'LB';

  // Defensive backs - keep separate
  if (p === 'CB') return 'CB';
  if (p === 'S' || p === 'FS' || p === 'SS') return 'S';

  // Offensive positions
  if (p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE' || p === 'K') return p;

  // Edge rushers
  if (p === 'EDGE') return 'EDGE';

  return p;
}

/**
 * Calculate consensus ranking from all sources
 */
function calculateConsensus(row, sourceColumns, headers) {
  const sources = [];
  const rankings = [];

  for (const sourceCol of sourceColumns) {
    const rankValue = row[sourceCol];

    // Skip empty values
    if (!rankValue || rankValue === '' || rankValue === '-' || rankValue === 'N/A') {
      continue;
    }

    const rank = Number(rankValue);
    if (isNaN(rank) || rank <= 0) continue;

    const weight = SOURCE_WEIGHTS[sourceCol] || 1.0;
    const weightedRank = rank / weight;

    sources.push({
      source: sourceCol,
      rank: rank,
      weight: weight
    });

    rankings.push(weightedRank);
  }

  if (rankings.length === 0) {
    return null;
  }

  const avgRank = rankings.reduce((a, b) => a + b, 0) / rankings.length;

  return {
    consensusRank: Math.round(avgRank * 10) / 10,
    sourceCount: sources.length,
    sources: sources
  };
}

/**
 * Process all players
 */
function processPlayers(headers, rows) {
  console.log('\n📊 Processing players...');

  // Identify source columns - exclude core data columns
  const coreFields = [
    'Rank', '#', 'Player Name', 'Name', 'Position', 'College', 'School',
    'Year', 'Height', 'Size', 'Weight', '40 Time', 'Speed',
    'Average', 'Remarks', 'Notes', 'YouTube', 'PhotoURL'
  ];

  const sourceColumns = headers.filter(h => {
    if (!h || h.trim() === '') return false;
    return !coreFields.some(cf => h.toLowerCase().includes(cf.toLowerCase()));
  });

  console.log(`✅ Found ${sourceColumns.length} source columns:`);
  sourceColumns.forEach(col => {
    const weight = SOURCE_WEIGHTS[col] || 1.0;
    console.log(`   - ${col} (weight: ${weight})`);
  });

  const players = [];

  for (const row of rows) {
    const name = row['Player Name'] || row['Name'] || '';
    if (!name || name.length < 2) continue;

    const position = normalizePosition(row['Position']);

    // Filter by league type
    if (!ALLOWED_POSITIONS.includes(position)) {
      continue;
    }

    // Get player data
    const school = row['College'] || row['School'] || 'Unknown';
    const year = row['Year'] || '';
    const height = row['Height'] || row['Size'] || '';
    const weight = row['Weight'] ? Number(row['Weight']) : null;
    const speed = row['40 Time'] || row['Speed'] || '';
    const remarks = row['Remarks'] || row['Notes'] || '';
    const youtube = row['YouTube'] || row['youtube'] || '';
    const photoURL = row['PhotoURL'] || row['Photo URL'] || '';

    // Calculate consensus
    const consensus = calculateConsensus(row, sourceColumns, headers);

    if (!consensus) {
      continue;
    }

    players.push({
      name: name,
      pos: position,
      school: school,
      year: year,
      size: height,
      weight: weight,
      speed: speed,
      consensusRank: consensus.consensusRank,
      sourceCount: consensus.sourceCount,
      sources: consensus.sources,
      remarks: remarks,
      youtube: youtube,
      photoURL: photoURL
    });
  }

  console.log(`✅ Processed ${players.length} players`);

  return players;
}

/**
 * Sort players by consensus rank
 */
function sortByConsensus(players) {
  console.log('\n🔄 Sorting by consensus rank...');

  return players.sort((a, b) => {
    // Sort purely by consensus rank
    return a.consensusRank - b.consensusRank;
  });
}

/**
 * Assign tiers based on final rank
 */
function assignTier(rank) {
  for (const { max, tier } of TIER_BOUNDARIES) {
    if (rank <= max) return tier;
  }
  return 5;
}

/**
 * Finalize rankings with sequential IDs and tiers
 */
function finalizeRankings(players) {
  return players.map((player, idx) => ({
    id: idx + 1,
    rank: idx + 1,  // This is the consensus-based final rank
    name: player.name,
    pos: player.pos,
    school: player.school,
    year: player.year,
    size: player.size,
    weight: player.weight,
    speed: player.speed,
    tier: assignTier(idx + 1),
    consensusRank: player.consensusRank,
    sourceCount: player.sourceCount,
    sources: player.sources,
    remarks: player.remarks,
    youtube: player.youtube,
    photoURL: player.photoURL
  }));
}

/**
 * Display statistics
 */
function displayStats(players) {
  console.log('\n📈 Statistics:');
  console.log(`   Total players: ${players.length}`);

  // Count by position
  const posCounts = {};
  players.forEach(p => {
    posCounts[p.pos] = (posCounts[p.pos] || 0) + 1;
  });

  console.log('\n   By position:');
  Object.keys(posCounts).sort().forEach(pos => {
    console.log(`   - ${pos}: ${posCounts[pos]}`);
  });

  // Count by tier
  const tierCounts = {};
  players.forEach(p => {
    tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
  });

  console.log('\n   By tier:');
  Object.keys(tierCounts).sort().forEach(tier => {
    console.log(`   - Tier ${tier}: ${tierCounts[tier]}`);
  });

  console.log('\n   Top 10 players:');
  players.slice(0, 10).forEach(p => {
    console.log(`   ${p.rank}. ${p.name} (${p.pos}) - Consensus: ${p.consensusRank}`);
  });
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting rankings processor...');
  console.log(`📋 League type: ${LEAGUE_TYPE}`);
  console.log(`🎯 Allowed positions: ${ALLOWED_POSITIONS.join(', ')}`);

  try {
    // Parse CSV
    const { headers, rows } = parseCSV(INPUT_FILE);
    console.log(`✅ Loaded ${rows.length} rows from ${INPUT_FILE}`);

    // Process players
    let players = processPlayers(headers, rows);

    if (players.length === 0) {
      throw new Error('No valid players found!');
    }

    // Sort by consensus
    players = sortByConsensus(players);

    // Finalize with ranks and tiers
    players = finalizeRankings(players);

    // Display stats
    displayStats(players);

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2));
    console.log(`\n✅ Output written to ${OUTPUT_FILE}`);
    console.log('🎉 Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
