/**
 * CSV Loader - Simplified V7 Version
 *
 * This system uses two CSV files:
 * 1. players.csv - Simple 3-column file (name, pos, school) in ranked order
 *    - Row number = rank (row 1 = #1 pick)
 *    - Easy to update from NFL Mock Draft Database
 *
 * 2. player-enrichment.csv - Persistent data that survives ranking updates
 *    - Number (previousRank for tracking movement)
 *    - ESPN IDs, photos, summaries, physical attributes, fantasyMultiplier
 *
 * All scoring (tier, grade, draftScore, fantasyRank) is calculated from rank position.
 */

async function loadPlayersFromCSV() {
  try {
    // Helper function to parse CSV (handles quoted fields with commas)
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map((line, index) => {
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

        const obj = { _rowIndex: index + 1 }; // Track row number (1-based)
        headers.forEach((header, idx) => {
          obj[header] = values[idx] ? values[idx].trim() : '';
        });
        return obj;
      });
    }

    // ============================================
    // SCORING CALCULATIONS (derived from rank)
    // ============================================

    // Calculate tier based on rank
    function calculateTier(rank) {
      if (rank <= 10) return 1;      // Elite prospects
      if (rank <= 32) return 2;      // First round
      if (rank <= 64) return 3;      // Second round
      if (rank <= 100) return 4;     // Day 2
      if (rank <= 150) return 5;     // Day 3
      if (rank <= 224) return 6;     // Late Day 3
      return 7;                       // UDFA territory
    }

    // Calculate grade based on rank (10.0 = best, scales down)
    function calculateGrade(rank) {
      if (rank <= 5) return 9.0 + (6 - rank) * 0.2;   // 9.0-10.0 for top 5
      if (rank <= 10) return 8.5 + (11 - rank) * 0.1; // 8.5-9.0 for 6-10
      if (rank <= 32) return 7.0 + (33 - rank) * 0.07; // 7.0-8.5 for 11-32
      if (rank <= 64) return 6.0 + (65 - rank) * 0.03; // 6.0-7.0 for 33-64
      if (rank <= 100) return 5.0 + (101 - rank) * 0.03; // 5.0-6.0 for 65-100
      if (rank <= 224) return 3.0 + (225 - rank) * 0.016; // 3.0-5.0 for 101-224
      return Math.max(1.0, 3.0 - (rank - 224) * 0.01); // Below 3.0 for UDFA
    }

    // Position value multipliers for draft score (NFL draft value)
    const positionValues = {
      'QB': 1.5,
      'EDGE': .65, 'DE': .65
      'OT': 1.25, 'T': 1.25,
      'WR': 1.2,
      'CB': .45,
      'DT': .11, 'DL': 1.1, 'IDL': 1.1,
      'LB': .42, 'ILB': .42, 'OLB': .42,
      'S': .45,
      'TE':1.0,
      'IOL': 0.9, 'OG': 0.9, 'G': 0.9, 'C': 0.9,
      'RB': 1.25,
      'K': 0.5, 'P': 0.5
    };

    // Fantasy position multipliers (based on PPG analysis)
    // Higher = more fantasy valuable, QB is baseline at 1.0
    const fantasyPositionMultipliers = {
      'QB': 1.0,
      'RB': 0.672,
      'WR': 0.494,
      'K': 0.477,
      'TE': 0.438,
      'DE': 0.409, 'EDGE': 0.409,
      'LB': 0.346, 'ILB': 0.346, 'OLB': 0.346,
      'DL': 0.317, 'IDL': 0.317,
      'DB': 0.285, 'S': 0.285,
      'CB': 0.265,
      'DT': 0.265,
      // OL positions have very low fantasy value
      'OT': 0.15, 'T': 0.15, 'IOL': 0.15, 'OG': 0.15, 'G': 0.15, 'C': 0.15, 'OL': 0.15,
      'P': 0.2
    };

    // Get fantasy multiplier for a position
    function getFantasyMultiplier(pos) {
      return fantasyPositionMultipliers[pos] || 0.3; // Default for unknown positions
    }

    // Calculate draft score (combines rank and position value)
    function calculateDraftScore(rank, pos) {
      const posValue = positionValues[pos] || 1.0;
      const baseScore = Math.max(0, (250 - rank) / 25); // 0-10 scale based on rank
      return Math.round(baseScore * posValue * 100) / 100;
    }

    // Determine if player is generational talent
    function isGenerational(rank, grade) {
      return rank <= 5 && grade >= 9.0;
    }

    // ============================================
    // LOAD DATA FILES
    // ============================================

    // 1. Fetch main player data - try both players.csv and player.csv
    let playersText = null;
    let playersResponse = await fetch('./players.csv');
    if (playersResponse.ok) {
      playersText = await playersResponse.text();
      console.log('Loaded players.csv');
    } else {
      // Try alternate filename
      playersResponse = await fetch('./player.csv');
      if (playersResponse.ok) {
        playersText = await playersResponse.text();
        console.log('Loaded player.csv');
      } else {
        throw new Error('Failed to load player data: neither players.csv nor player.csv found');
      }
    }
    const playersRaw = parseCSV(playersText);

    // Detect if this has a Rank column (case-insensitive check)
    const hasRankColumn = playersRaw.length > 0 && (
      playersRaw[0].hasOwnProperty('rank') ||
      playersRaw[0].hasOwnProperty('Rank') ||
      playersRaw[0].hasOwnProperty('RANK')
    );
    console.log(`Players file format: ${hasRankColumn ? 'Has Rank column' : 'Row order = rank'}`);
    console.log(`Columns detected:`, playersRaw.length > 0 ? Object.keys(playersRaw[0]) : 'none');
    // 2. Fetch source rankings (optional - for backwards compatibility)
    let sourcesMap = {};
    try {
      const sourcesResponse = await fetch('./player-sources.csv');
      if (sourcesResponse.ok) {
        const sourcesText = await sourcesResponse.text();
        const sourcesRaw = parseCSV(sourcesText);
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
      }
    } catch (err) {
      // Sources file is optional in new system
    }

    // 3. Fetch enrichment data (ESPN IDs, photos, summaries, previousRank)
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
            previousRank: parseInt(e.Number, 10) || null, // New: track previous rank
            espn_id: e.espn_id || '',
            photo_url: e.photo_url || '',
            summary: e.summary || '',
            year: e.year || '',
            size: e.size || '',
            weight: e.weight || '',
            speed: e.speed || '',
            fantasyMultiplier: parseFloat(e.fantasyMultiplier) || 1.0
          };
        });
        console.log(`Enrichment data loaded: ${Object.keys(enrichmentMap).length} players`);
      }
    } catch (err) {
      console.warn('Could not load player-enrichment.csv, continuing without enrichment data');
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    // Generate YouTube search URL for highlights
    function getHighlightUrl(name, school) {
      const query = encodeURIComponent(`${name} ${school} football highlights 2025`);
      return `https://www.youtube.com/results?search_query=${query}`;
    }

    // Get player initials for avatar fallback
    function getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Get player photo URL (priority: custom > ESPN > UI Avatars)
    function getPhotoUrl(playerName, enrichment) {
      if (enrichment && enrichment.photo_url) {
        return enrichment.photo_url;
      }
      if (enrichment && enrichment.espn_id) {
        return `https://a.espncdn.com/i/headshots/college-football/players/full/${enrichment.espn_id}.png`;
      }
      const name = encodeURIComponent(playerName);
      return `https://ui-avatars.com/api/?name=${name}&background=ca8a04&color=1e293b&size=128&bold=true`;
    }

    // Calculate rank change (positive = moved up, negative = moved down)
    function calculateRankChange(currentRank, previousRank) {
      if (!previousRank || previousRank === currentRank) return 0;
      return previousRank - currentRank; // Positive means improved (lower rank = better)
    }

    // ============================================
    // BUILD PLAYER OBJECTS
    // ============================================

    const combinedPlayers = playersRaw.map((player, index) => {
      // Determine rank: use Rank column if present, otherwise use row index
      const rank = hasRankColumn
        ? (parseInt(player.rank || player.Rank || player.RANK, 10) || index + 1)
        : (index + 1);

      // Get player name (handle many variations including "Player Name" with space)
      const name = player.name || player.Name || player.player || player.Player ||
                   player['Player Name'] || player['player name'] || player['PLAYER NAME'] || '';

      // Get position (handle variations)
      const pos = player.pos || player.Pos || player.position || player.Position ||
                  player.POS || player.POSITION || '';

      // Get school (handle variations including "College")
      const school = player.school || player.School || player.college || player.College ||
                     player.SCHOOL || player.COLLEGE || '';

      // Look up enrichment data by name + school
      const enrichmentKey = `${name.toLowerCase()}|${school.toLowerCase()}`;
      const enrichment = enrichmentMap[enrichmentKey] || {};

      // Calculate all scores from rank
      const tier = calculateTier(rank);
      const grade = Math.round(calculateGrade(rank) * 10) / 10;
      const draftScore = calculateDraftScore(rank, pos);
      const generational = isGenerational(rank, grade);

      // Fantasy rank: apply position multiplier (use enrichment override if set, otherwise position-based)
      const fantasyMultiplier = enrichment.fantasyMultiplier || getFantasyMultiplier(pos);
      const fantasyRank = Math.round(rank / fantasyMultiplier);

      // Calculate rank change for arrows
      const rankChange = calculateRankChange(rank, enrichment.previousRank);

      return {
        id: hasRankColumn ? (parseInt(player.id, 10) || index + 1) : (index + 1),
        name: name,
        pos: pos,
        position: pos,
        school: school,
        year: enrichment.year || '',
        size: enrichment.size || '',
        weight: enrichment.weight || '',
        speed: enrichment.speed || '',
        tier: tier,
        rank: rank,
        previousRank: enrichment.previousRank || null,
        rankChange: rankChange, // Positive = moved up, negative = moved down
        consensusRank: rank, // In simple mode, consensus = current rank
        fantasyRank: fantasyRank,
        sourceCount: hasRankColumn ? (parseInt(player.sourceCount, 10) || 1) : 1,
        grade: grade,
        isGenerational: generational,
        fantasyMultiplier: fantasyMultiplier,
        draftScore: draftScore,
        sources: sourcesMap[index + 1] || [],
        highlightUrl: getHighlightUrl(name, school),
        initials: getInitials(name),
        photoUrl: getPhotoUrl(name, enrichment),
        summary: enrichment.summary || ''
      };
    });

    // Sort by rank to ensure correct order
    combinedPlayers.sort((a, b) => a.rank - b.rank);

    console.log(`--- V7 DATA SYNC SUCCESS ---`);
    console.log(`Players Loaded: ${combinedPlayers.length}`);
    console.log(`Sample Player:`, combinedPlayers[0]);

    // Log rank changes summary
    const movedUp = combinedPlayers.filter(p => p.rankChange > 0).length;
    const movedDown = combinedPlayers.filter(p => p.rankChange < 0).length;
    const unchanged = combinedPlayers.filter(p => p.rankChange === 0 && p.previousRank).length;
    console.log(`Rank Changes: ↑${movedUp} moved up, ↓${movedDown} moved down, ${unchanged} unchanged`);

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
