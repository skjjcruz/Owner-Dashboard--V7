/**
 * CSV Loader - Automated V7 Version
 * This script loads processed player data with fantasy ranks and industry sources.
 */

async function loadPlayersFromCSV() {
  try {
    // Helper function to parse CSV
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map(line => {
        const values = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue);

        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] ? values[index].trim() : '';
        });
        return obj;
      });
    }

    // 1. Fetch main player data (has fantasyRank)
    const playersResponse = await fetch('./players.csv');
    if (!playersResponse.ok) {
      throw new Error(`Failed to load players.csv: ${playersResponse.status}`);
    }
    const playersText = await playersResponse.text();
    const playersRaw = parseCSV(playersText);

    // 2. Fetch source rankings
    const sourcesResponse = await fetch('./player-sources.csv');
    if (!sourcesResponse.ok) {
      throw new Error(`Failed to load player-sources.csv: ${sourcesResponse.status}`);
    }
    const sourcesText = await sourcesResponse.text();
    const sourcesRaw = parseCSV(sourcesText);

    // 3. Group sources by player_id
    const sourcesMap = {};
    sourcesRaw.forEach(s => {
      const playerId = parseInt(s.player_id, 10);
      if (!sourcesMap[playerId]) {
        sourcesMap[playerId] = [];
      }
      sourcesMap[playerId].push({
        source: s.source,
        rank: parseInt(s.rank, 10),
        weight: parseFloat(s.weight) || 1.0
      });
    });

    // Helper to generate YouTube search URL for highlights
    function getHighlightUrl(name, school) {
      const query = encodeURIComponent(`${name} ${school} football highlights 2025`);
      return `https://www.youtube.com/results?search_query=${query}`;
    }

    // Helper to get player initials for avatar
    function getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // 4. Combine players with their sources
    const combinedPlayers = playersRaw.map(player => {
      const id = parseInt(player.id, 10);
      return {
        id: id,
        name: player.name,
        pos: player.pos,
        position: player.pos,
        school: player.school,
        year: player.year,
        size: player.size,
        weight: player.weight,
        speed: player.speed,
        tier: parseInt(player.tier, 10) || 3,
        rank: parseInt(player.rank, 10) || 999,
        consensusRank: parseFloat(player.consensusRank) || 999,
        fantasyRank: parseInt(player.fantasyRank, 10) || 999,
        sourceCount: parseInt(player.sourceCount, 10) || 0,
        grade: parseFloat(player.grade) || 0,
        isGenerational: player.isGenerational === 'true',
        fantasyMultiplier: parseFloat(player.fantasyMultiplier) || 1.0,
        draftScore: parseFloat(player.draftScore) || 0,
        sources: sourcesMap[id] || [],
        highlightUrl: getHighlightUrl(player.name, player.school),
        initials: getInitials(player.name)
      };
    });

    console.log(`--- V7 DATA SYNC SUCCESS ---`);
    console.log(`Players Loaded: ${combinedPlayers.length}`);
    console.log(`Sample Player:`, combinedPlayers[0]);

    return combinedPlayers;

  } catch (error) {
    console.error('Error loading players from v7 data:', error);
    throw error;
  }
}

// Export for module usage or expose globally for the dashboard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadPlayersFromCSV };
} else {
  window.loadPlayersFromCSV = loadPlayersFromCSV;
}
