/**
 * supabase-client.js
 *
 * Replaces csv-loader.js as the player data source.
 * Fetches players directly from the Supabase `players` table
 * and applies the same scoring logic the CSV loader used.
 *
 * Exposes:
 *   window.OD.loadPlayers(draftYear?)  → Promise<Player[]>
 *   window.loadPlayersFromCSV()        → same (backward-compat alias)
 */

(function () {
  const SUPABASE_URL  = 'https://sxshiqyxhhifvtfqawbq.supabase.co';
  const ANON_KEY      = 'sb_publishable_5p-lnHKiF1NBaAvoTwO4kA_9bkPrs1-';
  const DEFAULT_YEAR  = '2026';

  // ── Scoring helpers (identical to csv-loader.js) ─────────────────────────

  function calculateTier(rank) {
    if (rank <= 10)  return 1;
    if (rank <= 32)  return 2;
    if (rank <= 64)  return 3;
    if (rank <= 100) return 4;
    if (rank <= 150) return 5;
    if (rank <= 224) return 6;
    return 7;
  }

  function calculateGrade(rank) {
    if (rank <= 5)   return Math.round((9.0 + (6 - rank) * 0.2) * 10) / 10;
    if (rank <= 10)  return Math.round((8.5 + (11 - rank) * 0.1) * 10) / 10;
    if (rank <= 32)  return Math.round((7.0 + (33 - rank) * 0.07) * 10) / 10;
    if (rank <= 64)  return Math.round((6.0 + (65 - rank) * 0.03) * 10) / 10;
    if (rank <= 100) return Math.round((5.0 + (101 - rank) * 0.03) * 10) / 10;
    if (rank <= 224) return Math.round((3.0 + (225 - rank) * 0.016) * 10) / 10;
    return Math.max(1.0, Math.round((3.0 - (rank - 224) * 0.01) * 10) / 10);
  }

  const positionValues = {
    QB: 1.5, EDGE: 1.3, DE: 1.3, OT: 1.25, T: 1.25, WR: 1.2, CB: 1.15,
    DT: 1.1, DL: 1.1, IDL: 1.1, LB: 1.05, ILB: 1.05, OLB: 1.05,
    S: 1.0, TE: 0.95, IOL: 0.9, OG: 0.9, G: 0.9, C: 0.9,
    RB: 0.85, K: 0.5, P: 0.5
  };

  const fantasyPositionMultipliers = {
    QB: 2.0, RB: 1.90, WR: 1.75, TE: 1.5, K: 0.5,
    DE: 0.35, EDGE: 0.35, LB: 0.30, ILB: 0.30, OLB: 0.30,
    DB: 0.25, S: 0.25, CB: 0.25, DL: 0.2, DT: 0.2, IDL: 0.2,
    OT: 0.15, T: 0.15, IOL: 0.15, OG: 0.15, G: 0.15, C: 0.15, OL: 0.15, P: 0.2
  };

  function getFantasyMultiplier(pos) {
    return fantasyPositionMultipliers[pos] || 0.3;
  }

  function calculateDraftScore(rank, pos) {
    const posValue = positionValues[pos] || 1.0;
    const base = Math.max(0, (250 - rank) / 25);
    return Math.round(base * posValue * 100) / 100;
  }

  function getPhotoUrl(name, espnId, photoUrl) {
    if (photoUrl) return photoUrl;
    if (espnId)   return `https://a.espncdn.com/i/headshots/college-football/players/full/${espnId}.png`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ca8a04&color=1e293b&size=128&bold=true`;
  }

  function getHighlightUrl(name, school) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} ${school} football highlights 2025`)}`;
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // ── Supabase fetch ────────────────────────────────────────────────────────

  async function fetchFromSupabase(draftYear) {
    const url = `${SUPABASE_URL}/rest/v1/players?draft_year=eq.${encodeURIComponent(draftYear)}&order=rank.asc&limit=500`;
    const res = await fetch(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept': 'application/json',
      }
    });
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  // ── Transform DB row → player object ─────────────────────────────────────

  function rowToPlayer(row, index) {
    const rank  = row.rank  || (index + 1);
    const pos   = row.pos   || '';
    const name  = row.name  || '';
    const school = row.school || '';

    const tier         = calculateTier(rank);
    const grade        = calculateGrade(rank);
    const draftScore   = calculateDraftScore(rank, pos);
    const fantasyMult  = getFantasyMultiplier(pos);
    const fantasyRank  = Math.round(rank / fantasyMult);
    const rankChange   = row.previous_rank ? (row.previous_rank - rank) : 0;

    return {
      id:               row.id || (index + 1),
      name,
      pos,
      position:         pos,
      school,
      year:             row.year_in_school || '',
      size:             row.size           || '',
      weight:           row.weight         || '',
      speed:            row.speed          || '',
      tier,
      rank,
      previousRank:     row.previous_rank  || null,
      rankChange,
      consensusRank:    rank,
      fantasyRank,
      sourceCount:      Array.isArray(row.sources) ? row.sources.length : 1,
      grade,
      isGenerational:   rank <= 5 && grade >= 9.0,
      fantasyMultiplier: fantasyMult,
      draftScore,
      sources:          Array.isArray(row.sources) ? row.sources : [],
      highlightUrl:     getHighlightUrl(name, school),
      initials:         getInitials(name),
      photoUrl:         getPhotoUrl(name, row.espn_id, row.photo_url),
      summary:          row.summary || '',
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async function loadPlayers(draftYear) {
    const year = draftYear || DEFAULT_YEAR;
    console.log(`[OD] Fetching players from Supabase (draft_year=${year}) …`);
    const rows = await fetchFromSupabase(year);
    console.log(`[OD] Received ${rows.length} rows`);
    const players = rows.map(rowToPlayer);
    players.sort((a, b) => a.rank - b.rank);
    const up   = players.filter(p => p.rankChange > 0).length;
    const down = players.filter(p => p.rankChange < 0).length;
    console.log(`[OD] ✓ ${players.length} players loaded | ↑${up} up ↓${down} down`);
    return players;
  }

  // Expose namespace + backward-compat alias so index.html needs no changes
  window.OD = window.OD || {};
  window.OD.loadPlayers = loadPlayers;
  window.loadPlayersFromCSV = loadPlayers;   // backward-compat alias

  console.log('[OD] supabase-client.js ready');
})();
