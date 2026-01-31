async function loadPlayersFromCSV() {
  try {
    // 1. Point to the NEW file path created by the GitHub Action
    const response = await fetch('./data/prospects_test_2025.csv');

    if (!response.ok) {
      throw new Error('Failed to load automated CSV file');
    }

    const csvText = await response.text();

    // 2. Parse CSV (Simplified logic)
    function parseCSV(text) {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map(line => {
        // Simple split handles most draft CSVs; 
        // using your regex-style split if you have quoted player names
        const values = line.split(','); 
        const obj = {};
        
        headers.forEach((header, index) => {
          let value = values[index] ? values[index].trim() : '';
          
          // MAP NEW HEADERS TO YOUR OLD APP'S EXPECTED NAMES
          // Example: Python 'consensus_rank' becomes your app's 'rank'
          if (header === 'consensus_rank') {
            obj['rank'] = parseInt(value, 10);
            obj['consensusRank'] = parseFloat(value);
          } else if (header === 'player_name') {
            obj['name'] = value;
          } else if (header === 'pos') {
            obj['position'] = value;
          } else {
            obj[header] = value;
          }
        });
        
        // Ensure sources is an empty array so your frontend doesn't crash
        obj['sources'] = []; 
        return obj;
      });
    }

    const combinedPlayers = parseCSV(csvText);
    console.log(`Successfully loaded ${combinedPlayers.length} prospects from automated feed.`);

    return combinedPlayers;

  } catch (error) {
    console.error('Error loading automated data:', error);
    throw error;
  }
}
