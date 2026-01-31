import pandas as pd
import requests
import os
import sys

def run_draft_pipeline():
    # PFF's 2026 Big Board Data URL (This is the underlying data feed)
    url = "https://www.pff.com/api/v1/draft/big_board?season=2026"
    
    # These headers are essential to make PFF think you're a real visitor
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.pff.com/draft/big-board?season=2026'
    }

    try:
        print("Requesting 2026 PFF Big Board Data...")
        response = requests.get(url, headers=headers, timeout=20)
        
        if response.status_code != 200:
            print(f"PFF Blocked the request. Code: {response.status_code}")
            # If the API fails, we exit gracefully but tell the action it failed
            sys.exit(1)

        data = response.json()
        
        # PFF's JSON usually contains a 'prospects' list
        prospects = data.get('prospects', [])
        
        if not prospects:
            raise ValueError("Data received but no prospects found.")

        # Convert to DataFrame
        df = pd.DataFrame(prospects)

        # 1. STANDARDIZE COLUMNS
        # PFF API keys are usually lowercase/underscored: 'player_name', 'position', 'rank'
        df = df.rename(columns={
            'player_name': 'player',
            'position': 'pos',
            'overall_rank': 'rank'
        })

        # 2. FILTERING (Screen out OL)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()

        # 3. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'].upper(), 1.0), 2), axis=1
        )

        # 4. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} PFF prospects for 2026.")

    except Exception as e:
        print(f"❌ PFF Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
