// CSV Loader - Loads players.csv and player-sources.csv and combines them into the same format as players-final.json
// This allows the frontend to work with CSV files while maintaining the same data structure

async function loadPlayersFromCSV() {
  try {
    // Fetch both CSV files in parallel
    const [playersResponse, sourcesResponse] = await Promise.all([
      fetch('./players.csv'),
      fetch('./player-sources.csv')
    ]);

    if (!playersResponse.ok || !sourcesResponse.ok) {
      throw new Error('Failed to load CSV files');
    }

    const playersCSV = await playersResponse.text();
    const sourcesCSV = await sourcesResponse.text();

    // Parse CSV helper function
    function parseCSV(csvText) {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map(line => {
        const values = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
              currentValue += '"';
              i++; // Skip next quote
            } else {
              insideQuotes = !insideQuotes;
            }
          } else if (char === ',' && !insideQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue); // Push last value

        const obj = {};
        headers.forEach((header, index) => {
          const value = values[index] || '';
          // Convert numeric fields
          if (['id', 'rank', 'weight', 'tier', 'sourceCount'].includes(header)) {
            obj[header] = value ? parseInt(value, 10) : null;
          } else if (header === 'consensusRank') {
            obj[header] = value ? parseFloat(value) : null;
          } else if (header === 'speed') {
            obj[header] = value || null;
          } else {
            obj[header] = value || null;
          }
        });
        return obj;
      });
    }

    // Parse both CSVs
    const players = parseCSV(playersCSV);
    const sources = parseCSV(sourcesCSV);

    // Group sources by player_id
    const sourcesByPlayerId = {};
    sources.forEach(source => {
      const playerId = parseInt(source.player_id, 10);
      if (!sourcesByPlayerId[playerId]) {
        sourcesByPlayerId[playerId] = [];
      }
      sourcesByPlayerId[playerId].push({
        source: source.source,
        rank: parseInt(source.rank, 10),
        weight: parseFloat(source.weight)
      });
    });

    // Combine players with their sources
    const combinedPlayers = players.map(player => ({
      ...player,
      sources: sourcesByPlayerId[player.id] || []
    }));

    console.log(`Loaded ${combinedPlayers.length} players from CSV (${combinedPlayers.reduce((sum, p) => sum + p.sources.length, 0)} total source rankings)`);

    return combinedPlayers;

  } catch (error) {
    console.error('Error loading players from CSV:', error);
    throw error;
  }
}

// Export for module usage or expose globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadPlayersFromCSV };
} else {
  window.loadPlayersFromCSV = loadPlayersFromCSV;
}
