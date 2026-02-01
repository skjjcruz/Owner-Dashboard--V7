#!/usr/bin/env node
/**
 * ESPN Player ID Fetcher
 * Run this script locally (outside of proxy-restricted environments) to fetch ESPN IDs for all players.
 *
 * Usage: node scripts/fetch-espn-ids.js
 * Output: Updates players.csv with espn_id column
 */

const fs = require('fs');
const https = require('https');

// Rate limiting delay (ms)
const DELAY = 300;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchESPN(playerName, school) {
  const searchQuery = encodeURIComponent(`${playerName} ${school}`);
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/athletes?search=${searchQuery}`;

  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const athletes = json.athletes || [];

          // Find best match
          for (const athlete of athletes) {
            const athleteName = (athlete.fullName || '').toLowerCase();
            const athleteSchool = (athlete.team?.displayName || '').toLowerCase();

            if (playerName.toLowerCase().includes(athleteName.split(' ')[1]) ||
                athleteName.includes(playerName.toLowerCase().split(' ')[1])) {
              resolve(athlete.id);
              return;
            }
          }

          // Return first result if any
          if (athletes.length > 0) {
            resolve(athletes[0].id);
            return;
          }

          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log('ESPN Player ID Fetcher');
  console.log('======================\n');

  // Read players.csv
  const csvPath = './players.csv';
  if (!fs.existsSync(csvPath)) {
    console.error('Error: players.csv not found');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  // Add espn_id column if not present
  if (!headers.includes('espn_id')) {
    headers.push('espn_id');
  }
  const espnIdIndex = headers.indexOf('espn_id');
  const nameIndex = headers.indexOf('name');
  const schoolIndex = headers.indexOf('school');

  console.log(`Processing ${lines.length - 1} players...\n`);

  const newLines = [headers.join(',')];
  let found = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const name = values[nameIndex];
    const school = values[schoolIndex];

    process.stdout.write(`[${i}/${lines.length - 1}] ${name} (${school})... `);

    const espnId = await searchESPN(name, school);

    // Ensure values array is long enough
    while (values.length < headers.length) {
      values.push('');
    }
    values[espnIdIndex] = espnId || '';

    if (espnId) {
      found++;
      console.log(`Found: ${espnId}`);
    } else {
      console.log('Not found');
    }

    newLines.push(values.join(','));
    await sleep(DELAY);
  }

  // Write updated CSV
  fs.writeFileSync(csvPath, newLines.join('\n'));

  console.log(`\n======================`);
  console.log(`Done! Found ESPN IDs for ${found}/${lines.length - 1} players`);
  console.log(`Updated: ${csvPath}`);
}

main().catch(console.error);
