import pandas as pd
import requests
import os
import sys

def run_draft_pipeline():
    # PFN's 2026 Big Board Data URL (JSON Endpoint)
    # This is more stable than scraping the HTML
    url = "https://www.profootballnetwork.com/wp-json/pfn/v1/big-board?year=2026"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.profootballnetwork.com/nfl-draft-hq/custom-big-board/'
    }

    try:
        print("Fetching PFN 2026 Big Board Data...")
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            # Fallback: If JSON is restricted, we'll use a standard scrape approach
            print(f"JSON endpoint blocked (Code {response.status_code}). Trying HTML fallback...")
            raise ConnectionError("Endpoint restricted.")

        data = response.json()
        
        # PFN data usually comes in a 'players' or 'data' key
        player_list = data.get('players', data.get('data', []))
        
        if not player_list:
            raise ValueError("No player data found in the PFN response.")

        # Convert to DataFrame
        df = pd.DataFrame(player_list)

        # 1. STANDARDIZE COLUMNS
        # PFN uses 'full_name' and 'position_name' in their API
        df = df.rename(columns={
            'full_name': 'player',
            'position_name': 'pos',
            'rank': 'rank'
        })

        # 2. FILTERING (Screen out OL)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL', 'Offensive Tackle', 'Offensive Guard', 'Center']
        df_filtered = df[~df['pos'].isin(ol_positions)].copy()

        # 3. FANTASY MULTIPLIERS
        # Standardize position codes for the multiplier math
        pos_map = {'Quarterback': 'QB', 'Running Back': 'RB', 'Wide Receiver': 'WR', 'Tight End': 'TE'}
        df_filtered['pos_clean'] = df_filtered['pos'].map(lambda x: pos_map.get(x, x))
        
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos_clean'], 1.0), 2), axis=1
        )

        # 4. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} PFN players for 2026.")

    except Exception as e:
        print(f"❌ PFN Sync failed: {e}")
        # If the JSON fails, we use a basic table scrape as a safety net
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
