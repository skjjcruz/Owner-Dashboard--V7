/**
 * CSV Loader - Automated V7 Version
 * This script pulls from the new /data/ folder and maps Python-calculated 
 * fantasy ranks and industry sources to the dashboard.
 */

async function loadPlayersFromCSV() {
  try {
    // 1. Fetch the single automated CSV file from the v7 data folder
    const response = await fetch('./data/prospects_test_2025.csv');

    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    /**
     * Parse CSV helper function
     * Specifically handles quoted player names and the | symbol for industry sources
     */
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map(line => {
        const values = [];
        let currentValue = '';
        let insideQuotes = false;

        // Robust parsing for fields with commas inside quotes (like player names)
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
          let value = values[index] ? values[index].trim() : '';

          // A. MAP NEW HEADERS TO APP KEYS
          if (header === 'player_name') {
            obj['name'] = value;
          } else if (header === 'pos') {
            obj['position'] = value;
          } else if (header === 'consensus_rank') {
            obj['rank'] = parseInt(value, 10) || 999;
            obj['consensusRank'] = parseFloat(value) || 999;
          } else if (header === 'fantasy_rank') {
            obj['fantasyRank'] = parseFloat(value) || 999;
          } 
          
          // B. HANDLE INDUSTRY SOURCES (The "Click for Info" feature)
          else if (header === 'industry_sources') {
            if (value) {
              // Converts "ESPN:1|PFF:3" -> [{source: 'ESPN', rank: 1, weight: 1.0}, ...]
              obj['sources'] = value.split('|').map(s => {
                const [sourceName, sourceRank] = s.split(':');
                return {
                  source: sourceName,
                  rank: parseInt(sourceRank, 10),
                  weight: 1.0 // Default weight for calculations
                };
              });
            } else {
              obj['sources'] = [];
            }
          }
          
          // C. PASS-THROUGH FOR OTHER FIELDS (school, standard_deviation, etc.)
          else {
            obj[header] = value;
          }
        });

        // Ensure essential fields exist to prevent UI crashes
        if (!obj['sources']) obj['sources'] = [];
        if (!obj['id']) obj['id'] = obj['player_id'] || Math.random();

        return obj;
      });
    }

    const combinedPlayers = parseCSV(csvText);
    
    console.log(`--- V7 DATA SYNC SUCCESS ---`);
    console.log(`Players Loaded: ${combinedPlayers.length}`);
    console.log(`Sample Player:`, combinedPlayers[0]);

    return combinedPlayers;

  } catch (error) {
    console.error('Error loading players from v7 CSV:', error);
    throw error;
  }
}

// Export for module usage or expose globally for the dashboard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadPlayersFromCSV };
} else {
  window.loadPlayersFromCSV = loadPlayersFromCSV;
}
