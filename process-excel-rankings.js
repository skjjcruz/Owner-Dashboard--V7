/**
 * Excel Draft Rankings Processor - UNIVERSAL VERSION
 * Supports both Dynasty (All Positions) and Redraft (Offense Only)
 */

const fs = require('fs');

// 1. SMART AUTO-DETECT: Priority for your 2025 Test File
function findCSVFile() {
  const files = fs.readdirSync('.');
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  const test2025File = csvFiles.find(f => f.includes('prospects_test_2025'));
  const dynastyFile = csvFiles.find(f => f.toLowerCase().includes('dynasty'));
  const redraftFile = csvFiles.find(f => f.toLowerCase().includes('redraft'));

  // Default to the 2025 file first, then dynasty, then whatever is available
  return test2025File || dynastyFile || redraftFile || csvFiles[0] || 'prospects_test_2025.csv';
}

const INPUT_FILE = findCSVFile();
const OUTPUT_FILE = 'players-final.json';

console.log(`📁 Target File: ${INPUT_FILE}`);

// 2. SMART LEAGUE DETECTION: Defaults to Dynasty (All Players) 
function detectLeagueType(filename) {
  const lower = filename.toLowerCase();
  // Only strips out IDP if 'redraft' is explicitly in the name
  if (lower.includes('redraft')) {
    console.log("🏆 Mode: REDRAFT (Offense Only)");
    return 'redraft';
  }
  console.log("🛡️ Mode: DYNASTY/FULL (All Positions)");
  return 'dynasty';
}

const LEAGUE_TYPE = detectLeagueType(INPUT_FILE);

const LEAGUE_POSITIONS = {
  dynasty: ['QB', 'RB', 'WR', 'TE', 'K', 'EDGE', 'DL', 'LB', 'S', 'CB', 'OT', 'OG', 'C'],
  redraft: ['QB', 'RB', 'WR', 'TE', 'K']
};

const ALLOWED_POSITIONS = LEAGUE_POSITIONS[LEAGUE_TYPE];

// Source weights for consensus
const SOURCE_WEIGHTS = {
  'PFF': 1.2, 'ESPN': 1.1, 'NFL': 1.1, 'Athletic': 1.0, 'CBS': 1.0
};

/**
 * CSV Parser handles quotes and commas
 */
function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) throw new Error('CSV is empty');

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => { row[header] = values[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const values = [];
  let current = '', inQuotes = false;
  for (let char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function normalizePosition(pos) {
  if (!pos) return 'UNKNOWN';
  const p = pos.toUpperCase().trim();
  if (['DT', 'DE', 'DL'].includes(p)) return 'DL';
  if (['OLB', 'ILB', 'MLB', 'LB'].includes(p)) return 'LB';
  if (['S', 'FS', 'SS'].includes(p)) return 'S';
  return p;
}

function calculateConsensus(row, sourceColumns) {
  const rankings = [];
  const sources = [];
  
  sourceColumns.forEach(col => {
    const val = row[col];
    if (val && !isNaN(val)) {
      const rank = Number(val);
      const weight = SOURCE_WEIGHTS[col] || 1.0;
      rankings.push(rank / weight);
      sources.push({ source: col, rank });
    }
  });

  // If no sources, use the 'Rank' column or default to 999
  if (rankings.length === 0) {
    const base = Number(row['Rank'] || row['#'] || 999);
    return { consensusRank: base, sources: [{source: 'Base', rank: base}], count: 1 };
  }

  const avg = rankings.reduce((a, b) => a + b, 0) / rankings.length;
  return { consensusRank: Math.round(avg * 10) / 10, sources, count: sources.length };
}

function main() {
  try {
    const { headers, rows } = parseCSV(INPUT_FILE);
    console.log(`✅ Loaded ${rows.length} rows.`);

    const sourceColumns = headers.filter(h => SOURCE_WEIGHTS[h]);
    
    const players = rows.map((row, idx) => {
      const name = row['Player Name'] || row['Name'] || row['player'] || 'Unknown Player';
      const pos = normalizePosition(row['Position'] || row['pos']);
      
      if (!ALLOWED_POSITIONS.includes(pos)) return null;

      const consensus = calculateConsensus(row, sourceColumns);
      return {
        id: idx + 1,
        name,
        pos,
        school: row['College'] || row['School'] || 'N/A',
        consensusRank: consensus.consensusRank,
        sources: consensus.sources,
        tier: consensus.consensusRank <= 24 ? 1 : (consensus.consensusRank <= 60 ? 2 : 3)
      };
    }).filter(p => p !== null);

    // Final Sort
    players.sort((a, b) => a.consensusRank - b.consensusRank);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(players, null, 2));
    console.log(`🎉 SUCCESS: ${players.length} players saved to ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
  }
}

main();

