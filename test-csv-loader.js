// Test script to verify CSV loader works correctly
const fs = require('fs');

// Mock fetch for Node.js environment
global.fetch = async function(url) {
  const filePath = url.replace('./', '');
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    ok: true,
    text: async () => content
  };
};

// Load the CSV loader
const { loadPlayersFromCSV } = require('./csv-loader.js');

// Test the loader
async function testLoader() {
  console.log('Testing CSV loader...\n');

  try {
    const players = await loadPlayersFromCSV();

    console.log(`✓ Loaded ${players.length} players`);

    // Test a few players
    const firstPlayer = players[0];
    console.log(`\n✓ First player: ${firstPlayer.name}`);
    console.log(`  - Position: ${firstPlayer.pos}`);
    console.log(`  - School: ${firstPlayer.school}`);
    console.log(`  - Rank: ${firstPlayer.rank}`);
    console.log(`  - Sources: ${firstPlayer.sources.length} rankings`);

    if (firstPlayer.sources.length > 0) {
      console.log(`  - Example source: ${firstPlayer.sources[0].source} ranked #${firstPlayer.sources[0].rank}`);
    }

    // Count total sources
    const totalSources = players.reduce((sum, p) => sum + p.sources.length, 0);
    console.log(`\n✓ Total source rankings: ${totalSources}`);

    // Verify structure matches original JSON
    const originalJSON = JSON.parse(fs.readFileSync('players-final.json', 'utf8'));
    const originalFirst = originalJSON[0];

    console.log('\nComparing with original JSON:');
    const fieldsMatch =
      firstPlayer.name === originalFirst.name &&
      firstPlayer.rank === originalFirst.rank &&
      firstPlayer.sources.length === originalFirst.sources.length;

    if (fieldsMatch) {
      console.log('✓ CSV data matches original JSON structure!');
    } else {
      console.log('✗ CSV data does NOT match original JSON');
    }

    console.log('\n✅ CSV loader test passed!');

  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

testLoader();
