/**
 * import-mock-drafts-to-supabase.js
 *
 * Seeds the `mock_draft_prospects` Supabase table from data/mock_draft_db.csv.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your_service_role_key \
 *   node scripts/import-mock-drafts-to-supabase.js
 *
 * Install dependencies first:
 *   npm install @supabase/supabase-js
 *
 * NOTE: Use the service_role key here (not the anon key) so the script can
 * bypass RLS and write all rows. Never commit the service_role key.
 */

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ---- Config ----------------------------------------------------------------
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CSV_PATH             = path.join(__dirname, '..', 'data', 'mock_draft_db.csv');
const BATCH_SIZE           = 100; // rows per upsert call
// ----------------------------------------------------------------------------

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function parseCSV(raw) {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

async function main() {
  console.log(`Reading ${CSV_PATH}…`);
  const raw  = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(raw);

  console.log(`Parsed ${rows.length} prospects.`);

  // Map CSV columns → table columns
  const mapped = rows.map(r => ({
    rank:        parseInt(r['Rank'], 10),
    player_name: r['Player Name'],
    position:    r['Position'],
    college:     r['College'] || null,
  })).filter(r => !isNaN(r.rank) && r.player_name);

  console.log(`Upserting ${mapped.length} rows in batches of ${BATCH_SIZE}…`);

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('mock_draft_prospects')
      .upsert(batch, { onConflict: 'rank' });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  Batch ${i / BATCH_SIZE + 1} / ${Math.ceil(mapped.length / BATCH_SIZE)} done.`);
  }

  console.log('Done — mock_draft_prospects table populated.');
}

main();
