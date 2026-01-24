const fs = require('fs');
const path = require('path');

// Read the JSON file
const playersData = JSON.parse(fs.readFileSync('players-final.json', 'utf8'));

console.log(`Converting ${playersData.length} players to CSV format...`);

// Helper function to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Create players.csv
const playerHeaders = [
  'id', 'rank', 'name', 'pos', 'school', 'year', 'size',
  'weight', 'speed', 'tier', 'consensusRank', 'sourceCount'
];

let playersCsv = playerHeaders.join(',') + '\n';

playersData.forEach(player => {
  const row = playerHeaders.map(header => escapeCSV(player[header]));
  playersCsv += row.join(',') + '\n';
});

fs.writeFileSync('players.csv', playersCsv, 'utf8');
console.log('✓ Created players.csv');

// Create player-sources.csv
const sourceHeaders = ['player_id', 'source', 'rank', 'weight'];
let sourcesCsv = sourceHeaders.join(',') + '\n';

let sourceRowCount = 0;
playersData.forEach(player => {
  if (player.sources && Array.isArray(player.sources)) {
    player.sources.forEach(source => {
      const row = [
        player.id,
        escapeCSV(source.source),
        source.rank,
        source.weight
      ];
      sourcesCsv += row.join(',') + '\n';
      sourceRowCount++;
    });
  }
});

fs.writeFileSync('player-sources.csv', sourcesCsv, 'utf8');
console.log(`✓ Created player-sources.csv with ${sourceRowCount} source rankings`);

// Calculate size reduction
const jsonSize = fs.statSync('players-final.json').size;
const playersSize = fs.statSync('players.csv').size;
const sourcesSize = fs.statSync('player-sources.csv').size;
const csvTotalSize = playersSize + sourcesSize;
const reduction = ((jsonSize - csvTotalSize) / jsonSize * 100).toFixed(1);

console.log('\nFile sizes:');
console.log(`  players-final.json: ${(jsonSize / 1024).toFixed(1)} KB`);
console.log(`  players.csv: ${(playersSize / 1024).toFixed(1)} KB`);
console.log(`  player-sources.csv: ${(sourcesSize / 1024).toFixed(1)} KB`);
console.log(`  Total CSV: ${(csvTotalSize / 1024).toFixed(1)} KB`);
console.log(`\nSize reduction: ${reduction}% smaller! 🎉`);
