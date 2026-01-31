import pandas as pd
import requests
import os
import sys
from io import StringIO

def run_draft_pipeline():
    url = "https://www.drafttek.com/2026-NFL-Draft-Big-Board/Top-NFL-Draft-Prospects-2026-Page-1.asp"
    headers = {'User-Agent': 'Mozilla/5.0'}

    try:
        print("Scraping Drafttek 2026 Big Board...")
        response = requests.get(url, headers=headers, timeout=15)
        
        # FIX: Wrap response.text in StringIO to avoid the FutureWarning
        # match='Prospect' ensures we grab the player table
        tables = pd.read_html(StringIO(response.text), match='Prospect')
        df = tables[0]

        # STEP 1: NORMALIZE COLUMNS (Case-insensitive)
        df.columns = df.columns.str.strip().str.lower()
        
        # STEP 2: RENAME FOR DASHBOARD
        df = df.rename(columns={'prospect': 'player', 'pos': 'pos', 'rank': 'rank'})

        # STEP 3: THE "BRICK WALL" FIX
        # Force 'pos' to be a string to prevent the AttributeError
        # Then clean it up for filtering
        df['pos'] = df['pos'].astype(str).str.strip().str.upper()

        # STEP 4: FILTERING (Screen out Offensive Linemen)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL', 'OC', 'NAN']
        df_filtered = df[~df['pos'].isin(ol_positions)].copy()

        # STEP 5: FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'], 1.0), 2), axis=1
        )

        # STEP 6: SAVE
        os.makedirs('data', exist_ok=True)
        df_filtered.to_csv('data/prospects_test_2025.csv', index=False)
        print(f"✅ Success! Captured {len(df_filtered)} players for 2026.")

    except Exception as e:
        print(f"❌ Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
