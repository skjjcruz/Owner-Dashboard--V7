#!/usr/bin/env node
/**
 * migrate-to-supabase.js
 *
 * ONE-TIME admin script: reads V7's CSV files and upserts all players
 * into the Supabase `players` table in V10.
 *
 * USAGE
 *   SUPABASE_SERVICE_KEY=<your-service-role-key> node migrate-to-supabase.js
 *
 * The service role key is found in:
 *   Supabase dashboard → Settings → API → "service_role" key
 *
 * Re-running is safe — uses upsert on (draft_year, rank).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://sxshiqyxhhifvtfqawbq.supabase.co';
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_KEY;
const DRAFT_YEAR        = process.env.DRAFT_YEAR || '2026';
const BATCH_SIZE        = 50; // rows per upsert request

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required.');
  console.error('  Get it from: Supabase dashboard → Settings → API → service_role key');
  process.exit(1);
}

// ── CSV parser (handles quoted fields containing commas and newlines) ─────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        // Handle escaped double-quotes inside quoted fields
        if (inQuotes && line[c + 1] === '"') { current += '"'; c++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

// ── Source columns in player.csv (everything except core fields) ──────────────
const CORE_COLS = new Set(['rank','name','pos','exp','_rowindex']);

// ── Load CSVs ─────────────────────────────────────────────────────────────────
console.log('Reading player.csv …');
const playersRaw = parseCSV(readFileSync(join(__dirname, 'player.csv'), 'utf8'));
console.log(`  → ${playersRaw.length} players`);

console.log('Reading player-enrichment.csv …');
const enrichmentRaw = parseCSV(readFileSync(join(__dirname, 'player-enrichment.csv'), 'utf8'));
console.log(`  → ${enrichmentRaw.length} enrichment rows`);

// ── Build enrichment lookup (by lowercase name) ───────────────────────────────
const enrichmentMap = {};
enrichmentRaw.forEach(e => {
  const key = (e.name || '').toLowerCase().trim();
  if (key) {
    enrichmentMap[key] = {
      school:            e.school             || '',
      espn_id:           e.espn_id            || '',
      photo_url:         e.photo_url          || '',
      summary:           e.summary            || '',
      year_in_school:    e.year               || '',
      size:              e.size               || '',
      weight:            e.weight             || '',
      speed:             e.speed              || '',
      fantasy_multiplier: parseFloat(e.fantasyMultiplier) || 1.0,
      previous_rank:     parseInt(e.Number, 10) || null,
    };
  }
});
console.log(`  → ${Object.keys(enrichmentMap).length} unique enrichment keys`);

// ── Detect source columns (ATH, BR, CBS, DT, ESPN, PFF, PFN, SIS, Tank, SD) ──
const allCols = playersRaw.length > 0 ? Object.keys(playersRaw[0]) : [];
const sourceCols = allCols.filter(c => !CORE_COLS.has(c.toLowerCase()));
console.log(`Source columns detected: ${sourceCols.join(', ')}`);

// ── Build player rows ─────────────────────────────────────────────────────────
const players = playersRaw.map((raw, i) => {
  const rank = parseInt(raw.Rank || raw.rank, 10) || (i + 1);
  const name = (raw.Name || raw.name || '').trim();
  const pos  = (raw.Pos  || raw.pos  || '').trim();

  const enr = enrichmentMap[name.toLowerCase().trim()] || {};

  // Build sources array from source columns
  const sources = [];
  sourceCols.forEach(col => {
    const val = raw[col];
    if (val && val.trim() && val.trim() !== 'N/A' && val.trim() !== '-') {
      const r = parseFloat(val.trim());
      if (!isNaN(r)) sources.push({ source: col, rank: r, weight: 1.0 });
    }
  });

  return {
    draft_year:         DRAFT_YEAR,
    rank,
    name,
    pos,
    school:             enr.school            || '',
    year_in_school:     enr.year_in_school    || (raw.Exp || raw.exp || ''),
    previous_rank:      enr.previous_rank     || null,
    sources,
    size:               enr.size              || '',
    weight:             enr.weight            || '',
    speed:              enr.speed             || '',
    espn_id:            enr.espn_id           || '',
    photo_url:          enr.photo_url         || '',
    summary:            enr.summary           || '',
    fantasy_multiplier: enr.fantasy_multiplier ?? 1.0,
  };
});

console.log(`\nBuilt ${players.length} player rows for draft_year=${DRAFT_YEAR}`);
console.log('Sample:', JSON.stringify(players[0], null, 2));

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsertBatch(batch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
    method:  'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase error ${res.status}: ${body}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nUpserting to Supabase in batches of ${BATCH_SIZE} …`);

let inserted = 0;
for (let i = 0; i < players.length; i += BATCH_SIZE) {
  const batch = players.slice(i, i + BATCH_SIZE);
  process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 1}–${Math.min(i + BATCH_SIZE, players.length)}) … `);
  try {
    await upsertBatch(batch);
    inserted += batch.length;
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

console.log(`\nDone. ${inserted} players upserted into players table (draft_year=${DRAFT_YEAR}).`);
console.log('Re-run anytime rankings change — safe to run multiple times.');
