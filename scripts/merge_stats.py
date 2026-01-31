import pandas as pd
import os
import sys

def run_draft_pipeline():
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
    
    try:
        print("Downloading data...")
        df = pd.read_csv(url, low_memory=False)

        # FIX: Check if 'year' exists, otherwise use 'season' or skip filtering
        year_col = 'year' if 'year' in df.columns else ('season' if 'season' in df.columns else None)
        
        if year_col:
            print(f"Filtering by {year_col} 2025...")
            df_2025 = df[(df[year_col] == 2025) & (~df['pos'].isin(ol_positions))].copy()
        else:
            print("Warning: No year/season column found. Filtering by position only.")
            df_2025 = df[~df['pos'].isin(ol_positions)].copy()

        # Simple Fantasy Rank
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_2025['fantasy_rank'] = df_2025.apply(
            lambda r: round(r['consensus_rank'] / multipliers.get(r['pos'], 1.0), 2) 
            if 'consensus_rank' in r and pd.notnull(r['consensus_rank']) else 999, axis=1
        )

        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_2025.to_csv(output_path, index=False)
        print(f"✅ Success! Created {output_path} with {len(df_2025)} players.")

    except Exception as e:
        print(f"❌ Error during processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
