const fs = require('fs');
const path = require('path');

// Function to parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  // Get headers from first line
  const headers = lines[0].split(',');

  // Parse each line into an object
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj = {};

    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : '';
    });

    data.push(obj);
  }

  return data;
}

// Function to convert CSV data to player format
function convertToPlayerFormat(csvData) {
  return csvData.map((row, index) => {
    // Extract height and convert to format like "6'2""
    let size = '';
    if (row.Height) {
      const height = row.Height.replace(/"/g, '');
      const parts = height.split("'");
      if (parts.length === 2) {
        size = `${parts[0]}'${parts[1]}"`;
      } else {
        size = height;
      }
    }

    // Parse weight
    const weight = row.Weight ? parseInt(row.Weight) : null;

    // Parse 40 time (speed)
    const speed = row['40 Time'] ? parseFloat(row['40 Time']) : null;

    // Determine tier based on rank
    let tier = 1;
    const rank = parseInt(row.Rank);
    if (rank > 100) {
      tier = 3;
    } else if (rank > 30) {
      tier = 2;
    }

    return {
      id: index + 1,
      name: row['Player Name'] || '',
      pos: row.Position || '',
      school: row.College || '',
      size: size || '',
      weight: weight,
      speed: speed,
      tier: tier,
      rank: rank,
      year: row.Year || '',
      remarks: row.Remarks || ''
    };
  });
}

// Main execution
try {
  console.log('Processing rankings CSV...');

  // Find CSV file
  const csvFile = '2026-Dynasty.csv';

  if (!fs.existsSync(csvFile)) {
    console.error(`CSV file not found: ${csvFile}`);
    process.exit(1);
  }

  // Parse CSV
  const csvData = parseCSV(csvFile);
  console.log(`Parsed ${csvData.length} players from CSV`);

  // Convert to player format
  const players = convertToPlayerFormat(csvData);

  // Write to JSON file
  const outputFile = 'players-final.json';
  fs.writeFileSync(outputFile, JSON.stringify(players, null, 2));
  console.log(`Successfully wrote ${players.length} players to ${outputFile}`);

} catch (error) {
  console.error('Error processing rankings:', error);
  process.exit(1);
}
