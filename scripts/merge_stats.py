import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import sys

def run_draft_pipeline():
    # The live URL for Jack's 2025 Consensus Big Board
    url = "https://jacklich10.com/bigboard/nfl/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try:
        print("Connecting to Jack Lichtenstein's 2025 Big Board...")
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            raise ConnectionError(f"Could not reach the site. Status code: {response.status_code}")

        # Jack's site often uses a standard HTML table for the 'Consensus' view
        # We'll use Pandas to grab all tables and find the one with player data
        tables = pd.read_html(response.text)
        
        # Usually, the main board is the first or largest table
        df = max(tables, key=len)

        # 1. CLEANING & COLUMN MATCHING
        # Standardize column names (Jack usually uses 'Player', 'Pos', and 'Rank')
        df.columns = [c.strip() for c in df.columns]
        
        # Locate columns regardless of exact capitalization
        player_col = next((c for c in ['Player', 'Name', 'player'] if c in df.columns), None)
        pos_col = next((c for c in ['Pos', 'Position', 'pos'] if c in df.columns), None)
        rank_col = next((c for c in ['Rank', 'rank', 'Consensus Rank'] if c in df.columns), None)

        if not all([player_col, pos_col, rank_col]):
            print(f"Columns found: {df.columns.tolist()}")
            raise KeyError("Could not find required columns on Jack's site.")

        # 2. FILTERING (Screen out OL, Keep 2025 Stars)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df[pos_col].str.upper().isin(ol_positions)].copy()

        # 3. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        
        # Convert rank to numeric (Jack's ranks are sometimes strings)
        df_filtered[rank_col] = pd.to_numeric(df_filtered[rank_col], errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r[rank_col] / multipliers.get(str(r[pos_col]).upper(), 1.0), 2), axis=1
        )

        # 4. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} players from Jack's 2025 board.")

    except Exception as e:
        print(f"❌ JackLich Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
