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

    // 3. Fetch enrichment data (ESPN IDs, photos, summaries) - persists across ranking updates
    let enrichmentMap = {};
    try {
      const enrichmentResponse = await fetch('./player-enrichment.csv');
      if (enrichmentResponse.ok) {
        const enrichmentText = await enrichmentResponse.text();
        const enrichmentRaw = parseCSV(enrichmentText);
        // Build lookup map by name+school (case-insensitive)
        enrichmentRaw.forEach(e => {
          const key = `${e.name.toLowerCase()}|${e.school.toLowerCase()}`;
          enrichmentMap[key] = {
            espn_id: e.espn_id || '',
            photo_url: e.photo_url || '',
            summary: e.summary || '',
            year: e.year || '',
            size: e.size || '',
            weight: e.weight || '',
            speed: e.speed || ''
          };
        });
        console.log(`Enrichment data loaded: ${Object.keys(enrichmentMap).length} players`);
      }
    } catch (err) {
      console.warn('Could not load player-enrichment.csv, continuing without enrichment data');
    }

    // 4. Group sources by player_id
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

    // Helper to get player photo URL
    // Priority: custom photo_url > ESPN ID > UI Avatars fallback
    function getPhotoUrl(playerName, enrichment) {
      // 1. Use custom photo URL if provided (college athletic sites, etc.)
      if (enrichment && enrichment.photo_url) {
        return enrichment.photo_url;
      }
      // 2. Use ESPN CDN if ESPN ID is available
      if (enrichment && enrichment.espn_id) {
        return `https://a.espncdn.com/i/headshots/college-football/players/full/${enrichment.espn_id}.png`;
      }
      // 3. Fallback to UI Avatars service
      const name = encodeURIComponent(playerName);
      return `https://ui-avatars.com/api/?name=${name}&background=ca8a04&color=1e293b&size=128&bold=true`;
    }

    // 5. Combine players with their sources and enrichment data
    const combinedPlayers = playersRaw.map(player => {
      const id = parseInt(player.id, 10);
      // Look up enrichment data by name + school
      const enrichmentKey = `${player.name.toLowerCase()}|${player.school.toLowerCase()}`;
      const enrichment = enrichmentMap[enrichmentKey] || {};

      return {
        id: id,
        name: player.name,
        pos: player.pos,
        position: player.pos,
        school: player.school,
        year: enrichment.year || '',
        size: enrichment.size || '',
        weight: enrichment.weight || '',
        speed: enrichment.speed || '',
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
        initials: getInitials(player.name),
        photoUrl: getPhotoUrl(player.name, enrichment),
        summary: enrichment.summary || ''
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
