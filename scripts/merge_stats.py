import pandas as pd
import requests
import os
import sys

def run_draft_pipeline():
    # URL for Page 1 (Top 100 Prospects)
    url = "https://www.drafttek.com/2026-NFL-Draft-Big-Board/Top-NFL-Draft-Prospects-2026-Page-1.asp"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try:
        print("Connecting to Drafttek 2026 Big Board...")
        response = requests.get(url, headers=headers, timeout=15)
        
        # Drafttek uses a standard table. read_html finds it automatically.
        # We look for the table that contains the word 'Prospect'
        tables = pd.read_html(response.text, match='Prospect')
        df = tables[0]

        # 1. CLEANING THE DATA
        # Drafttek columns are: Rank, CNG, Prospect, College, POS, Ht, Wt, CLS...
        df = df.rename(columns={
            'Prospect': 'player',
            'POS': 'pos',
            'Rank': 'rank'
        })

        # 2. FILTERING (Screen out OL)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        print(f"Filtering out OL players...")
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()

        # 3. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(str(r['pos']).upper(), 1.0), 2), axis=1
        )

        # 4. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} players from Drafttek.")

    except Exception as e:
        print(f"❌ Drafttek Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
